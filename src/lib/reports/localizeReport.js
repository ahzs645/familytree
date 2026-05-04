const TERM_KEYS = {
  '#': '#',
  'Anniversary List': 'reports.builders.anniversary-list',
  Ancestors: 'glossary.tree',
  Birth: 'glossary.birth',
  Born: 'glossary.birth',
  Child: 'glossary.child',
  Children: 'glossary.child',
  Date: 'glossary.date',
  Death: 'glossary.death',
  Died: 'glossary.death',
  Events: 'glossary.event',
  Fact: 'glossary.fact',
  Families: 'glossary.family',
  Family: 'glossary.family',
  'Family Group Sheet': 'reports.builders.family-group-sheet',
  Gender: 'glossary.gender',
  Generation: 'glossary.tree',
  Marriage: 'glossary.marriage',
  'Marriage Date': 'glossary.marriage',
  Name: 'glossary.person',
  Parent: 'glossary.father',
  Parents: 'persons.parents',
  Person: 'glossary.person',
  Place: 'glossary.place',
  Places: 'glossary.place',
  Report: 'glossary.report',
  Source: 'glossary.source',
  Sources: 'glossary.source',
  Spouse: 'glossary.spouse',
  Status: 'glossary.status',
  Title: 'reports.title',
  Type: 'reports.type',
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
  if (entry.kind === 'title') return { ...entry, text: localizeText(entry.text, t) };
  if (entry.kind === 'table') {
    return {
      ...entry,
      headers: (entry.headers || []).map((header) => localizeText(header, t)),
    };
  }
  return entry;
}

function localizeText(value, t) {
  const key = TERM_KEYS[String(value || '').trim()];
  return key ? t(key) : value;
}
