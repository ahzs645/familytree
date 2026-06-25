import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { generateId } from '../lib/ids.js';
import { logRecordCreated, logRecordDeleted, saveWithChangeLog } from '../lib/changeLog.js';
import { readField, writeRef } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import {
  loadLdsOrdinanceRows,
  LDS_ORDINANCE_RECORD_TYPE,
  LDS_ORDINANCE_KEY_MAP,
} from '../lib/listData.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput } from '../components/editors/FieldRow.jsx';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
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
  const [persons, setPersons] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [next, personRows] = await Promise.all([
      loadLdsOrdinanceRows(),
      db.query('Person', { limit: 100000 }),
    ]);
    setResult(next);
    setPersons(personRows.records.sort((a, b) => personLabel(a).localeCompare(personLabel(b))));
    setActiveId((current) => (current && next.rows.some((row) => row.id === current) ? current : next.rows[0]?.id || null));
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const active = useMemo(() => result.rows.find((row) => row.id === activeId) || null, [result.rows, activeId]);

  // Seed the editor from the persisted record so the ordinance field shows the
  // raw stored value (the list label is humanized) and edits round-trip cleanly.
  useEffect(() => {
    if (!active || !active.editable) {
      setValues({});
      return;
    }
    let cancelled = false;
    (async () => {
      const record = await getLocalDatabase().getRecord(active.id);
      if (cancelled) return;
      const keys = active.fieldKeys;
      setValues({
        ordinance: active.ordinanceIsConclusion ? active.ordinance : readField(record, keys.ordinance, ''),
        date: readField(record, keys.date, ''),
        status: readField(record, keys.status, ''),
        temple: readField(record, keys.temple, ''),
        owner: active.ownerType === 'Person' ? (active.ownerId || '') : '',
      });
    })();
    return () => { cancelled = true; };
  }, [active]);

  const onCreate = useCallback(async () => {
    const db = getLocalDatabase();
    const record = {
      recordName: generateId('lds'),
      recordType: LDS_ORDINANCE_RECORD_TYPE,
      fields: {
        [LDS_ORDINANCE_KEY_MAP.ordinance]: { value: 'Baptism', type: 'STRING' },
        [LDS_ORDINANCE_KEY_MAP.status]: { value: 'Submitted', type: 'STRING' },
      },
    };
    await db.saveRecord(record);
    await logRecordCreated(record);
    await reload();
    setActiveId(record.recordName);
  }, [reload]);

  const onSave = useCallback(async () => {
    if (!active || !active.editable) return;
    const db = getLocalDatabase();
    const record = await db.getRecord(active.id);
    if (!record) return;
    if (isRecordLocked(record)) {
      setStatus(t('ldsOrdinances.unlockSave', { defaultValue: 'Unlock this record before saving.' }));
      return;
    }
    setSaving(true);
    const keys = active.fieldKeys;
    const next = { ...record, fields: { ...record.fields } };
    const setOrDelete = (key, value) => {
      const trimmed = typeof value === 'string' ? value.trim() : value;
      if (trimmed) next.fields[key] = { value: trimmed, type: 'STRING' };
      else delete next.fields[key];
    };
    if (!active.ordinanceIsConclusion) setOrDelete(keys.ordinance, values.ordinance);
    setOrDelete(keys.date, values.date);
    setOrDelete(keys.status, values.status);
    setOrDelete(keys.temple, values.temple);
    if (values.owner) next.fields[keys.owner] = writeRef(values.owner, 'Person');
    else delete next.fields[keys.owner];
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus(t('ldsOrdinances.saved', { defaultValue: 'Saved' }));
    setTimeout(() => setStatus(null), 1500);
  }, [active, values, reload, t]);

  const onDelete = useCallback(async () => {
    if (!active || !active.editable) return;
    const db = getLocalDatabase();
    const record = await db.getRecord(active.id);
    if (!record) return;
    if (isRecordLocked(record)) {
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
    await db.deleteRecord(active.id);
    await logRecordDeleted(active.id, record.recordType);
    setActiveId(null);
    await reload();
  }, [active, modal, reload, t]);

  const newButton = (
    <button onClick={onCreate} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">
      {t('ldsOrdinances.addNew', { defaultValue: '+ New ordinance' })}
    </button>
  );

  if (loading) return <div className="p-10 text-muted-foreground">{t('ldsOrdinances.loading')}</div>;

  if (!result.schemaPresent) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
          <h1 className="text-base font-semibold">{t('ldsOrdinances.title')}</h1>
          <span className="ms-auto">{newButton}</span>
        </header>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-xl text-center">
            <h2 className="text-lg font-semibold mb-2">{t('ldsOrdinances.noSchemaTitle')}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t('ldsOrdinances.noSchemaBody')}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('ldsOrdinances.bootstrapHint', { defaultValue: 'Or add the first ordinance record to start tracking them here.' })}
            </p>
          </div>
        </main>
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
        <span className="ms-auto"><SaveStatus status={status} dirty={false} /></span>
        <button onClick={onDelete} className="text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">
          {t('ldsOrdinances.delete', { defaultValue: 'Delete' })}
        </button>
        <button onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? t('ldsOrdinances.saving', { defaultValue: 'Saving…' }) : t('ldsOrdinances.save', { defaultValue: 'Save' })}
        </button>
      </div>

      <section className="border border-border rounded-md bg-card p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label={t('ldsOrdinances.ordinance')}>
            {active.ordinanceIsConclusion ? (
              <input value={values.ordinance || ''} readOnly style={{ ...editorInput, opacity: 0.7 }} />
            ) : (
              <>
                <input
                  list="lds-ordinance-options"
                  value={values.ordinance || ''}
                  onChange={(e) => setValues({ ...values, ordinance: e.target.value })}
                  style={editorInput}
                />
                <datalist id="lds-ordinance-options">
                  {COMMON_ORDINANCES.map((o) => <option key={o} value={o} />)}
                </datalist>
              </>
            )}
          </FieldRow>
          <FieldRow label={t('ldsOrdinances.owner')}>
            <select value={values.owner || ''} onChange={(e) => setValues({ ...values, owner: e.target.value })} style={editorInput}>
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
              style={editorInput}
            />
            <datalist id="lds-status-options">
              {COMMON_STATUSES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </FieldRow>
          <FieldRow label={t('ldsOrdinances.templePlace')}>
            <input value={values.temple || ''} onChange={(e) => setValues({ ...values, temple: e.target.value })} style={editorInput} />
          </FieldRow>
        </div>
        {active.ownerType === 'Person' && active.ownerId ? (
          <div className="mt-3 text-xs text-muted-foreground">
            <Link to={`/person/${active.ownerId}`} className="text-primary hover:underline">{active.ownerName}</Link>
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
            ? <Link to={ownerLinkHref} className="text-primary hover:underline">{active.ownerName}</Link>
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
          activeId={activeId}
          onPick={setActiveId}
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
