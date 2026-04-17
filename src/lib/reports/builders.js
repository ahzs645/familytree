/**
 * Narrative builders — given a person/family record, produce a report (AST).
 * Data shaping only; no rendering. All person/family formatting goes through
 * models/wrap.js so output stays consistent with the rest of the app.
 */
import { buildAncestorTree, buildDescendantTree } from '../treeQuery.js';
import { buildPersonContext } from '../personContext.js';
import { personSummary, lifeSpanLabel, Gender } from '../../models/index.js';
import { block, emptyReport } from './ast.js';

function nameOf(summaryOrPerson) {
  return summaryOrPerson?.fullName || 'Unknown';
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
          e.fields?.conclusionType?.value || e.fields?.eventType?.value || 'Event',
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
    if (!node || !node.person) return 'Unknown';
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
