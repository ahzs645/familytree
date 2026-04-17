/**
 * Saved chart templates — persisted in IndexedDB via LocalDatabase meta store.
 * A template captures: { id, name, chartType, themeId, generations, arcDegrees }.
 */
import { getLocalDatabase } from './LocalDatabase.js';

const META_KEY = 'savedChartTemplates';

export async function listChartTemplates() {
  const db = getLocalDatabase();
  const list = await db.getMeta(META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveChartTemplate(template) {
  const db = getLocalDatabase();
  const list = await listChartTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  const stamped = { ...template, savedAt: Date.now() };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await db.setMeta(META_KEY, list);
  return stamped;
}

export async function deleteChartTemplate(id) {
  const db = getLocalDatabase();
  const list = await listChartTemplates();
  const next = list.filter((t) => t.id !== id);
  await db.setMeta(META_KEY, next);
}

export function newTemplateId() {
  return 'tpl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
