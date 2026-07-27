/**
 * Localize a report AST just before it is rendered or exported.
 *
 * Builders emit English structural vocabulary ("Born", "Father", table column
 * headers) so their output stays comparable across locales; this pass swaps
 * that vocabulary for the active locale. Record *data* — names, places, dates
 * — is never touched.
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
  Age: 'reports.terms.age',
  Ancestors: 'glossary.tree',
  'Anniversary List': 'reports.builders.anniversary-list',
  Birth: 'glossary.birth',
  Born: 'glossary.birth',
  Burial: 'reports.terms.burial',
  Child: 'glossary.child',
  Children: 'glossary.child',
  Citation: 'reports.terms.citation',
  Date: 'glossary.date',
  Death: 'glossary.death',
  Description: 'reports.terms.description',
  Died: 'glossary.death',
  Event: 'glossary.event',
  Events: 'glossary.event',
  Fact: 'glossary.fact',
  Families: 'glossary.family',
  Family: 'glossary.family',
  'Family Group Sheet': 'reports.builders.family-group-sheet',
  Father: 'glossary.father',
  Gender: 'glossary.gender',
  Generation: 'reports.terms.generation',
  Label: 'reports.terms.label',
  'Life Span': 'reports.terms.lifeSpan',
  Line: 'reports.terms.line',
  Lineage: 'reports.terms.lineage',
  Marriage: 'glossary.marriage',
  'Marriage Date': 'reports.terms.marriageDate',
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
  'Person A': 'reports.terms.personA',
  'Person B': 'reports.terms.personB',
  Persons: 'reports.terms.persons',
  Place: 'glossary.place',
  Places: 'glossary.place',
  Relationship: 'reports.terms.relationship',
  Report: 'glossary.report',
  Residence: 'reports.terms.residence',
  Scope: 'reports.terms.scope',
  Source: 'glossary.source',
  Sources: 'glossary.source',
  Spouse: 'glossary.spouse',
  Status: 'glossary.status',
  Summary: 'reports.terms.summary',
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
      return { ...entry, columns: (entry.columns || []).map((column) => localizeText(column, t)) };
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
  const key = TERM_KEYS[String(value ?? '').trim()];
  return key ? t(key) : value;
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
