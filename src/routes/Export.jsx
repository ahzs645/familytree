/**
 * Export hub — GEDCOM, full backup, static website.
 */
import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { listAllPersons, findStartPerson } from '../lib/treeQuery.js';
import { downloadGedcom } from '../lib/gedcomExport.js';
import { analyzeGedcomText, importGedcomText } from '../lib/gedcomImport.js';
import { GEDCOM_ACCEPT, readGedcomTextFromFile } from '../lib/genealogyFileFormats.js';
import { downloadBackup } from '../lib/backup.js';
import { analyzeBackupMergeJSON, mergeBackupJSON } from '../lib/mergeImport.js';
import { downloadSubtreeBackup, removeSubtree } from '../lib/subtree.js';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';

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
  const [gedIssues, setGedIssues] = useState(null);
  const [pendingGedcom, setPendingGedcom] = useState(null);
  const [pendingMerge, setPendingMerge] = useState(null);
  const [rollbackNote, setRollbackNote] = useState('');
  const [persons, setPersons] = useState([]);
  const [subtreeRoot, setSubtreeRoot] = useState(null);
  const gedRef = useRef(null);
  const mergeRef = useRef(null);

  React.useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      const start = await findStartPerson();
      setSubtreeRoot(start?.recordName || list[0]?.recordName || null);
    })();
  }, []);

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

  const onGedFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus('Reviewing GEDCOM/GedZip…');
    try {
      const { text, sourceName, format } = await readGedcomTextFromFile(file);
      const analysis = analyzeGedcomText(text);
      setGedIssues(analysis);
      setPendingGedcom({ fileName: sourceName || file.name, format, text, analysis });
      setStatus(analysis.canImport ? 'GEDCOM ready for review.' : 'GEDCOM has blocking syntax errors.');
    } catch (e) {
      setStatus(`GEDCOM review failed: ${e.message}`);
    }
    setBusy(false);
  };

  const onConfirmGedImport = wrap('Importing GEDCOM…', async () => {
    if (!pendingGedcom) return 'Choose a GEDCOM file first.';
    if (!pendingGedcom.analysis.canImport) return 'GEDCOM has blocking syntax errors. Review issues before importing.';
    const n = await importGedcomText(pendingGedcom.text, { sourceName: pendingGedcom.fileName });
    await refresh();
    setPendingGedcom(null);
    if (gedRef.current) gedRef.current.value = '';
    return `Imported ${n.toLocaleString()} new records.`;
  });

  const onBackupMergeFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus('Reviewing backup merge…');
    try {
      const json = JSON.parse(await file.text());
      const preview = await analyzeBackupMergeJSON(json);
      setPendingMerge({ fileName: file.name, json, preview });
      setRollbackNote(`Rollback note for ${file.name}: restore a backup captured before this merge if the result is not wanted.`);
      setStatus('Backup merge ready for review.');
    } catch (e) {
      setStatus(`Backup review failed: ${e.message}`);
    }
    setBusy(false);
  };

  const onConfirmMergeBackup = wrap('Merging backup…', async () => {
    if (!pendingMerge) return 'Choose a backup file first.';
    const result = await mergeBackupJSON(pendingMerge.json, { rollbackNote });
    await refresh();
    setPendingMerge(null);
    setRollbackNote('');
    if (mergeRef.current) mergeRef.current.value = '';
    const assetPart = result.assetRenamed ? ` ${result.assetRenamed.toLocaleString()} colliding asset IDs were renamed.` : '';
    return `Merged ${result.records.toLocaleString()} records and ${result.assets.toLocaleString()} assets. ${result.renamed.toLocaleString()} colliding record names were renamed.${assetPart}`;
  });

  const onSubtreeExport = wrap('Exporting subtree…', async () => {
    if (!subtreeRoot) return 'Pick a subtree root first.';
    const count = await downloadSubtreeBackup(subtreeRoot);
    return `Exported ${count.toLocaleString()} subtree records.`;
  });

  const onSubtreeRemove = wrap('Removing subtree…', async () => {
    if (!subtreeRoot) return 'Pick a subtree root first.';
    if (!confirm('Remove this person and descendant subtree from the current database? This cannot be undone from inside the app.')) return;
    const count = await removeSubtree(subtreeRoot);
    await refresh();
    return `Removed ${count.toLocaleString()} subtree records.`;
  });

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-2xl mx-auto p-5">
        <h1 className="text-xl font-bold mb-1">Import &amp; Export</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Move data in and out of your tree. {summary && `Currently ${summary.total.toLocaleString()} records.`}{' '}
          Publishing tools are available in <Link to="/publish" className="text-primary hover:underline">Publish</Link>.
        </p>

        <Card title="GEDCOM export" description="Standard genealogy interchange format. Lossy for app-specific fields.">
          <button onClick={wrap('Building GEDCOM…', downloadGedcom)} disabled={busy} className={btn}>Download .ged</button>
        </Card>

        <Card title="GEDCOM / GedZip import" description="Merge .ged, .uged, .uged16, or GedZip .zip files from another tool. Records are added with new local IDs.">
          <input ref={gedRef} type="file" accept={GEDCOM_ACCEPT} className="hidden"
            onChange={(e) => onGedFile(e.target.files?.[0])} />
          <button onClick={() => gedRef.current?.click()} disabled={busy} className={btnSecondary}>
            Choose GEDCOM or GedZip…
          </button>
          {(gedIssues || pendingGedcom) && (
            <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs">
              <div className="font-semibold mb-1">GEDCOM review</div>
              <div className="text-muted-foreground mb-2">
                {pendingGedcom?.fileName && <span className="text-foreground">{pendingGedcom.fileName} · </span>}
                {pendingGedcom?.format && <span>{pendingGedcom.format} · </span>}
                {gedIssues.counts.INDI} persons · {gedIssues.counts.FAM} families · {gedIssues.counts.SOUR} sources · {gedIssues.issues.length} issue(s)
              </div>
              <div className="text-muted-foreground mb-2">
                Conflict summary: GEDCOM records are imported with new local IDs, so existing records are not overwritten.
              </div>
              {gedIssues.issues.slice(0, 8).map((issue, i) => (
                <div key={i} className={issue.severity === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                  {issue.line ? `Line ${issue.line}: ` : ''}{issue.message}
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <button onClick={onConfirmGedImport} disabled={busy || !pendingGedcom?.analysis.canImport} className={btn}>
                  Import reviewed GEDCOM
                </button>
                <button
                  onClick={() => { setPendingGedcom(null); setGedIssues(null); if (gedRef.current) gedRef.current.value = ''; }}
                  disabled={busy}
                  className={btnSecondary}
                >
                  Clear review
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card title="Merge another tree" description="Merge a CloudTreeWeb backup into the current database. Name collisions are renamed and references are rewritten.">
          <input ref={mergeRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => onBackupMergeFile(e.target.files?.[0])} />
          <button onClick={() => mergeRef.current?.click()} disabled={busy} className={btnSecondary}>
            Choose backup to merge…
          </button>
          {pendingMerge && (
            <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs">
              <div className="font-semibold mb-1">Backup merge preview</div>
              <div className="text-muted-foreground mb-2">
                <span className="text-foreground">{pendingMerge.fileName}</span> · {pendingMerge.preview.records.toLocaleString()} records ·{' '}
                {pendingMerge.preview.assets.toLocaleString()} assets · {pendingMerge.preview.collisions.toLocaleString()} record collisions ·{' '}
                {pendingMerge.preview.assetCollisions.toLocaleString()} asset collisions
              </div>
              {pendingMerge.preview.collisionSamples.length > 0 && (
                <div className="text-muted-foreground mb-2">
                  Record collision samples: {pendingMerge.preview.collisionSamples.map((item) => `${item.recordName} (${item.recordType})`).join(', ')}
                </div>
              )}
              <label className="block text-muted-foreground mb-1">Rollback note saved with changelog metadata</label>
              <textarea
                value={rollbackNote}
                onChange={(e) => setRollbackNote(e.target.value)}
                className="w-full min-h-20 rounded-md border border-border bg-card text-foreground p-2 text-xs"
              />
              <div className="mt-3 flex gap-2">
                <button onClick={onConfirmMergeBackup} disabled={busy} className={btn}>Merge reviewed backup</button>
                <button
                  onClick={() => { setPendingMerge(null); setRollbackNote(''); if (mergeRef.current) mergeRef.current.value = ''; }}
                  disabled={busy}
                  className={btnSecondary}
                >
                  Clear review
                </button>
              </div>
            </div>
          )}
        </Card>

        <Card title="Subtree export / remove" description="Export or remove a person and their descendant subtree, including related events, facts, notes, labels, media/source relations, and assets.">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Root person</label>
              <PersonPicker persons={persons} value={subtreeRoot} onChange={setSubtreeRoot} />
            </div>
            <button onClick={onSubtreeExport} disabled={busy || !subtreeRoot} className={btn}>Export subtree</button>
            <button onClick={onSubtreeRemove} disabled={busy || !subtreeRoot} className={btnSecondary}>Remove subtree</button>
          </div>
        </Card>

        <Card title="Full backup" description="Every record packaged into a single JSON file.">
          <button onClick={wrap('Preparing backup…', downloadBackup)} disabled={busy} className={btn}>Download backup</button>
        </Card>

        <Card title="Publish surfaces" description="Use dedicated publish pages for websites and book bundles. This page stays focused on data transfer.">
          <div className="flex flex-wrap gap-2">
            <Link to="/websites" className={btnSecondary}>Open Websites</Link>
            <Link to="/books" className={btnSecondary}>Open Books</Link>
            <Link to="/publish" className={btn}>Open Publish hub</Link>
          </div>
        </Card>

        {status && <div className="rounded-md border border-border bg-card p-3 text-sm">{status}</div>}
      </div>
    </div>
  );
}
