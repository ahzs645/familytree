import { getLocalDatabase } from './LocalDatabase.js';

/**
 * Map a dataset produced by `extractMFTPKGDataset` (lib/mftpkgExtractor.js) to
 * the `cloudtreeweb-backup` JSON shape the merge pipeline understands. The
 * extractor already returns `records` as a recordName→record map and `assets`
 * as an array of {assetId, ownerRecordName, dataBase64, …}, which is exactly
 * what planMerge / mergeBackupJSONWithResolutions expect — this just stamps the
 * recognised envelope (`format`) and carries useful metadata. Pure: no I/O.
 */
export function mftpkgDatasetToBackupJSON(dataset, { sourceName = '' } = {}) {
  if (!dataset || typeof dataset !== 'object' || !dataset.records) {
    throw new Error('Extracted package did not contain any records.');
  }
  const records = Array.isArray(dataset.records)
    ? Object.fromEntries(dataset.records.filter((r) => r?.recordName).map((r) => [r.recordName, r]))
    : dataset.records;
  return {
    format: 'cloudtreeweb-backup',
    version: dataset.meta?.datasetSchemaVersion || dataset.datasetSchemaVersion || 2,
    datasetSchemaVersion: dataset.datasetSchemaVersion || dataset.meta?.datasetSchemaVersion,
    exportedAt: dataset.meta?.importedAt || new Date().toISOString(),
    counts: dataset.counts || dataset.meta?.counts || {},
    assetCount: Array.isArray(dataset.assets) ? dataset.assets.length : 0,
    records,
    assets: Array.isArray(dataset.assets) ? dataset.assets : [],
    treeName: dataset.treeName || sourceName || '',
    sourceFormat: 'mftpkg',
  };
}

/**
 * Read a user-picked File and return a `cloudtreeweb-backup` JSON ready for
 * planMerge/merge. Accepts both CloudTreeWeb JSON backups and MacFamilyTree
 * packages (.mftpkg / .mftsql / SQLite / zipped database), routing the latter
 * through the existing parseSource + sql.js + extractMFTPKGDataset pipeline.
 * Not pure (dynamic imports, sql.js); the pure mapping lives in
 * mftpkgDatasetToBackupJSON above.
 */
export async function loadMergeFileToBackupJSON(file) {
  if (!file) throw new Error('No file selected.');
  const name = file.name || 'merge-source';
  const lower = name.toLowerCase();

  // Cheap path: a plain CloudTreeWeb .json backup.
  if (lower.endsWith('.json')) {
    const json = JSON.parse(await file.text());
    if (json?.format !== 'cloudtreeweb-backup' || !json.records) {
      throw new Error('File is not a CloudTreeWeb backup.');
    }
    return json;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const [{ parseSource, SOURCE_KIND }, { getSqlJs }, { extractMFTPKGDataset }] = await Promise.all([
    import('./import/parseSource.js'),
    import('./import/sqlJs.js'),
    import('./mftpkgExtractor.js'),
  ]);
  const parsed = await parseSource(bytes, name);

  // A backup JSON can also arrive inside a .json/.zip wrapper.
  if (parsed.kind === SOURCE_KIND.JSON) {
    const json = parsed.data;
    if (json?.format === 'cloudtreeweb-backup' && json.records) return json;
    // Some packages embed a database.json that is already a full dataset.
    if (json?.records) return mftpkgDatasetToBackupJSON(json, { sourceName: name });
    throw new Error('File is not a CloudTreeWeb backup or MacFamilyTree package.');
  }

  let dbBytes = null;
  let resourceFiles = [];
  let pkgName = name;
  if (parsed.kind === SOURCE_KIND.ZIP_DATABASE) {
    dbBytes = parsed.dbBytes;
    resourceFiles = parsed.resourceFiles || [];
    pkgName = parsed.sourceName || name;
  } else if (parsed.kind === SOURCE_KIND.SQLITE) {
    dbBytes = parsed.bytes;
  } else {
    throw new Error('Unsupported merge source. Choose a CloudTreeWeb backup .json or a MacFamilyTree .mftpkg package.');
  }

  const SQL = await getSqlJs();
  const db = new SQL.Database(dbBytes);
  try {
    const query = (sql) => {
      const result = db.exec(sql);
      if (!result.length) return [];
      const { columns, values } = result[0];
      return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
    };
    const dataset = extractMFTPKGDataset({ query, sourceName: pkgName, resourceFiles });
    return mftpkgDatasetToBackupJSON(dataset, { sourceName: pkgName });
  } finally {
    db.close();
  }
}

export const CONFLICT_RESOLUTION = Object.freeze({
  KEEP_EXISTING: 'existing',
  USE_INCOMING: 'incoming',
  RENAME_INCOMING: 'rename',
});

/**
 * Build a per-record conflict plan — for every incoming record that shares
 * an ID with an existing record, list the fields that differ (name + old +
 * new value). Returns:
 *   {
 *     conflicts: [{ recordName, recordType, fields: [{ name, existing, incoming }] }],
 *     newRecords: [records with no existing collision],
 *     assetCollisions: [assetId, ...],
 *   }
 *
 * Callers can then render a conflict sheet and pass resolutions into
 * `mergeBackupJSONWithResolutions`.
 */
export async function planMerge(json) {
  if (!json || json.format !== 'cloudtreeweb-backup' || !json.records) {
    throw new Error('File is not a CloudTreeWeb backup.');
  }
  const db = getLocalDatabase();
  const incoming = Object.values(json.records);
  const conflicts = [];
  const newRecords = [];

  for (const record of incoming) {
    const existing = await db.getRecord(record.recordName);
    if (!existing) {
      newRecords.push(record);
      continue;
    }
    const fieldDiffs = [];
    const names = new Set([
      ...Object.keys(existing.fields || {}),
      ...Object.keys(record.fields || {}),
    ]);
    for (const name of names) {
      const left = existing.fields?.[name]?.value;
      const right = record.fields?.[name]?.value;
      if (!valuesEqual(left, right)) {
        fieldDiffs.push({ name, existing: left, incoming: right });
      }
    }
    if (fieldDiffs.length === 0) {
      // Identical payload — nothing to do; counts as "keep existing".
      continue;
    }
    conflicts.push({
      recordName: record.recordName,
      recordType: record.recordType,
      fields: fieldDiffs,
    });
  }

  const assetCollisions = [];
  for (const asset of json.assets || []) {
    if (!asset?.assetId) continue;
    const existing = await db.getAsset(asset.assetId);
    if (existing) assetCollisions.push(asset.assetId);
  }

  return { conflicts, newRecords, assetCollisions };
}

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'object' || typeof b === 'object') {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }
  return String(a) === String(b);
}

/**
 * Apply a merge plan honoring per-record resolutions.
 * resolutions is a map: recordName → CONFLICT_RESOLUTION value.
 * Missing keys default to KEEP_EXISTING (safe).
 */
export async function mergeBackupJSONWithResolutions(json, resolutions, options = {}) {
  const db = getLocalDatabase();
  const incoming = Object.values(json.records || {});
  const nameMap = new Map();
  const saveRecords = [];

  for (const record of incoming) {
    const existing = await db.getRecord(record.recordName);
    if (!existing) {
      saveRecords.push(structuredCloneSafe(record));
      continue;
    }
    const choice = resolutions?.[record.recordName] || CONFLICT_RESOLUTION.KEEP_EXISTING;
    if (choice === CONFLICT_RESOLUTION.KEEP_EXISTING) continue;
    if (choice === CONFLICT_RESOLUTION.USE_INCOMING) {
      saveRecords.push(structuredCloneSafe(record));
      continue;
    }
    if (choice === CONFLICT_RESOLUTION.RENAME_INCOMING) {
      const newName = uniqueRecordName(record.recordName);
      nameMap.set(record.recordName, newName);
      saveRecords.push({ ...structuredCloneSafe(record), recordName: newName });
    }
  }

  const assetIdMap = new Map();
  const saveAssets = [];
  for (const asset of json.assets || []) {
    if (!asset?.assetId) continue;
    const existing = await db.getAsset(asset.assetId);
    if (!existing) {
      saveAssets.push(structuredCloneSafe(asset));
      continue;
    }
    const choice = resolutions?.[`asset:${asset.assetId}`] || CONFLICT_RESOLUTION.KEEP_EXISTING;
    if (choice === CONFLICT_RESOLUTION.KEEP_EXISTING) continue;
    if (choice === CONFLICT_RESOLUTION.USE_INCOMING) {
      saveAssets.push(structuredCloneSafe(asset));
      continue;
    }
    if (choice === CONFLICT_RESOLUTION.RENAME_INCOMING) {
      const newId = uniqueAssetId(asset.assetId);
      assetIdMap.set(asset.assetId, newId);
      saveAssets.push({ ...structuredCloneSafe(asset), assetId: newId });
    }
  }

  const rewritten = saveRecords.map((record) => rewriteRecord(record, nameMap, assetIdMap));
  const logEntry = buildMergeLogEntry({
    records: rewritten.length,
    assets: saveAssets.length,
    renamed: nameMap.size,
    assetRenamed: assetIdMap.size,
    rollbackNote: options.rollbackNote || '',
    exportedAt: json.exportedAt || '',
  });
  await db.applyRecordTransaction({ saveRecords: [...rewritten, logEntry], saveAssets });
  await appendMergeHistory(db, {
    importedAt: new Date().toISOString(),
    records: rewritten.length,
    assets: saveAssets.length,
    renamed: nameMap.size,
    assetRenamed: assetIdMap.size,
    rollbackNote: options.rollbackNote || '',
    exportedAt: json.exportedAt || null,
    resolvedConflicts: Object.keys(resolutions || {}).length,
  });
  return {
    records: rewritten.length,
    assets: saveAssets.length,
    renamed: nameMap.size,
    assetRenamed: assetIdMap.size,
    resolvedConflicts: Object.keys(resolutions || {}).length,
  };
}

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
