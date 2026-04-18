/**
 * Narrative builders — given a person/family record, produce a report (AST).
 * Data shaping only; no rendering. All person/family formatting goes through
 * models/wrap.js so output stays consistent with the rest of the app.
 */
import { buildAncestorTree, buildDescendantTree } from '../treeQuery.js';
import { buildPersonContext } from '../personContext.js';
import { getLocalDatabase } from '../LocalDatabase.js';
import { runPlausibilityChecks } from '../plausibility.js';
import { findRelationshipPath } from '../relationshipPath.js';
import { readConclusionType, readField, readRef, refType } from '../schema.js';
import { personSummary, familySummary, placeSummary, sourceSummary, lifeSpanLabel, Gender } from '../../models/index.js';
import { humanizeType } from '../../utils/humanizeType.js';
import { block, emptyReport } from './ast.js';

function nameOf(summaryOrPerson) {
  return summaryOrPerson?.fullName || 'No name recorded';
}

function nameOrFallback(summaryOrPerson, fallback) {
  return summaryOrPerson?.fullName || fallback || 'No name recorded';
}

function spanAnnotated(summary) {
  const label = lifeSpanLabel(summary);
  return label ? `(${label})` : '';
}

function genderLabel(g) {
  switch (g) {
    case Gender.Male:
      return 'Male';
    case Gender.Female:
      return 'Female';
    case Gender.Intersex:
      return 'Intersex';
    default:
      return 'Unknown';
  }
}

/**
 * PERSON SUMMARY — name, life dates, parents, partners, children, events table.
 */
export async function buildPersonSummary(recordName) {
  const ctx = await buildPersonContext(recordName);
  if (!ctx) return emptyReport('Person not found');
  const self = ctx.selfSummary;
  const report = emptyReport(`Person Summary — ${nameOf(self)}`);

  report.blocks.push(block.title(nameOf(self), 1));
  if (lifeSpanLabel(self)) report.blocks.push(block.paragraph(lifeSpanLabel(self)));
  report.blocks.push(block.spacer(6));

  const vitals = [];
  if (self.birthDate) vitals.push(`Born: ${self.birthDate}`);
  if (self.deathDate) vitals.push(`Died: ${self.deathDate}`);
  vitals.push(`Gender: ${genderLabel(self.gender)}`);
  if (vitals.length > 0) report.blocks.push(block.list(vitals));

  if (ctx.parents.length > 0) {
    report.blocks.push(block.title('Parents', 2));
    const items = [];
    for (const fam of ctx.parents) {
      if (fam.man) items.push(`Father: ${nameOf(fam.man)} ${spanAnnotated(fam.man)}`.trim());
      if (fam.woman) items.push(`Mother: ${nameOf(fam.woman)} ${spanAnnotated(fam.woman)}`.trim());
    }
    report.blocks.push(block.list(items));
  }

  if (ctx.families.length > 0) {
    report.blocks.push(block.title('Families', 2));
    for (const fam of ctx.families) {
      report.blocks.push(block.title(`With ${nameOf(fam.partner)} ${spanAnnotated(fam.partner)}`.trim(), 3));
      if (fam.children.length > 0) {
        report.blocks.push(block.list(fam.children.map((c) => `${nameOf(c)} ${spanAnnotated(c)}`.trim())));
      } else {
        report.blocks.push(block.paragraph('No children recorded.'));
      }
    }
  }

  if (ctx.events.length > 0) {
    report.blocks.push(block.title('Events', 2));
    report.blocks.push(
      block.table(
        ['Type', 'Date', 'Description'],
        ctx.events.map((e) => [
          humanizeType(e.fields?.conclusionType?.value || e.fields?.eventType?.value) || 'Event',
          e.fields?.date?.value || '',
          e.fields?.description?.value || '',
        ])
      )
    );
  }

  return report;
}

/**
 * ANCESTOR NARRATIVE — generation-by-generation rundown starting from proband.
 */
export async function buildAncestorNarrative(recordName, generations = 5) {
  const tree = await buildAncestorTree(recordName, generations);
  if (!tree) return emptyReport('Person not found');
  const report = emptyReport(`Ancestors of ${nameOf(tree.person)}`);
  report.blocks.push(block.title(report.title, 1));

  function line(node) {
    if (!node || !node.person) return 'No name recorded';
    const p = node.person;
    const years = [];
    if (p.birthDate) years.push('b. ' + p.birthDate);
    if (p.deathDate) years.push('d. ' + p.deathDate);
    return `${p.fullName}${years.length ? ' (' + years.join(', ') + ')' : ''}`;
  }

  function visit(node, gen, prefix) {
    if (!node || gen >= generations) return;
    if (gen > 0) {
      const relation = relationNameAt(gen, prefix);
      report.blocks.push(block.paragraph(`${relation}: ${line(node)}`));
    }
    if (node.father) visit(node.father, gen + 1, prefix + 'F');
    if (node.mother) visit(node.mother, gen + 1, prefix + 'M');
  }

  report.blocks.push(block.title('Proband', 2));
  report.blocks.push(block.paragraph(line(tree)));
  report.blocks.push(block.spacer(8));
  report.blocks.push(block.title('Ancestors', 2));
  visit(tree, 0, '');

  return report;
}

function relationNameAt(gen, path) {
  const last = path.slice(-1);
  const parent = last === 'F' ? 'Father' : last === 'M' ? 'Mother' : 'Parent';
  if (gen === 1) return parent;
  if (gen === 2) return `Grand${parent.toLowerCase()}`;
  if (gen === 3) return `Great-grand${parent.toLowerCase()}`;
  const greats = gen - 2;
  return `${greats}×-great-grand${parent.toLowerCase()}`;
}

/**
 * FAMILY GROUP SHEET — partner A, partner B, marriage info, children list.
 */
export async function buildFamilyGroupSheet(recordName) {
  const ctx = await buildPersonContext(recordName);
  if (!ctx || ctx.families.length === 0) return emptyReport('No families to summarize');
  const self = ctx.selfSummary;
  const report = emptyReport(`Family Group Sheet — ${nameOf(self)}`);
  report.blocks.push(block.title(report.title, 1));

  for (const fam of ctx.families) {
    report.blocks.push(block.title(`${nameOf(self)} & ${nameOf(fam.partner)}`, 2));
    if (fam.familySummary?.marriageDate) {
      report.blocks.push(block.paragraph(`Married: ${fam.familySummary.marriageDate}`));
    }

    const rows = fam.children.map((c) => [
      nameOf(c),
      genderLabel(c.gender),
      c.birthDate || '',
      c.deathDate || '',
    ]);
    if (rows.length > 0) {
      report.blocks.push(block.table(['Child', 'Gender', 'Born', 'Died'], rows));
    } else {
      report.blocks.push(block.paragraph('No children recorded.'));
    }
  }
  return report;
}

/**
 * PERSON EVENTS — direct person events plus family events from parent/spouse families.
 */
export async function buildPersonEventsReport(recordName) {
  const ctx = await buildPersonContext(recordName);
  if (!ctx) return emptyReport('Person not found');

  const db = getLocalDatabase();
  const rows = [];
  const seenEvents = new Set();

  for (const event of ctx.events) {
    if (seenEvents.has(event.recordName)) continue;
    seenEvents.add(event.recordName);
    rows.push(await eventReportRow(db, event, 'Personal event'));
  }

  const familyContexts = new Map();
  for (const family of ctx.parents) {
    addFamilyContext(familyContexts, family.family?.recordName, parentFamilyContextLabel(family));
  }
  for (const family of ctx.families) {
    addFamilyContext(familyContexts, family.family?.recordName, spouseFamilyContextLabel(family));
  }

  for (const [familyId, context] of familyContexts.entries()) {
    const { records } = await db.query('FamilyEvent', {
      referenceField: 'family',
      referenceValue: familyId,
      limit: 1000,
    });
    for (const event of records || []) {
      if (seenEvents.has(event.recordName)) continue;
      seenEvents.add(event.recordName);
      rows.push(await eventReportRow(db, event, context));
    }
  }

  rows.sort(
    (a, b) =>
      String(a[1]).localeCompare(String(b[1])) ||
      String(a[0]).localeCompare(String(b[0])) ||
      String(a[4]).localeCompare(String(b[4]))
  );

  const report = emptyReport(`Person Events — ${nameOf(ctx.selfSummary)}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${rows.length.toLocaleString()} events for ${nameOf(ctx.selfSummary)}`));
  report.blocks.push(block.table(['Type', 'Date', 'Place', 'Description', 'Context'], rows));
  return report;
}

/**
 * STORY REPORT — metadata, narrative sections, and related records.
 */
export async function buildStoryReport(recordName) {
  const db = getLocalDatabase();
  const story = recordName ? await db.getRecord(recordName) : null;
  if (!story || story.recordType !== 'Story') return emptyReport('Story not found');

  const title = storyTitle(story);
  const report = emptyReport(`Story Report — ${title}`);
  report.blocks.push(block.title(report.title, 1));

  report.blocks.push(block.title('Metadata', 2));
  report.blocks.push(
    block.table(
      ['Field', 'Value'],
      [
        ['Title', title],
        ['Subtitle', readField(story, ['subtitle'])],
        ['Author', readField(story, ['author', 'authorName'])],
        ['Date', readField(story, ['date', 'dateString'])],
        ['Record ID', story.recordName],
        ['Unique ID', readField(story, ['uniqueID', 'identifier'])],
      ]
    )
  );

  const storyText = readField(story, ['text', 'description', 'userDescription'], '');
  if (storyText) {
    report.blocks.push(block.title('Story Text', 2));
    appendTextParagraphs(report, storyText);
  }

  const { records: sectionRecords } = await db.query('StorySection', {
    referenceField: 'story',
    referenceValue: story.recordName,
    limit: 100000,
  });
  const sections = (sectionRecords || []).sort((a, b) => Number(readField(a, ['order'], 0)) - Number(readField(b, ['order'], 0)));

  report.blocks.push(block.title('Sections', 2));
  if (sections.length === 0) {
    report.blocks.push(block.paragraph('No story sections recorded.'));
  } else {
    sections.forEach((section, index) => {
      report.blocks.push(block.title(storySectionTitle(section, index), 3));
      appendTextParagraphs(report, readField(section, ['text', 'description'], ''), 'No section text recorded.');
    });
  }

  const relationRows = [];
  const { records: storyRelations } = await db.query('StoryRelation', {
    referenceField: 'story',
    referenceValue: story.recordName,
    limit: 100000,
  });
  for (const relation of storyRelations || []) {
    relationRows.push(await storyRelationRow(db, relation, 'Story'));
  }

  for (const [index, section] of sections.entries()) {
    const { records: sectionRelations } = await db.query('StorySectionRelation', {
      referenceField: 'storySection',
      referenceValue: section.recordName,
      limit: 100000,
    });
    const scope = `Section: ${storySectionTitle(section, index)}`;
    for (const relation of sectionRelations || []) {
      relationRows.push(await storyRelationRow(db, relation, scope));
    }
  }

  relationRows.sort(
    (a, b) =>
      String(a[0]).localeCompare(String(b[0])) ||
      String(a[1]).localeCompare(String(b[1])) ||
      String(a[2]).localeCompare(String(b[2]))
  );

  report.blocks.push(block.title('Relations', 2));
  report.blocks.push(block.table(['Scope', 'Target Type', 'Target', 'Record ID'], relationRows));
  return report;
}

/**
 * KINSHIP REPORT — shortest relationship path between two people.
 */
export async function buildKinshipReport(recordA, recordB) {
  const db = getLocalDatabase();
  const [personA, personB] = await Promise.all([
    recordA ? db.getRecord(recordA) : null,
    recordB ? db.getRecord(recordB) : null,
  ]);
  const summaryA = personSummary(personA);
  const summaryB = personSummary(personB);
  const labelA = nameOrFallback(summaryA, recordA || 'First person');
  const labelB = nameOrFallback(summaryB, recordB || 'Second person');
  const report = emptyReport(`Kinship — ${labelA} to ${labelB}`);
  report.blocks.push(block.title(report.title, 1));

  if (!recordA || !recordB) {
    report.blocks.push(block.paragraph('Select two people to calculate kinship.'));
    return report;
  }

  const path = await findRelationshipPath(recordA, recordB);
  if (!path) {
    report.blocks.push(block.paragraph(`No relationship path found between ${labelA} and ${labelB}.`));
    report.blocks.push(block.table(['Person A', 'Person B', 'Relationship'], [[labelA, labelB, 'No path found']]));
    return report;
  }

  report.blocks.push(block.paragraph(`Relationship: ${path.label || 'Related'}`));
  report.blocks.push(
    block.table(
      ['Step', 'Connection', 'Person', 'Life Span'],
      path.steps.map((step, index) => [
        String(index + 1),
        index === 0 ? 'Start' : pathEdgeLabel(step.edgeFromPrev),
        nameOf(step.person),
        lifeSpanLabel(step.person),
      ])
    )
  );
  return report;
}

/**
 * DESCENDANT NARRATIVE — descendants grouped by generation with children lists.
 */
export async function buildDescendantNarrative(recordName, generations = 4) {
  const tree = await buildDescendantTree(recordName, generations);
  if (!tree) return emptyReport('Person not found');
  const report = emptyReport(`Descendants of ${nameOf(tree.person)}`);
  report.blocks.push(block.title(report.title, 1));

  function visit(node, gen) {
    if (!node || !node.person || gen > generations) return;
    const header = gen === 0 ? 'Proband' : `Generation ${gen}`;
    report.blocks.push(block.title(`${header}: ${nameOf(node.person)}`, gen === 0 ? 2 : 3));
    for (const u of node.unions) {
      if (u.partner) {
        report.blocks.push(block.paragraph(`Married ${nameOf(u.partner)}`));
      }
      if (u.children.length > 0) {
        report.blocks.push(block.list(u.children.map((c) => nameOf(c.person))));
        for (const c of u.children) visit(c, gen + 1);
      }
    }
  }

  visit(tree, 0);
  return report;
}

export async function buildPersonsList() {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const rows = records
    .map(personSummary)
    .filter(Boolean)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((p) => [p.fullName, genderLabel(p.gender), p.birthDate || '', p.deathDate || '']);
  const report = emptyReport('Persons List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${rows.length.toLocaleString()} persons`));
  report.blocks.push(block.table(['Name', 'Gender', 'Born', 'Died'], rows));
  return report;
}

export async function buildPlacesList() {
  const db = getLocalDatabase();
  const { records } = await db.query('Place', { limit: 100000 });
  const rows = records
    .map(placeSummary)
    .filter(Boolean)
    .sort((a, b) => (a.displayName || a.name || '').localeCompare(b.displayName || b.name || ''))
    .map((p) => [p.displayName || p.name || '', p.shortName || '', p.geonameID || '']);
  const report = emptyReport('Places List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${rows.length.toLocaleString()} places`));
  report.blocks.push(block.table(['Place', 'Short Name', 'GeoName ID'], rows));
  return report;
}

export async function buildSourcesList() {
  const db = getLocalDatabase();
  const { records } = await db.query('Source', { limit: 100000 });
  const rows = records
    .map(sourceSummary)
    .filter(Boolean)
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    .map((s) => [s.title || '', s.date || '', trimText(s.text || '', 90)]);
  const report = emptyReport('Sources List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${rows.length.toLocaleString()} sources`));
  report.blocks.push(block.table(['Title', 'Date', 'Text'], rows));
  return report;
}

export async function buildEventsList() {
  const db = getLocalDatabase();
  const [personEvents, familyEvents] = await Promise.all([
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
  ]);
  const rows = [];
  for (const ev of [...personEvents.records, ...familyEvents.records]) {
    const owner = await eventOwnerLabel(db, ev);
    const place = await placeLabel(db, readRef(ev.fields?.place) || readRef(ev.fields?.assignedPlace));
    rows.push([
      readConclusionType(ev) || readField(ev, ['eventType', 'type']) || 'Event',
      readField(ev, ['date']) || '',
      owner,
      place,
      readField(ev, ['description', 'userDescription', 'text']) || '',
    ]);
  }
  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const report = emptyReport('Events List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${rows.length.toLocaleString()} events`));
  report.blocks.push(block.table(['Type', 'Date', 'Owner', 'Place', 'Description'], rows));
  return report;
}

export async function buildAnniversaryList() {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const rows = [];
  for (const record of records) {
    const p = personSummary(record);
    addAnniversary(rows, p, 'Birth', p?.birthDate);
    addAnniversary(rows, p, 'Death', p?.deathDate);
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2]));
  const report = emptyReport('Anniversary List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Month/Day', 'Type', 'Person', 'Year'], rows));
  return report;
}

export async function buildAhnentafelReport(recordName, generations = 6) {
  const tree = await buildAncestorTree(recordName, generations);
  if (!tree) return emptyReport('Person not found');
  const rows = [];
  function visit(node, number, generation) {
    if (!node?.person || generation > generations) return;
    rows.push([String(number), String(generation + 1), nameOf(node.person), node.person.birthDate || '', node.person.deathDate || '']);
    visit(node.father, number * 2, generation + 1);
    visit(node.mother, number * 2 + 1, generation + 1);
  }
  visit(tree, 1, 0);
  const report = emptyReport(`Ahnentafel — ${nameOf(tree.person)}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['#', 'Generation', 'Name', 'Born', 'Died'], rows.sort((a, b) => Number(a[0]) - Number(b[0]))));
  return report;
}

export async function buildPlausibilityReport() {
  const warnings = await runPlausibilityChecks();
  const report = emptyReport('Plausibility List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${warnings.length.toLocaleString()} warnings`));
  report.blocks.push(block.table(['Severity', 'Rule', 'Record', 'Message'], warnings.map((w) => [w.severity, w.rule, w.recordName, w.message])));
  return report;
}

export async function buildToDoListReport() {
  const db = getLocalDatabase();
  const { records } = await db.query('ToDo', { limit: 100000 });
  const rows = records
    .map((todo) => [
      readField(todo, ['title', 'name']) || todo.recordName,
      readField(todo, ['status']) || '',
      readField(todo, ['priority']) || '',
      readField(todo, ['dueDate', 'cached_dueDateAsDate']) || '',
      trimText(readField(todo, ['description', 'text'], ''), 120),
    ])
    .sort((a, b) => String(a[3]).localeCompare(String(b[3])) || a[0].localeCompare(b[0]));
  const report = emptyReport('ToDo List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Title', 'Status', 'Priority', 'Due', 'Description'], rows));
  return report;
}

export async function buildRegisterReport(recordName, generations = 4) {
  const tree = await buildDescendantTree(recordName, generations);
  if (!tree) return emptyReport('Person not found');
  const report = emptyReport(`Register Report — ${nameOf(tree.person)}`);
  report.blocks.push(block.title(report.title, 1));
  let index = 1;
  function visit(node, gen) {
    if (!node?.person || gen > generations) return;
    const number = index++;
    report.blocks.push(block.title(`${number}. ${nameOf(node.person)} ${spanAnnotated(node.person)}`.trim(), gen === 0 ? 2 : 3));
    const spouses = [];
    const children = [];
    for (const union of node.unions || []) {
      if (union.partner) spouses.push(nameOf(union.partner));
      for (const child of union.children || []) children.push(nameOf(child.person));
    }
    if (spouses.length) report.blocks.push(block.paragraph(`Spouse${spouses.length === 1 ? '' : 's'}: ${spouses.join('; ')}`));
    if (children.length) report.blocks.push(block.list(children.map((child, childIndex) => `${number}.${childIndex + 1} ${child}`)));
    for (const union of node.unions || []) for (const child of union.children || []) visit(child, gen + 1);
  }
  visit(tree, 0);
  return report;
}

export async function buildDescendancyReport(recordName, generations = 5) {
  const tree = await buildDescendantTree(recordName, generations);
  if (!tree) return emptyReport('Person not found');
  const rows = [];
  function visit(node, gen, parent = '') {
    if (!node?.person || gen > generations) return;
    rows.push([String(gen + 1), nameOf(node.person), node.person.birthDate || '', node.person.deathDate || '', parent]);
    for (const union of node.unions || []) {
      for (const child of union.children || []) visit(child, gen + 1, nameOf(node.person));
    }
  }
  visit(tree, 0);
  const report = emptyReport(`Descendancy Report — ${nameOf(tree.person)}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Generation', 'Name', 'Born', 'Died', 'Parent'], rows));
  return report;
}

export async function buildNarrativeReport(recordName, generations = 4) {
  const ctx = await buildPersonContext(recordName);
  if (!ctx) return emptyReport('Person not found');
  const report = emptyReport(`Narrative Report — ${nameOf(ctx.selfSummary)}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(narrativeSentence(ctx.selfSummary)));
  for (const parentFamily of ctx.parents) {
    const parents = [parentFamily.man, parentFamily.woman].filter(Boolean).map(nameOf).join(' and ');
    if (parents) report.blocks.push(block.paragraph(`${nameOf(ctx.selfSummary)} was a child of ${parents}.`));
  }
  for (const family of ctx.families) {
    if (family.partner) report.blocks.push(block.paragraph(`${nameOf(ctx.selfSummary)} formed a family with ${nameOf(family.partner)}.`));
    if (family.children.length) report.blocks.push(block.paragraph(`Their recorded children are ${family.children.map(nameOf).join(', ')}.`));
  }
  const descendants = await buildDescendantNarrative(recordName, generations);
  report.blocks.push(...descendants.blocks.slice(1));
  return report;
}

export async function buildMediaGalleryReport() {
  const db = getLocalDatabase();
  const mediaTypes = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];
  const rows = [];
  for (const type of mediaTypes) {
    const { records } = await db.query(type, { limit: 100000 });
    for (const media of records) {
      rows.push([
        type.replace('Media', ''),
        readField(media, ['title', 'caption', 'filename'], media.recordName),
        readField(media, ['date'], ''),
        readField(media, ['url', 'pictureFileIdentifier', 'thumbnailFileIdentifier', 'pdfFileIdentifier', 'audioFileIdentifier', 'videoFileIdentifier'], ''),
      ]);
    }
  }
  const report = emptyReport('Media Gallery Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Type', 'Title', 'Date', 'File / URL'], rows.sort((a, b) => a[1].localeCompare(b[1]))));
  return report;
}

export async function buildTimelineReport() {
  const db = getLocalDatabase();
  const [personEvents, familyEvents] = await Promise.all([
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
  ]);
  const rows = [];
  for (const event of [...personEvents.records, ...familyEvents.records]) {
    rows.push([
      readField(event, ['date'], ''),
      readConclusionType(event) || 'Event',
      await eventOwnerLabel(db, event),
      await placeLabel(db, readRef(event.fields?.place) || readRef(event.fields?.assignedPlace)),
      trimText(readField(event, ['description', 'text'], ''), 90),
    ]);
  }
  const report = emptyReport('Timeline Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Date', 'Type', 'Owner', 'Place', 'Description'], rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))));
  return report;
}

export async function buildStatusReport() {
  const db = getLocalDatabase();
  const [persons, places, sources, media, todos] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Place', { limit: 100000 }),
    db.query('Source', { limit: 100000 }),
    db.query('MediaPicture', { limit: 100000 }),
    db.query('ToDo', { limit: 100000 }),
  ]);
  const rows = [
    ['Persons', persons.records.length],
    ['Persons without birth date', persons.records.filter((p) => !readField(p, ['cached_birthDate', 'birthDate'])).length],
    ['Persons without death date', persons.records.filter((p) => !readField(p, ['cached_deathDate', 'deathDate'])).length],
    ['Places', places.records.length],
    ['Places without coordinates', places.records.filter((p) => !readField(p, ['coordinate', 'latitude'])).length],
    ['Sources', sources.records.length],
    ['Pictures', media.records.length],
    ['Open ToDos', todos.records.filter((t) => !/done|complete/i.test(readField(t, ['status'], ''))).length],
  ].map(([name, value]) => [name, Number(value).toLocaleString()]);
  const report = emptyReport('Status Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Metric', 'Value'], rows));
  return report;
}

export async function buildTodayReport(date = new Date()) {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const rows = [];
  for (const person of records) {
    const summary = personSummary(person);
    addTodayRow(rows, key, summary, 'Birth', summary?.birthDate);
    addTodayRow(rows, key, summary, 'Death', summary?.deathDate);
  }
  const report = emptyReport('Today Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Type', 'Person', 'Date'], rows));
  return report;
}

export async function buildChangesListReport() {
  const db = getLocalDatabase();
  const { records } = await db.query('ChangeLogEntry', { limit: 100000 });
  const rows = records
    .map((entry) => [
      readField(entry, ['timestamp'], ''),
      readField(entry, ['changeType'], ''),
      readField(entry, ['targetType'], ''),
      readField(entry, ['summary'], ''),
    ])
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  const report = emptyReport('Changes List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Date', 'Type', 'Target', 'Summary'], rows));
  return report;
}

export async function buildFactsListReport() {
  const db = getLocalDatabase();
  const { records } = await db.query('PersonFact', { limit: 100000 });
  const rows = [];
  for (const fact of records) {
    const personId = readRef(fact.fields?.person);
    const person = personId ? await db.getRecord(personId) : null;
    rows.push([
      personSummary(person)?.fullName || personId || '',
      readConclusionType(fact) || readField(fact, ['factType', 'type'], 'Fact'),
      readField(fact, ['value', 'description', 'text'], ''),
      readField(fact, ['date'], ''),
    ]);
  }
  const report = emptyReport('Facts List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Person', 'Fact', 'Value', 'Date'], rows.sort((a, b) => a[0].localeCompare(b[0]))));
  return report;
}

export async function buildMarriageListReport() {
  const db = getLocalDatabase();
  const { records: families } = await db.query('Family', { limit: 100000 });
  const rows = [];
  for (const family of families) {
    const man = await db.getRecord(readRef(family.fields?.man));
    const woman = await db.getRecord(readRef(family.fields?.woman));
    rows.push([
      personSummary(man)?.fullName || '',
      personSummary(woman)?.fullName || '',
      readField(family, ['cached_marriageDate', 'marriageDate'], ''),
    ]);
  }
  const report = emptyReport('Marriage List');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Partner 1', 'Partner 2', 'Marriage Date'], rows.sort((a, b) => String(a[2]).localeCompare(String(b[2])))));
  return report;
}

export async function buildMapReport() {
  const db = getLocalDatabase();
  const [places, coords] = await Promise.all([
    db.query('Place', { limit: 100000 }),
    db.query('Coordinate', { limit: 100000 }),
  ]);
  const coordByPlace = new Map();
  for (const coord of coords.records) {
    const place = readRef(coord.fields?.place);
    if (place) coordByPlace.set(place, coord);
  }
  const rows = places.records.map((place) => {
    const coord = coordByPlace.get(place.recordName) || null;
    return [
      placeSummary(place)?.displayName || placeSummary(place)?.name || place.recordName,
      readField(coord, ['latitude'], ''),
      readField(coord, ['longitude'], ''),
      readField(place, ['geonameID', 'geoNameID'], ''),
    ];
  });
  const report = emptyReport('Map Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Place', 'Latitude', 'Longitude', 'GeoName ID'], rows));
  return report;
}

async function eventOwnerLabel(db, eventRecord) {
  const personId = readRef(eventRecord.fields?.person);
  if (personId) {
    const person = await db.getRecord(personId);
    return personSummary(person)?.fullName || personId;
  }
  const familyId = readRef(eventRecord.fields?.family);
  if (familyId) {
    const family = await db.getRecord(familyId);
    return familySummary(family)?.familyName || familyId;
  }
  return '';
}

async function placeLabel(db, placeId) {
  if (!placeId) return '';
  const place = await db.getRecord(placeId);
  const summary = placeSummary(place);
  return summary?.displayName || summary?.name || placeId;
}

function familyNameOf(summary) {
  return summary?.familyName || summary?.recordName || 'Family';
}

function addFamilyContext(contexts, familyId, label) {
  if (!familyId) return;
  const current = contexts.get(familyId);
  if (!current) {
    contexts.set(familyId, label || 'Family event');
    return;
  }
  if (label && !current.split('; ').includes(label)) {
    contexts.set(familyId, `${current}; ${label}`);
  }
}

function parentFamilyContextLabel(family) {
  const parents = [family.man, family.woman].filter(Boolean).map(nameOf).join(' and ');
  if (parents) return `Child in family of ${parents}`;
  return `Child in ${familyNameOf(family.familySummary)}`;
}

function spouseFamilyContextLabel(family) {
  if (family.partner) return `Family with ${nameOf(family.partner)}`;
  return familyNameOf(family.familySummary);
}

async function eventReportRow(db, event, context) {
  const place = await placeLabel(db, readRef(event.fields?.place) || readRef(event.fields?.assignedPlace));
  return [
    eventTypeLabel(event),
    eventDate(event),
    place,
    trimText(eventDescription(event), 140),
    context || '',
  ];
}

function eventTypeLabel(event) {
  return humanizeType(readConclusionType(event) || readField(event, ['eventType', 'factType', 'type'], 'Event')) || 'Event';
}

function eventDate(event) {
  return readField(event, ['date', 'cached_dateAsDate', 'dateString'], '');
}

function eventDescription(event) {
  return readField(event, ['description', 'userDescription', 'text', 'note'], '');
}

function storyTitle(record) {
  return readField(record, ['title', 'name'], record?.recordName || 'Story');
}

function storySectionTitle(section, index) {
  return readField(section, ['title', 'name'], `Section ${index + 1}`);
}

function appendTextParagraphs(report, text, fallback = '') {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    if (fallback) report.blocks.push(block.paragraph(fallback));
    return;
  }
  for (const paragraph of paragraphs) report.blocks.push(block.paragraph(paragraph));
}

async function storyRelationRow(db, relation, scope) {
  const targetId = readRef(relation.fields?.target);
  const target = targetId ? await db.getRecord(targetId) : null;
  const targetType = readField(relation, ['targetType'], target?.recordType || refType(relation.fields?.target) || 'Record');
  return [
    scope,
    targetTypeLabel(targetType),
    recordDisplayLabel(target) || targetId || relation.recordName,
    targetId || '',
  ];
}

function targetTypeLabel(type) {
  const labels = {
    Person: 'Person',
    Family: 'Family',
    PersonEvent: 'Person Event',
    FamilyEvent: 'Family Event',
    MediaPicture: 'Picture',
    MediaPDF: 'PDF',
    MediaURL: 'URL',
    MediaAudio: 'Audio',
    MediaVideo: 'Video',
  };
  return labels[type] || humanizeType(type) || 'Record';
}

function recordDisplayLabel(record) {
  if (!record) return '';
  if (record.recordType === 'Person') return personSummary(record)?.fullName || record.recordName;
  if (record.recordType === 'Family') return familySummary(record)?.familyName || record.recordName;
  if (record.recordType === 'Place') return placeSummary(record)?.displayName || placeSummary(record)?.name || record.recordName;
  if (record.recordType === 'Source') return sourceSummary(record)?.title || record.recordName;
  if (record.recordType === 'Story') return storyTitle(record);
  if (record.recordType === 'PersonEvent' || record.recordType === 'FamilyEvent') {
    return [eventTypeLabel(record), eventDate(record)].filter(Boolean).join(' - ') || record.recordName;
  }
  if (String(record.recordType || '').startsWith('Media')) {
    return readField(record, ['title', 'caption', 'filename', 'url'], record.recordName);
  }
  return readField(record, ['title', 'name', 'cached_fullName', 'cached_familyName'], record.recordName);
}

function pathEdgeLabel(edge) {
  switch (edge) {
    case 'parent':
      return 'Parent of previous';
    case 'child':
      return 'Child of previous';
    case 'spouse':
      return 'Spouse of previous';
    case 'self':
      return 'Self';
    default:
      return 'Related';
  }
}

function addAnniversary(rows, person, type, rawDate) {
  const match = String(rawDate || '').match(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  if (!person || !match) return;
  const monthDay = `${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  rows.push([monthDay, type, person.fullName, match[1] || '']);
}

function addTodayRow(rows, todayKey, person, type, rawDate) {
  const match = String(rawDate || '').match(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  if (!person || !match) return;
  const key = `${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  if (key === todayKey) rows.push([type, person.fullName, rawDate]);
}

function narrativeSentence(summary) {
  const pieces = [`${nameOf(summary)} is recorded in this family tree`];
  if (summary.birthDate) pieces.push(`born ${summary.birthDate}`);
  if (summary.deathDate) pieces.push(`died ${summary.deathDate}`);
  return pieces.join(', ') + '.';
}

function trimText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
