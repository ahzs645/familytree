/**
 * ReportsApp — pick a builder, pick report subjects, preview the report,
 * save the configuration, export to any supported format.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, PanelLeftClose, PanelLeftOpen, Play, RotateCcw, RotateCw, Save, Search, Square, Trash2 } from 'lucide-react';
import { listAllPersons, findStartPerson } from '../../lib/treeQuery.js';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { compareStrings } from '../../lib/i18n.js';
import { readField } from '../../lib/schema.js';
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
} from '../../lib/reports/builders.js';
import { applyPageStyle, listSavedReports, saveReport, deleteSavedReport, renameSavedReport, newReportId } from '../../lib/reports/savedReports.js';
import { EXPORT_FORMATS, downloadReport } from '../../lib/reports/export.js';
import { DEFAULT_PAGE_STYLE, PRESENTATION_THEMES, normalizePageStyle } from '../../lib/presentationSettings.js';
import { getAuthorInfo } from '../../lib/authorInfo.js';
import { listBooks, saveBook, newBookId, normalizeBookPresentationSettings } from '../../lib/books.js';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { formClasses } from '../ui/formClasses.js';
import { cn } from '../../lib/utils.js';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { PresentationSettingsControls } from '../presentation/PresentationSettingsControls.jsx';
import { ReportPreview } from './ReportPreview.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { localizeReportAst } from '../../lib/reports/localizeReport.js';
import {
  reportCategoryLabel,
  reportExportLabel,
  reportOptionCheckbox,
  reportHelpText,
  reportOptionLabel,
  reportSubjectLabel,
} from '../../lib/reports/reportLabels.js';

export { normalizePageStyle };

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
    { key: 'sortBy', label: 'Sort by', type: 'select', default: 'type', choices: [['type', 'Type'], ['person', 'Person']] },
  ], helpText: 'Shows recorded births and deaths that match a given month and day, with how many years ago.', run: (rn, o) => buildTodayReport(o) },
  { id: 'changes-list', category: 'Lists', label: 'Changes List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists recent change-log entries in reverse chronological order.', run: () => buildChangesListReport() },
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

export function createSavedReportPayload({ name, builderId, targetId, secondTargetId, options, pageStyle, themeId = 'plain' }) {
  const builder = getReportBuilder(builderId) || REPORT_BUILDERS[0];
  const theme = PRESENTATION_THEMES.some((entry) => entry.id === themeId) ? themeId : 'plain';
  return {
    id: newReportId(),
    name,
    builderId: builder.id,
    targetRecordName: builder.needsSubject === false ? null : targetId || null,
    targetRecordType: builder.needsSubject === false ? null : builder.subjectType || 'Person',
    secondTargetRecordName: builder.needsSecondSubject ? secondTargetId || null : null,
    secondTargetRecordType: builder.needsSecondSubject ? builder.secondSubjectType || 'Person' : null,
    options: normalizeReportOptions(builder, options),
    pageStyle: normalizePageStyle(pageStyle),
    themeId: theme,
  };
}

export function stateFromSavedReport(entry) {
  const builder = getReportBuilder(entry?.builderId) || REPORT_BUILDERS[0];
  return {
    builderId: builder.id,
    targetId: entry?.targetRecordName || null,
    secondTargetId: entry?.secondTargetRecordName || null,
    options: normalizeReportOptions(builder, entry?.options),
    pageStyle: normalizePageStyle(entry?.pageStyle),
    themeId: PRESENTATION_THEMES.some((theme) => theme.id === entry?.themeId) ? entry.themeId : 'plain',
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

export function ReportsApp() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { recordName: activePersonId, setActivePerson } = useActivePerson();
  const modal = useModal();
  const [persons, setPersons] = useState([]);
  const [stories, setStories] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [secondTargetId, setSecondTargetId] = useState(null);
  const [builderId, setBuilderId] = useState('person-summary');
  const [options, setOptions] = useState(() => defaultOptionsForBuilder('person-summary'));
  const [pageStyle, setPageStyle] = useState(() => normalizePageStyle(DEFAULT_PAGE_STYLE));
  const [themeId, setThemeId] = useState('plain');
  const [report, setReport] = useState(null);
  const [customReport, setCustomReport] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [savedList, setSavedList] = useState([]);
  const [savedBooks, setSavedBooks] = useState([]);
  const [bookTargetId, setBookTargetId] = useState('');
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [authorInfo, setAuthorInfo] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  // The three-column workspace needs 480px before the preview gets a single
  // pixel, so on a phone the library and inspector pushed the report itself off
  // the right edge — along with the "Options" toggle, which landed at x=391 in
  // a container that does not scroll. Below 768px the workspace is one column
  // and the library starts closed, so the preview is what you land on.
  const [libraryOpen, setLibraryOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 767px)').matches;
  });
  const [reportSearch, setReportSearch] = useState('');
  const generationRequestRef = useRef(0);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => {
    if (speechSupported) window.speechSynthesis.cancel();
  }, [speechSupported]);

  useEffect(() => {
    let cancelled = false;
    getAuthorInfo()
      .then((info) => {
        if (!cancelled) setAuthorInfo(info);
      })
      .catch(() => {
        if (!cancelled) setAuthorInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const builder = useMemo(() => getReportBuilder(builderId) || REPORT_BUILDERS[0], [builderId]);
  const needsSubject = builder?.needsSubject !== false;
  const needsSecondSubject = !!builder?.needsSecondSubject;
  const usesGenerations = !!builder?.usesGenerations;
  const generationValue = Number(options.generations ?? builder?.defaultOptions?.generations ?? 5);
  const subjectItems = useMemo(() => getSubjectItemsForBuilder(builder, { persons, stories }), [builder, persons, stories]);
  const filteredBuilders = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    if (!query) return REPORT_BUILDERS;
    return REPORT_BUILDERS.filter((entry) => {
      const haystack = `${entry.label} ${entry.category || ''} ${entry.helpText || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [reportSearch]);
  const builderCategories = useMemo(() => getReportBuilderCategories(filteredBuilders), [filteredBuilders]);
  const displayReport = customReport || report;
  const reportStats = useMemo(() => summarizeReport(displayReport), [displayReport]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [personList, storyList, savedReports, books, start] = await Promise.all([
          listAllPersons(),
          listAllStories(),
          listSavedReports(),
          listBooks(),
          findStartPerson(),
        ]);
        if (cancelled) return;
        setPersons(personList);
        setStories(storyList);
        setSavedList(savedReports);
        setSavedBooks(books);
        setBookTargetId(books[0]?.id || '');
        setEmpty(personList.length === 0 && storyList.length === 0);

        const firstTarget = personList.some((person) => person.recordName === activePersonId)
          ? activePersonId
          : start?.recordName || personList[0]?.recordName || storyList[0]?.recordName || null;
        setTargetId(firstTarget);
        if (firstTarget && personList.some((person) => person.recordName === firstTarget)) setActivePerson(firstTarget);
        setSecondTargetId(personList.find((person) => person.recordName !== firstTarget)?.recordName || personList[0]?.recordName || null);
      } catch (error) {
        if (!cancelled) setGenerationError(error?.message || 'Unable to load report subjects.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Initial report defaults only; changing report subjects should not reload saved lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !needsSubject) return;
    if (subjectItems.length === 0) {
      if (targetId !== null) setTargetId(null);
      return;
    }
    if (!subjectItems.some((item) => item.recordName === targetId)) {
      setTargetId(subjectItems[0].recordName);
      if (builder.subjectType !== 'Story') setActivePerson(subjectItems[0].recordName);
    }
  }, [builder.subjectType, loading, needsSubject, setActivePerson, subjectItems, targetId]);

  useEffect(() => {
    if (loading || !needsSecondSubject) return;
    if (persons.length === 0) {
      if (secondTargetId !== null) setSecondTargetId(null);
      return;
    }
    if (!persons.some((person) => person.recordName === secondTargetId)) {
      setSecondTargetId(persons.find((person) => person.recordName !== targetId)?.recordName || persons[0].recordName);
    }
  }, [loading, needsSecondSubject, persons, targetId, secondTargetId]);

  useEffect(() => {
    if (loading || !builder) return;
    const normalizedOptions = normalizeReportOptions(builder, options);
    const missingSubject = builder.needsSubject !== false && !targetId;
    const missingSecondSubject = builder.needsSecondSubject && !secondTargetId;
    if (missingSubject || missingSecondSubject) {
      setReport(null);
      setReportLoading(false);
      return;
    }

    let cancelled = false;
    const requestId = ++generationRequestRef.current;
    setReportLoading(true);
    setGenerationError('');

    (async () => {
      try {
        const ast = await builder.run(targetId, normalizedOptions, secondTargetId);
        const optioned = applyReportContentOptions(ast, normalizedOptions);
        const localized = localizeReportAst(optioned, t);
        const styled = applyPageStyle(localized, pageStyle);
        if (!cancelled && generationRequestRef.current === requestId) {
          setReport(styled);
          if (!customizing) {
            setCustomReport(null);
            setUndoStack([]);
            setRedoStack([]);
          }
        }
      } catch (error) {
        if (!cancelled && generationRequestRef.current === requestId) {
          setReport(null);
          setGenerationError(error?.message || 'Report generation failed.');
        }
      } finally {
        if (!cancelled && generationRequestRef.current === requestId) setReportLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, builder, targetId, secondTargetId, options, pageStyle, t, customizing]);

  const updateOption = useCallback((key, value) => {
    setOptions((current) => ({ ...current, [key]: value }));
  }, []);

  const onBuilderChange = useCallback((nextBuilderId) => {
    setBuilderId(nextBuilderId);
    setOptions(defaultOptionsForBuilder(nextBuilderId));
    setGenerationError('');
    setCustomizing(false);
    setCustomReport(null);
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const builderLabel = (entry) => t(`reports.builders.${entry.id}`);
  const selectedBuilderLabel = builderLabel(builder);

  const onSave = useCallback(async () => {
    const name = await modal.prompt('Name for this report:', '', { title: t('reports.saveReport') });
    if (!name) return;
    await saveReport(createSavedReportPayload({
      name,
      builderId,
      targetId,
      secondTargetId,
      options,
      pageStyle,
      themeId,
    }));
    setSavedList(await listSavedReports());
  }, [builderId, targetId, secondTargetId, options, pageStyle, themeId, modal, t]);

  const onApplySaved = useCallback(async (id) => {
    const entry = savedList.find((r) => r.id === id);
    if (!entry) return;
    const state = stateFromSavedReport(entry);
    setBuilderId(state.builderId);
    setTargetId(state.targetId);
    setSecondTargetId(state.secondTargetId);
    setOptions(state.options);
    setPageStyle(state.pageStyle);
    setThemeId(state.themeId);
  }, [savedList]);

  const onDelete = useCallback(async (id) => {
    if (!(await modal.confirm('Delete this saved report?', { title: t('reports.deleteReport'), okLabel: t('common.delete'), destructive: true }))) return;
    await deleteSavedReport(id);
    setSavedList(await listSavedReports());
  }, [modal, t]);

  const onRename = useCallback(async (id) => {
    const entry = savedList.find((r) => r.id === id);
    if (!entry) return;
    const name = await modal.prompt('Rename this saved report:', entry.name || '', { title: 'Rename Report' });
    if (!name || name === entry.name) return;
    await renameSavedReport(id, name);
    setSavedList(await listSavedReports());
  }, [modal, savedList]);

  const currentReportPayload = useCallback((name) => createSavedReportPayload({
    name,
    builderId,
    targetId,
    secondTargetId,
    options,
    pageStyle,
    themeId,
  }), [builderId, targetId, secondTargetId, options, pageStyle, themeId]);

  const onAddToBook = useCallback(async () => {
    const reportName = await modal.prompt('Name this report section:', selectedBuilderLabel, { title: 'Add Report to Book' });
    if (!reportName) return;
    const savedReport = await saveReport(currentReportPayload(reportName));
    const books = await listBooks();
    const existing = books.find((book) => book.id === bookTargetId);
    const targetBook = existing || {
      id: newBookId(),
      title: 'Family Reports',
      presentationSettings: normalizeBookPresentationSettings(),
      sections: [
        { kind: 'cover', text: 'Family Reports', subtitle: '', author: '', date: '' },
        { kind: 'toc', tocStyle: 'numbered' },
      ],
    };
    const nextBook = {
      ...targetBook,
      sections: [...(targetBook.sections || []), { kind: 'saved-report', savedReportId: savedReport.id }],
    };
    await saveBook(nextBook);
    setSavedList(await listSavedReports());
    const nextBooks = await listBooks();
    setSavedBooks(nextBooks);
    setBookTargetId(nextBook.id);
  }, [bookTargetId, currentReportPayload, modal, selectedBuilderLabel]);

  const beginCustomize = useCallback(() => {
    if (!displayReport) return;
    setCustomReport(cloneReport(displayReport));
    setCustomizing(true);
    setUndoStack([]);
    setRedoStack([]);
  }, [displayReport]);

  const finishCustomize = useCallback(() => {
    setCustomizing(false);
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const discardCustomize = useCallback(() => {
    setCustomReport(null);
    setCustomizing(false);
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const pushCustomReport = useCallback((next) => {
    setCustomReport((current) => {
      if (!current) return next;
      setUndoStack((stack) => [...stack, cloneReport(current)].slice(-30));
      setRedoStack([]);
      return next;
    });
  }, []);

  const deleteCustomBlock = useCallback((index) => {
    if (!customReport?.blocks?.length) return;
    pushCustomReport({
      ...customReport,
      blocks: customReport.blocks.filter((_, blockIndex) => blockIndex !== index),
    });
  }, [customReport, pushCustomReport]);

  const onUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const previous = stack[stack.length - 1];
      setCustomReport((current) => {
        if (current) setRedoStack((redo) => [...redo, cloneReport(current)].slice(-30));
        return previous;
      });
      return stack.slice(0, -1);
    });
  }, []);

  const onRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (!stack.length) return stack;
      const next = stack[stack.length - 1];
      setCustomReport((current) => {
        if (current) setUndoStack((undo) => [...undo, cloneReport(current)].slice(-30));
        return next;
      });
      return stack.slice(0, -1);
    });
  }, []);

  const onExport = useCallback((fmt) => {
    if (!displayReport) return;
    downloadReport(fmt, displayReport, {
      filenameBase: displayReport.title,
      author: authorInfo,
      theme: themeId === 'plain' ? null : { id: themeId },
    });
  }, [displayReport, authorInfo, themeId]);

  const onSpeak = useCallback(() => {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = reportToSpeech(displayReport);
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setSpeaking(true);
  }, [displayReport, speaking, speechSupported]);

  if (loading) return <div className={loadingClass}>{t('common.loading')}</div>;
  if (empty) {
    return (
      <div className={loadingClass}>
        {t('reports.noFamilyData')} <Link to="/" className="ms-1.5 text-primary">{t('common.import')}</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Topbar wraps so the report title and the Play/Export actions stop
          overlapping once the row runs out of width. */}
      <header className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-4 py-2.5">
        <Button
          variant="secondary"
          size="icon"
          className="shrink-0"
          onClick={() => setLibraryOpen((open) => !open)}
          title={libraryOpen ? 'Hide report library' : 'Show report library'}
          aria-label={libraryOpen ? 'Hide report library' : 'Show report library'}
        >
          {libraryOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </Button>
        <div className="min-w-0">
          <div className={eyebrowClass}>{t('reports.ui.reportsEyebrow')}</div>
          <h1 className="m-0 max-w-[420px] truncate text-lg font-bold leading-tight text-foreground">{selectedBuilderLabel}</h1>
        </div>
        <div className="ms-auto flex min-w-0 flex-wrap items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
          <span>{reportCategoryLabel(t, builder.category || 'Reports')}</span>
          {reportStats && <span>{t('reports.ui.blocksCount', { count: reportStats.blocks })}</span>}
          {reportStats && <span>{t('reports.ui.tablesCount', { count: reportStats.tables })}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {speechSupported && (
            <Button
              variant="secondary"
              onClick={onSpeak}
              disabled={!displayReport || reportLoading}
              title={speaking ? 'Stop speaking' : 'Read this report aloud'}
            >
              {speaking ? <Square size={15} /> : <Play size={15} />}
              <span>{speaking ? t('reports.ui.stop') : t('reports.ui.play')}</span>
            </Button>
          )}
          <ExportSelect disabled={!displayReport || reportLoading} onExport={onExport} />
        </div>
      </header>

      <div
        className="grid min-h-0 flex-1 bg-secondary"
        style={{
          gridTemplateColumns: isMobile
            ? 'minmax(0, 1fr)'
            : libraryOpen
              ? 'minmax(220px, 280px) minmax(260px, 330px) minmax(0, 1fr)'
              : 'minmax(260px, 330px) minmax(0, 1fr)',
        }}
      >
        {libraryOpen && (
          <aside className="flex min-h-0 min-w-0 flex-col border-e border-border bg-background">
            <div className="m-3 flex items-center gap-2 rounded-md border border-border bg-secondary px-2.5 py-2 text-muted-foreground">
              <Search size={15} />
              <input
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                placeholder={t('reports.ui.findReport')}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none"
              />
            </div>
            <div className="min-h-0 overflow-auto px-2 pb-4">
              {builderCategories.map((category) => (
                <section key={category.name} className="mt-2.5">
                  <div className={cn(eyebrowClass, 'px-2 pb-1 pt-1.5')}>{reportCategoryLabel(t, category.name)}</div>
                  {category.builders.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onBuilderChange(entry.id)}
                      className={cn(
                        'flex min-h-[34px] w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-start text-sm text-foreground',
                        entry.id === builderId
                          ? 'border-primary/30 bg-primary/10'
                          : 'border-transparent bg-transparent hover:bg-accent',
                      )}
                    >
                      <FileText size={15} />
                      <span className="min-w-0 truncate">{builderLabel(entry)}</span>
                    </button>
                  ))}
                </section>
              ))}
              {builderCategories.length === 0 && <div className="p-3 text-sm text-muted-foreground">{t('reports.ui.noMatches')}</div>}
            </div>
          </aside>
        )}

        <aside className="min-w-0 overflow-auto border-e border-border bg-card p-4 text-card-foreground">
          <div className="mb-2 flex items-start justify-between gap-2.5">
            <div>
              <div className={eyebrowClass}>{t('reports.ui.reportEyebrow')}</div>
              <div className="text-base font-bold leading-tight text-foreground">{selectedBuilderLabel}</div>
            </div>
            <Button
              variant="secondary"
              onClick={() => setOptionsOpen((open) => !open)}
              className="lg:hidden"
              aria-expanded={optionsOpen}
            >
              {optionsOpen ? t('common.close') : t('reports.ui.options')}
            </Button>
          </div>
          <p className="mb-2.5 mt-0 text-xs leading-snug text-muted-foreground">{reportHelpText(t, builder)}</p>

          <div className={`${optionsOpen ? 'block' : 'hidden'} lg:block`}>
            <InspectorSection title={t('reports.ui.edit')}>
              {needsSubject && (
                <Field label={reportSubjectLabel(t, builder.subjectLabel) || t('reports.ui.subject')}>
                  {builder.subjectType === 'Story' ? (
                    <RecordSelect items={stories} value={targetId} onChange={setTargetId} placeholder={t('reports.selectStory')} />
                  ) : (
                    <PersonPicker persons={persons} value={targetId} onChange={(id) => { setTargetId(id); setActivePerson(id); }} />
                  )}
                </Field>
              )}

              {needsSecondSubject && (
                <Field label={reportSubjectLabel(t, builder.secondSubjectLabel) || t('reports.ui.secondSubject')}>
                  <PersonPicker persons={persons} value={secondTargetId} onChange={setSecondTargetId} />
                </Field>
              )}

              {usesGenerations && (
                <Field label={t('reports.generations')}>
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={generationValue}
                    onChange={(e) => updateOption('generations', Math.min(10, Math.max(2, +e.target.value || builder.defaultOptions.generations || 5)))}
                  />
                </Field>
              )}

              {(builder?.optionsSchema || []).map((option) => {
                const current = options[option.key] ?? option.default;
                if (option.type === 'boolean') {
                  return (
                    <Field key={option.key} label={reportOptionLabel(t, option)} wrap={false}>
                      <label className={checkRowClass}>
                        <input type="checkbox" checked={current !== false} onChange={(e) => updateOption(option.key, e.target.checked)} /> {reportOptionCheckbox(t, option)}
                      </label>
                    </Field>
                  );
                }
                if (option.type === 'select') {
                  return (
                    <Field key={option.key} label={reportOptionLabel(t, option)}>
                      <Select
                        value={current}
                        onChange={(next) => updateOption(option.key, next)}
                        options={option.choices.map(([value, label]) => ({ value, label }))}
                      />
                    </Field>
                  );
                }
                if (option.type === 'number') {
                  return (
                    <Field key={option.key} label={reportOptionLabel(t, option)}>
                      <Input
                        type="number"
                        min={option.min}
                        max={option.max}
                        value={current}
                        onChange={(e) => updateOption(option.key, Math.max(option.min ?? -Infinity, Math.min(option.max ?? Infinity, +e.target.value || option.default)))}
                      />
                    </Field>
                  );
                }
                if (option.type === 'text') {
                  return (
                    <Field key={option.key} label={reportOptionLabel(t, option)}>
                      <Input
                        type="text"
                        value={current || ''}
                        placeholder={option.placeholder || ''}
                        onChange={(e) => updateOption(option.key, e.target.value)}
                      />
                    </Field>
                  );
                }
                return null;
              })}

              <Field label={t('reports.header')}>
                <label className={checkRowClass}>
                  <input type="checkbox" checked={options.includeHeader !== false} onChange={(e) => updateOption('includeHeader', e.target.checked)} /> {t('reports.title')}
                </label>
              </Field>
            </InspectorSection>

            <InspectorSection title={t('reports.ui.stylePage')}>
              <PresentationSettingsControls value={pageStyle} onChange={setPageStyle} />
              <Field label={t('reports.theme')}>
                <Select
                  value={themeId}
                  onChange={setThemeId}
                  options={PRESENTATION_THEMES.map((theme) => ({
                    value: theme.id,
                    label: t(`presentation.theme.${theme.id}`, { defaultValue: theme.label }),
                  }))}
                />
              </Field>
            </InspectorSection>

            <InspectorSection title={t('reports.saved')}>
              <Button variant="primary" onClick={onSave} className="w-full"><Save size={15} /> {t('reports.ui.saveReport')}…</Button>
              <select value="" onChange={(e) => e.target.value && onApplySaved(e.target.value)} className={selectClass}>
                <option value="">{savedList.length ? t('reports.load') : 'No saved reports'}</option>
                {savedList.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
              {savedList.length > 0 && (
                <select value="" onChange={(e) => { if (e.target.value) onRename(e.target.value); e.target.value = ''; }} className={selectClass}>
                  <option value="">{t('reports.ui.renameReport')}</option>
                  {savedList.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </select>
              )}
              {savedList.length > 0 && (
                <select value="" onChange={(e) => e.target.value && onDelete(e.target.value)} className={selectClass}>
                  <option value="">{t('reports.ui.deleteReport')}</option>
                  {savedList.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </select>
              )}
              {savedList.length === 0 && <div className={microcopyClass}>{t('reports.ui.saveHint')}</div>}
            </InspectorSection>

            <InspectorSection title={t('reports.ui.reportEditing')}>
              {!customizing ? (
                <Button variant="secondary" onClick={beginCustomize} disabled={!displayReport || reportLoading}>{t('reports.ui.editReport')}</Button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="primary" onClick={finishCustomize}>{t('reports.ui.finish')}</Button>
                    <Button variant="secondary" onClick={discardCustomize}>{t('reports.ui.discard')}</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" onClick={onUndo} disabled={undoStack.length === 0}><RotateCcw size={15} /> {t('reports.ui.undo')}</Button>
                    <Button variant="secondary" onClick={onRedo} disabled={redoStack.length === 0}><RotateCw size={15} /> {t('reports.ui.redo')}</Button>
                  </div>
                  <div className="flex max-h-[220px] flex-col gap-1.5 overflow-auto">
                    {(customReport?.blocks || []).map((block, index) => (
                      <div key={`${block.kind}-${index}`} className="flex items-center gap-2 rounded-md border border-border bg-background py-1.5 pe-2 ps-2.5">
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{blockLabel(block, index)}</span>
                        <Button variant="destructiveOutline" size="icon" className="h-7 w-7 shrink-0" onClick={() => deleteCustomBlock(index)} title={t('reports.ui.deleteBlock')} aria-label={t('reports.ui.deleteBlock')}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className={microcopyClass}>{t('reports.ui.editHint')}</div>
            </InspectorSection>

            <InspectorSection title={t('reports.ui.books')}>
              <Select
                value={bookTargetId}
                onChange={setBookTargetId}
                options={[
                  { value: '', label: 'New book: Family Reports' },
                  ...savedBooks.map((book) => ({ value: book.id, label: book.title || 'Untitled Book' })),
                ]}
              />
              <Button variant="secondary" onClick={onAddToBook}>{t('reports.ui.addToBook')}</Button>
              <div className={microcopyClass}>{t('reports.ui.addToBookHint')}</div>
            </InspectorSection>
          </div>
        </aside>

        <div className="relative min-w-0 overflow-auto bg-gradient-to-b from-secondary to-background">
          {reportLoading && <div className="sticky top-0 z-10 border-b border-border bg-secondary px-5 py-2 text-xs text-foreground">{t('reports.generating', { label: selectedBuilderLabel })}</div>}
          {generationError && <div className="bg-destructive px-5 py-2 text-xs text-destructive-foreground">{generationError}</div>}
          <ReportPreview report={displayReport} />
        </div>
      </div>
    </div>
  );
}

/**
 * A real <label> wrapping the control, not a <span> beside it — otherwise the
 * caption is visible but the input has no accessible name.
 *
 * `wrap={false}` for rows whose children already contain their own <label>
 * (the checkbox options do), since nesting labels is invalid.
 */
function Field({ label, children, wrap = true }) {
  const Tag = wrap ? 'label' : 'div';
  return (
    <Tag className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </Tag>
  );
}

function InspectorSection({ title, children }) {
  return (
    <section className="mt-3.5 border-t border-border pt-3.5">
      <h2 className="mb-2.5 mt-0 text-xs font-bold text-foreground">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function ExportSelect({ disabled, onExport }) {
  const { t } = useTranslation();
  return (
    <label className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary ps-2.5 text-secondary-foreground">
      <Download size={15} />
      <select
        value=""
        disabled={disabled}
        onChange={(event) => {
          if (!event.target.value) return;
          onExport(event.target.value);
          event.target.value = '';
        }}
        className="h-full cursor-pointer border-0 bg-transparent pe-1 text-xs text-inherit outline-none disabled:cursor-not-allowed disabled:opacity-50"
        title={t('reports.export')}
      >
        <option value="">{t('reports.export')}</option>
        {EXPORT_FORMATS.map((format) => (
          <option key={format.id} value={format.id}>{reportExportLabel(t, format)}</option>
        ))}
      </select>
    </label>
  );
}

function RecordSelect({ items, value, onChange, placeholder }) {
  const { t } = useTranslation();
  return (
    <Select
      value={value || ''}
      onChange={(next) => onChange(next || null)}
      options={[
        { value: '', label: placeholder || t('reports.selectRecord') },
        ...items.map((item) => ({ value: item.recordName, label: item.label })),
      ]}
    />
  );
}

function getSubjectItemsForBuilder(builder, { persons, stories }) {
  if (builder?.needsSubject === false) return [];
  if (builder?.subjectType === 'Story') return stories;
  return persons;
}

async function listAllStories() {
  const db = getLocalDatabase();
  const { records } = await db.query('Story', { limit: 100000 });
  return records
    .map(storySubject)
    .filter(Boolean)
    .sort((a, b) => compareStrings(a.label, b.label));
}

function reportToSpeech(report) {
  if (!report?.blocks?.length) return '';
  const lines = [];
  if (report.title) lines.push(report.title);
  for (const block of report.blocks) {
    switch (block.kind) {
      case 'title':
        if (block.text) lines.push(block.text);
        break;
      case 'paragraph':
        if (block.text) lines.push(block.text);
        break;
      case 'list':
        for (const item of block.items || []) if (item) lines.push(item);
        break;
      case 'table':
        for (const row of block.rows || []) {
          const cells = row.filter((c) => c != null && String(c).trim());
          if (cells.length) lines.push(cells.join(', '));
        }
        break;
      default:
        break;
    }
  }
  return lines.join('. ').slice(0, 32000);
}

function summarizeReport(report) {
  if (!report?.blocks?.length) return null;
  return report.blocks.reduce((summary, block) => {
    summary.blocks += 1;
    if (block.kind === 'table') summary.tables += 1;
    if (block.kind === 'pageBreak') summary.pageBreaks += 1;
    return summary;
  }, { blocks: 0, tables: 0, pageBreaks: 0 });
}

function cloneReport(report) {
  return {
    ...report,
    blocks: (report?.blocks || []).map((block) => ({ ...block })),
    pageStyle: report?.pageStyle ? { ...report.pageStyle } : report?.pageStyle,
  };
}

function blockLabel(block, index) {
  if (!block) return `Block ${index + 1}`;
  if (block.kind === 'title') return `Heading: ${block.text || 'Untitled'}`;
  if (block.kind === 'paragraph') return `Paragraph: ${String(block.text || '').slice(0, 48) || 'Empty'}`;
  if (block.kind === 'table') return `Table: ${(block.rows || []).length} rows`;
  if (block.kind === 'list') return `List: ${(block.items || []).length} items`;
  if (block.kind === 'pageBreak') return 'Page break';
  return `${block.kind || 'Block'} ${index + 1}`;
}


function storySubject(record) {
  if (!record) return null;
  return {
    recordName: record.recordName,
    label: readField(record, ['title', 'name'], record.recordName || 'Story'),
  };
}

const eyebrowClass = 'text-xs font-bold uppercase text-muted-foreground';
/** Native <select> styled like the shared input; kept native for the value-reset action menus. */
const selectClass = cn(formClasses.input, 'cursor-pointer');
const checkRowClass = cn(formClasses.input, 'flex cursor-pointer items-center gap-2');
const microcopyClass = 'text-xs leading-snug text-muted-foreground';
const loadingClass = 'flex h-screen items-center justify-center bg-background text-muted-foreground';

export default ReportsApp;
