/**
 * Localize a report AST just before it is rendered or exported.
 *
 * Builders emit English structural vocabulary ("Born", "Father", table column
 * headers) so their output stays comparable across locales; this pass swaps
 * that vocabulary for the active locale. Exact known structural cell values
 * (such as Yes, Birth, or Delete) are translated too; arbitrary record data —
 * names, places, dates, notes — passes through unchanged.
 *
 * Two bugs used to make this a no-op for most of a report:
 *   - it mapped `entry.headers`, but ast.js emits tables with `columns`, so
 *     table headers were never localized at all;
 *   - it only visited titles and tables, so paragraph and list lines like
 *     "Born: 1900-01-02" or "Father: X" stayed English even in Arabic.
 */

// Terms with an existing glossary entry reuse it; the rest live under
// reports.terms.* so a report and the surrounding UI stay in step.
const TERM_KEYS = {
  '#': '#',
  Add: 'reports.terms.add',
  Age: 'reports.terms.age',
  Ancestors: 'glossary.tree',
  'Anniversary List': 'reports.builders.anniversary-list',
  'Ahnentafel Report': 'reports.builders.ahnentafel',
  'Ancestor Narrative': 'reports.builders.ancestor-narrative',
  Anniversary: 'reports.terms.anniversary',
  Birth: 'glossary.birth',
  Born: 'glossary.birth',
  Burial: 'reports.terms.burial',
  Child: 'glossary.child',
  Children: 'glossary.child',
  Citation: 'reports.terms.citation',
  Date: 'glossary.date',
  Death: 'glossary.death',
  'DNA Report': 'reports.builders.dna-report',
  'Descendancy Report': 'reports.builders.descendancy',
  'Descendant Narrative': 'reports.builders.descendant-narrative',
  Description: 'reports.terms.description',
  Died: 'glossary.death',
  Event: 'glossary.event',
  Events: 'glossary.event',
  Fact: 'glossary.fact',
  Families: 'glossary.family',
  Family: 'glossary.family',
  'Family Group Sheet': 'reports.builders.family-group-sheet',
  'Person / Family': 'reports.terms.personOrFamily',
  'Media Gallery Report': 'reports.builders.media-gallery-report',
  Father: 'glossary.father',
  Gender: 'glossary.gender',
  Generation: 'reports.terms.generation',
  Label: 'reports.terms.label',
  'Life Span': 'reports.terms.lifeSpan',
  Line: 'reports.terms.line',
  Lineage: 'reports.terms.lineage',
  Marriage: 'glossary.marriage',
  'Marriage Date': 'reports.terms.marriageDate',
  'Markers / SNP Data': 'reports.terms.markerData',
  Married: 'glossary.marriage',
  Mother: 'glossary.mother',
  Name: 'reports.terms.name',
  Note: 'reports.terms.note',
  Notes: 'reports.terms.note',
  Occupation: 'reports.terms.occupation',
  Parent: 'glossary.father',
  Parents: 'persons.parents',
  'Partner 1': 'reports.terms.partner1',
  'Partner 2': 'reports.terms.partner2',
  Person: 'glossary.person',
  'Person Summary': 'reports.builders.person-summary',
  'Persons List': 'reports.builders.persons-list',
  'Person A': 'reports.terms.personA',
  'Person B': 'reports.terms.personB',
  Persons: 'reports.terms.persons',
  Place: 'glossary.place',
  Places: 'glossary.place',
  'Places List': 'reports.builders.places-list',
  Proband: 'reports.subjects.proband',
  Publisher: 'books.config.publisher',
  Relationship: 'reports.terms.relationship',
  Report: 'glossary.report',
  'Register Report': 'reports.builders.register',
  'Raw File': 'reports.terms.rawFile',
  Residence: 'reports.terms.residence',
  Scope: 'reports.terms.scope',
  Source: 'glossary.source',
  Sources: 'glossary.source',
  'Sources List': 'reports.builders.sources-list',
  Spouse: 'glossary.spouse',
  Status: 'glossary.status',
  Summary: 'reports.terms.summary',
  Test: 'reports.terms.test',
  'Test Kind': 'reports.terms.testKind',
  Provider: 'reports.terms.provider',
  Haplogroup: 'reports.terms.haplogroup',
  Author: 'reports.terms.author',
  'Object Type': 'reports.terms.objectType',
  'Changed Entry': 'reports.terms.changedEntry',
  Changes: 'reports.terms.changes',
  Change: 'reports.terms.change',
  Delete: 'reports.terms.delete',
  'Still in Database': 'reports.terms.stillInDatabase',
  'Today Report': 'reports.builders.today-report',
  'Changes List': 'reports.builders.changes-list',
  Yes: 'common.yes',
  No: 'common.no',
  Title: 'reports.title',
  Type: 'reports.type',
  Value: 'reports.terms.value',
  Year: 'reports.terms.year',
};

export function localizeReportAst(report, t) {
  if (!report || typeof t !== 'function') return report;
  return {
    ...report,
    title: localizeText(report.title, t),
    blocks: (report.blocks || []).map((block) => localizeBlock(block, t)),
  };
}

function localizeBlock(entry, t) {
  if (!entry) return entry;
  switch (entry.kind) {
    case 'title':
      return { ...entry, text: localizeText(entry.text, t) };
    case 'table':
      // ast.js calls this `columns`. The old `headers` lookup silently matched
      // nothing, which is why report tables stayed English in every locale.
      return {
        ...entry,
        columns: (entry.columns || []).map((column) => localizeText(column, t)),
        rows: (entry.rows || []).map((row) => row.map((cell) => localizeText(cell, t))),
      };
    case 'paragraph':
      return { ...entry, text: localizeLine(entry.text, t) };
    case 'list':
      return { ...entry, items: (entry.items || []).map((item) => localizeLine(item, t)) };
    default:
      return entry;
  }
}

/** Exact-match a standalone term (table header, title). */
function localizeText(value, t) {
  const text = String(value ?? '');
  const key = TERM_KEYS[text.trim()];
  if (key) return t(key);
  const separator = text.indexOf(' — ');
  if (separator > 0) {
    const prefix = text.slice(0, separator).trim();
    const prefixKey = TERM_KEYS[prefix];
    if (prefixKey) return `${t(prefixKey)}${text.slice(separator)}`;
  }
  return value;
}

/**
 * Localize the label half of a "Label: value" line, leaving the value alone.
 * A line with no recognised label prefix passes through untouched, so free
 * text and record data are never rewritten.
 */
function localizeLine(value, t) {
  const text = String(value ?? '');
  const split = text.indexOf(':');
  if (split <= 0) return localizeText(text, t);
  const label = text.slice(0, split).trim();
  const key = TERM_KEYS[label];
  if (!key) return text;
  return `${t(key)}:${text.slice(split + 1)}`;
}
