import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { logRecordCreated, logRecordDeleted, saveWithChangeLog } from '../lib/changeLog.js';
import { readRef } from '../lib/schema.js';
import { sourceSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';
import { useModal } from '../contexts/ModalContext.jsx';

const REPOSITORY_FIELDS = [
  'name',
  'address',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'country',
  'phone',
  'email',
  'fax',
  'website',
  'note',
];

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function repoName(record) {
  return record?.fields?.name?.value || record?.fields?.title?.value || record?.recordName || 'Repository';
}

function sourceTitle(record) {
  return sourceSummary(record)?.title || record?.fields?.cached_title?.value || record?.recordName || 'Source';
}

export default function SourceRepositories() {
  const modal = useModal();
  const [repositories, setRepositories] = useState([]);
  const [sources, setSources] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [repoRows, sourceRows] = await Promise.all([
      db.query('SourceRepository', { limit: 100000 }),
      db.query('Source', { limit: 100000 }),
    ]);
    const sorted = repoRows.records.sort((a, b) => repoName(a).localeCompare(repoName(b)));
    setRepositories(sorted);
    setSources(sourceRows.records.sort((a, b) => sourceTitle(a).localeCompare(sourceTitle(b))));
    if (!activeId && sorted.length > 0) setActiveId(sorted[0].recordName);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const active = repositories.find((record) => record.recordName === activeId);
    if (!active) return;
    setValues(Object.fromEntries(REPOSITORY_FIELDS.map((field) => [field, active.fields?.[field]?.value || ''])));
  }, [activeId, repositories]);

  const active = repositories.find((record) => record.recordName === activeId);
  const linkedSources = useMemo(() => (
    sources.filter((source) => readRef(source.fields?.sourceRepository) === activeId)
  ), [activeId, sources]);

  const onCreate = useCallback(async () => {
    const db = getLocalDatabase();
    const record = {
      recordName: uuid('repo'),
      recordType: 'SourceRepository',
      fields: { name: { value: 'New Repository', type: 'STRING' } },
    };
    await db.saveRecord(record);
    await logRecordCreated(record);
    await reload();
    setActiveId(record.recordName);
  }, [reload]);

  const onSave = useCallback(async () => {
    if (!active) return;
    setSaving(true);
    const next = { ...active, fields: { ...active.fields } };
    for (const field of REPOSITORY_FIELDS) {
      const value = values[field];
      if (value) next.fields[field] = { value, type: 'STRING' };
      else delete next.fields[field];
    }
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [active, values, reload]);

  const onDelete = useCallback(async () => {
    if (!active) return;
    const message = linkedSources.length
      ? `Delete this repository and detach it from ${linkedSources.length} source record(s)?`
      : 'Delete this repository?';
    if (!(await modal.confirm(message, { title: 'Delete repository', okLabel: 'Delete', destructive: true }))) return;
    const db = getLocalDatabase();
    for (const source of linkedSources) {
      const fields = { ...source.fields };
      delete fields.sourceRepository;
      await saveWithChangeLog({ ...source, fields });
    }
    await db.deleteRecord(active.recordName);
    await logRecordDeleted(active.recordName, 'SourceRepository');
    setActiveId(null);
    await reload();
  }, [active, linkedSources, reload, modal]);

  const renderRow = (record) => {
    const count = sources.filter((source) => readRef(source.fields?.sourceRepository) === record.recordName).length;
    return (
      <div>
        <div className="text-sm text-foreground truncate">{repoName(record)}</div>
        <div className="text-xs text-muted-foreground">{count} linked source{count === 1 ? '' : 's'}</div>
      </div>
    );
  };

  const detail = active ? (
    <div className="p-5 max-w-4xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold truncate">{repoName(active)}</h2>
        {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
        <button onClick={onDelete} className="ms-auto text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">Delete</button>
        <button onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Repository Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Name"><input value={values.name || ''} onChange={(e) => setValues({ ...values, name: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Website"><input value={values.website || ''} onChange={(e) => setValues({ ...values, website: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Phone"><input value={values.phone || ''} onChange={(e) => setValues({ ...values, phone: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Email"><input value={values.email || ''} onChange={(e) => setValues({ ...values, email: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Fax"><input value={values.fax || ''} onChange={(e) => setValues({ ...values, fax: e.target.value })} style={editorInput} /></FieldRow>
        </div>
      </section>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Address</h3>
        <FieldRow label="Full address"><textarea value={values.address || ''} rows={3} onChange={(e) => setValues({ ...values, address: e.target.value })} style={editorTextarea} /></FieldRow>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Address line 1"><input value={values.addressLine1 || ''} onChange={(e) => setValues({ ...values, addressLine1: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Address line 2"><input value={values.addressLine2 || ''} onChange={(e) => setValues({ ...values, addressLine2: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="City"><input value={values.city || ''} onChange={(e) => setValues({ ...values, city: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="State / Province"><input value={values.state || ''} onChange={(e) => setValues({ ...values, state: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Postal Code"><input value={values.postalCode || ''} onChange={(e) => setValues({ ...values, postalCode: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Country"><input value={values.country || ''} onChange={(e) => setValues({ ...values, country: e.target.value })} style={editorInput} /></FieldRow>
        </div>
      </section>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Linked Sources</h3>
        {linkedSources.length === 0 ? (
          <div className="text-sm text-muted-foreground">No sources currently point to this repository.</div>
        ) : (
          <div className="space-y-2">
            {linkedSources.map((source) => (
              <div key={source.recordName} className="flex items-center gap-2 bg-secondary/40 rounded-md p-2">
                <span className="text-sm flex-1 truncate">{sourceTitle(source)}</span>
                <span className="text-xs text-muted-foreground">{source.fields?.cached_date?.value || source.fields?.date?.value || ''}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border border-border rounded-md bg-card p-3">
        <h3 className="text-sm font-semibold mb-3">Notes</h3>
        <textarea value={values.note || ''} rows={5} onChange={(e) => setValues({ ...values, note: e.target.value })} style={editorTextarea} />
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">No repository selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Source Repositories</h1>
        <span className="text-xs text-muted-foreground">{repositories.length}</span>
        <button onClick={onCreate} className="ms-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">+ New</button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList
          items={repositories}
          activeId={activeId}
          onPick={setActiveId}
          renderRow={renderRow}
          placeholder="Search repositories..."
          detail={detail}
        />
      </div>
    </div>
  );
}
