/**
 * Media gallery presentation and workflow helpers.
 *
 * The sorting/grouping functions are deliberately pure so the route only has
 * to render their result. Mutation helpers keep MediaRelation and entry-image
 * changes on the normal change-log paths.
 */
import { getAppDataClient } from './data/AppDataClient.js';
import { createWithChangeLog, deleteWithChangeLog } from './recordWrite.js';
import { saveWithChangeLog } from './changeLog.js';
import { generateId } from './ids.js';
import { readRef, writeRef } from './schema.js';

export const MEDIA_RECORD_TYPES = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];
export const ENTRY_IMAGE_TARGET_TYPES = ['Person', 'Family', 'Source', 'Place'];

export const DEFAULT_MEDIA_GALLERY_PREFERENCES = Object.freeze({
  sortBy: 'title',
  groupBy: 'none',
  thumbnailSize: 'medium',
});

export function normalizeMediaGalleryPreferences(value = {}) {
  const sortBy = ['title', 'date'].includes(value?.sortBy) ? value.sortBy : 'title';
  const groupBy = ['none', 'type', 'year', 'decade'].includes(value?.groupBy) ? value.groupBy : 'none';
  const thumbnailSize = ['small', 'medium', 'large'].includes(value?.thumbnailSize) ? value.thumbnailSize : 'medium';
  return { sortBy, groupBy, thumbnailSize };
}

export function mediaTitle(record) {
  return String(
    record?.fields?.caption?.value
      || record?.fields?.title?.value
      || record?.fields?.filename?.value
      || record?.fields?.fileName?.value
      || record?.fields?.url?.value
      || record?.recordName
      || ''
  );
}

export function mediaTimestamp(record) {
  const value = record?.fields?.mft_creationDate?.value
    ?? record?.fields?.date?.value
    ?? record?.created?.timestamp
    ?? record?.modified?.timestamp;
  if (value == null || value === '') return null;
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Return stable presentation groups with title or newest-date-first sorting. */
export function groupMediaRecords(records, preferences = {}, locale = 'en') {
  const prefs = normalizeMediaGalleryPreferences(preferences);
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const sorted = [...(records || [])].sort((a, b) => {
    if (prefs.sortBy === 'date') {
      const dateDifference = (mediaTimestamp(b) ?? -Infinity) - (mediaTimestamp(a) ?? -Infinity);
      if (dateDifference) return dateDifference;
    }
    return collator.compare(mediaTitle(a), mediaTitle(b)) || String(a.recordName).localeCompare(String(b.recordName));
  });

  if (prefs.groupBy === 'none') return [{ key: 'all', kind: 'none', value: '', records: sorted }];
  const groups = new Map();
  for (const record of sorted) {
    let value;
    if (prefs.groupBy === 'type') value = record.recordType || 'unknown';
    else {
      const timestamp = mediaTimestamp(record);
      // Stored creation timestamps are absolute instants. UTC keeps an item
      // created near midnight from jumping years when the browser time zone
      // differs from the tree creator's.
      const year = timestamp == null ? null : new Date(timestamp).getUTCFullYear();
      value = year == null || !Number.isFinite(year)
        ? 'unknown'
        : prefs.groupBy === 'decade' ? Math.floor(year / 10) * 10 : year;
    }
    const key = `${prefs.groupBy}:${value}`;
    if (!groups.has(key)) groups.set(key, { key, kind: prefs.groupBy, value, records: [] });
    groups.get(key).records.push(record);
  }
  const result = [...groups.values()];
  if (prefs.groupBy === 'type') {
    result.sort((a, b) => {
      const aIndex = MEDIA_RECORD_TYPES.indexOf(a.value);
      const bIndex = MEDIA_RECORD_TYPES.indexOf(b.value);
      return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex);
    });
  } else {
    result.sort((a, b) => {
      if (a.value === 'unknown') return 1;
      if (b.value === 'unknown') return -1;
      return Number(b.value) - Number(a.value);
    });
  }
  return result;
}

export function mediaPictureIdentifier(record) {
  return record?.fields?.pictureFileIdentifier?.value
    || record?.fields?.thumbnailFileIdentifier?.value
    || record?.fields?.filename?.value
    || record?.fields?.fileName?.value
    || record?.recordName
    || '';
}

export function safeMediaFilename(value, fallback = 'media') {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+|[. ]+$/g, '')
    .trim();
  return (cleaned || fallback).slice(0, 180);
}

function extensionForMimeType(mimeType) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  }[String(mimeType || '').toLowerCase()] || 'bin';
}

export function mediaExportEntries(records, assetsByMedia = {}) {
  const usedNames = new Set();
  const uniqueName = (rawName) => {
    const safe = safeMediaFilename(rawName);
    const dot = safe.lastIndexOf('.');
    const base = dot > 0 ? safe.slice(0, dot) : safe;
    const extension = dot > 0 ? safe.slice(dot) : '';
    let candidate = safe;
    let counter = 2;
    while (usedNames.has(candidate.toLocaleLowerCase())) candidate = `${base} (${counter++})${extension}`;
    usedNames.add(candidate.toLocaleLowerCase());
    return candidate;
  };

  const entries = [];
  for (const record of records || []) {
    if (record.recordType === 'MediaURL') {
      const url = String(record.fields?.url?.value || '').trim();
      if (url) entries.push({
        filename: uniqueName(`${safeMediaFilename(mediaTitle(record), 'link')}.url`),
        text: `[InternetShortcut]\r\nURL=${url}\r\n`,
      });
      continue;
    }
    const assets = assetsByMedia[record.recordName] || [];
    assets.forEach((asset, index) => {
      if (!asset?.dataBase64) return;
      let filename = asset.filename || record.fields?.filename?.value || mediaTitle(record);
      if (!/\.[a-z0-9]{1,8}$/i.test(String(filename))) filename = `${filename}.${extensionForMimeType(asset.mimeType)}`;
      if (assets.length > 1 && index > 0) {
        const dot = String(filename).lastIndexOf('.');
        filename = dot > 0
          ? `${String(filename).slice(0, dot)}-${index + 1}${String(filename).slice(dot)}`
          : `${filename}-${index + 1}`;
      }
      entries.push({ filename: uniqueName(filename), dataBase64: asset.dataBase64 });
    });
  }
  return entries;
}

export async function buildMediaExportZip(records, assetsByMedia) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const entries = mediaExportEntries(records, assetsByMedia);
  for (const entry of entries) {
    if (entry.dataBase64) zip.file(entry.filename, entry.dataBase64, { base64: true });
    else zip.file(entry.filename, entry.text || '');
  }
  return { blob: await zip.generateAsync({ type: 'blob' }), fileCount: entries.length };
}

export function assetToBlob(asset) {
  if (!asset?.dataBase64) return null;
  const binary = atob(asset.dataBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: asset.mimeType || 'application/octet-stream' });
}

export async function loadAssetsForMedia(records) {
  const data = getAppDataClient();
  const pairs = await Promise.all((records || []).map(async (record) => {
    const ids = record.fields?.assetIds?.value || [];
    const assets = ids.length
      ? (await Promise.all(ids.map((id) => data.assets.get(id)))).filter(Boolean)
      : await data.assets.listForRecord(record.recordName);
    return [record.recordName, assets];
  }));
  return Object.fromEntries(pairs);
}

export async function attachMediaToTarget(mediaRecord, targetRecord) {
  if (!mediaRecord?.recordName || !targetRecord?.recordName) throw new Error('A media record and target record are required.');
  const db = getAppDataClient().records;
  const existing = await db.query('MediaRelation', {
    referenceField: 'target',
    referenceValue: targetRecord.recordName,
    limit: 100000,
  });
  const attached = existing.records.find((relation) => readRef(relation.fields?.media) === mediaRecord.recordName);
  if (attached) return attached;
  const relation = {
    recordName: generateId('mr'),
    recordType: 'MediaRelation',
    fields: {
      media: writeRef(mediaRecord.recordName, mediaRecord.recordType),
      target: writeRef(targetRecord.recordName, targetRecord.recordType),
      targetType: { value: targetRecord.recordType, type: 'STRING' },
      order: { value: existing.records.length, type: 'DOUBLE' },
    },
  };
  await createWithChangeLog(relation);
  return relation;
}

export async function setMediaAsEntryImage(mediaRecord, targetRecord) {
  if (mediaRecord?.recordType !== 'MediaPicture') throw new Error('Only pictures can be used as entry images.');
  if (!ENTRY_IMAGE_TARGET_TYPES.includes(targetRecord?.recordType)) throw new Error('This record type does not support an entry image.');
  await attachMediaToTarget(mediaRecord, targetRecord);
  const next = {
    ...targetRecord,
    fields: {
      ...(targetRecord.fields || {}),
      thumbnailFileIdentifier: { value: mediaPictureIdentifier(mediaRecord), type: 'STRING' },
    },
  };
  await saveWithChangeLog(next);
  return next;
}

export async function findMediaReferences(mediaIds) {
  const wanted = new Set(mediaIds || []);
  const result = await getAppDataClient().records.query('MediaRelation', { limit: 100000 });
  return result.records.filter((relation) => wanted.has(readRef(relation.fields?.media)));
}

export async function detachMediaFromTarget(mediaRecords, targetId) {
  const ids = new Set((mediaRecords || []).map((record) => record.recordName));
  const relations = await findMediaReferences([...ids]);
  const detached = relations.filter((relation) => readRef(relation.fields?.target) === targetId);
  for (const relation of detached) await deleteWithChangeLog(relation.recordName, 'MediaRelation');

  const target = targetId ? await getAppDataClient().records.get(targetId) : null;
  if (target?.fields?.thumbnailFileIdentifier?.value) {
    const detachedMediaIds = new Set(detached.map((relation) => readRef(relation.fields?.media)));
    const identifiers = new Set((mediaRecords || [])
      .filter((record) => detachedMediaIds.has(record.recordName))
      .map(mediaPictureIdentifier));
    if (identifiers.has(target.fields.thumbnailFileIdentifier.value)) {
      const fields = { ...target.fields };
      delete fields.thumbnailFileIdentifier;
      await saveWithChangeLog({ ...target, fields });
    }
  }
  return detached.length;
}

export async function deleteMediaEverywhere(mediaRecords) {
  const records = (mediaRecords || []).filter(Boolean);
  const ids = new Set(records.map((record) => record.recordName));
  const relations = await findMediaReferences([...ids]);
  const data = getAppDataClient();
  const targets = new Map();
  for (const relation of relations) {
    const targetId = readRef(relation.fields?.target);
    if (targetId && !targets.has(targetId)) targets.set(targetId, await data.records.get(targetId));
  }
  for (const targetType of ENTRY_IMAGE_TARGET_TYPES) {
    const result = await data.records.query(targetType, { limit: 100000 });
    for (const target of result.records) targets.set(target.recordName, target);
  }

  const deletedIdentifiers = new Set(records.map(mediaPictureIdentifier));
  for (const target of targets.values()) {
    if (!target?.fields?.thumbnailFileIdentifier?.value) continue;
    if (deletedIdentifiers.has(target.fields.thumbnailFileIdentifier.value)) {
      const fields = { ...target.fields };
      delete fields.thumbnailFileIdentifier;
      await saveWithChangeLog({ ...target, fields });
    }
  }

  const otherRelationFields = {
    LabelRelation: ['target', 'targetPerson', 'targetFamily', 'targetPlace', 'targetSource', 'baseObject'],
    SourceRelation: ['target'],
    ToDoRelation: ['target'],
    StoryRelation: ['target'],
    StorySectionRelation: ['target'],
  };
  const otherRelations = [];
  for (const [recordType, fieldNames] of Object.entries(otherRelationFields)) {
    const result = await data.records.query(recordType, { limit: 100000 });
    otherRelations.push(...result.records.filter((record) => (
      fieldNames.some((fieldName) => ids.has(readRef(record.fields?.[fieldName])))
    )));
  }
  for (const relation of [...relations, ...otherRelations]) await deleteWithChangeLog(relation.recordName, relation.recordType);
  for (const record of records) {
    const assets = await data.assets.listForRecord(record.recordName);
    const assetIds = new Set([...(record.fields?.assetIds?.value || []), ...assets.map((asset) => asset.assetId)]);
    for (const assetId of assetIds) await data.assets.delete(assetId);
    await deleteWithChangeLog(record.recordName, record.recordType);
  }
  return { deleted: records.length, detached: relations.length + otherRelations.length };
}
