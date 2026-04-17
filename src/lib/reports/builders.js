/**
 * Narrative builders — given a person/family record, produce a report (AST).
 * Data shaping only; no rendering.
 */
import { buildAncestorTree, buildDescendantTree } from '../treeQuery.js';
import { buildPersonContext } from '../personContext.js';
import { block, emptyReport } from './ast.js';

function personLabel(p) {
  if (!p) return 'Unknown';
  const f = p.fields || {};
  return f.cached_fullName?.value || `${f.firstName?.value || ''} ${f.lastName?.value || ''}`.trim() || 'Unknown';
}

function lifeSpan(p) {
  const f = p?.fields || {};
  const b = (f.cached_birthDate?.value || '').slice(0, 4);
  const d = (f.cached_deathDate?.value || '').slice(0, 4);
  if (!b && !d) return '';
  return `(${b || '?'} – ${d || ''})`.trim();
}

/**
 * PERSON SUMMARY — name, life dates, parents, partners, children, events table.
 */
export async function buildPersonSummary(recordName) {
  const ctx = await buildPersonContext(recordName);
  if (!ctx) return emptyReport('Person not found');
  const self = ctx.self;
  const name = personLabel(self);
  const report = emptyReport(`Person Summary — ${name}`);
  const f = self.fields || {};

  report.blocks.push(block.title(name, 1));
  if (lifeSpan(self)) report.blocks.push(block.paragraph(lifeSpan(self)));
  report.blocks.push(block.spacer(6));

  const vitals = [];
  if (f.cached_birthDate?.value) vitals.push(`Born: ${f.cached_birthDate.value}`);
  if (f.cached_deathDate?.value) vitals.push(`Died: ${f.cached_deathDate.value}`);
  vitals.push(`Gender: ${['Unknown', 'Male', 'Female'][f.gender?.value ?? 0]}`);
  if (vitals.length > 0) report.blocks.push(block.list(vitals));

  if (ctx.parents.length > 0) {
    report.blocks.push(block.title('Parents', 2));
    const items = [];
    for (const fam of ctx.parents) {
      if (fam.man) items.push(`Father: ${personLabel(fam.man)} ${lifeSpan(fam.man)}`);
      if (fam.woman) items.push(`Mother: ${personLabel(fam.woman)} ${lifeSpan(fam.woman)}`);
    }
    report.blocks.push(block.list(items));
  }

  if (ctx.families.length > 0) {
    report.blocks.push(block.title('Families', 2));
    for (const fam of ctx.families) {
      const partner = personLabel(fam.partner);
      report.blocks.push(block.title(`With ${partner} ${lifeSpan(fam.partner)}`, 3));
      if (fam.children.length > 0) {
        report.blocks.push(block.list(fam.children.map((c) => `${personLabel(c)} ${lifeSpan(c)}`)));
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
  const report = emptyReport(`Ancestors of ${tree.person?.fullName || 'Unknown'}`);
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
  const report = emptyReport(`Family Group Sheet — ${personLabel(ctx.self)}`);
  report.blocks.push(block.title(report.title, 1));

  for (const fam of ctx.families) {
    const partner = fam.partner;
    report.blocks.push(block.title(`${personLabel(ctx.self)} & ${personLabel(partner)}`, 2));
    const marriage = fam.family.fields?.cached_marriageDate?.value;
    if (marriage) report.blocks.push(block.paragraph(`Married: ${marriage}`));

    const rows = fam.children.map((c) => {
      const f = c.fields || {};
      return [
        personLabel(c),
        ['Unknown', 'Male', 'Female'][f.gender?.value ?? 0],
        f.cached_birthDate?.value || '',
        f.cached_deathDate?.value || '',
      ];
    });
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
  const report = emptyReport(`Descendants of ${tree.person?.fullName || 'Unknown'}`);
  report.blocks.push(block.title(report.title, 1));

  function visit(node, gen) {
    if (!node || !node.person || gen > generations) return;
    const header = gen === 0 ? 'Proband' : `Generation ${gen}`;
    report.blocks.push(block.title(`${header}: ${node.person.fullName}`, gen === 0 ? 2 : 3));
    for (const u of node.unions) {
      if (u.partner) {
        report.blocks.push(block.paragraph(`Married ${u.partner.fullName}`));
      }
      if (u.children.length > 0) {
        report.blocks.push(block.list(u.children.map((c) => c.person?.fullName || 'Unknown')));
        for (const c of u.children) visit(c, gen + 1);
      }
    }
  }

  visit(tree, 0);
  return report;
}
