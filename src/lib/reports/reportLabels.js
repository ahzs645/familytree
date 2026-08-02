/**
 * Translation lookup for the Reports UI chrome.
 *
 * REPORT_BUILDERS is a data table carrying English literals for categories,
 * option labels, and checkbox captions. Rather than restructure ~30 builder
 * definitions, this maps those literals onto catalog keys and falls back to
 * the literal itself, so an untranslated string degrades to today's English
 * instead of rendering a raw key.
 */

const CATEGORY_KEYS = {
  'Person Reports': 'reports.categories.person',
  'Lineage Reports': 'reports.categories.lineage',
  'Family Reports': 'reports.categories.family',
  'Story & Media': 'reports.categories.storyMedia',
  Analysis: 'reports.categories.analysis',
  Lists: 'reports.categories.list',
  'List Reports': 'reports.categories.list',
  Reports: 'reports.categories.default',
};

// Keyed by the option's `key` in optionsSchema — stable across label rewording.
const OPTION_KEYS = {
  showParents: 'reports.options.showParents',
  showFamilies: 'reports.options.showFamilies',
  showEvents: 'reports.options.showEvents',
  appendCitations: 'reports.options.appendCitations',
  includeFamilyEvents: 'reports.options.includeFamilyEvents',
  showWorldHistory: 'reports.options.showWorldHistory',
  includeChristening: 'reports.options.includeChristening',
  includeBurial: 'reports.options.includeBurial',
  includeEducation: 'reports.options.includeEducation',
  includeResidence: 'reports.options.includeResidence',
  includeOccupation: 'reports.options.includeOccupation',
  includeSiblings: 'reports.options.includeSiblings',
  lineType: 'reports.options.lineType',
  maxDepth: 'reports.options.maxDepth',
  showLifeSpan: 'reports.options.showLifeSpan',
  showCoefficients: 'reports.options.showCoefficients',
  groupByEventType: 'reports.options.groupByEventType',
  includeBirth: 'reports.options.includeBirth',
  todayIncludeChristening: 'reports.options.todayIncludeChristening',
  includeDeath: 'reports.options.includeDeath',
  todayIncludeBurial: 'reports.options.todayIncludeBurial',
  includeMarriage: 'reports.options.includeMarriage',
  includeEngagement: 'reports.options.includeEngagement',
  includeDivorce: 'reports.options.includeDivorce',
  includeOtherEvents: 'reports.options.includeOtherEvents',
  includePersons: 'reports.options.includePersons',
  includeFamilies: 'reports.options.includeFamilies',
  includeSources: 'reports.options.includeSources',
  includePlaces: 'reports.options.includePlaces',
  includeMedia: 'reports.options.includeMedia',
  includeOtherObjects: 'reports.options.includeOtherObjects',
  showAuthor: 'reports.options.showAuthor',
  showStillExists: 'reports.options.showStillExists',
};

const EXPORT_KEYS = {
  html: 'reports.exportAs.html',
  csv: 'reports.exportAs.csv',
  text: 'reports.exportAs.txt',
  rtf: 'reports.exportAs.rtf',
  // Not a file save: this opens the rendered report in a window and calls
  // print(), so the label says so rather than promising a download.
  pdf: 'reports.exportAs.pdf',
};

export function reportCategoryLabel(t, name) {
  const key = CATEGORY_KEYS[name];
  return key ? t(key, { defaultValue: name }) : name;
}

export function reportOptionLabel(t, option) {
  const key = OPTION_KEYS[option?.key];
  return key ? t(`${key}.label`, { defaultValue: option.label }) : option?.label;
}

export function reportOptionCheckbox(t, option) {
  const key = OPTION_KEYS[option?.key];
  const fallback = option?.checkboxLabel || t('reports.options.enabled', { defaultValue: 'Enabled' });
  return key ? t(`${key}.checkbox`, { defaultValue: fallback }) : fallback;
}

const SUBJECT_KEYS = {
  Person: 'glossary.person',
  'Person A': 'reports.terms.personA',
  'Person B': 'reports.terms.personB',
  Story: 'reports.subjects.story',
  Proband: 'reports.subjects.proband',
  'Root person': 'reports.subjects.rootPerson',
  'Lineage subject': 'reports.subjects.lineageSubject',
};

export function reportSubjectLabel(t, label) {
  const key = SUBJECT_KEYS[label];
  return key ? t(key, { defaultValue: label }) : label;
}

/**
 * Per-builder blurb under the report title. No catalog carries these yet, so
 * every locale falls back to the builder's English literal rather than showing
 * a raw key. The lookup exists so `reports.helpText.<builderId>` translations
 * can land without touching the REPORT_BUILDERS table.
 */
export function reportHelpText(t, builder) {
  if (!builder?.id) return builder?.helpText || '';
  return t(`reports.helpText.${builder.id}`, { defaultValue: builder.helpText || '' });
}

export function reportExportLabel(t, format) {
  const key = EXPORT_KEYS[format?.id];
  const fallback = format?.label || String(format?.id || '').toUpperCase();
  return key
    ? t(key, { defaultValue: fallback })
    : t('reports.exportAs.other', { format: fallback, defaultValue: `Save as ${fallback}…` });
}
