/**
 * Maps a stable report-id string (used in saved books, persisted UI
 * state, and deep links) to the builder function that produces it.
 *
 * Treat the keys as a wire format — renaming one breaks existing book
 * documents and saved chart references. Add new entries, never reword.
 */
import {
  buildAhnentafelReport,
  buildAncestorNarrative,
  buildDescendancyReport,
  buildDescendantNarrative,
  buildFamilyGroupSheet,
  buildKinshipReport,
  buildNarrativeReport,
  buildPersonEventsReport,
  buildPersonSummary,
  buildRegisterReport,
} from './personReports.js';
import { buildGiaPhaLineageReport } from './vietnameseReports.js';
import {
  buildAnniversaryList,
  buildChangesListReport,
  buildEventsList,
  buildFactsListReport,
  buildMarriageListReport,
  buildPersonsList,
  buildPlacesList,
  buildSourcesList,
  buildToDoListReport,
} from './listReports.js';
import {
  buildMediaGalleryReport,
  buildStoryReport,
  buildTimelineReport,
} from './storyAndMediaReports.js';
import {
  buildMapReport,
  buildPlausibilityReport,
  buildStatusReport,
  buildTodayReport,
} from './analysisReports.js';

export const REPORT_BUILDERS = Object.freeze({
  'person-summary': buildPersonSummary,
  'ancestor-narrative': buildAncestorNarrative,
  'descendant-narrative': buildDescendantNarrative,
  'family-group-sheet': buildFamilyGroupSheet,
  'person-events': buildPersonEventsReport,
  'kinship': buildKinshipReport,
  'ahnentafel': buildAhnentafelReport,
  'register': buildRegisterReport,
  'descendancy': buildDescendancyReport,
  'narrative': buildNarrativeReport,
  'gia-pha-lineage': buildGiaPhaLineageReport,
  'persons-list': buildPersonsList,
  'places-list': buildPlacesList,
  'sources-list': buildSourcesList,
  'events-list': buildEventsList,
  'anniversary-list': buildAnniversaryList,
  'todo-list': buildToDoListReport,
  'changes-list': buildChangesListReport,
  'facts-list': buildFactsListReport,
  'marriage-list': buildMarriageListReport,
  'story': buildStoryReport,
  'media-gallery': buildMediaGalleryReport,
  'timeline': buildTimelineReport,
  'plausibility-list': buildPlausibilityReport,
  'status': buildStatusReport,
  'today': buildTodayReport,
  'map': buildMapReport,
});

export function getReportBuilder(id) {
  return REPORT_BUILDERS[id] || null;
}
