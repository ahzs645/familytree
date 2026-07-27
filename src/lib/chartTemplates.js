/**
 * Saved chart templates — persisted in IndexedDB via LocalDatabase meta store.
 * A template captures: { id, name, chartType, themeId, generations, arcDegrees }.
 */
import { getAppDataClient } from './data/AppDataClient.js';
import { generateId } from './ids.js';

const META_KEY = 'savedChartTemplates';

export async function listChartTemplates() {
  const db = getAppDataClient().meta;
  const list = await db.get(META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveChartTemplate(template) {
  const db = getAppDataClient().meta;
  const list = await listChartTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  const stamped = { ...template, savedAt: Date.now() };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await db.set(META_KEY, list);
  return stamped;
}

export async function deleteChartTemplate(id) {
  const db = getAppDataClient().meta;
  const list = await listChartTemplates();
  const next = list.filter((t) => t.id !== id);
  await db.set(META_KEY, next);
}

export function newTemplateId() {
  return generateId('tpl');
}
