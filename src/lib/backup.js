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

/**
 * Scheduled / retained in-app backups. Mirrors Mac's OrganizeBackupsSheet:
 * backup-on-save, interval schedule (5/10/15/20/30 min, 1–6h), and a retention
 * count (keep the N most recent).
 *
 * Each entry is stored in IndexedDB meta as compact JSON. Assets are omitted
 * from in-app backups to keep the browser quota sane; to preserve media the
 * user should still use the download flows (.mftpkg or .json).
 */
const BACKUP_SETTINGS_META = 'backupSettings';
const BACKUP_HISTORY_META = 'backupHistory';

export const BACKUP_INTERVALS = [
  { id: 'off', label: 'Off', ms: 0 },
  { id: '5m', label: 'Every 5 min', ms: 5 * 60 * 1000 },
  { id: '10m', label: 'Every 10 min', ms: 10 * 60 * 1000 },
  { id: '15m', label: 'Every 15 min', ms: 15 * 60 * 1000 },
  { id: '20m', label: 'Every 20 min', ms: 20 * 60 * 1000 },
  { id: '30m', label: 'Every 30 min', ms: 30 * 60 * 1000 },
  { id: '1h', label: 'Every 1 h', ms: 60 * 60 * 1000 },
  { id: '2h', label: 'Every 2 h', ms: 2 * 60 * 60 * 1000 },
  { id: '3h', label: 'Every 3 h', ms: 3 * 60 * 60 * 1000 },
  { id: '4h', label: 'Every 4 h', ms: 4 * 60 * 60 * 1000 },
  { id: '6h', label: 'Every 6 h', ms: 6 * 60 * 60 * 1000 },
];

export const DEFAULT_BACKUP_SETTINGS = Object.freeze({
  intervalId: 'off',
  backupOnSave: false,
  retention: 10,
});

export async function getBackupSettings() {
  const stored = await getLocalDatabase().getMeta(BACKUP_SETTINGS_META);
  return { ...DEFAULT_BACKUP_SETTINGS, ...(stored || {}) };
}

export async function saveBackupSettings(partial) {
  const current = await getBackupSettings();
  const next = {
    ...current,
    ...partial,
    retention: Math.max(1, Math.min(50, Number(partial?.retention ?? current.retention) || 10)),
  };
  await getLocalDatabase().setMeta(BACKUP_SETTINGS_META, next);
  return next;
}

export async function listBackupHistory() {
  const list = await getLocalDatabase().getMeta(BACKUP_HISTORY_META);
  return Array.isArray(list) ? list : [];
}

export async function takeBackupSnapshot({ reason = 'manual' } = {}) {
  const db = getLocalDatabase();
  const data = await exportBackup();
  const entry = {
    id: `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    reason,
    recordCount: Object.keys(data.records || {}).length,
    assetCount: Array.isArray(data.assets) ? data.assets.length : 0,
    // Assets stripped from in-app snapshots to avoid ballooning IndexedDB.
    snapshot: { ...data, assets: [] },
  };
  const { retention } = await getBackupSettings();
  const existing = await listBackupHistory();
  const next = [entry, ...existing].slice(0, Math.max(1, retention));
  await db.setMeta(BACKUP_HISTORY_META, next);
  return entry;
}

export async function restoreBackupSnapshot(id) {
  const list = await listBackupHistory();
  const entry = list.find((item) => item.id === id);
  if (!entry) throw new Error(`Backup snapshot not found: ${id}`);
  return restoreBackup(entry.snapshot);
}

export async function deleteBackupSnapshot(id) {
  const db = getLocalDatabase();
  const list = await listBackupHistory();
  await db.setMeta(BACKUP_HISTORY_META, list.filter((entry) => entry.id !== id));
}

export async function clearBackupHistory() {
  await getLocalDatabase().setMeta(BACKUP_HISTORY_META, []);
}

/**
 * Start a foreground scheduler that triggers snapshots on the configured
 * interval. Returns a disposer. Safe to re-call — the caller should dispose
 * the previous scheduler first if swapping.
 */
export function startBackupScheduler({ onTick } = {}) {
  let timer = null;
  let disposed = false;

  async function tick() {
    if (disposed) return;
    try {
      const snapshot = await takeBackupSnapshot({ reason: 'scheduled' });
      if (typeof onTick === 'function') onTick(snapshot);
    } catch (error) {
      if (typeof onTick === 'function') onTick({ error });
    }
  }

  async function reconfigure() {
    if (timer) { clearInterval(timer); timer = null; }
    const settings = await getBackupSettings();
    const choice = BACKUP_INTERVALS.find((x) => x.id === settings.intervalId);
    if (choice && choice.ms > 0) timer = setInterval(tick, choice.ms);
  }

  reconfigure();
  return {
    reconfigure,
    stop() {
      disposed = true;
      if (timer) { clearInterval(timer); timer = null; }
    },
  };
}
