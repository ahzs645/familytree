/**
 * Backup / Restore — full IndexedDB export to a JSON file, and import back.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import {
  downloadBackup,
  restoreBackup,
  BACKUP_INTERVALS,
  getBackupSettings,
  saveBackupSettings,
  listBackupHistory,
  takeBackupSnapshot,
  restoreBackupSnapshot,
  deleteBackupSnapshot,
  clearBackupHistory,
} from '../lib/backup.js';

export default function Backup() {
  const { summary, refresh } = useDatabaseStatus();
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [typedConfirm, setTypedConfirm] = useState('');
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [loadedSettings, loadedHistory] = await Promise.all([getBackupSettings(), listBackupHistory()]);
      if (cancel) return;
      setSettings(loadedSettings);
      setHistory(loadedHistory);
    })();
    return () => { cancel = true; };
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistory(await listBackupHistory());
  }, []);

  const updateSetting = useCallback(async (partial) => {
    const next = await saveBackupSettings(partial);
    setSettings(next);
    // Notify the root scheduler (in App.jsx) so it picks up the new interval
    // without requiring a page reload.
    window.dispatchEvent(new CustomEvent('cloudtreeweb:backup-settings-changed'));
  }, []);

  const onTakeSnapshot = useCallback(async () => {
    setBusy(true);
    setStatus('Taking snapshot…');
    try {
      const entry = await takeBackupSnapshot({ reason: 'manual' });
      await refreshHistory();
      setStatus(`Snapshot saved (${entry.recordCount.toLocaleString()} records).`);
    } catch (error) {
      setStatus(`Snapshot failed: ${error?.message || error}`);
    }
    setBusy(false);
  }, [refreshHistory]);

  const onRestoreSnapshot = useCallback(async (id) => {
    if (!confirm('Restore this snapshot? Current data will be replaced.')) return;
    setBusy(true);
    setStatus('Restoring snapshot…');
    try {
      const restored = await restoreBackupSnapshot(id);
      await refresh();
      setStatus(`Restored ${restored.records.toLocaleString()} records from snapshot.`);
    } catch (error) {
      setStatus(`Restore failed: ${error?.message || error}`);
    }
    setBusy(false);
  }, [refresh]);

  const onDeleteSnapshot = useCallback(async (id) => {
    if (!confirm('Delete this snapshot?')) return;
    await deleteBackupSnapshot(id);
    await refreshHistory();
  }, [refreshHistory]);

  const onClearHistory = useCallback(async () => {
    if (!confirm('Clear all in-app snapshots?')) return;
    await clearBackupHistory();
    await refreshHistory();
  }, [refreshHistory]);

  const onExport = useCallback(async () => {
    setBusy(true);
    setStatus('Preparing backup…');
    try {
      await downloadBackup();
      setStatus('Backup downloaded.');
    } catch (e) {
      setStatus('Export failed: ' + e.message);
    }
    setBusy(false);
  }, []);

  const onRestoreConfirmed = useCallback(async () => {
    const file = pendingFile;
    setPendingFile(null);
    setTypedConfirm('');
    if (!file) return;
    setBusy(true);
    setStatus('Reading file…');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const restored = await restoreBackup(json);
      await refresh();
      const assetPart = restored.assets ? ` and ${restored.assets.toLocaleString()} assets` : '';
      setStatus(`Restored ${restored.records.toLocaleString()} records${assetPart}.`);
    } catch (e) {
      setStatus('Restore failed: ' + e.message);
    }
    setBusy(false);
  }, [pendingFile, refresh]);

  const onCancel = useCallback(() => {
    setPendingFile(null);
    setTypedConfirm('');
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const confirmReady = typedConfirm.trim().toUpperCase() === 'RESTORE';

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-2xl mx-auto p-5">
        <h1 className="text-xl font-bold mb-1">Backup &amp; Restore</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Export your entire local database to a JSON file you can keep offsite, then restore it on the same or a different device.
        </p>

        <div className="rounded-lg border border-border bg-card p-5 mb-4">
          <h2 className="text-sm font-semibold mb-2">Export</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {summary ? `${summary.total.toLocaleString()} records and any imported media assets will be packaged.` : 'No data loaded.'}
          </p>
          <button onClick={onExport} disabled={busy || !summary}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Download backup file
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 mb-4">
          <h2 className="text-sm font-semibold mb-2">Restore</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Replaces every record currently in the browser with the contents of a backup file. This cannot be undone.
          </p>
          <input ref={fileRef} type="file" accept="application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="border border-border bg-secondary text-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60">
            Choose backup file…
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 mb-4">
          <h2 className="text-sm font-semibold mb-2">Scheduled snapshots</h2>
          <p className="text-xs text-muted-foreground mb-4">
            In-app snapshots live inside the browser database — handy for quick rollbacks, but don't replace the downloaded backup for offsite safety. Media assets are omitted from in-app snapshots to keep storage lean.
          </p>
          {settings && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <div className="text-xs text-muted-foreground mb-1">Auto-snapshot interval</div>
                <select
                  value={settings.intervalId}
                  onChange={(e) => updateSetting({ intervalId: e.target.value })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {BACKUP_INTERVALS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-xs text-muted-foreground mb-1">Retention ({settings.retention} kept)</div>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.retention}
                  onChange={(e) => updateSetting({ retention: Number(e.target.value) })}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={settings.backupOnSave}
                  onChange={(e) => updateSetting({ backupOnSave: e.target.checked })}
                />
                <span className="text-sm">Snapshot on save</span>
              </label>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onTakeSnapshot} disabled={busy}
              className="border border-border bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-60">
              Take snapshot now
            </button>
            {history.length > 0 && (
              <button onClick={onClearHistory} disabled={busy}
                className="border border-border bg-secondary text-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent">
                Clear all
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="mt-3 text-xs text-muted-foreground">No snapshots yet.</div>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 rounded-md border border-border bg-background p-2 text-sm">
                  <span className="flex-1">
                    <div className="font-medium">{new Date(entry.timestamp).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      {entry.reason} · {entry.recordCount.toLocaleString()} records
                      {entry.assetCount ? ` · ${entry.assetCount.toLocaleString()} assets` : ''}
                    </div>
                  </span>
                  <button onClick={() => onRestoreSnapshot(entry.id)} disabled={busy}
                    className="border border-border bg-secondary rounded-md px-2 py-1 text-xs font-medium hover:bg-accent">
                    Restore
                  </button>
                  <button onClick={() => onDeleteSnapshot(entry.id)} disabled={busy}
                    className="border border-border bg-secondary rounded-md px-2 py-1 text-xs font-medium hover:bg-accent">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {status && (
          <div className="rounded-md border border-border bg-card p-3 text-sm">
            {status}
          </div>
        )}
      </div>

      {pendingFile && (
        <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold mb-1">Replace your current tree?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Restoring <span className="font-medium text-foreground">{pendingFile.name}</span> will{' '}
              <span className="font-semibold text-destructive">permanently delete</span> every record currently
              in this browser{summary ? ` (${summary.total.toLocaleString()} records)` : ''}.
              This action cannot be undone.
            </p>
            <label className="block text-xs text-muted-foreground mb-1">
              Type <span className="font-mono font-semibold text-foreground">RESTORE</span> to confirm:
            </label>
            <input
              autoFocus
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-4"
              placeholder="RESTORE"
            />
            <div className="flex justify-end gap-2">
              <button onClick={onCancel}
                className="rounded-md border border-border bg-secondary text-foreground px-3 py-1.5 text-sm font-medium hover:bg-accent">
                Cancel
              </button>
              <button onClick={onRestoreConfirmed} disabled={!confirmReady || busy}
                className="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-sm font-semibold disabled:opacity-40">
                Replace everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
