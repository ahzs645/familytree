import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { readLabel, readRef } from '../lib/schema.js';
import { recordDisplayLabel } from '../components/editors/RelatedRecordEditors.jsx';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';
import { deleteWithChangeLog, stringField } from '../lib/recordWrite.js';
import { toCssHexColor } from '../lib/labelColors.js';
import { PageTitle } from '../components/ui/PageTitle.jsx';

function labelName(record) {
  return readLabel(record).name || record.recordName;
}

function normalizeCssColor(value) {
  return toCssHexColor(value) || '#2563eb';
}

function labelToValues(record) {
  const display = readLabel(record);
  return {
    name: display.name || '',
    color: toCssHexColor(display.rawColor || display.color) || '#2563eb',
    description: record.fields?.description?.value || record.fields?.text?.value || '',
  };
}

// Labels mirror name→title and description→text for legacy readers, so the
// plain `fields` model does not fit; apply the mirrored pairs explicitly.
function labelApplyValues(record, values) {
  const next = { ...record, fields: { ...record.fields } };
  const setOrClear = (name, value) => {
    const field = stringField(value);
    if (field) next.fields[name] = field;
    else delete next.fields[name];
  };
  setOrClear('name', values.name);
  setOrClear('title', values.name);
  setOrClear('color', values.color);
  setOrClear('description', values.description);
  setOrClear('text', values.description);
  return next;
}

export default function Labels() {
  const modal = useModal();
  const [searchParams] = useSearchParams();
  const queryLabelId = searchParams.get('labelId');
  const {
    rows: labels, active, activeId, setActiveId, values, setValues,
    dirty, saving, status, setStatus, onCreate, onSave, onToggleLock,
  } = useRecordEditor({
    recordType: 'Label',
    noun: 'label',
    idPrefix: 'lbl',
    labelOf: labelName,
    createValues: () => ({ name: 'New Label', color: '#2563eb' }),
    toValues: labelToValues,
    applyValues: labelApplyValues,
  });
  const { records: relations } = useRecords('LabelRelation');
  const [targets, setTargets] = useState(new Map());

  useEffect(() => {
    let cancelled = false;
    getAppDataClient().records.all().then((records) => {
      if (!cancelled) setTargets(new Map(records.map((record) => [record.recordName, record])));
    });
    return () => { cancelled = true; };
  }, [relations]);

  useEffect(() => {
    if (!queryLabelId || labels.length === 0) return;
    if (labels.some((label) => label.recordName === queryLabelId)) setActiveId(queryLabelId);
  }, [queryLabelId, labels, setActiveId]);

  const activeRelations = useMemo(() => relations.filter((rel) => readRef(rel.fields?.label) === activeId), [activeId, relations]);

  const onDelete = useCallback(async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this label before deleting.');
      return;
    }
    const message = activeRelations.length
      ? `Delete this label and remove ${activeRelations.length} label assignment(s)?`
      : 'Delete this label?';
    if (!(await modal.confirm(message, { title: 'Delete label', okLabel: 'Delete', destructive: true }))) return;
    for (const relation of activeRelations) {
      await deleteWithChangeLog(relation.recordName, 'LabelRelation');
    }
    await deleteWithChangeLog(active.recordName, 'Label');
  }, [active, activeRelations, modal, setStatus]);

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
        <span className="ms-auto"><SaveStatus status={status} dirty={dirty} /></span>
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(active)} className="ms-auto text-destructive-text border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">Delete</button>
        <Button variant="primary" size="md" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)">
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Label</h3>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px] gap-3">
          <FieldRow label="Name"><input value={values.name || ''} onChange={(e) => setValues({ ...values, name: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={normalizeCssColor(values.color)}
                onChange={(e) => setValues({ ...values, color: e.target.value })}
                className="h-9 w-12 bg-background border border-border rounded-md cursor-pointer"
              />
              <span className="text-xs font-mono text-muted-foreground">{normalizeCssColor(values.color)}</span>
            </div>
          </FieldRow>
        </div>
        <FieldRow label="Description">
          <textarea value={values.description || ''} rows={3} onChange={(e) => setValues({ ...values, description: e.target.value })} className={formClasses.textarea} />
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
        <PageTitle className="text-base font-semibold">Labels</PageTitle>
        <span className="text-xs text-muted-foreground">{labels.length}</span>
        <Button variant="primary" size="sm" onClick={onCreate} className="ms-auto">+ New</Button>
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
