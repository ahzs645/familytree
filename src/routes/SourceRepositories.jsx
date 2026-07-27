import React, { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { readRef } from '../lib/schema.js';
import { sourceSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';
import { deleteWithChangeLog } from '../lib/recordWrite.js';

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

function repoName(record) {
  return record?.fields?.name?.value || record?.fields?.title?.value || record?.recordName || 'Repository';
}

function sourceTitle(record) {
  return sourceSummary(record)?.title || record?.fields?.cached_title?.value || record?.recordName || 'Source';
}

export default function SourceRepositories() {
  const modal = useModal();
  const [searchParams] = useSearchParams();
  const queryRepositoryId = searchParams.get('repositoryId');
  const {
    rows: repositories, active, activeId, setActiveId, values, setValues,
    dirty, saving, status, setStatus, onCreate, onSave, onToggleLock,
  } = useRecordEditor({
    recordType: 'SourceRepository',
    noun: 'repository',
    idPrefix: 'repo',
    fields: REPOSITORY_FIELDS,
    labelOf: repoName,
    createValues: () => ({ name: 'New Repository' }),
  });
  const { records: sourceRecords } = useRecords('Source');
  const sources = useMemo(
    () => [...sourceRecords].sort((a, b) => sourceTitle(a).localeCompare(sourceTitle(b))),
    [sourceRecords],
  );

  useEffect(() => {
    if (!queryRepositoryId || repositories.length === 0) return;
    if (repositories.some((repo) => repo.recordName === queryRepositoryId)) setActiveId(queryRepositoryId);
  }, [queryRepositoryId, repositories, setActiveId]);

  const linkedSources = useMemo(() => (
    sources.filter((source) => readRef(source.fields?.sourceRepository) === activeId)
  ), [activeId, sources]);

  const onDelete = useCallback(async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this repository before deleting.');
      return;
    }
    const message = linkedSources.length
      ? `Delete this repository and detach it from ${linkedSources.length} source record(s)?`
      : 'Delete this repository?';
    if (!(await modal.confirm(message, { title: 'Delete repository', okLabel: 'Delete', destructive: true }))) return;
    for (const source of linkedSources) {
      const fields = { ...source.fields };
      delete fields.sourceRepository;
      await saveWithChangeLog({ ...source, fields });
    }
    await deleteWithChangeLog(active.recordName, 'SourceRepository');
  }, [active, linkedSources, modal, setStatus]);

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
        <span className="ms-auto"><SaveStatus status={status} dirty={dirty} /></span>
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(active)} className="ms-auto text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">Delete</button>
        <button onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)" className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Repository Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Name"><input value={values.name || ''} onChange={(e) => setValues({ ...values, name: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Website"><input value={values.website || ''} onChange={(e) => setValues({ ...values, website: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Phone"><input value={values.phone || ''} onChange={(e) => setValues({ ...values, phone: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Email"><input value={values.email || ''} onChange={(e) => setValues({ ...values, email: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Fax"><input value={values.fax || ''} onChange={(e) => setValues({ ...values, fax: e.target.value })} className={formClasses.input} /></FieldRow>
        </div>
      </section>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Address</h3>
        <FieldRow label="Full address"><textarea value={values.address || ''} rows={3} onChange={(e) => setValues({ ...values, address: e.target.value })} className={formClasses.textarea} /></FieldRow>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Address line 1"><input value={values.addressLine1 || ''} onChange={(e) => setValues({ ...values, addressLine1: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Address line 2"><input value={values.addressLine2 || ''} onChange={(e) => setValues({ ...values, addressLine2: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="City"><input value={values.city || ''} onChange={(e) => setValues({ ...values, city: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="State / Province"><input value={values.state || ''} onChange={(e) => setValues({ ...values, state: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Postal Code"><input value={values.postalCode || ''} onChange={(e) => setValues({ ...values, postalCode: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Country"><input value={values.country || ''} onChange={(e) => setValues({ ...values, country: e.target.value })} className={formClasses.input} /></FieldRow>
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
        <textarea value={values.note || ''} rows={5} onChange={(e) => setValues({ ...values, note: e.target.value })} className={formClasses.textarea} />
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
          emptyTitle="No repositories yet"
          emptyHint="Tap + New to add a repository."
        />
      </div>
    </div>
  );
}
