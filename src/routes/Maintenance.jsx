/**
 * Database Maintenance — read-only audits + targeted batch fixes.
 * Each tool runs as a dry-run first, then offers an Apply button.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import {
  auditUnreadableDates,
  reformatAllDates,
  auditEmptyEntries,
  removeEmptyEntries,
  auditFamilyGenderMismatch,
  reformatNames,
  mediaSizeReport,
} from '../lib/maintenance.js';

function Card({ title, description, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 mb-4">
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      {children}
    </div>
  );
}

function ResultList({ items, columns }) {
  if (!items) return null;
  if (items.length === 0) return <div className="text-sm text-muted-foreground italic">No issues found.</div>;
  return (
    <div className="mt-3">
      <div className="text-xs text-muted-foreground mb-1">{items.length} matches</div>
      <div className="border border-border rounded-md max-h-72 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-secondary/60 backdrop-blur">
            <tr>{columns.map((c) => <th key={c.key} className="text-left px-2.5 py-1.5 font-semibold">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {items.slice(0, 200).map((it, i) => (
              <tr key={i} className="border-t border-border/40">
                {columns.map((c) => <td key={c.key} className="px-2.5 py-1.5 break-words">{c.render ? c.render(it) : it[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 200 && <div className="text-[11px] text-muted-foreground p-2 text-center">… +{items.length - 200} more</div>}
      </div>
    </div>
  );
}

const btnPrimary = 'bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60';
const btnSecondary = 'bg-secondary border border-border text-foreground rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60';
const inputClass = 'bg-background text-foreground border border-border rounded-md px-2 py-1 text-xs';

export default function Maintenance() {
  const navigate = useNavigate();
  const { refresh } = useDatabaseStatus();
  const [unreadable, setUnreadable] = useState(null);
  const [dateChanges, setDateChanges] = useState(null);
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [empty, setEmpty] = useState(null);
  const [genderMismatch, setGenderMismatch] = useState(null);
  const [nameChanges, setNameChanges] = useState(null);
  const [nameField, setNameField] = useState('lastName');
  const [nameMode, setNameMode] = useState('TITLE');
  const [media, setMedia] = useState(null);
  const [busy, setBusy] = useState(false);

  const wrap = (fn) => async () => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-3xl mx-auto p-5">
        <h1 className="text-xl font-bold mb-1">Database Maintenance</h1>
        <p className="text-sm text-muted-foreground mb-5">Audit and clean up your tree. Each tool previews changes first.</p>

        <Card title="Find Unreadable Dates" description="Lists event dates that don't parse as a valid date.">
          <button className={btnSecondary} disabled={busy} onClick={wrap(async () => setUnreadable(await auditUnreadableDates()))}>Scan</button>
          <ResultList items={unreadable} columns={[
            { key: 'recordType', label: 'Type' },
            { key: 'value', label: 'Value' },
            { key: 'open', label: '', render: (it) => <button onClick={() => navigate(`/events`)} className="text-primary hover:underline">open</button> },
          ]} />
        </Card>

        <Card title="Reformat All Dates" description="Converts every parseable event date to a single chosen format.">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs text-muted-foreground">Format</label>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={inputClass}>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD MM YYYY">DD MM YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
            <button className={btnSecondary} disabled={busy}
              onClick={wrap(async () => setDateChanges(await reformatAllDates(dateFormat, { dryRun: true })))}>
              Preview
            </button>
            <button className={btnPrimary} disabled={busy || !dateChanges?.length}
              onClick={wrap(async () => {
                if (!confirm(`Apply to ${dateChanges.length} records?`)) return;
                await reformatAllDates(dateFormat, { dryRun: false });
                setDateChanges(null);
                await refresh();
              })}>Apply</button>
          </div>
          <ResultList items={dateChanges} columns={[
            { key: 'recordType', label: 'Type' },
            { key: 'before', label: 'Before' },
            { key: 'after', label: 'After' },
          ]} />
        </Card>

        <Card title="Reformat Names" description="Apply a casing rule to a name field across all persons.">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <label className="text-xs text-muted-foreground">Field</label>
            <select value={nameField} onChange={(e) => setNameField(e.target.value)} className={inputClass}>
              <option value="firstName">First name</option>
              <option value="lastName">Last name</option>
              <option value="nameMiddle">Middle name</option>
            </select>
            <label className="text-xs text-muted-foreground">Mode</label>
            <select value={nameMode} onChange={(e) => setNameMode(e.target.value)} className={inputClass}>
              <option value="TITLE">Title Case</option>
              <option value="UPPER">UPPERCASE</option>
              <option value="LOWER">lowercase</option>
              <option value="TRIM">Trim whitespace</option>
            </select>
            <button className={btnSecondary} disabled={busy}
              onClick={wrap(async () => setNameChanges(await reformatNames({ field: nameField, mode: nameMode, dryRun: true })))}>
              Preview
            </button>
            <button className={btnPrimary} disabled={busy || !nameChanges?.length}
              onClick={wrap(async () => {
                if (!confirm(`Rewrite ${nameChanges.length} names?`)) return;
                await reformatNames({ field: nameField, mode: nameMode, dryRun: false });
                setNameChanges(null);
                await refresh();
              })}>Apply</button>
          </div>
          <ResultList items={nameChanges} columns={[
            { key: 'recordName', label: 'Person' },
            { key: 'before', label: 'Before' },
            { key: 'after', label: 'After' },
          ]} />
        </Card>

        <Card title="Remove Empty Entries" description="Persons / families with no name or partner data.">
          <div className="flex items-center gap-2">
            <button className={btnSecondary} disabled={busy} onClick={wrap(async () => setEmpty(await auditEmptyEntries()))}>Scan</button>
            <button className={btnPrimary} disabled={busy || !empty?.length}
              onClick={wrap(async () => {
                if (!confirm(`Delete ${empty.length} empty records?`)) return;
                await removeEmptyEntries({ dryRun: false });
                setEmpty(null);
                await refresh();
              })}>Delete all</button>
          </div>
          <ResultList items={empty} columns={[{ key: 'recordType', label: 'Type' }, { key: 'recordName', label: 'Record' }]} />
        </Card>

        <Card title="Family Gender Mismatch" description="Families where the man/woman slot holds a person of the opposite gender.">
          <button className={btnSecondary} disabled={busy} onClick={wrap(async () => setGenderMismatch(await auditFamilyGenderMismatch()))}>Scan</button>
          <ResultList items={genderMismatch} columns={[
            { key: 'familyRecordName', label: 'Family' },
            { key: 'issue', label: 'Issue' },
            { key: 'open', label: '', render: (it) => <button onClick={() => navigate(`/family/${it.familyRecordName}`)} className="text-primary hover:underline">open</button> },
          ]} />
        </Card>

        <Card title="Media Size" description="Read-only summary of media records and their declared sizes.">
          <button className={btnSecondary} disabled={busy} onClick={wrap(async () => setMedia(await mediaSizeReport()))}>Compute</button>
          {media && (
            <div className="mt-3 text-sm">
              <div>{media.count.toLocaleString()} media records</div>
              <div className="text-muted-foreground">{(media.totalBytes / 1024 / 1024).toFixed(2)} MB total (recorded sizes)</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
