import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { logRecordCreated, logRecordDeleted, saveWithChangeLog } from '../lib/changeLog.js';
import { readLabel, readRef } from '../lib/schema.js';
import { recordDisplayLabel } from '../components/editors/RelatedRecordEditors.jsx';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function labelName(record) {
  return readLabel(record).name || record.recordName;
}

function normalizeCssColor(value) {
  return value || '#2563eb';
}

export default function Labels() {
  const [labels, setLabels] = useState([]);
  const [relations, setRelations] = useState([]);
  const [targets, setTargets] = useState(new Map());
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [labelRows, relationRows, allRecords] = await Promise.all([
      db.query('Label', { limit: 100000 }),
      db.query('LabelRelation', { limit: 100000 }),
      db.getAllRecords(),
    ]);
    const sorted = labelRows.records.sort((a, b) => labelName(a).localeCompare(labelName(b)));
    setLabels(sorted);
    setRelations(relationRows.records);
    setTargets(new Map(allRecords.map((record) => [record.recordName, record])));
    if (!activeId && sorted.length > 0) setActiveId(sorted[0].recordName);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const active = labels.find((record) => record.recordName === activeId);
    if (!active) return;
    const display = readLabel(active);
    setValues({
      name: display.name || '',
      color: display.rawColor || display.color || '',
      description: active.fields?.description?.value || active.fields?.text?.value || '',
    });
  }, [activeId, labels]);

  const active = labels.find((record) => record.recordName === activeId);
  const activeRelations = useMemo(() => relations.filter((rel) => readRef(rel.fields?.label) === activeId), [activeId, relations]);

  const onCreate = useCallback(async () => {
    const db = getLocalDatabase();
    const record = {
      recordName: uuid('lbl'),
      recordType: 'Label',
      fields: {
        name: { value: 'New Label', type: 'STRING' },
        color: { value: '#2563eb', type: 'STRING' },
      },
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
    if (values.name) {
      next.fields.name = { value: values.name, type: 'STRING' };
      next.fields.title = { value: values.name, type: 'STRING' };
    } else {
      delete next.fields.name;
      delete next.fields.title;
    }
    if (values.color) next.fields.color = { value: values.color, type: 'STRING' };
    else delete next.fields.color;
    if (values.description) {
      next.fields.description = { value: values.description, type: 'STRING' };
      next.fields.text = { value: values.description, type: 'STRING' };
    } else {
      delete next.fields.description;
      delete next.fields.text;
    }
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [active, reload, values]);

  const onDelete = useCallback(async () => {
    if (!active) return;
    const message = activeRelations.length
      ? `Delete this label and remove ${activeRelations.length} label assignment(s)?`
      : 'Delete this label?';
    if (!confirm(message)) return;
    const db = getLocalDatabase();
    await db.applyRecordTransaction({
      deleteRecordNames: [active.recordName, ...activeRelations.map((rel) => rel.recordName)],
    });
    await logRecordDeleted(active.recordName, 'Label');
    setActiveId(null);
    await reload();
  }, [active, activeRelations, reload]);

  const renderRow = (record) => {
    const display = readLabel(record);
    const count = relations.filter((rel) => readRef(rel.fields?.label) === record.recordName).length;
    return (
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm border border-border" style={{ background: normalizeCssColor(display.color) }} />
        <div className="min-w-0">
          <div className="text-sm text-foreground truncate">{display.name || record.recordName}</div>
          <div className="text-xs text-muted-foreground">{count} assignment{count === 1 ? '' : 's'}</div>
        </div>
      </div>
    );
  };

  const detail = active ? (
    <div className="p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-5 h-5 rounded-sm border border-border" style={{ background: normalizeCssColor(values.color) }} />
        <h2 className="text-base font-semibold truncate">{labelName(active)}</h2>
        {status && <span className="ml-auto text-xs text-emerald-500">{status}</span>}
        <button onClick={onDelete} className="ml-auto text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">Delete</button>
        <button onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Label</h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-3">
          <FieldRow label="Name"><input value={values.name || ''} onChange={(e) => setValues({ ...values, name: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Color">
            <div className="flex gap-2">
              <input type="color" value={normalizeCssColor(values.color).startsWith('#') ? normalizeCssColor(values.color) : '#2563eb'} onChange={(e) => setValues({ ...values, color: e.target.value })} className="h-9 w-12 bg-background border border-border rounded-md" />
              <input value={values.color || ''} onChange={(e) => setValues({ ...values, color: e.target.value })} style={editorInput} />
            </div>
          </FieldRow>
        </div>
        <FieldRow label="Description">
          <textarea value={values.description || ''} rows={3} onChange={(e) => setValues({ ...values, description: e.target.value })} style={editorTextarea} />
        </FieldRow>
      </section>

      <section className="border border-border rounded-md bg-card p-3">
        <h3 className="text-sm font-semibold mb-3">Assigned Records</h3>
        {activeRelations.length === 0 ? (
          <div className="text-sm text-muted-foreground">No records currently use this label.</div>
        ) : (
          <div className="space-y-2">
            {activeRelations.map((relation) => {
              const targetId =
                readRef(relation.fields?.target) ||
                readRef(relation.fields?.baseObject) ||
                readRef(relation.fields?.targetPerson) ||
                readRef(relation.fields?.targetFamily) ||
                readRef(relation.fields?.targetPlace) ||
                readRef(relation.fields?.targetSource);
              const target = targets.get(targetId);
              return (
                <div key={relation.recordName} className="flex items-center gap-2 bg-secondary/40 rounded-md p-2">
                  <span className="text-xs text-muted-foreground w-24">{target?.recordType || relation.fields?.targetType?.value || 'Record'}</span>
                  <span className="text-sm flex-1 truncate">{recordDisplayLabel(target) || targetId || relation.recordName}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">No label selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Labels</h1>
        <span className="text-xs text-muted-foreground">{labels.length}</span>
        <button onClick={onCreate} className="ml-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">+ New</button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList
          items={labels}
          activeId={activeId}
          onPick={setActiveId}
          renderRow={renderRow}
          placeholder="Search labels..."
          detail={detail}
        />
      </div>
    </div>
  );
}
