/**
 * Export hub — GEDCOM, full backup, static website.
 */
import React, { useRef, useState } from 'react';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { listAllPersons, findStartPerson } from '../lib/treeQuery.js';
import { downloadGedcom } from '../lib/gedcomExport.js';
import { analyzeGedcomText, importGedcomText } from '../lib/gedcomImport.js';
import { downloadBackup } from '../lib/backup.js';
import { mergeBackupJSON } from '../lib/mergeImport.js';
import { downloadSubtreeBackup, removeSubtree } from '../lib/subtree.js';
import { downloadSite } from '../lib/websiteExport.js';
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

  const onGedImport = wrap('Importing GEDCOM…', async (file) => {
    if (!file) return;
    const text = await file.text();
    const analysis = analyzeGedcomText(text);
    setGedIssues(analysis);
    if (!analysis.canImport) return 'GEDCOM has blocking syntax errors. Review issues before importing.';
    const warningCount = analysis.issues.filter((issue) => issue.severity !== 'error').length;
    if (!confirm(`Import ${file.name}? ${warningCount} warning${warningCount === 1 ? '' : 's'} found. Records will be added to your tree.`)) return;
    const n = await importGedcomText(text);
    await refresh();
    return `Imported ${n.toLocaleString()} new records.`;
  });

  const onMergeBackup = wrap('Merging backup…', async (file) => {
    if (!file) return;
    if (!confirm(`Merge "${file.name}" into the current tree? Existing records are kept.`)) return;
    const json = JSON.parse(await file.text());
    const result = await mergeBackupJSON(json);
    await refresh();
    return `Merged ${result.records.toLocaleString()} records and ${result.assets.toLocaleString()} assets. ${result.renamed.toLocaleString()} colliding record names were renamed.`;
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
          {gedIssues && (
            <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs">
              <div className="font-semibold mb-1">GEDCOM review</div>
              <div className="text-muted-foreground mb-2">
                {gedIssues.counts.INDI} persons · {gedIssues.counts.FAM} families · {gedIssues.counts.SOUR} sources · {gedIssues.issues.length} issue(s)
              </div>
              {gedIssues.issues.slice(0, 8).map((issue, i) => (
                <div key={i} className={issue.severity === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                  {issue.line ? `Line ${issue.line}: ` : ''}{issue.message}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Merge another tree" description="Merge a CloudTreeWeb backup into the current database. Name collisions are renamed and references are rewritten.">
          <input ref={mergeRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => onMergeBackup(e.target.files?.[0])()} />
          <button onClick={() => mergeRef.current?.click()} disabled={busy} className={btnSecondary}>
            Choose backup to merge…
          </button>
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

        <Card title="Static website" description="One HTML page per person plus an index, packaged as a .zip you can host anywhere.">
          <button onClick={wrap('Building site…', downloadSite)} disabled={busy} className={btn}>Download .zip</button>
        </Card>

        {status && <div className="rounded-md border border-border bg-card p-3 text-sm">{status}</div>}
      </div>
    </div>
  );
}
