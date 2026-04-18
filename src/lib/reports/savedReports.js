/**
 * Saved report configurations — persisted in IndexedDB meta store.
 * A saved report is a recipe: { id, name, builderId, targetRecordName, options,
 * pageStyle: { background, paginate }, themeId, savedAt }. The actual report
 * content is regenerated each time from live data so saved reports stay current.
 */
import { getLocalDatabase } from '../LocalDatabase.js';

const META_KEY = 'savedReports';

export async function listSavedReports() {
  const db = getLocalDatabase();
  const list = await db.getMeta(META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveReport(report) {
  const db = getLocalDatabase();
  const list = await listSavedReports();
  const idx = list.findIndex((r) => r.id === report.id);
  const stamped = { ...report, savedAt: Date.now() };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await db.setMeta(META_KEY, list);
  return stamped;
}

export async function deleteSavedReport(id) {
  const db = getLocalDatabase();
  const list = await listSavedReports();
  await db.setMeta(META_KEY, list.filter((r) => r.id !== id));
}

export function newReportId() {
  return 'rpt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** Apply page-style options (pagination, background) to a generated report AST. */
export function applyPageStyle(report, pageStyle = {}) {
  const styledReport = { ...report, pageStyle: { ...pageStyle } };
  if (!pageStyle.paginate || !styledReport.blocks.length) return styledReport;
  // Insert a page break before each top-level (h1/h2) title after the first.
  const blocks = [];
  let seenTitle = false;
  for (const b of styledReport.blocks) {
    if (b.kind === 'title' && b.level <= 2) {
      if (seenTitle) blocks.push({ kind: 'pageBreak' });
      seenTitle = true;
    }
    blocks.push(b);
  }
  return { ...styledReport, blocks };
}
