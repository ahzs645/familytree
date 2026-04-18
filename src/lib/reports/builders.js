/**
 * Narrative builders — given a person/family record, produce a report (AST).
 * Data shaping only; no rendering. All person/family formatting goes through
 * models/wrap.js so output stays consistent with the rest of the app.
 */
import { buildAncestorTree, buildDescendantTree } from '../treeQuery.js';
import { buildPersonContext } from '../personContext.js';
import { getLocalDatabase } from '../LocalDatabase.js';
import { runPlausibilityChecks } from '../plausibility.js';
import { readConclusionType, readField, readRef } from '../schema.js';
import { personSummary, familySummary, placeSummary, sourceSummary, lifeSpanLabel, Gender } from '../../models/index.js';
import { humanizeType } from '../../utils/humanizeType.js';
import { block, emptyReport } from './ast.js';

function nameOf(summaryOrPerson) {
  return summaryOrPerson?.fullName || 'No name recorded';
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

function addAnniversary(rows, person, type, rawDate) {
  const match = String(rawDate || '').match(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  if (!person || !match) return;
  const monthDay = `${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  rows.push([monthDay, type, person.fullName, match[1] || '']);
}

function trimText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
