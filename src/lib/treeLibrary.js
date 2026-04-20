import { openDB } from 'idb';
import { exportBackup } from './backup.js';
import { getLocalDatabase } from './LocalDatabase.js';

const DB_NAME = 'cloudtreeweb-tree-library';
const DB_VERSION = 1;
const STORE = 'snapshots';

async function openLibrary() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byUpdatedAt', 'updatedAt');
      }
    },
  });
}

export async function listTreeSnapshots({ sortBy = 'updatedAt' } = {}) {
  const db = await openLibrary();
  const snapshots = await db.getAll(STORE);
  const mapped = snapshots.map(({ backup, ...summary }) => ({
    ...summary,
    favorite: !!summary.favorite,
    label: summary.label || '',
    recordCount: summary.recordCount || Object.keys(backup?.records || {}).length,
    assetCount: summary.assetCount || (Array.isArray(backup?.assets) ? backup.assets.length : 0),
  }));
  return sortSnapshots(mapped, sortBy);
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
  const snapshot = await db.get(STORE, snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  await db.put(STORE, { ...snapshot, favorite: !!favorite, updatedAt: new Date().toISOString() });
}

export async function setTreeSnapshotLabel(snapshotId, label) {
  const db = await openLibrary();
  const snapshot = await db.get(STORE, snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  await db.put(STORE, { ...snapshot, label: String(label || ''), updatedAt: new Date().toISOString() });
}

export async function sendTreeSnapshotAsCopy(snapshotId) {
  const db = await openLibrary();
  const snapshot = await db.get(STORE, snapshotId);
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
    id: `tree-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: String(name || '').trim() || `Tree ${now.slice(0, 10)}`,
    createdAt: now,
    updatedAt: now,
    counts: backup.counts || {},
    recordCount: Object.keys(backup.records || {}).length,
    assetCount: Array.isArray(backup.assets) ? backup.assets.length : 0,
    backup,
  };
  const db = await openLibrary();
  await db.put(STORE, snapshot);
  return snapshot;
}

export async function restoreTreeSnapshot(snapshotId) {
  const db = await openLibrary();
  const snapshot = await db.get(STORE, snapshotId);
  if (!snapshot?.backup?.records) throw new Error('Tree snapshot was not found.');
  await getLocalDatabase().importDataset({
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
  const snapshot = await db.get(STORE, snapshotId);
  if (!snapshot) throw new Error('Tree snapshot was not found.');
  const next = {
    ...snapshot,
    name: String(name || '').trim() || snapshot.name,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORE, next);
  return next;
}

export async function deleteTreeSnapshot(snapshotId) {
  const db = await openLibrary();
  await db.delete(STORE, snapshotId);
}
