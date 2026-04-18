import { getLocalDatabase } from './LocalDatabase.js';

export async function analyzeBackupMergeJSON(json) {
  if (!json || json.format !== 'cloudtreeweb-backup' || !json.records) {
    throw new Error('File is not a CloudTreeWeb backup.');
  }
  const db = getLocalDatabase();
  const incoming = Object.values(json.records);
  const recordTypes = {};
  let collisions = 0;
  const collisionSamples = [];
  for (const record of incoming) {
    recordTypes[record.recordType] = (recordTypes[record.recordType] || 0) + 1;
    const existing = await db.getRecord(record.recordName);
    if (existing) {
      collisions += 1;
      if (collisionSamples.length < 8) collisionSamples.push({ recordName: record.recordName, recordType: record.recordType });
    }
  }

  let assetCollisions = 0;
  const assetSamples = [];
  for (const asset of json.assets || []) {
    if (!asset?.assetId) continue;
    const existing = await db.getAsset(asset.assetId);
    if (existing) {
      assetCollisions += 1;
      if (assetSamples.length < 8) assetSamples.push(asset.assetId);
    }
  }

  return {
    records: incoming.length,
    assets: Array.isArray(json.assets) ? json.assets.length : 0,
    collisions,
    collisionSamples,
    assetCollisions,
    assetSamples,
    recordTypes,
    exportedAt: json.exportedAt || null,
    backupVersion: json.version || 1,
  };
}

export async function mergeBackupJSON(json, { rollbackNote = '' } = {}) {
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

  const assetIdMap = new Map();
  for (const asset of json.assets || []) {
    if (!asset?.assetId) continue;
    const existing = await db.getAsset(asset.assetId);
    if (existing) assetIdMap.set(asset.assetId, uniqueAssetId(asset.assetId));
  }

  const rewrittenRecords = incoming.map((record) => rewriteRecord(structuredCloneSafe(record), nameMap, assetIdMap));
  const rewrittenAssets = (json.assets || []).map((asset) => {
    const next = structuredCloneSafe(asset);
    if (nameMap.has(next.ownerRecordName)) next.ownerRecordName = nameMap.get(next.ownerRecordName);
    if (assetIdMap.has(next.assetId)) next.assetId = assetIdMap.get(next.assetId);
    return next;
  });
  const logEntry = buildMergeLogEntry({
    records: rewrittenRecords.length,
    assets: rewrittenAssets.length,
    renamed: nameMap.size,
    assetRenamed: assetIdMap.size,
    rollbackNote,
    exportedAt: json.exportedAt || '',
  });

  await db.applyRecordTransaction({ saveRecords: [...rewrittenRecords, logEntry], saveAssets: rewrittenAssets });
  await appendMergeHistory(db, {
    importedAt: new Date().toISOString(),
    records: rewrittenRecords.length,
    assets: rewrittenAssets.length,
    renamed: nameMap.size,
    assetRenamed: assetIdMap.size,
    rollbackNote,
    exportedAt: json.exportedAt || null,
  });
  return {
    records: rewrittenRecords.length,
    assets: rewrittenAssets.length,
    renamed: nameMap.size,
    assetRenamed: assetIdMap.size,
    rollbackNote,
  };
}

function rewriteRecord(record, nameMap, assetIdMap) {
  if (nameMap.has(record.recordName)) record.recordName = nameMap.get(record.recordName);
  for (const [fieldName, field] of Object.entries(record.fields || {})) {
    if (!field || typeof field.value !== 'string') continue;
    for (const [from, to] of nameMap.entries()) {
      if (field.value === from) field.value = to;
      else if (field.value.startsWith(`${from}---`)) field.value = `${to}${field.value.slice(from.length)}`;
    }
    if (fieldName === 'assetIds' && Array.isArray(field.value)) {
      field.value = field.value.map((assetId) => assetIdMap.get(assetId) || assetId);
    }
  }
  const assetField = record.fields?.assetIds;
  if (assetField && Array.isArray(assetField.value)) {
    assetField.value = assetField.value.map((assetId) => assetIdMap.get(assetId) || assetId);
  }
  return record;
}

function uniqueRecordName(recordName) {
  return `${recordName}-merge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function uniqueAssetId(assetId) {
  return `${assetId}-merge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function buildMergeLogEntry({ records, assets, renamed, assetRenamed, rollbackNote, exportedAt }) {
  const stamp = Date.now().toString(36);
  return {
    recordName: `cle-merge-${stamp}-${Math.random().toString(36).slice(2, 7)}`,
    recordType: 'ChangeLogEntry',
    fields: {
      targetType: { value: 'ImportMerge' },
      timestamp: { value: new Date().toISOString() },
      author: { value: 'CloudTreeWeb' },
      changeType: { value: 'Merge' },
      changeCount: { value: records },
      summary: { value: `Merged backup: ${records} records, ${assets} assets, ${renamed} record renames, ${assetRenamed} asset renames.` },
      rollbackNote: { value: rollbackNote || 'Rollback by restoring a backup captured before this merge.' },
      sourceExportedAt: { value: exportedAt || '' },
    },
  };
}

async function appendMergeHistory(db, entry) {
  const history = await db.getMeta('mergeImportHistory');
  const next = Array.isArray(history) ? history.slice(-24) : [];
  next.push(entry);
  await db.setMeta('mergeImportHistory', next);
}
