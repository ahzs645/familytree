/**
 * Backup / Restore — full IndexedDB export to a JSON file, and import back.
 */
import React, { useState, useRef, useCallback } from 'react';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { downloadBackup, restoreBackup } from '../lib/backup.js';

export default function Backup() {
  const { summary, refresh } = useDatabaseStatus();
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

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

  const onRestore = useCallback(async (file) => {
    if (!file) return;
    if (!confirm(`Restore "${file.name}" — this replaces all current data. Continue?`)) return;
    setBusy(true);
    setStatus('Reading file…');
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const n = await restoreBackup(json);
      await refresh();
      setStatus(`Restored ${n.toLocaleString()} records.`);
    } catch (e) {
      setStatus('Restore failed: ' + e.message);
    }
    setBusy(false);
  }, [refresh]);

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
            {summary ? `${summary.total.toLocaleString()} records will be packaged.` : 'No data loaded.'}
          </p>
          <button onClick={onExport} disabled={busy || !summary}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Download backup file
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 mb-4">
          <h2 className="text-sm font-semibold mb-2">Restore</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Replaces every record currently in the browser with the contents of a backup file.
          </p>
          <input ref={fileRef} type="file" accept="application/json"
            className="hidden"
            onChange={(e) => onRestore(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="border border-border bg-secondary text-foreground rounded-md px-4 py-2 text-sm font-semibold hover:bg-accent disabled:opacity-60">
            Choose backup file…
          </button>
        </div>

        {status && (
          <div className="rounded-md border border-border bg-card p-3 text-sm">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
