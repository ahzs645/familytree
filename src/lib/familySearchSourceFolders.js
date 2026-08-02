/**
 * FamilySearch source folders + reference tags.
 *
 * Mirrors `FamilySearchSourceFoldersSheet` / `FamilySearchEditSourceReferenceTagsWidget`.
 * Stored entirely in IndexedDB meta — no additional record types.
 */
import { getAppDataClient } from './data/AppDataClient.js';

const FOLDERS_META_KEY = 'familySearchSourceFolders';
const REFERENCES_META_KEY = 'familySearchSourceReferenceTags';
const POLICY_META_KEY = 'familySearchPolicyAcceptances';
const FURTHER_INFORMATION_META_KEY = 'familySearchFurtherInformationQueue';

export async function listFamilySearchSourceFolders() {
  const db = getAppDataClient().meta;
  const list = await db.get(FOLDERS_META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function upsertFamilySearchSourceFolder(folder) {
  if (!folder?.id) throw new Error('Folder id required.');
  const db = getAppDataClient().meta;
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
  await db.set(FOLDERS_META_KEY, list);
  return stamped;
}

export async function deleteFamilySearchSourceFolder(id) {
  const db = getAppDataClient().meta;
  const list = await listFamilySearchSourceFolders();
  await db.set(FOLDERS_META_KEY, list.filter((item) => item.id !== id));
  const refs = await listFamilySearchSourceReferences();
  const next = refs.map((ref) => (ref.folderId === id ? { ...ref, folderId: null } : ref));
  await db.set(REFERENCES_META_KEY, next);
}

export async function listFamilySearchSourceReferences() {
  const db = getAppDataClient().meta;
  const list = await db.get(REFERENCES_META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function setFamilySearchSourceReferenceTags(sourceRecordName, { folderId = null, tags = [] } = {}) {
  if (!sourceRecordName) throw new Error('Source recordName required.');
  const db = getAppDataClient().meta;
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
  await db.set(REFERENCES_META_KEY, list);
  return stamped;
}

/** Policy acceptance lives in tree metadata, so switching/restoring trees keeps it scoped. */
export async function getFamilySearchPolicyAcceptances() {
  const stored = await getAppDataClient().meta.get(POLICY_META_KEY);
  return {
    memories: stored?.memories || null,
    ordinances: stored?.ordinances || null,
  };
}

export async function acceptFamilySearchPolicy(policy) {
  if (policy !== 'memories' && policy !== 'ordinances') throw new Error('Unknown FamilySearch policy.');
  const current = await getFamilySearchPolicyAcceptances();
  const next = { ...current, [policy]: new Date().toISOString() };
  await getAppDataClient().meta.set(POLICY_META_KEY, next);
  return next;
}

export async function listFamilySearchFurtherInformation() {
  const stored = await getAppDataClient().meta.get(FURTHER_INFORMATION_META_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function saveFamilySearchFurtherInformation(items) {
  const normalized = normalizeFurtherInformationQueue(items);
  await getAppDataClient().meta.set(FURTHER_INFORMATION_META_KEY, normalized);
  return normalized;
}

export async function markFamilySearchFurtherInformationSeen(personId) {
  const current = await listFamilySearchFurtherInformation();
  const seenAt = new Date().toISOString();
  const next = current.map((item) => item.personId === personId ? { ...item, seenAt } : item);
  await getAppDataClient().meta.set(FURTHER_INFORMATION_META_KEY, next);
  return next;
}

/** Merge scan results while retaining the persisted seen state for unchanged items. */
export function mergeFamilySearchFurtherInformation(existing, scanned, namesById = {}) {
  const previous = new Map((existing || []).map((item) => [item.personId, item]));
  return normalizeFurtherInformationQueue((scanned || [])
    .filter((item) => item?.available && Number(item.total) > 0)
    .map((item) => {
      const old = previous.get(item.personId);
      const signature = furtherInformationSignature(item);
      return {
        ...item,
        personName: namesById[item.personId] || item.personName || old?.personName || item.personId,
        signature,
        seenAt: old?.signature === signature ? old.seenAt || null : null,
        scannedAt: new Date().toISOString(),
      };
    }));
}

export function normalizeFurtherInformationQueue(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    personId: String(item.personId || ''),
    personName: String(item.personName || item.personId || ''),
    notes: Math.max(0, Number(item.notes) || 0),
    memories: Math.max(0, Number(item.memories) || 0),
    discussions: Math.max(0, Number(item.discussions) || 0),
    total: Math.max(0, Number(item.total) || 0),
    available: item.available !== false,
    signature: item.signature || furtherInformationSignature(item),
    seenAt: item.seenAt || null,
    scannedAt: item.scannedAt || null,
  })).filter((item) => item.personId && item.total > 0);
}

function furtherInformationSignature(item) {
  return [item.notes || 0, item.memories || 0, item.discussions || 0, item.total || 0].join(':');
}
