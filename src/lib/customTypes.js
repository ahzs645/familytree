/**
 * Custom type catalogs — user-authored type labels for events, facts,
 * additional names, and ToDos.
 *
 * Mac reference: DatabaseMaintenance.strings exposes a "Custom * Types"
 * editor per entity. Users keep a list of type strings that show up in
 * the respective pickers (event type menu, fact type menu, etc.).
 *
 * This module persists those lists in IndexedDB meta and exposes CRUD
 * plus a helper to merge user entries with built-in catalogs from
 * `catalogs.js` so pickers stay consistent across the app.
 */

import { getLocalDatabase } from './LocalDatabase.js';

export const CUSTOM_TYPE_CATEGORIES = [
  { id: 'event', label: 'Custom Event Types', description: 'Extra event kinds for PersonEvent / FamilyEvent pickers.', metaKey: 'customTypes:event' },
  { id: 'fact', label: 'Custom Fact Types', description: 'Extra fact kinds for the PersonFact picker.', metaKey: 'customTypes:fact' },
  { id: 'additionalName', label: 'Custom Additional-Name Types', description: 'Alias/alternate-name kinds (stage name, married name, etc.).', metaKey: 'customTypes:additionalName' },
  { id: 'todo', label: 'Custom ToDo Types', description: 'Research-task categories for the ToDos list.', metaKey: 'customTypes:todo' },
];

function categoryFor(id) {
  return CUSTOM_TYPE_CATEGORIES.find((category) => category.id === id) || null;
}

function normalize(entry) {
  if (typeof entry === 'string') return { id: slug(entry), label: entry.trim() };
  if (!entry || typeof entry !== 'object') return null;
  const label = String(entry.label || '').trim();
  if (!label) return null;
  return { id: entry.id || slug(label), label, hint: entry.hint || '' };
}

function slug(value) {
  return `ct-${String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function listCustomTypes(categoryId) {
  const category = categoryFor(categoryId);
  if (!category) return [];
  const list = await getLocalDatabase().getMeta(category.metaKey);
  return Array.isArray(list) ? list.map(normalize).filter(Boolean) : [];
}

export async function saveCustomType(categoryId, entry) {
  const category = categoryFor(categoryId);
  if (!category) throw new Error(`Unknown type category: ${categoryId}`);
  const normalized = normalize(entry);
  if (!normalized) throw new Error('Custom type needs a label.');
  const db = getLocalDatabase();
  const current = await listCustomTypes(categoryId);
  const idx = current.findIndex((item) => item.id === normalized.id);
  if (idx >= 0) current[idx] = normalized;
  else current.push(normalized);
  await db.setMeta(category.metaKey, current);
  return normalized;
}

export async function deleteCustomType(categoryId, id) {
  const category = categoryFor(categoryId);
  if (!category) return;
  const db = getLocalDatabase();
  const current = await listCustomTypes(categoryId);
  await db.setMeta(category.metaKey, current.filter((entry) => entry.id !== id));
}

export async function reorderCustomTypes(categoryId, orderedIds) {
  const category = categoryFor(categoryId);
  if (!category) return;
  const db = getLocalDatabase();
  const current = await listCustomTypes(categoryId);
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  // Append any entries that weren't in the ordering list so nothing disappears.
  for (const entry of current) if (!orderedIds.includes(entry.id)) reordered.push(entry);
  await db.setMeta(category.metaKey, reordered);
}

/**
 * Merge a caller-provided built-in list with the user's custom entries.
 * The Mac type pickers show user types at the bottom so callers can keep
 * the same shape — built-ins first, custom entries last.
 */
export function mergeWithBuiltins(builtinList = [], customList = []) {
  const existing = new Set(builtinList.map((entry) => String(entry?.id || entry?.label || '').toLowerCase()));
  const additions = customList.filter((entry) => entry?.label && !existing.has(String(entry.id || entry.label).toLowerCase()));
  return [...builtinList, ...additions];
}
