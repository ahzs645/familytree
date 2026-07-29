import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { generateId } from '../lib/ids.js';
import { createWithChangeLog, deleteWithChangeLog } from '../lib/recordWrite.js';
import { readField, writeRef } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import {
  loadLdsOrdinanceRows,
  LDS_ORDINANCE_RECORD_TYPE,
  LDS_ORDINANCE_KEY_MAP,
} from '../lib/listData.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';
import { subscribeRecordChanges } from '../lib/data/recordEvents.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const COMMON_ORDINANCES = ['Baptism', 'Confirmation', 'Initiatory', 'Endowment', 'Sealing to Spouse', 'Sealing to Parents'];
const COMMON_STATUSES = ['Completed', 'Submitted', 'Reserved', 'In Progress', 'Ready', 'Not Ready', 'Cancelled'];

function personLabel(record) {
  return personSummary(record)?.fullName || record?.recordName || '';
}

function ownerHref(row) {
  if (row?.ownerType === 'Person' && row.ownerId) return `/person/${row.ownerId}`;
  if (row?.ownerType === 'Family' && row.ownerId) return `/family/${row.ownerId}`;
  return null;
}

const EMPTY_RESULT = { schemaPresent: false, detectedSchema: [], rows: [] };

export default function LdsOrdinances() {
  const { t } = useTranslation();
  const modal = useModal();
  const [result, setResult] = useState(EMPTY_RESULT);
  const [loading, setLoading] = useState(true);
  const [pickedId, setPickedId] = useState(null);
  const scanSeq = useRef(0);

  // The ordinance list is a cross-type scan (dedicated ordinance records plus
  // read-only rows found on Person/Family records), so it can't ride the
  // per-type useRecords cache; refresh it from the same change events instead.
  const reloadRows = useCallback(async () => {
    const seq = ++scanSeq.current;
    const next = await loadLdsOrdinanceRows();
    if (seq !== scanSeq.current) return;
    setResult(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    reloadRows();
    return subscribeRecordChanges(() => { reloadRows(); });
  }, [reloadRows]);

  // The scan owns row selection: drop deleted rows, select the first initially.
  useEffect(() => {
    setPickedId((current) => (current && result.rows.some((row) => row.id === current) ? current : result.rows[0]?.id || null));
  }, [result.rows]);

  const active = useMemo(() => result.rows.find((row) => row.id === pickedId) || null, [result.rows, pickedId]);

  // Seed the editor from the persisted record so the ordinance field shows the
  // raw stored value (the list label is humanized) and edits round-trip cleanly
  // through the row's own field aliases.
  const toValues = useCallback((record) => {
    const keys = active?.fieldKeys || LDS_ORDINANCE_KEY_MAP;
    return {
      ordinance: active?.ordinanceIsConclusion ? active.ordinance : readField(record, [keys.ordinance], ''),
      date: readField(record, [keys.date], ''),
      status: readField(record, [keys.status], ''),
      temple: readField(record, [keys.temple], ''),
      owner: active?.ownerType === 'Person' ? (active.ownerId || '') : '',
    };
  }, [active]);

  const applyValues = useCallback((record, nextValues) => {
    const keys = active?.fieldKeys || LDS_ORDINANCE_KEY_MAP;
    const next = { ...record, fields: { ...record.fields } };
    const setOrDelete = (key, value) => {
      const trimmed = typeof value === 'string' ? value.trim() : value;
      if (trimmed) next.fields[key] = { value: trimmed, type: 'STRING' };
      else delete next.fields[key];
    };
    if (!active?.ordinanceIsConclusion) setOrDelete(keys.ordinance, nextValues.ordinance);
    setOrDelete(keys.date, nextValues.date);
    setOrDelete(keys.status, nextValues.status);
    setOrDelete(keys.temple, nextValues.temple);
    if (nextValues.owner) next.fields[keys.owner] = writeRef(nextValues.owner, 'Person');
    else delete next.fields[keys.owner];
    return next;
  }, [active]);

  // Editable rows can live on any dedicated ordinance record type, so the hook
  // is keyed to the active row's type; the scan-owned selection is mirrored in.
  const {
    active: activeRecord, setActiveId, values, setValues,
    dirty, saving, status, setStatus, flashStatus, onSave: saveActive, onToggleLock,
  } = useRecordEditor({
    recordType: active?.editable ? active.recordType : null,
    noun: 'ordinance',
    idPrefix: 'lds',
    toValues,
    applyValues,
    selectFirst: false,
    savedMessage: t('ldsOrdinances.saved', { defaultValue: 'Saved' }),
  });

  useEffect(() => { setActiveId(pickedId); }, [pickedId, setActiveId]);

  const { records: personRecords } = useRecords('Person');
  const persons = useMemo(
    () => [...personRecords].sort((a, b) => personLabel(a).localeCompare(personLabel(b))),
    [personRecords],
  );

  const onCreate = useCallback(async () => {
    const record = {
      recordName: generateId('lds'),
      recordType: LDS_ORDINANCE_RECORD_TYPE,
      fields: {
        [LDS_ORDINANCE_KEY_MAP.ordinance]: { value: 'Baptism', type: 'STRING' },
        [LDS_ORDINANCE_KEY_MAP.status]: { value: 'Submitted', type: 'STRING' },
      },
    };
    await createWithChangeLog(record);
    await reloadRows();
    setPickedId(record.recordName);
  }, [reloadRows]);

  const onSave = useCallback(async () => {
    if (!activeRecord) return;
    if (isRecordLocked(activeRecord)) {
      setStatus(t('ldsOrdinances.unlockSave', { defaultValue: 'Unlock this record before saving.' }));
      return;
    }
    await saveActive();
    flashStatus(t('ldsOrdinances.saved', { defaultValue: 'Saved' }));
  }, [activeRecord, saveActive, setStatus, flashStatus, t]);

  const onDelete = useCallback(async () => {
    if (!active?.editable || !activeRecord) return;
    if (isRecordLocked(activeRecord)) {
      setStatus(t('ldsOrdinances.unlockDelete', { defaultValue: 'Unlock this record before deleting.' }));
      return;
    }
    const confirmed = await modal.confirm(
      t('ldsOrdinances.deleteConfirm', { defaultValue: 'Delete this ordinance record?' }),
      {
        title: t('ldsOrdinances.deleteTitle', { defaultValue: 'Delete ordinance' }),
        okLabel: t('ldsOrdinances.deleteOk', { defaultValue: 'Delete' }),
        destructive: true,
      },
    );
    if (!confirmed) return;
    await deleteWithChangeLog(active.id, active.recordType);
  }, [active, activeRecord, modal, setStatus, t]);

  const newButton = (
    <Button variant="primary" size="sm" onClick={onCreate}>
      {t('ldsOrdinances.addNew', { defaultValue: '+ New ordinance' })}
    </Button>
  );

  if (loading) return <div className="p-10 text-muted-foreground">{t('ldsOrdinances.loading')}</div>;

  if (!result.schemaPresent) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
          <h1 className="text-base font-semibold">{t('ldsOrdinances.title')}</h1>
          <span className="ms-auto">{newButton}</span>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <h2 className="text-lg font-semibold mb-2">{t('ldsOrdinances.noSchemaTitle')}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('ldsOrdinances.noSchemaBody')}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('ldsOrdinances.bootstrapHint', { defaultValue: 'Or add the first ordinance record to start tracking them here.' })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const ownerLinkHref = ownerHref(active);
  const detail = !active ? (
    <div className="p-10 text-muted-foreground">{t('ldsOrdinances.detailEmpty', { defaultValue: 'Select an ordinance to view or edit.' })}</div>
  ) : active.editable ? (
    <div className="p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold truncate">{active.ordinance || t('ldsOrdinances.ordinance')}</h2>
        <span className="ms-auto"><SaveStatus status={status} dirty={dirty} /></span>
        <RecordLockButton record={activeRecord} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(activeRecord)} className="text-destructive-text border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">
          {t('ldsOrdinances.delete', { defaultValue: 'Delete' })}
        </button>
        <Button variant="primary" size="md" onClick={onSave} disabled={saving || isRecordLocked(activeRecord) || !dirty} title="Save (⌘/Ctrl+S)">
          {saving ? t('ldsOrdinances.saving', { defaultValue: 'Saving…' }) : t('ldsOrdinances.save', { defaultValue: 'Save' })}
        </Button>
      </div>

      <section className="border border-border rounded-md bg-card p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label={t('ldsOrdinances.ordinance')}>
            {active.ordinanceIsConclusion ? (
              <input value={values.ordinance || ''} readOnly className={` opacity-70`} />
            ) : (
              <>
                <input
                  list="lds-ordinance-options"
                  value={values.ordinance || ''}
                  onChange={(e) => setValues({ ...values, ordinance: e.target.value })}
                  className={formClasses.input}
                />
                <datalist id="lds-ordinance-options">
                  {COMMON_ORDINANCES.map((o) => <option key={o} value={o} />)}
                </datalist>
              </>
            )}
          </FieldRow>
          <FieldRow label={t('ldsOrdinances.owner')}>
            <select value={values.owner || ''} onChange={(e) => setValues({ ...values, owner: e.target.value })} className={formClasses.input}>
              <option value="">{t('ldsOrdinances.noPerson', { defaultValue: 'No person linked' })}</option>
              {persons.map((person) => <option key={person.recordName} value={person.recordName}>{personLabel(person)}</option>)}
            </select>
          </FieldRow>
          <FieldRow label={t('ldsOrdinances.date')}>
            <DatePicker
              value={values.date || ''}
              onChange={(value) => setValues({ ...values, date: value })}
              placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
            />
          </FieldRow>
          <FieldRow label={t('ldsOrdinances.status')}>
            <input
              list="lds-status-options"
              value={values.status || ''}
              onChange={(e) => setValues({ ...values, status: e.target.value })}
              className={formClasses.input}
            />
            <datalist id="lds-status-options">
              {COMMON_STATUSES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </FieldRow>
          <FieldRow label={t('ldsOrdinances.templePlace')}>
            <input value={values.temple || ''} onChange={(e) => setValues({ ...values, temple: e.target.value })} className={formClasses.input} />
          </FieldRow>
        </div>
        {active.ownerType === 'Person' && active.ownerId ? (
          <div className="mt-3 text-xs text-muted-foreground">
            <Link to={`/person/${active.ownerId}`} className="text-interactive hover:underline">{active.ownerName}</Link>
          </div>
        ) : null}
      </section>
    </div>
  ) : (
    <div className="p-5 max-w-3xl">
      <h2 className="text-base font-semibold mb-3">{active.ordinance || t('ldsOrdinances.ordinance')}</h2>
      <div className="border border-border rounded-md bg-card p-4 text-sm grid gap-2">
        <ReadOnlyCell label={t('ldsOrdinances.owner')} value={
          ownerLinkHref
            ? <Link to={ownerLinkHref} className="text-interactive hover:underline">{active.ownerName}</Link>
            : active.ownerName
        } />
        <ReadOnlyCell label={t('ldsOrdinances.date')} value={active.date || '—'} />
        <ReadOnlyCell label={t('ldsOrdinances.status')} value={String(active.status || '') || '—'} />
        <ReadOnlyCell label={t('ldsOrdinances.templePlace')} value={String(active.temple || '') || '—'} />
        <ReadOnlyCell label={t('ldsOrdinances.recordType')} value={active.recordType} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {t('ldsOrdinances.readOnlyNote', { defaultValue: 'This ordinance is stored on a Person or Family record. Open the linked record to edit it.' })}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">{t('ldsOrdinances.title')}</h1>
        <span className="text-xs text-muted-foreground">{result.rows.length}</span>
        <span className="ms-auto">{newButton}</span>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList
          items={result.rows}
          activeId={pickedId}
          onPick={setPickedId}
          renderRow={(row) => (
            <div>
              <div className="text-sm text-foreground truncate">{row.ordinance || t('ldsOrdinances.ordinance')}</div>
              <div className="text-xs text-muted-foreground truncate">
                {row.ownerName}{row.date ? ` · ${row.date}` : ''}{row.editable ? '' : ` · ${row.recordType}`}
              </div>
            </div>
          )}
          placeholder={t('ldsOrdinances.searchPlaceholder')}
          detail={detail}
          emptyTitle={t('ldsOrdinances.emptyTitle')}
          emptyHint={t('ldsOrdinances.emptyHint')}
        />
      </div>
    </div>
  );
}

function ReadOnlyCell({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-words">{value}</span>
    </div>
  );
}
