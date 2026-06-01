/**
 * Public surface for the report builders. Splits live under ./builders/
 * organised by domain (person-centric, lists, story/media, analysis,
 * Vietnamese-localised). Existing imports of `./builders.js` continue
 * to work via this re-export.
 *
 * For new code, prefer `getReportBuilder(id)` from ./builders/registry.js.
 */
export {
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
} from './builders/personReports.js';

export { buildGiaPhaLineageReport } from './builders/vietnameseReports.js';

export {
  buildAnniversaryList,
  buildChangesListReport,
  buildEventsList,
  buildFactsListReport,
  buildMarriageListReport,
  buildPersonsList,
  buildPlacesList,
  buildSourcesList,
  buildSourceCitationAuditReport,
  buildToDoListReport,
} from './builders/listReports.js';

export {
  buildMediaGalleryReport,
  buildStoryReport,
  buildTimelineReport,
} from './builders/storyAndMediaReports.js';

export {
  buildMapReport,
  buildPlausibilityReport,
  buildStatusReport,
  buildTodayReport,
} from './builders/analysisReports.js';

export { REPORT_BUILDERS, getReportBuilder } from './builders/registry.js';
