/**
 * Export hub — GEDCOM, full backup, static website.
 */
import React, { useRef, useState } from 'react';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { downloadGedcom } from '../lib/gedcomExport.js';
import { importGedcomText } from '../lib/gedcomImport.js';
import { downloadBackup } from '../lib/backup.js';
import { downloadSite } from '../lib/websiteExport.js';

function Card({ title, description, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 mb-4">
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      {children}
    </div>
  );
}

const btn = 'bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60';
const btnSecondary = 'bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm hover:bg-accent disabled:opacity-60';

export default function Export() {
  const { summary, refresh } = useDatabaseStatus();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const gedRef = useRef(null);

  const wrap = (label, fn) => async () => {
    setBusy(true);
    setStatus(label);
    try {
      const result = await fn();
      setStatus(typeof result === 'string' ? result : `${label} — done.`);
    } catch (e) {
      setStatus(`${label} failed: ${e.message}`);
    }
    setBusy(false);
  };

  const onGedImport = wrap('Importing GEDCOM…', async (file) => {
    if (!file) return;
    if (!confirm(`Import ${file.name}? Records will be added to your tree.`)) return;
    const text = await file.text();
    const n = await importGedcomText(text);
    await refresh();
    return `Imported ${n.toLocaleString()} new records.`;
  });

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-2xl mx-auto p-5">
        <h1 className="text-xl font-bold mb-1">Import &amp; Export</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Move data in and out of your tree. {summary && `Currently ${summary.total.toLocaleString()} records.`}
        </p>

        <Card title="GEDCOM export" description="Standard genealogy interchange format. Lossy for app-specific fields.">
          <button onClick={wrap('Building GEDCOM…', downloadGedcom)} disabled={busy} className={btn}>Download .ged</button>
        </Card>

        <Card title="GEDCOM import" description="Merge a .ged file from another tool. Records are added (no de-duplication).">
          <input ref={gedRef} type="file" accept=".ged,text/plain" className="hidden"
            onChange={(e) => onGedImport(e.target.files?.[0])()} />
          <button onClick={() => gedRef.current?.click()} disabled={busy} className={btnSecondary}>
            Choose .ged file…
          </button>
        </Card>

        <Card title="Full backup" description="Every record packaged into a single JSON file.">
          <button onClick={wrap('Preparing backup…', downloadBackup)} disabled={busy} className={btn}>Download backup</button>
        </Card>

        <Card title="Static website" description="One HTML page per person plus an index, packaged as a .zip you can host anywhere.">
          <button onClick={wrap('Building site…', downloadSite)} disabled={busy} className={btn}>Download .zip</button>
        </Card>

        {status && <div className="rounded-md border border-border bg-card p-3 text-sm">{status}</div>}
      </div>
    </div>
  );
}
