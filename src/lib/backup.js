/**
 * Full-database backup and restore. Reads every record out of IndexedDB into
 * a single JSON document; restore replaces all records with the document's
 * contents.
 */
import { getLocalDatabase } from './LocalDatabase.js';

export async function exportBackup() {
  const db = getLocalDatabase();
  const summary = await db.getSummary();
  const records = {};
  for (const type of Object.keys(summary?.types || {})) {
    const { records: list } = await db.query(type, { limit: 1000000 });
    for (const r of list) records[r.recordName] = r;
  }
  return {
    format: 'cloudtreeweb-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: summary?.types || {},
    records,
  };
}

export async function downloadBackup() {
  const data = await exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudtreeweb-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export async function restoreBackup(json) {
  if (!json || json.format !== 'cloudtreeweb-backup' || !json.records) {
    throw new Error('File is not a CloudTreeWeb backup.');
  }
  const db = getLocalDatabase();
  await db.importDataset({ records: json.records, meta: { source: 'backup', importedAt: Date.now() } });
  return Object.keys(json.records).length;
}
