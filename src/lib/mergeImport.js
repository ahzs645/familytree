import { getLocalDatabase } from './LocalDatabase.js';

export async function mergeBackupJSON(json) {
  if (!json || json.format !== 'cloudtreeweb-backup' || !json.records) {
    throw new Error('File is not a CloudTreeWeb backup.');
  }
  const db = getLocalDatabase();
  const incoming = Object.values(json.records);
  const nameMap = new Map();
  for (const record of incoming) {
    const existing = await db.getRecord(record.recordName);
    if (existing) nameMap.set(record.recordName, uniqueRecordName(record.recordName));
  }

  const rewrittenRecords = incoming.map((record) => rewriteRecord(structuredCloneSafe(record), nameMap));
  const rewrittenAssets = (json.assets || []).map((asset) => {
    const next = structuredCloneSafe(asset);
    if (nameMap.has(next.ownerRecordName)) next.ownerRecordName = nameMap.get(next.ownerRecordName);
    if (next.assetId && nameMap.has(asset.ownerRecordName)) next.assetId = `${next.assetId}-merge-${Date.now().toString(36)}`;
    return next;
  });

  await db.applyRecordTransaction({ saveRecords: rewrittenRecords, saveAssets: rewrittenAssets });
  return {
    records: rewrittenRecords.length,
    assets: rewrittenAssets.length,
    renamed: nameMap.size,
  };
}

function rewriteRecord(record, nameMap) {
  if (nameMap.has(record.recordName)) record.recordName = nameMap.get(record.recordName);
  for (const field of Object.values(record.fields || {})) {
    if (!field || typeof field.value !== 'string') continue;
    for (const [from, to] of nameMap.entries()) {
      if (field.value === from) field.value = to;
      else if (field.value.startsWith(`${from}---`)) field.value = `${to}${field.value.slice(from.length)}`;
    }
  }
  return record;
}

function uniqueRecordName(recordName) {
  return `${recordName}-merge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
