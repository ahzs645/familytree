/**
 * Generic master/detail editor for any record type with a flat field set.
 * Caller supplies recordType, displayLabel, and a list of editable fields.
 * Save runs through saveWithChangeLog so edits land in the change log.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRecords } from '../../lib/data/useRecords.js';
import { saveWithChangeLog } from '../../lib/changeLog.js';
import { createWithChangeLog, deleteWithChangeLog } from '../../lib/recordWrite.js';
import { MasterDetailList } from './MasterDetailList.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';
import { readRef, refValue } from '../../lib/schema.js';
import { generateId } from '../../lib/ids.js';
import { formClasses } from '../ui/formClasses.js';
import { Button } from '../ui/Button.jsx';

function uuid(prefix) {
  return generateId(prefix);
}

const inputClass = formClasses.input;

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
  const modal = useModal();
  const { records: rawRecords } = useRecords(recordType);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const records = useMemo(() => {
    const list = [...rawRecords];
    list.sort((a, b) => String(displayLabel(a)).localeCompare(String(displayLabel(b))));
    return list;
  }, [rawRecords, displayLabel]);

  useEffect(() => {
    if (!activeId && records.length > 0) setActiveId(records[0].recordName);
  }, [activeId, records]);

  useEffect(() => {
    if (!activeId) return;
    const r = records.find((x) => x.recordName === activeId);
    if (!r) return;
    const v = {};
    for (const f of fields) {
      v[f.id] = f.referenceType ? readRef(r.fields?.[f.id]) || '' : r.fields?.[f.id]?.value ?? '';
    }
    setValues(v);
  }, [activeId, records, fields]);

  const onCreate = useCallback(async () => {
    const rec = {
      recordName: uuid(uuidPrefix),
      recordType,
      fields: { ...extraDefaults },
    };
    await createWithChangeLog(rec);
    setActiveId(rec.recordName);
  }, [recordType, uuidPrefix, extraDefaults]);

  const onDelete = useCallback(async () => {
    if (!activeId) return;
    if (!(await modal.confirm('Delete this record?', { title: 'Delete record', okLabel: 'Delete', destructive: true }))) return;
    await deleteWithChangeLog(activeId, recordType);
    setActiveId(null);
  }, [activeId, recordType, modal]);

  const onSave = useCallback(async () => {
    const r = records.find((x) => x.recordName === activeId);
    if (!r) return;
    setSaving(true);
    const next = { ...r, fields: { ...r.fields } };
    for (const f of fields) {
      const v = values[f.id];
      if (v == null || v === '') delete next.fields[f.id];
      else if (f.referenceType) next.fields[f.id] = { value: refValue(v, f.referenceType), type: 'REFERENCE' };
      else next.fields[f.id] = { value: f.type === 'number' ? +v : v, type: f.type === 'number' ? 'NUMBER' : 'STRING' };
    }
    await saveWithChangeLog(next);
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, records, fields, values]);

  const renderRow = (r) => (
    <div className="text-sm text-foreground truncate">{displayLabel(r)}</div>
  );

  const active = records.find((r) => r.recordName === activeId);
  const detail = active ? (
    <div className="p-5 max-w-2xl">
      <div className="flex items-center mb-4">
        <h2 className="text-base font-semibold truncate">{displayLabel(active)}</h2>
        <div className="ms-auto flex items-center gap-2">
          {status && <span className="text-success-text text-xs">{status}</span>}
          <button onClick={onDelete} className="text-destructive-text border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">Delete</button>
          <Button variant="primary" size="md" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {fields.map((f) => (
          <label key={f.id} className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</span>
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
            {f.hint && <span className="block text-2xs text-muted-foreground mt-1">{f.hint}</span>}
          </label>
        ))}
      </div>
    </div>
  ) : (
    <div className="p-10 text-muted-foreground">No {title.toLowerCase()} selected.</div>
  );

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        {/* h2, not h1: this list is a panel inside a page that already titles itself. */}
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{records.length}</span>
        <Button variant="primary" size="sm" onClick={onCreate} className="ms-auto">+ New</Button>
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
