/**
 * FamilySearch source folders + reference tags.
 *
 * Mirrors `FamilySearchSourceFoldersSheet` / `FamilySearchEditSourceReferenceTagsWidget`.
 * Stored entirely in IndexedDB meta — no additional record types.
 */
import { getLocalDatabase } from './LocalDatabase.js';

const FOLDERS_META_KEY = 'familySearchSourceFolders';
const REFERENCES_META_KEY = 'familySearchSourceReferenceTags';

export async function listFamilySearchSourceFolders() {
  const db = getLocalDatabase();
  const list = await db.getMeta(FOLDERS_META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function upsertFamilySearchSourceFolder(folder) {
  if (!folder?.id) throw new Error('Folder id required.');
  const db = getLocalDatabase();
  const list = await listFamilySearchSourceFolders();
  const idx = list.findIndex((item) => item.id === folder.id);
  const stamped = {
    id: folder.id,
    name: folder.name || 'Untitled folder',
    description: folder.description || '',
    parentId: folder.parentId || null,
    updatedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await db.setMeta(FOLDERS_META_KEY, list);
  return stamped;
}

export async function deleteFamilySearchSourceFolder(id) {
  const db = getLocalDatabase();
  const list = await listFamilySearchSourceFolders();
  await db.setMeta(FOLDERS_META_KEY, list.filter((item) => item.id !== id));
  const refs = await listFamilySearchSourceReferences();
  const next = refs.map((ref) => (ref.folderId === id ? { ...ref, folderId: null } : ref));
  await db.setMeta(REFERENCES_META_KEY, next);
}

export async function listFamilySearchSourceReferences() {
  const db = getLocalDatabase();
  const list = await db.getMeta(REFERENCES_META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function setFamilySearchSourceReferenceTags(sourceRecordName, { folderId = null, tags = [] } = {}) {
  if (!sourceRecordName) throw new Error('Source recordName required.');
  const db = getLocalDatabase();
  const list = await listFamilySearchSourceReferences();
  const idx = list.findIndex((item) => item.sourceRecordName === sourceRecordName);
  const stamped = {
    sourceRecordName,
    folderId,
    tags: [...new Set((tags || []).map((tag) => String(tag).trim()).filter(Boolean))],
    updatedAt: Date.now(),
  };
  if (idx >= 0) list[idx] = stamped;
  else list.push(stamped);
  await db.setMeta(REFERENCES_META_KEY, list);
  return stamped;
}

export async function getFamilySearchSourceReferenceTags(sourceRecordName) {
  const list = await listFamilySearchSourceReferences();
  return list.find((item) => item.sourceRecordName === sourceRecordName) || null;
}
