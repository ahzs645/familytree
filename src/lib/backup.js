/**
 * Full-database backup and restore. Reads every record out of IndexedDB into
 * a single JSON document; restore replaces all records with the document's
 * contents.
 */
import { getLocalDatabase } from './LocalDatabase.js';

export async function exportBackup() {
  const db = getLocalDatabase();
  const summary = await db.getSummary();
  const assets = await db.listAllAssets();
  const records = {};
  for (const type of Object.keys(summary?.types || {})) {
    const { records: list } = await db.query(type, { limit: 1000000 });
    for (const r of list) records[r.recordName] = r;
  }
  return {
    format: 'cloudtreeweb-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    counts: summary?.types || {},
    assetCount: assets.length,
    records,
    assets,
  };
}

export async function downloadBackup() {
  const data = await exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `cloudtreeweb-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

export async function downloadMFTPackage() {
  const data = await exportBackup();
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const exportedAt = new Date().toISOString();
  zip.file('database.json', JSON.stringify(data, null, 2));
  zip.file('metadata.json', JSON.stringify({
    format: 'cloudtreeweb-mftpkg',
    version: 1,
    exportedAt,
    recordCount: Object.keys(data.records || {}).length,
    assetCount: Array.isArray(data.assets) ? data.assets.length : 0,
    note: 'CloudTreeWeb round-trip package. MacFamilyTree proprietary package internals are not rewritten.',
  }, null, 2));
  zip.file('README.txt', [
    'CloudTreeWeb .mftpkg round-trip package',
    '',
    'Import this package back into CloudTreeWeb to restore records and assets.',
    'The resources folder contains media copies for inspection; database.json is the canonical import payload.',
  ].join('\n'));

  for (const asset of data.assets || []) {
    if (!asset?.dataBase64) continue;
    zip.file(`resources/${safePackageName(asset.filename || asset.sourceIdentifier || asset.assetId)}`, asset.dataBase64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `cloudtreeweb-${new Date().toISOString().slice(0, 10)}.mftpkg`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function safePackageName(name) {
  return String(name || 'asset').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 180) || 'asset';
}

export async function restoreBackup(json) {
  if (!json || json.format !== 'cloudtreeweb-backup' || !json.records) {
    throw new Error('File is not a CloudTreeWeb backup.');
  }
  const db = getLocalDatabase();
  await db.importDataset({
    records: json.records,
    assets: Array.isArray(json.assets) ? json.assets : [],
    meta: {
      source: 'backup',
      importedAt: Date.now(),
      backupVersion: json.version || 1,
      assetCount: Array.isArray(json.assets) ? json.assets.length : 0,
    },
  });
  return {
    records: Object.keys(json.records).length,
    assets: Array.isArray(json.assets) ? json.assets.length : 0,
  };
}
