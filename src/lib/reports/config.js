/**
 * Report configuration — the builder registry plus the pure helpers that turn
 * a builder into default options, saved-report payloads, and restored state.
 * ReportsApp (and the report-library UI) consume these; keeping them here
 * means saved reports and books can be resolved without importing the React
 * component tree.
 */
import {
  buildPersonSummary,
  buildPersonEventsReport,
  buildAncestorNarrative,
  buildGiaPhaLineageReport,
  buildFamilyGroupSheet,
  buildDescendantNarrative,
  buildPersonsList,
  buildPlacesList,
  buildSourcesList,
  buildSourceCitationAuditReport,
  buildEventsList,
  buildAnniversaryList,
  buildAhnentafelReport,
  buildPlausibilityReport,
  buildToDoListReport,
  buildRegisterReport,
  buildDescendancyReport,
  buildNarrativeReport,
  buildStoryReport,
  buildKinshipReport,
  buildMediaGalleryReport,
  buildTimelineReport,
  buildStatusReport,
  buildTodayReport,
  buildChangesListReport,
  buildFactsListReport,
  buildMarriageListReport,
  buildMapReport,
  buildKinshipRosterReport,
  buildPersonAnalysisReport,
  buildDNAReport,
} from './builders.js';
import { newReportId } from './savedReports.js';
import { PRESENTATION_THEMES } from '../presentationSettings.js';
import { normalizeReportLanguage, normalizeReportPageStyle } from './presentationSettings.js';

export const REPORT_BUILDERS = [
  { id: 'person-summary', category: 'Person Reports', label: 'Person Summary', needsSubject: true, subjectType: 'Person', subjectLabel: 'Person', includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'showParents', label: 'Parents', type: 'boolean', default: true, checkboxLabel: 'Show parents' },
    { key: 'showFamilies', label: 'Families', type: 'boolean', default: true, checkboxLabel: 'Show families & children' },
    { key: 'showEvents', label: 'Events', type: 'boolean', default: true, checkboxLabel: 'Show events table' },
    { key: 'appendCitations', label: 'Citations', type: 'boolean', default: false, checkboxLabel: 'Append source citations' },
  ], helpText: 'Summarizes the selected person, parents, families, children, and direct events.', run: (rn, o) => buildPersonSummary(rn, o) },
  { id: 'person-events', category: 'Person Reports', label: 'Person Events Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Person', includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'includeFamilyEvents', label: 'Family events', type: 'boolean', default: true, checkboxLabel: 'Include linked family events' },
    { key: 'showWorldHistory', label: 'World history', type: 'boolean', default: false, checkboxLabel: 'Show world history events' },
    { key: 'appendCitations', label: 'Citations', type: 'boolean', default: false, checkboxLabel: 'Append source citations' },
  ], helpText: 'Lists the selected person\'s direct events and linked family events with context.', run: (rn, o) => buildPersonEventsReport(rn, o) },
  { id: 'ancestor-narrative', category: 'Lineage Reports', label: 'Ancestor Narrative', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 5 }, helpText: 'Builds a generation-by-generation ancestor narrative from the selected proband.', run: (rn, o) => buildAncestorNarrative(rn, o.generations) },
  { id: 'gia-pha-lineage', category: 'Lineage Reports', label: 'Gia phả / Family Lineage Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Lineage subject', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 5 }, helpText: 'Builds a Vietnamese-oriented lineage register with ancestor and descendant branch codes.', run: (rn, o) => buildGiaPhaLineageReport(rn, o.generations) },
  { id: 'descendant-narrative', category: 'Lineage Reports', label: 'Descendant Narrative', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 4 }, helpText: 'Builds a descendant narrative grouped by generation.', run: (rn, o) => buildDescendantNarrative(rn, o.generations) },
  { id: 'narrative', category: 'Person Reports', label: 'Narrative Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Person', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 4 }, optionsSchema: [
    { key: 'includeChristening', label: 'Christening', type: 'boolean', default: false, checkboxLabel: 'Narrate christening / baptism' },
    { key: 'includeBurial', label: 'Burial', type: 'boolean', default: false, checkboxLabel: 'Narrate burial' },
    { key: 'includeEducation', label: 'Education', type: 'boolean', default: false, checkboxLabel: 'Narrate education' },
    { key: 'includeResidence', label: 'Residence', type: 'boolean', default: false, checkboxLabel: 'Narrate residence' },
    { key: 'includeOccupation', label: 'Occupation', type: 'boolean', default: false, checkboxLabel: 'Narrate occupation' },
    { key: 'includeSiblings', label: 'Siblings', type: 'boolean', default: false, checkboxLabel: 'Narrate siblings' },
    { key: 'showWorldHistory', label: 'World history', type: 'boolean', default: false, checkboxLabel: 'Show world history events' },
    { key: 'appendCitations', label: 'Citations', type: 'boolean', default: false, checkboxLabel: 'Append source citations' },
  ], helpText: 'Combines family context and descendant narrative for the selected person.', run: (rn, o) => buildNarrativeReport(rn, o.generations, o) },
  { id: 'family-group-sheet', category: 'Family Reports', label: 'Family Group Sheet', needsSubject: true, subjectType: 'Person', subjectLabel: 'Person', includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'appendCitations', label: 'Citations', type: 'boolean', default: false, checkboxLabel: 'Append source citations' },
  ], helpText: 'Shows partner families and children for the selected person.', run: (rn, o) => buildFamilyGroupSheet(rn, o) },
  { id: 'story-report', category: 'Story & Media', label: 'Story Report', needsSubject: true, subjectType: 'Story', subjectLabel: 'Story', includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'showWorldHistory', label: 'World history', type: 'boolean', default: false, checkboxLabel: 'Show world history events' },
  ], helpText: 'Prints a selected story with metadata, sections, and related people, families, events, and media.', run: (rn, o) => buildStoryReport(rn, o) },
  { id: 'kinship-report', category: 'Analysis', label: 'Kinship Report', needsSubject: true, needsSecondSubject: true, subjectType: 'Person', subjectLabel: 'Person A', secondSubjectType: 'Person', secondSubjectLabel: 'Person B', includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'lineType', label: 'Relationship lines', type: 'select', default: 'any', choices: [['any', 'Any relationship'], ['blood', 'Blood relatives only'], ['biological', 'Biological lines only']] },
    { key: 'maxDepth', label: 'Maximum depth', type: 'number', default: 12, min: 2, max: 20 },
    { key: 'showLifeSpan', label: 'Life span column', type: 'boolean', default: true, checkboxLabel: 'Show life span column' },
    { key: 'showCoefficients', label: 'Coefficients', type: 'boolean', default: true, checkboxLabel: 'Show relationship coefficients' },
  ], helpText: 'Finds the shortest known family path between two selected people.', run: (rn, o, second) => buildKinshipReport(rn, second, o) },
  { id: 'kinship-roster', category: 'Analysis', label: 'Kinship Roster', needsSubject: true, subjectType: 'Person', subjectLabel: 'Root person', includeHeader: true, defaultOptions: {}, helpText: 'Lists every known relative of one person with their relationship.', run: (rn, o) => buildKinshipRosterReport(rn, o) },
  { id: 'person-analysis', category: 'Analysis', label: 'Person Analysis', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'onlyShowCount', label: 'Detail', type: 'boolean', default: false, checkboxLabel: 'Only show counts (omit value tables)' },
  ], helpText: 'Frequency of occupations, education, illnesses, religion, physical traits, labels, and more across the tree.', run: (rn, o) => buildPersonAnalysisReport(o) },
  { id: 'ahnentafel', category: 'Lineage Reports', label: 'Ahnentafel Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 6 }, helpText: 'Numbers ancestors using the standard Ahnentafel sequence.', run: (rn, o) => buildAhnentafelReport(rn, o.generations) },
  { id: 'register', category: 'Lineage Reports', label: 'Register Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 4 }, helpText: 'Creates a register-style descendant report from the selected person.', run: (rn, o) => buildRegisterReport(rn, o.generations) },
  { id: 'descendancy', category: 'Lineage Reports', label: 'Descendancy Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 5 }, optionsSchema: [
    { key: 'showDates', label: 'Dates', type: 'boolean', default: true, checkboxLabel: 'Show birth / death dates' },
    { key: 'showPlaces', label: 'Places', type: 'boolean', default: false, checkboxLabel: 'Show birth places' },
  ], helpText: 'Creates a tabular descendant report with parent context.', run: (rn, o) => buildDescendancyReport(rn, o.generations, o) },
  { id: 'persons-list', category: 'Lists', label: 'Persons List', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'sortBy', label: 'Sort by', type: 'select', default: 'name', choices: [['name', 'Name'], ['birth', 'Birth date'], ['death', 'Death date']] },
    { key: 'groupBy', label: 'Group into sections', type: 'select', default: 'none', choices: [['none', 'No sections'], ['surname', 'Surname initial'], ['birthDecade', 'Birth decade'], ['gender', 'Gender']] },
    { key: 'search', label: 'Search names', type: 'text', default: '', placeholder: 'Filter by name…' },
    { key: 'includeGender', label: 'Gender column', type: 'boolean', default: true, checkboxLabel: 'Show gender' },
    { key: 'showBirthDate', label: 'Birth date column', type: 'boolean', default: true, checkboxLabel: 'Show birth date' },
    { key: 'showBirthPlace', label: 'Birth place column', type: 'boolean', default: false, checkboxLabel: 'Show birth place' },
    { key: 'showDeathDate', label: 'Death date column', type: 'boolean', default: true, checkboxLabel: 'Show death date' },
    { key: 'showDeathPlace', label: 'Death place column', type: 'boolean', default: false, checkboxLabel: 'Show death place' },
    { key: 'showLifespan', label: 'Life span column', type: 'boolean', default: false, checkboxLabel: 'Show life span' },
    { key: 'showRecordId', label: 'Record ID column', type: 'boolean', default: false, checkboxLabel: 'Show record ID' },
    { key: 'onlyWithDates', label: 'Date filter', type: 'boolean', default: false, checkboxLabel: 'Only people with a birth or death date' },
  ], helpText: 'Lists every public person with gender and life dates.', run: (rn, o) => buildPersonsList(o) },
  { id: 'places-list', category: 'Lists', label: 'Places List', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'sortBy', label: 'Sort by', type: 'select', default: 'name', choices: [['name', 'Name'], ['geoname', 'GeoName ID']] },
    { key: 'onlyMissingGeoname', label: 'GeoName filter', type: 'boolean', default: false, checkboxLabel: 'Only places without a GeoName ID' },
  ], helpText: 'Lists recorded places with short names and GeoName identifiers.', run: (rn, o) => buildPlacesList(o) },
  { id: 'sources-list', category: 'Lists', label: 'Sources List', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'sortBy', label: 'Sort by', type: 'select', default: 'title', choices: [['title', 'Title'], ['date', 'Date']] },
    { key: 'includeText', label: 'Text column', type: 'boolean', default: true, checkboxLabel: 'Show source text excerpt' },
  ], helpText: 'Lists sources with dates and source text excerpts.', run: (rn, o) => buildSourcesList(o) },
  { id: 'source-citation-audit', category: 'Lists', label: 'Source Citation Audit', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists source citations, referenced entries, citation text, and private lineage metadata.', run: () => buildSourceCitationAuditReport() },
  { id: 'events-list', category: 'Lists', label: 'Events List', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'sortBy', label: 'Sort by', type: 'select', default: 'date', choices: [['date', 'Date'], ['type', 'Type'], ['owner', 'Owner']] },
    { key: 'onlyFullDate', label: 'Date filter', type: 'boolean', default: false, checkboxLabel: 'Only events with a full date' },
    { key: 'showDescription', label: 'Description column', type: 'boolean', default: true, checkboxLabel: 'Show description' },
    { key: 'showAge', label: 'Age column', type: 'boolean', default: false, checkboxLabel: 'Show age at event' },
    { key: 'showTime', label: 'Time column', type: 'boolean', default: false, checkboxLabel: 'Show time' },
    { key: 'showAddress', label: 'Address column', type: 'boolean', default: false, checkboxLabel: 'Show address' },
    { key: 'showPlaceDetail', label: 'Place detail column', type: 'boolean', default: false, checkboxLabel: 'Show place detail' },
    { key: 'showAuthority', label: 'Authority column', type: 'boolean', default: false, checkboxLabel: 'Show authority' },
    { key: 'showCause', label: 'Cause column', type: 'boolean', default: false, checkboxLabel: 'Show cause' },
    { key: 'showNotes', label: 'Notes column', type: 'boolean', default: false, checkboxLabel: 'Show notes' },
  ], helpText: 'Lists person and family events with owner and place context.', run: (rn, o) => buildEventsList(o) },
  { id: 'facts-list', category: 'Lists', label: 'Facts List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists recorded person facts with values and dates.', run: () => buildFactsListReport() },
  { id: 'marriage-list', category: 'Family Reports', label: 'Marriage List', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'sortBy', label: 'Sort by', type: 'select', default: 'date', choices: [['date', 'Marriage date'], ['partner1', 'Partner 1'], ['partner2', 'Partner 2']] },
  ], helpText: 'Lists families and recorded marriage dates.', run: (rn, o) => buildMarriageListReport(o) },
  { id: 'anniversary-list', category: 'Lists', label: 'Anniversary List', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'type', label: 'Anniversary type', type: 'select', default: 'all', choices: [['all', 'Birth & Death'], ['Birth', 'Birth'], ['Death', 'Death']] },
    { key: 'sortBy', label: 'Sort by', type: 'select', default: 'monthDay', choices: [['monthDay', 'Month / Day'], ['person', 'Person'], ['year', 'Year']] },
  ], helpText: 'Lists birth and death anniversaries by month and day.', run: (rn, o) => buildAnniversaryList(o) },
  { id: 'timeline-report', category: 'Analysis', label: 'Timeline Report', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'includeHistoryEvents', label: 'History events', type: 'boolean', default: false, checkboxLabel: 'Include history events' },
  ], helpText: 'Orders all person and family events by date.', run: (rn, o) => buildTimelineReport(o) },
  { id: 'media-gallery-report', category: 'Story & Media', label: 'Media Gallery Report', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'groupBy', label: 'Group into sections', type: 'select', default: 'none', choices: [['none', 'Single list'], ['type', 'By media type']] },
  ], helpText: 'Lists media records and their file or URL references.', run: (rn, o) => buildMediaGalleryReport(o) },
  { id: 'status-report', category: 'Analysis', label: 'Status Report', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Shows high-level database completeness and count metrics.', run: () => buildStatusReport() },
  { id: 'today-report', category: 'Analysis', label: 'Today Report', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'forDate', label: 'Generate for date', type: 'text', default: '', placeholder: 'YYYY-MM-DD (blank = today)' },
    { key: 'sortBy', label: 'Sorting', type: 'select', default: 'date', choices: [['date', 'By Date'], ['person', 'By Name']] },
    { key: 'groupByEventType', label: 'Grouping', type: 'boolean', default: true, checkboxLabel: 'Group by event type' },
    { key: 'includeBirth', label: 'Birth', type: 'boolean', default: true, checkboxLabel: 'Include births' },
    { key: 'todayIncludeChristening', label: 'Christening', type: 'boolean', default: true, checkboxLabel: 'Include christenings and baptisms' },
    { key: 'includeDeath', label: 'Death', type: 'boolean', default: true, checkboxLabel: 'Include deaths' },
    { key: 'todayIncludeBurial', label: 'Burial', type: 'boolean', default: true, checkboxLabel: 'Include burials' },
    { key: 'includeMarriage', label: 'Marriage', type: 'boolean', default: true, checkboxLabel: 'Include marriages' },
    { key: 'includeEngagement', label: 'Engagement', type: 'boolean', default: true, checkboxLabel: 'Include engagements' },
    { key: 'includeDivorce', label: 'Divorce', type: 'boolean', default: true, checkboxLabel: 'Include divorces and separations' },
    { key: 'includeOtherEvents', label: 'Other events', type: 'boolean', default: false, checkboxLabel: 'Include other person and family events' },
  ], helpText: 'Shows selected person and family event anniversaries for a given month and day, grouped by event type.', run: (rn, o) => buildTodayReport(o) },
  { id: 'changes-list', category: 'Lists', label: 'Changes List', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'includePersons', label: 'Persons', type: 'boolean', default: true, checkboxLabel: 'Include persons' },
    { key: 'includeFamilies', label: 'Families', type: 'boolean', default: true, checkboxLabel: 'Include families' },
    { key: 'includeSources', label: 'Sources', type: 'boolean', default: true, checkboxLabel: 'Include sources' },
    { key: 'includePlaces', label: 'Places', type: 'boolean', default: true, checkboxLabel: 'Include places' },
    { key: 'includeMedia', label: 'Media', type: 'boolean', default: true, checkboxLabel: 'Include media' },
    { key: 'includeOtherObjects', label: 'Other objects', type: 'boolean', default: true, checkboxLabel: 'Include other object types' },
    { key: 'showAuthor', label: 'Author', type: 'boolean', default: true, checkboxLabel: 'Show author of change' },
    { key: 'showStillExists', label: 'Still in database', type: 'boolean', default: true, checkboxLabel: 'Display whether the entry is still in the database' },
    { key: 'groupBy', label: 'Grouping', type: 'select', default: 'none', choices: [['none', 'No grouping'], ['objectType', 'Group by types'], ['author', 'Group by author']] },
    { key: 'sortOrder', label: 'Sorting', type: 'select', default: 'latest', choices: [['latest', 'Latest change first'], ['earliest', 'Earliest change first']] },
  ], helpText: 'Lists change-log entries with object, author, existence, grouping, and date-order controls.', run: (rn, o) => buildChangesListReport(o) },
  { id: 'dna-report', category: 'Person Reports', label: 'DNA Report', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Summarizes DNA tests by person, kind, provider, result data, and raw-file references.', run: (rn, o) => buildDNAReport(o) },
  { id: 'map-report', category: 'Analysis', label: 'Map Report', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists places with latitude, longitude, and GeoName identifiers.', run: () => buildMapReport() },
  { id: 'todo-list', category: 'Lists', label: 'ToDo List', needsSubject: false, includeHeader: true, defaultOptions: {}, optionsSchema: [
    { key: 'sortBy', label: 'Sort by', type: 'select', default: 'due', choices: [['due', 'Due date'], ['priority', 'Priority'], ['status', 'Status'], ['title', 'Title']] },
    { key: 'includeCompleted', label: 'Completed', type: 'boolean', default: true, checkboxLabel: 'Include completed ToDos' },
    { key: 'showText', label: 'Description', type: 'boolean', default: true, checkboxLabel: 'Show description column' },
  ], helpText: 'Lists ToDo records with status, priority, due date, and description.', run: (rn, o) => buildToDoListReport(o) },
  { id: 'plausibility-list', category: 'Analysis', label: 'Plausibility List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Runs plausibility checks and lists resulting warnings.', run: () => buildPlausibilityReport() },
];

export function getReportBuilderCategories(builders = REPORT_BUILDERS) {
  const categories = [];
  for (const builder of builders) {
    const name = builder.category || 'Reports';
    let category = categories.find((entry) => entry.name === name);
    if (!category) {
      category = { name, builders: [] };
      categories.push(category);
    }
    category.builders.push(builder);
  }
  return categories;
}

export function getReportBuilder(id) {
  return REPORT_BUILDERS.find((builder) => builder.id === id) || null;
}

export function defaultOptionsForBuilder(builderOrId) {
  const builder = typeof builderOrId === 'string' ? getReportBuilder(builderOrId) : builderOrId;
  const schemaDefaults = {};
  for (const option of builder?.optionsSchema || []) schemaDefaults[option.key] = option.default;
  return {
    includeHeader: builder?.includeHeader !== false,
    ...schemaDefaults,
    ...(builder?.defaultOptions || {}),
  };
}

export function normalizeReportOptions(builderOrId, options = {}) {
  return {
    ...defaultOptionsForBuilder(builderOrId),
    ...(options || {}),
  };
}

export function createSavedReportPayload({ id, name, builderId, targetId, secondTargetId, options, pageStyle, themeId = 'plain', reportLanguage = 'app' }) {
  const builder = getReportBuilder(builderId) || REPORT_BUILDERS[0];
  const theme = PRESENTATION_THEMES.some((entry) => entry.id === themeId) ? themeId : 'plain';
  return {
    id: id || newReportId(),
    name,
    builderId: builder.id,
    targetRecordName: builder.needsSubject === false ? null : targetId || null,
    targetRecordType: builder.needsSubject === false ? null : builder.subjectType || 'Person',
    secondTargetRecordName: builder.needsSecondSubject ? secondTargetId || null : null,
    secondTargetRecordType: builder.needsSecondSubject ? builder.secondSubjectType || 'Person' : null,
    options: normalizeReportOptions(builder, options),
    pageStyle: normalizeReportPageStyle(pageStyle),
    themeId: theme,
    reportLanguage: normalizeReportLanguage(reportLanguage),
  };
}

export function stateFromSavedReport(entry) {
  const builder = getReportBuilder(entry?.builderId) || REPORT_BUILDERS[0];
  return {
    builderId: builder.id,
    targetId: entry?.targetRecordName || null,
    secondTargetId: entry?.secondTargetRecordName || null,
    options: normalizeReportOptions(builder, entry?.options),
    pageStyle: normalizeReportPageStyle(entry?.pageStyle),
    themeId: PRESENTATION_THEMES.some((theme) => theme.id === entry?.themeId) ? entry.themeId : 'plain',
    reportLanguage: normalizeReportLanguage(entry?.reportLanguage),
  };
}

export function applyReportContentOptions(report, options = {}) {
  if (options.includeHeader !== false || !report?.blocks?.length) return report;
  let removedHeader = false;
  return {
    ...report,
    blocks: report.blocks.filter((entry) => {
      if (!removedHeader && entry.kind === 'title' && entry.level === 1) {
        removedHeader = true;
        return false;
      }
      return true;
    }),
  };
}
