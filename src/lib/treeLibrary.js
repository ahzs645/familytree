import Dexie from 'dexie';
import { exportBackup } from './backup.js';
import { getAppDataClient } from './data/index.js';
import {
  DATASET_SCHEMA_VERSION,
  DATASET_SCHEMA_VERSION_META_KEY,
} from './datasetSchemaVersion.js';
import { generateId } from './ids.js';

const DB_NAME = 'cloudtreeweb-tree-library';
const DB_VERSION = 1;
const STORE = 'snapshots';
export const TREE_ARTWORK_MODES = Object.freeze(['crest', 'single', 'mosaic']);

// localStorage pointer to the library snapshot that the active dataset belongs
// to. Stored outside Dexie meta because importDataset() clears the meta store.
const ACTIVE_TREE_KEY = 'cloudtreeweb.activeTreeId';
export const ACTIVE_TREE_CHANGED_EVENT = 'cloudtreeweb:active-tree-changed';
export const TREES_CHANGED_EVENT = 'cloudtreeweb:trees-changed';

let libraryDb = null;

function newTreeId() {
  return generateId('tree');
}

function emitTreesChanged() {
  try { window.dispatchEvent(new CustomEvent(TREES_CHANGED_EVENT)); } catch { /* SSR/test */ }
}

export function getActiveTreeId() {
  try { return localStorage.getItem(ACTIVE_TREE_KEY); } catch { return null; }
}

export function setActiveTreeId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_TREE_KEY, id);
    else localStorage.removeItem(ACTIVE_TREE_KEY);
  } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent(ACTIVE_TREE_CHANGED_EVENT, { detail: { id: id || null } }));
  } catch { /* SSR/test */ }
}

/** Name of the tree currently loaded, as shown in the tree switcher. */
export async function getActiveTreeName() {
  const id = getActiveTreeId();
  if (!id) return '';
  try {
    const db = await openLibrary();
    const snapshot = await db[STORE].get(id);
    return snapshot?.name || '';
  } catch {
    return '';
  }
}

async function openLibrary() {
  if (!libraryDb) {
    libraryDb = new Dexie(DB_NAME);
    libraryDb.version(DB_VERSION).stores({
      [STORE]: 'id, updatedAt',
    });
  }
  if (!libraryDb.isOpen()) await libraryDb.open();
  return libraryDb;
}

export async function listTreeSnapshots({ sortBy = 'updatedAt' } = {}) {
  const db = await openLibrary();
  const snapshots = await db[STORE].toArray();
  const mapped = snapshots.map(({ backup, ...summary }) => ({
    ...summary,
    favorite: !!summary.favorite,
    label: summary.label || '',
    recordCount: summary.recordCount || Object.keys(backup?.records || {}).length,
    assetCount: summary.assetCount || (Array.isArray(backup?.assets) ? backup.assets.length : 0),
    artwork: normalizeTreeArtwork(summary.artwork),
    artworkImages: selectedArtworkImages(summary.artwork, backup),
  }));
  return sortSnapshots(mapped, sortBy);
}

export function normalizeTreeArtwork(value) {
  const mode = TREE_ARTWORK_MODES.includes(value?.mode) ? value.mode : 'crest';
  const gridSize = Math.max(1, Math.min(4, Number(value?.gridSize) || 2));
  const crest = ['tree', 'shield', 'heart', 'star'].includes(value?.crest) ? value.crest : 'tree';
  const mediaIds = [...new Set(Array.isArray(value?.mediaIds) ? value.mediaIds.filter(Boolean).map(String) : [])].slice(0, 16);
  return { mode, gridSize, crest, mediaIds };
}

export async function getTreeArtworkMedia(snapshotId) {
  const db = await openLibrary();
  const snapshot = await db[STORE].get(snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  const records = Object.values(snapshot.backup?.records || {}).filter((record) => record?.recordType === 'MediaPicture');
  return records.map((record) => ({
    id: record.recordName,
    label: record.fields?.caption?.value || record.fields?.title?.value || record.fields?.filename?.value || record.recordName,
    src: imageForMedia(record.recordName, snapshot.backup),
  })).filter((item) => item.src).sort((a, b) => item.label.localeCompare(b.label));
}

export async function setTreeSnapshotArtwork(snapshotId, artwork) {
  const db = await openLibrary();
  const snapshot = await db[STORE].get(snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  const next = { ...snapshot, artwork: normalizeTreeArtwork(artwork), updatedAt: new Date().toISOString() };
  await db[STORE].put(next);
  emitTreesChanged();
  return next.artwork;
}

function selectedArtworkImages(artwork, backup) {
  const config = normalizeTreeArtwork(artwork);
  return config.mediaIds.map((id) => imageForMedia(id, backup)).filter(Boolean).slice(0, config.mode === 'single' ? 1 : config.gridSize ** 2);
}

function imageForMedia(mediaId, backup) {
  const record = backup?.records?.[mediaId];
  if (!record || record.recordType !== 'MediaPicture') return '';
  const ids = record.fields?.assetIds?.value || [];
  const asset = (backup.assets || []).find((item) => ids.includes(item.assetId) || item.ownerRecordName === mediaId);
  if (!asset?.dataBase64 || !String(asset.mimeType || '').startsWith('image/')) return '';
  return `data:${asset.mimeType};base64,${asset.dataBase64}`;
}

export async function clearTreeSnapshots() {
  const db = await openLibrary();
  await db[STORE].clear();
}

function sortSnapshots(list, sortBy) {
  const arr = [...list];
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
  const byUpdated = (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt));
  let primary;
  if (sortBy === 'name') primary = byName;
  else if (sortBy === 'favorites') primary = (a, b) => {
    if (!!b.favorite !== !!a.favorite) return Number(!!b.favorite) - Number(!!a.favorite);
    return byUpdated(a, b);
  };
  else primary = byUpdated;
  return arr.sort(primary);
}

export async function setTreeSnapshotFavorite(snapshotId, favorite) {
  const db = await openLibrary();
  const snapshot = await db[STORE].get(snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  await db[STORE].put({ ...snapshot, favorite: !!favorite, updatedAt: new Date().toISOString() });
  emitTreesChanged();
}

export async function setTreeSnapshotLabel(snapshotId, label) {
  const db = await openLibrary();
  const snapshot = await db[STORE].get(snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  await db[STORE].put({ ...snapshot, label: String(label || ''), updatedAt: new Date().toISOString() });
  emitTreesChanged();
}

export async function sendTreeSnapshotAsCopy(snapshotId) {
  const db = await openLibrary();
  const snapshot = await db[STORE].get(snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  const blob = new Blob([JSON.stringify(snapshot.backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(snapshot.name)}-copy.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function safeFilename(value) {
  return String(value || 'tree').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'tree';
}

export async function saveCurrentTreeSnapshot(name = '') {
  const backup = await exportBackup();
  const now = new Date().toISOString();
  const snapshot = {
    id: generateId('tree'),
    name: String(name || '').trim() || `Tree ${now.slice(0, 10)}`,
    createdAt: now,
    updatedAt: now,
    counts: backup.counts || {},
    recordCount: Object.keys(backup.records || {}).length,
    assetCount: Array.isArray(backup.assets) ? backup.assets.length : 0,
    backup,
    artwork: normalizeTreeArtwork(),
  };
  const db = await openLibrary();
  await db[STORE].put(snapshot);
  return snapshot;
}

export async function restoreTreeSnapshot(snapshotId) {
  const db = await openLibrary();
  const snapshot = await db[STORE].get(snapshotId);
  if (!snapshot?.backup?.records) throw new Error('Tree snapshot was not found.');
  await getAppDataClient().records.importDataset({
    ...snapshot.backup,
    meta: {
      ...(snapshot.backup.meta || {}),
      restoredFromSnapshot: snapshot.name,
      restoredAt: new Date().toISOString(),
    },
  });
  return {
    records: Object.keys(snapshot.backup.records || {}).length,
    assets: Array.isArray(snapshot.backup.assets) ? snapshot.backup.assets.length : 0,
  };
}

export async function renameTreeSnapshot(snapshotId, name) {
  const db = await openLibrary();
  const snapshot = await db[STORE].get(snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  const next = {
    ...snapshot,
    name: String(name || '').trim() || snapshot.name,
    updatedAt: new Date().toISOString(),
  };
  await db[STORE].put(next);
  emitTreesChanged();
  return next;
}

export async function deleteTreeSnapshot(snapshotId) {
  const db = await openLibrary();
  await db[STORE].delete(snapshotId);
  if (getActiveTreeId() === snapshotId) setActiveTreeId(null);
  emitTreesChanged();
}

function defaultTreeName() {
  return `Tree ${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Save the current active dataset into the library under the active-tree
 * pointer (upsert). If there is no active pointer, generates one and stores it
 * — so an imported-but-never-saved tree gets captured on first switch instead
 * of being lost.
 *
 * No-op when the dataset is empty AND there is no existing entry AND no name
 * was provided (avoids creating phantom empty entries on first run).
 *
 * Returns the upserted snapshot summary (without backup), or null on no-op.
 */
export async function upsertActiveTreeSnapshot({ name } = {}) {
  const backup = await exportBackup();
  const recordCount = Object.keys(backup.records || {}).length;
  const assetCount = Array.isArray(backup.assets) ? backup.assets.length : 0;

  let id = getActiveTreeId();
  const db = await openLibrary();
  const existing = id ? await db[STORE].get(id) : null;

  if (!id) {
    if (recordCount === 0 && !name) return null;
    id = newTreeId();
    setActiveTreeId(id);
  }

  const now = new Date().toISOString();
  const next = {
    id,
    name: String(name || existing?.name || defaultTreeName()).trim() || defaultTreeName(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    favorite: existing?.favorite ?? false,
    label: existing?.label || '',
    artwork: normalizeTreeArtwork(existing?.artwork),
    counts: backup.counts || {},
    recordCount,
    assetCount,
    backup,
  };
  await db[STORE].put(next);
  emitTreesChanged();
  const { backup: _omit, ...summary } = next;
  return summary;
}

/** Convenience: save the current dataset back into its active-tree entry. */
export async function saveActiveTree() {
  return upsertActiveTreeSnapshot();
}

/**
 * Non-destructive tree switch: save the current tree back to the library
 * first, then restore the target snapshot and update the active pointer.
 * Returns the result from restoreTreeSnapshot, or null when switching to the
 * already-active tree.
 */
export async function switchToTree(snapshotId) {
  if (!snapshotId) throw new Error('switchToTree requires a snapshot id.');
  if (getActiveTreeId() === snapshotId) return null;
  await saveActiveTree();
  const result = await restoreTreeSnapshot(snapshotId);
  setActiveTreeId(snapshotId);
  return result;
}

/**
 * Start a fresh empty tree: save the current one back, clear the active
 * dataset, generate a new active id, and create the library entry so it
 * shows up in "My trees" immediately. The caller (onboarding) is expected
 * to populate the dataset and then call saveActiveTree() to sync counts.
 *
 * Returns the new active-tree id.
 */
export async function startNewTree(name) {
  await saveActiveTree();
  await getAppDataClient().records.clearAll();
  // Stamp the current dataset schema version so the SchemaMigrationSheet
  // doesn't prompt the user on a freshly created tree (importDataset sets
  // this for imports; we have to set it explicitly for from-scratch trees).
  await getAppDataClient().meta.set(DATASET_SCHEMA_VERSION_META_KEY, DATASET_SCHEMA_VERSION);
  const id = newTreeId();
  setActiveTreeId(id);
  await upsertActiveTreeSnapshot({ name: name || defaultTreeName() });
  return id;
}
