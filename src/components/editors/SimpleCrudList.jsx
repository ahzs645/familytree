/**
 * Generic master/detail editor for any record type with a flat field set.
 * Caller supplies recordType, displayLabel, and a list of editable fields.
 * Save runs through saveWithChangeLog so edits land in the change log.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../../lib/changeLog.js';
import { MasterDetailList } from './MasterDetailList.jsx';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const inputClass = 'w-full bg-background text-foreground border border-border rounded-md px-2.5 py-2 text-sm outline-none focus:border-primary';

export function SimpleCrudList({
  recordType,
  uuidPrefix = 'rec',
  title = recordType,
  fields,
  displayLabel = (r) => r.fields?.[fields[0].id]?.value || r.recordName,
  searchPlaceholder = 'Search…',
  emptyText = `No ${recordType} records yet.`,
  extraDefaults = {},
}) {
  const [records, setRecords] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const { records: list } = await db.query(recordType, { limit: 100000 });
    list.sort((a, b) => String(displayLabel(a)).localeCompare(String(displayLabel(b))));
    setRecords(list);
    if (!activeId && list.length > 0) setActiveId(list[0].recordName);
  }, [recordType, activeId, displayLabel]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!activeId) return;
    const r = records.find((x) => x.recordName === activeId);
    if (!r) return;
    const v = {};
    for (const f of fields) v[f.id] = r.fields?.[f.id]?.value ?? '';
    setValues(v);
  }, [activeId, records, fields]);

  const onCreate = useCallback(async () => {
    const db = getLocalDatabase();
    const rec = {
      recordName: uuid(uuidPrefix),
      recordType,
      fields: { ...extraDefaults },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    await reload();
    setActiveId(rec.recordName);
  }, [recordType, uuidPrefix, extraDefaults, reload]);

  const onDelete = useCallback(async () => {
    if (!activeId) return;
    if (!confirm('Delete this record?')) return;
    const db = getLocalDatabase();
    await db.deleteRecord(activeId);
    await logRecordDeleted(activeId, recordType);
    setActiveId(null);
    await reload();
  }, [activeId, recordType, reload]);

  const onSave = useCallback(async () => {
    const r = records.find((x) => x.recordName === activeId);
    if (!r) return;
    setSaving(true);
    const next = { ...r, fields: { ...r.fields } };
    for (const f of fields) {
      const v = values[f.id];
      if (v == null || v === '') delete next.fields[f.id];
      else next.fields[f.id] = { value: f.type === 'number' ? +v : v, type: f.type === 'number' ? 'NUMBER' : 'STRING' };
    }
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, records, fields, values, reload]);

  const renderRow = (r) => (
    <div className="text-sm text-foreground truncate">{displayLabel(r)}</div>
  );

  const active = records.find((r) => r.recordName === activeId);
  const detail = active ? (
    <div className="p-5 max-w-2xl">
      <div className="flex items-center mb-4">
        <h2 className="text-base font-semibold truncate">{displayLabel(active)}</h2>
        <div className="ml-auto flex items-center gap-2">
          {status && <span className="text-emerald-500 text-xs">{status}</span>}
          <button onClick={onDelete} className="text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">Delete</button>
          <button onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
            {f.kind === 'textarea' ? (
              <textarea value={values[f.id] ?? ''} rows={f.rows || 4}
                onChange={(e) => setValues((s) => ({ ...s, [f.id]: e.target.value }))}
                className={inputClass + ' resize-y'} />
            ) : f.kind === 'select' ? (
              <select value={values[f.id] ?? ''}
                onChange={(e) => setValues((s) => ({ ...s, [f.id]: e.target.value }))}
                className={inputClass}>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type={f.type === 'number' ? 'number' : 'text'} value={values[f.id] ?? ''}
                onChange={(e) => setValues((s) => ({ ...s, [f.id]: e.target.value }))}
                className={inputClass} />
            )}
            {f.hint && <div className="text-[11px] text-muted-foreground mt-1">{f.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="p-10 text-muted-foreground">No {title.toLowerCase()} selected.</div>
  );

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">{title}</h1>
        <span className="text-xs text-muted-foreground">{records.length}</span>
        <button onClick={onCreate} className="ml-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">+ New</button>
      </header>
      <div className="flex-1 min-h-0">
        {records.length === 0 ? (
          <div className="text-center text-muted-foreground p-10">{emptyText}</div>
        ) : (
          <MasterDetailList
            items={records}
            activeId={activeId}
            onPick={setActiveId}
            renderRow={renderRow}
            placeholder={searchPlaceholder}
            detail={detail}
          />
        )}
      </div>
    </div>
  );
}

export default SimpleCrudList;
