/**
 * Person- and family-centric reports: summaries, ancestor/descendant
 * narratives, family group sheets, kinship paths, ahnentafel/register/
 * descendancy formats. All take one or two record names and produce a
 * report AST.
 */
import { buildAncestorTree, buildDescendantTree } from '../../treeQuery.js';
import { buildPersonContext } from '../../personContext.js';
import { computeKinshipCoefficient, findRelationshipPath, collectRelatives, relationshipLabel } from '../../relationshipPath.js';
import { computeAncestorCompleteness, loadGenealogyMetricRecords } from '../../genealogyMetrics.js';
import { sosaFather, sosaGeneration, sosaMother, sosaRelation } from '../../sosa.js';
import { describeBirth, describeDeath, describeMarriage } from '../narrativeTemplates.js';
import { formatVitalDateParts } from '../../vitalFormat.js';
import { compareStrings, formatInteger } from '../../i18n.js';
import { eventTypeLabel } from '../../catalogs.js';
import { block, emptyReport } from '../ast.js';
import {
  addFamilyContext,
  eventReportRow,
  genderLabel,
  getLocalDatabase,
  lifeSpanLabel,
  nameOf,
  nameOrFallback,
  parentFamilyContextLabel,
  pathEdgeLabel,
  personSummary,
  placeSummary,
  readRef,
  relationNameAt,
  spanAnnotated,
  spouseFamilyContextLabel,
} from './_helpers.js';

/**
 * PERSON SUMMARY — name, life dates, parents, partners, children, events table.
 */
export async function buildPersonSummary(recordName, options = {}) {
  const ctx = await buildPersonContext(recordName);
  if (!ctx) return emptyReport('Person not found');
  const showParents = options.showParents !== false;
  const showFamilies = options.showFamilies !== false;
  const showEvents = options.showEvents !== false;
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

  if (showParents && ctx.parents.length > 0) {
    report.blocks.push(block.title('Parents', 2));
    const items = [];
    for (const fam of ctx.parents) {
      if (fam.man) items.push(`Father: ${nameOf(fam.man)} ${spanAnnotated(fam.man)}`.trim());
      if (fam.woman) items.push(`Mother: ${nameOf(fam.woman)} ${spanAnnotated(fam.woman)}`.trim());
    }
    report.blocks.push(block.list(items));
  }

  if (showFamilies && ctx.families.length > 0) {
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

  if (showEvents && ctx.events.length > 0) {
    report.blocks.push(block.title('Events', 2));
    report.blocks.push(
      block.table(
        ['Type', 'Date', 'Description'],
        ctx.events.map((e) => [
          eventTypeLabel(e.fields?.conclusionType?.value || e.fields?.eventType?.value),
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
    const years = formatVitalDateParts(p);
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
export async function buildPersonEventsReport(recordName, options = {}) {
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

  const includeFamilyEvents = options.includeFamilyEvents !== false;
  const familyContexts = new Map();
  if (includeFamilyEvents) {
    for (const family of ctx.parents) {
      addFamilyContext(familyContexts, family.family?.recordName, parentFamilyContextLabel(family));
    }
    for (const family of ctx.families) {
      addFamilyContext(familyContexts, family.family?.recordName, spouseFamilyContextLabel(family));
    }
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
      compareStrings(a[1], b[1]) ||
      compareStrings(a[0], b[0]) ||
      compareStrings(a[4], b[4])
  );

  const report = emptyReport(`Person Events — ${nameOf(ctx.selfSummary)}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} events for ${nameOf(ctx.selfSummary)}`));
  report.blocks.push(block.table(['Type', 'Date', 'Place', 'Description', 'Context'], rows));
  return report;
}

/**
 * KINSHIP REPORT — shortest relationship path between two people.
 */
/**
 * KINSHIP ROSTER — every known relative of a single root person, labelled.
 * Mirrors MFT's KinshipReport (single-root relatives roster).
 */
export async function buildKinshipRosterReport(recordName, options = {}) {
  const db = getLocalDatabase();
  const root = recordName ? await db.getRecord(recordName) : null;
  if (!root) return emptyReport('Person not found');
  const rootName = nameOf(personSummary(root));
  const relatives = await collectRelatives(recordName, { maxDepth: options.maxDepth || 12 });
  const rows = relatives
    .map((entry) => ({
      name: nameOf(entry.person),
      relation: relationshipLabel(entry.steps),
      span: lifeSpanLabel(entry.person),
      depth: entry.steps.length - 1,
    }))
    .filter((row) => row.relation && row.relation !== 'Same person')
    .sort((a, b) => a.depth - b.depth || compareStrings(a.relation, b.relation) || compareStrings(a.name, b.name))
    .map((row) => [row.name, row.relation, row.span]);
  const report = emptyReport(`Kinship Roster — ${rootName}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`${formatInteger(rows.length)} relatives of ${rootName}`));
  report.blocks.push(block.table(['Person', 'Relationship', 'Life Span'], rows));
  return report;
}

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
  const coefficient = await computeKinshipCoefficient(recordA, recordB);
  if (coefficient) {
    report.blocks.push(block.paragraph(`Relationship coefficient: ${formatCoefficient(coefficient.relationshipCoefficient)}; kinship coefficient: ${formatCoefficient(coefficient.kinshipCoefficient)}.`));
    if (coefficient.contributions.length > 0) {
      report.blocks.push(
        block.table(
          ['Common Ancestor', 'Distance A', 'Distance B', 'Contribution'],
          coefficient.contributions.slice(0, 12).map((entry) => [
            nameOf(entry.ancestor),
            String(entry.distanceA),
            String(entry.distanceB),
            formatCoefficient(entry.relationship),
          ])
        )
      );
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

export async function buildAhnentafelReport(recordName, generations = 6) {
  const tree = await buildAncestorTree(recordName, generations);
  if (!tree) return emptyReport('Person not found');
  const rows = [];
  function visit(node, number, generation) {
    if (!node?.person || generation > generations) return;
    rows.push([String(number), String(sosaGeneration(number)), sosaRelation(number), nameOf(node.person), node.person.birthDate || '', node.person.deathDate || '']);
    visit(node.father, sosaFather(number), generation + 1);
    visit(node.mother, sosaMother(number), generation + 1);
  }
  visit(tree, 1, 0);
  const report = emptyReport(`Ahnentafel — ${nameOf(tree.person)}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['#', 'Generation', 'Line', 'Name', 'Born', 'Died'], rows.sort((a, b) => Number(a[0]) - Number(b[0]))));
  return report;
}

export async function buildAncestorCompletenessReport(recordName, generations = 8) {
  const records = await loadGenealogyMetricRecords();
  const root = records.personsById.get(recordName);
  if (!root) return emptyReport('Person not found');
  const metrics = computeAncestorCompleteness(recordName, records, { maxGenerations: generations });
  const report = emptyReport(`Ancestor Completeness — ${nameOf(personSummary(root))}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(
    block.table(
      ['Generation', 'Theoretical', 'Known Paths', 'Unique Ancestors', 'Missing', 'Coverage', 'Implex', 'Birth Years'],
      metrics.generations.map((row) => [
        String(row.generation),
        String(row.theoretical),
        String(row.known),
        String(row.unique),
        String(row.missing),
        `${row.coverage}%`,
        `${row.implex}%`,
        row.minYear == null ? '' : `${row.minYear}-${row.maxYear}`,
      ])
    )
  );
  if (metrics.repeatedAncestors.length > 0) {
    report.blocks.push(block.title('Repeated Ancestors', 2));
    report.blocks.push(
      block.table(
        ['Ancestor', 'Paths'],
        metrics.repeatedAncestors.slice(0, 25).map((entry) => [
          nameOf(personSummary(records.personsById.get(entry.personId))),
          entry.paths.map((path) => `${path.sosa}: ${path.relation}`).join('; '),
        ])
      )
    );
  }
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

export async function buildDescendancyReport(recordName, generations = 5, options = {}) {
  const tree = await buildDescendantTree(recordName, generations);
  if (!tree) return emptyReport('Person not found');
  const showDates = options.showDates !== false;
  const showPlaces = !!options.showPlaces;

  const birthPlaceByPerson = new Map();
  if (showPlaces) {
    const db = getLocalDatabase();
    const [{ records: persons }, { records: places }] = await Promise.all([
      db.query('Person', { limit: 100000 }),
      db.query('Place', { limit: 100000 }),
    ]);
    const placeName = new Map(places.map((place) => [place.recordName, placeSummary(place)?.displayName || placeSummary(place)?.name || '']));
    for (const person of persons) {
      const ref = readRef(person.fields?.birthPlace);
      if (ref) birthPlaceByPerson.set(person.recordName, placeName.get(ref) || '');
    }
  }

  const rows = [];
  function visit(node, gen, parent = '') {
    if (!node?.person || gen > generations) return;
    const row = [String(gen + 1), nameOf(node.person)];
    if (showDates) row.push(node.person.birthDate || '', node.person.deathDate || '');
    if (showPlaces) row.push(birthPlaceByPerson.get(node.person.recordName) || '');
    row.push(parent);
    rows.push(row);
    for (const union of node.unions || []) {
      for (const child of union.children || []) visit(child, gen + 1, nameOf(node.person));
    }
  }
  visit(tree, 0);

  const columns = ['Generation', 'Name'];
  if (showDates) columns.push('Born', 'Died');
  if (showPlaces) columns.push('Birth Place');
  columns.push('Parent');

  const report = emptyReport(`Descendancy Report — ${nameOf(tree.person)}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(columns, rows));
  return report;
}

export async function buildNarrativeReport(recordName, generations = 4) {
  const ctx = await buildPersonContext(recordName);
  if (!ctx) return emptyReport('Person not found');
  const report = emptyReport(`Narrative Report — ${nameOf(ctx.selfSummary)}`);
  report.blocks.push(block.title(report.title, 1));
  const self = ctx.selfSummary;
  const birth = describeBirth(self);
  if (birth) report.blocks.push(block.paragraph(birth));
  for (const parentFamily of ctx.parents) {
    const parents = [parentFamily.man, parentFamily.woman].filter(Boolean).map(nameOf).join(' and ');
    if (parents) report.blocks.push(block.paragraph(`${nameOf(self)} was a child of ${parents}.`));
  }
  for (const family of ctx.families) {
    if (family.partner) {
      const marriageDate = family.familySummary?.marriageDate || '';
      report.blocks.push(block.paragraph(describeMarriage(self, family.partner, marriageDate, '')));
    }
    if (family.children.length) report.blocks.push(block.paragraph(`Their recorded children are ${family.children.map(nameOf).join(', ')}.`));
  }
  const death = describeDeath(self);
  if (death) report.blocks.push(block.paragraph(death));
  const descendants = await buildDescendantNarrative(recordName, generations);
  report.blocks.push(...descendants.blocks.slice(1));
  return report;
}

function formatCoefficient(value) {
  if (!Number.isFinite(value)) return '';
  return `${(value * 100).toFixed(value < 0.01 ? 3 : 2)}%`;
}
