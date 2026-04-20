/**
 * Saved chart documents — full editable chart state, separate from lightweight
 * templates. Documents preserve subject picks, page setup, overlays, and chart
 * options so they can be reopened as editable web chart documents.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { normalizeChartDocument } from './chartDocumentSchema.js';

const META_KEY = 'savedChartDocuments';

export async function listChartDocuments() {
  const db = getLocalDatabase();
  const list = await db.getMeta(META_KEY);
  return Array.isArray(list) ? list.map(normalizeChartDocument) : [];
}

export async function saveChartDocument(document) {
  const db = getLocalDatabase();
  const list = await listChartDocuments();
  const now = Date.now();
  const normalized = normalizeChartDocument(document);
  const stamped = {
    ...normalized,
    createdAt: normalized.createdAt || now,
    updatedAt: now,
    savedAt: now,
  };
  const idx = list.findIndex((item) => item.id === stamped.id);
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await db.setMeta(META_KEY, list);
  return stamped;
}

export async function deleteChartDocument(id) {
  const db = getLocalDatabase();
  const list = await listChartDocuments();
  await db.setMeta(META_KEY, list.filter((item) => item.id !== id));
}

export function newChartDocumentId() {
  return 'chartdoc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
