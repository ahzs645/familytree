/**
 * Sources — list + editor. Source Template picker, full info fields,
 * Source Text, Referenced Entries (computed from PersonEvent.source refs),
 * Labels, Reference Numbers, Bookmarks, Private, Last Edited.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { generateId } from '../lib/ids.js';
import { formClasses } from '../components/ui/formClasses.js';
import { Button } from '../components/ui/Button.jsx';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { createWithChangeLog, deleteWithChangeLog } from '../lib/recordWrite.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { sourceSummary } from '../models/index.js';
import {
  LABELS,
  REFERENCE_NUMBER_FIELDS,
  formatTimestamp,
} from '../lib/catalogs.js';
import { resolveLabelDefinitions } from '../lib/labels.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { Section } from '../components/editors/Section.jsx';
import { EditSwitch } from '../components/editors/EditSwitch.jsx';
import { MediaRelationsEditor, NotesEditor, SourceCitationsEditor } from '../components/editors/RelatedRecordEditors.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { EditorSectionNavProvider, EditorSectionNavBar } from '../components/editors/EditorSectionNav.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useListSelection } from '../components/lists/useListSelection.js';
import { RecordBulkBar } from '../components/lists/RecordBulkBar.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';
import { PageTitle } from '../components/ui/PageTitle.jsx';
import { EditorModeBoundary, EditorModeControls, useEditorMode } from '../components/editors/EditorMode.jsx';
import { DuplicateRecordAction } from '../components/editors/ContextualActionRail.jsx';

function humanizeTemplateName(recordName) {
  // "SourceTemplate_ChurchRecord_Books" → "Church Record - Books"
  return (recordName || '')
    .replace(/^SourceTemplate_/, '')
    .replace(/_/g, ' · ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

const ACCENTS = {
  info: 'rgb(255 128 0)',
  text: 'rgb(0 204 128)',
  refs: 'rgb(102 217 0)',
  media: 'rgb(77 128 230)',
  notes: 'rgb(217 217 0)',
  labels: 'rgb(255 0 128)',
  ref: 'rgb(128 217 77)',
  bookmarks: 'rgb(128 51 255)',
  private: 'rgb(255 0 0)',
  edited: 'rgb(191 128 64)',
};

const inputClass = formClasses.input;
const textareaClass = inputClass + ' resize-y';

const INFO_FIELDS = [
  { id: 'title', label: 'Title' },
  { id: 'author', label: 'Author' },
  { id: 'publication', label: 'Publication' },
  { id: 'abbreviation', label: 'Abbreviation' },
  { id: 'cached_date', label: 'Date' },
  { id: 'place', label: 'Place' },
  { id: 'agency', label: 'Agency' },
  { id: 'sourceReferenceNumber', label: 'Reference Number' },
  { id: 'sourceReferenceType', label: 'Reference Type' },
];

const REF_NUMBER_FIELDS = REFERENCE_NUMBER_FIELDS.filter((f) => f.id !== 'familySearchID');

// The caption has to wrap the control, not sit beside it: a bare <label> with
// no `for` names nothing, so every field on these screens reached assistive
// tech unnamed even though the caption was right there on screen.
function Field({ label, children }) {
  return (
    <label className="flex-1 min-w-0 block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function sourceSortKey(record) {
  return (record.fields?.cached_title?.value || record.fields?.title?.value || '').toLowerCase();
}

function sortSources(a, b) {
  return sourceSortKey(a).localeCompare(sourceSortKey(b));
}

const createSourceValues = () => ({ title: 'New Source', cached_title: 'New Source' });

function sourceToValues(record) {
  const info = {};
  for (const f of INFO_FIELDS) info[f.id] = record.fields?.[f.id]?.value ?? '';
  const refNumbers = {};
  for (const fd of REF_NUMBER_FIELDS) refNumbers[fd.id] = record.fields?.[fd.id]?.value ?? '';
  return {
    // Real .mftpkg uses `template`; saveWithChangeLog writes `sourceTemplate`.
    templateId: refToRecordName(record.fields?.template?.value) || refToRecordName(record.fields?.sourceTemplate?.value) || '',
    repositoryId: refToRecordName(record.fields?.sourceRepository?.value) || '',
    info,
    text: record.fields?.text?.value || '',
    bookmarked: !!record.fields?.isBookmarked?.value,
    isPrivate: !!record.fields?.isPrivate?.value,
    refNumbers,
    // Hydrated asynchronously from LabelRelation / SourceKeyValue rows.
    labels: {},
    templateValues: {},
  };
}

/**
 * Reconcile the side records owned by the editor (SourceKeyValue rows for the
 * template fields, LabelRelation rows for the label switches) against the
 * saved values. Runs alongside the main-record save; every write goes through
 * the change-logged helpers.
 */
async function reconcileSourceSideRecords(sourceId, vals, templateFields) {
  const data = getAppDataClient();

  const existingKeyValues = (await data.records.query('SourceKeyValue', { referenceField: 'source', referenceValue: sourceId, limit: 1000 })).records;
  const existingByKey = new Map(existingKeyValues.map((kv) => [refToRecordName(kv.fields?.templateKey?.value), kv]));
  for (const fieldDef of templateFields) {
    const value = vals.templateValues[fieldDef.keyId] || '';
    const existing = existingByKey.get(fieldDef.keyId);
    if (value && existing) {
      await saveWithChangeLog({ ...existing, fields: { ...existing.fields, value: { value, type: 'STRING' } } });
    } else if (value && !existing) {
      await createWithChangeLog({
        recordName: generateId('skv'),
        recordType: 'SourceKeyValue',
        fields: {
          source: { value: refValue(sourceId, 'Source'), type: 'REFERENCE' },
          templateKey: { value: refValue(fieldDef.keyId, 'SourceTemplateKey'), type: 'REFERENCE' },
          value: { value, type: 'STRING' },
        },
      });
    } else if (!value && existing) {
      await deleteWithChangeLog(existing.recordName, 'SourceKeyValue');
    }
  }

  // Labels reconcile
  const existingLbl = (await data.records.query('LabelRelation', { referenceField: 'targetSource', referenceValue: sourceId, limit: 500 })).records;
  const existingByLabel = new Map(existingLbl.map((rec) => [refToRecordName(rec.fields?.label?.value), rec]));
  for (const def of LABELS) {
    const want = !!vals.labels[def.id];
    const existing = existingByLabel.get(def.id);
    if (want && !existing) {
      await createWithChangeLog({
        recordName: generateId('lbr'),
        recordType: 'LabelRelation',
        fields: {
          label: { value: refValue(def.id, 'Label'), type: 'REFERENCE' },
          targetSource: { value: refValue(sourceId, 'Source'), type: 'REFERENCE' },
        },
      });
    } else if (!want && existing) {
      await deleteWithChangeLog(existing.recordName, 'LabelRelation');
    }
  }
}

export default function Sources() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const querySourceId = searchParams.get('sourceId');
  const [templateFields, setTemplateFields] = useState([]);
  const sideSave = useRef(Promise.resolve());
  const statusRef = useRef(null);

  const applyValues = useCallback((record, vals) => {
    const next = { ...record, fields: { ...record.fields } };

    if (vals.templateId) {
      next.fields.template = { value: refValue(vals.templateId, 'SourceTemplate'), type: 'REFERENCE' };
      delete next.fields.sourceTemplate;
    } else {
      delete next.fields.template;
      delete next.fields.sourceTemplate;
    }
    if (vals.repositoryId) next.fields.sourceRepository = { value: refValue(vals.repositoryId, 'SourceRepository'), type: 'REFERENCE' };
    else delete next.fields.sourceRepository;

    for (const f of INFO_FIELDS) {
      const v = vals.info[f.id];
      if (v == null || v === '') delete next.fields[f.id];
      else next.fields[f.id] = { value: v, type: 'STRING' };
    }
    if (vals.info.title) next.fields.cached_title = { value: vals.info.title, type: 'STRING' };
    if (vals.text) next.fields.text = { value: vals.text, type: 'STRING' };
    else delete next.fields.text;

    next.fields.isBookmarked = { value: !!vals.bookmarked, type: 'BOOLEAN' };
    next.fields.isPrivate = { value: !!vals.isPrivate, type: 'BOOLEAN' };
    for (const f of REF_NUMBER_FIELDS) {
      const v = vals.refNumbers[f.id];
      if (v == null || v === '') delete next.fields[f.id];
      else next.fields[f.id] = { value: v, type: 'STRING' };
    }

    // Side records save on the same chain the hydration effect awaits, so a
    // reload never reads them mid-reconcile.
    sideSave.current = sideSave.current
      .then(() => reconcileSourceSideRecords(record.recordName, vals, templateFields))
      .catch((error) => statusRef.current?.(error?.message || String(error)));
    return next;
  }, [templateFields]);

  const {
    rows: sources, active, activeId, setActiveId, values, setValues,
    dirty, saving, status, setStatus, loadSeq, onCreate, onSave, onToggleLock,
  } = useRecordEditor({
    recordType: 'Source',
    noun: 'source',
    idPrefix: 'src',
    sortRows: sortSources,
    createValues: createSourceValues,
    toValues: sourceToValues,
    applyValues,
  });
  statusRef.current = setStatus;
  const editorMode = useEditorMode({
    recordId: activeId,
    disabled: !!active && isRecordLocked(active),
    onFinish: async () => {
      if (dirty) await onSave();
      return true;
    },
  });
  const createNewSource = useCallback(async () => {
    editorMode.markNextRecordNew();
    await onCreate();
  }, [editorMode, onCreate]);
  const openScopedDuplicates = useCallback(async (href) => {
    if (dirty && !(await editorMode.finishEditing())) return;
    navigate(href);
  }, [dirty, editorMode, navigate]);

  const { records: templateRecords } = useRecords('SourceTemplate');
  const templates = useMemo(
    () => templateRecords
      .map((t) => ({
        recordName: t.recordName,
        name: t.fields?.name?.value || t.fields?.title?.value || humanizeTemplateName(t.recordName),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [templateRecords],
  );
  const { records: repositoryRecords } = useRecords('SourceRepository');
  const repositories = useMemo(
    () => repositoryRecords
      .map((repo) => ({
        recordName: repo.recordName,
        name: repo.fields?.name?.value || repo.fields?.title?.value || repo.recordName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [repositoryRecords],
  );
  const { records: labelRecords } = useRecords('Label');
  const labelDefs = useMemo(() => resolveLabelDefinitions(labelRecords), [labelRecords]);

  const sourceIds = useMemo(() => sources.map((record) => record.recordName), [sources]);
  const selection = useListSelection(sourceIds);

  useEffect(() => {
    if (!querySourceId || sources.length === 0) return;
    if (sources.some((source) => source.recordName === querySourceId)) setActiveId(querySourceId);
  }, [querySourceId, sources, setActiveId]);

  // Hydrate the side-record values (labels, template key values) for the
  // active source. Re-runs on every list refresh (loadSeq), which the write
  // paths trigger automatically.
  useEffect(() => {
    if (!activeId) return undefined;
    let cancelled = false;
    (async () => {
      await sideSave.current;
      const data = getAppDataClient();
      const record = await data.records.get(activeId);
      if (!record || cancelled) return;

      const lbl = await data.records.query('LabelRelation', { referenceField: 'targetSource', referenceValue: activeId, limit: 500 });
      const labelled = new Set(lbl.records.map((rec) => refToRecordName(rec.fields?.label?.value)));
      const labels = {};
      for (const def of LABELS) labels[def.id] = labelled.has(def.id);

      const selectedTemplateId = refToRecordName(record.fields?.template?.value) || refToRecordName(record.fields?.sourceTemplate?.value) || '';
      let fields = [];
      let templateValues = {};
      if (selectedTemplateId) {
        const [relations, keys, keyValues] = await Promise.all([
          data.records.query('SourceTemplateKeyRelation', { referenceField: 'template', referenceValue: selectedTemplateId, limit: 1000 }),
          data.records.query('SourceTemplateKey', { limit: 10000 }),
          data.records.query('SourceKeyValue', { referenceField: 'source', referenceValue: activeId, limit: 1000 }),
        ]);
        const keyById = new Map(keys.records.map((key) => [key.recordName, key]));
        const valueByKey = new Map(keyValues.records.map((value) => [refToRecordName(value.fields?.templateKey?.value), value]));
        fields = relations.records
          .map((rel) => {
            const keyId = refToRecordName(rel.fields?.templateKey?.value);
            const key = keyById.get(keyId);
            const value = valueByKey.get(keyId);
            return {
              relation: rel,
              key,
              keyId,
              valueRecord: value,
              label: key?.fields?.name?.value || key?.fields?.localizeableNameKey?.value || keyId,
              order: rel.fields?.order?.value ?? 0,
            };
          })
          .filter((item) => item.keyId)
          .sort((a, b) => a.order - b.order);
        templateValues = Object.fromEntries(fields.map((item) => [item.keyId, item.valueRecord?.fields?.value?.value || '']));
      }
      if (cancelled) return;
      setTemplateFields(fields);
      setValues((current) => ({ ...current, labels, templateValues }));
    })();
    return () => { cancelled = true; };
  }, [activeId, loadSeq, setValues]);

  const renderRow = (r) => {
    const s = sourceSummary(r);
    return (
      <div>
        <div className="text-sm text-foreground truncate">
          {s?.bookmarked ? '★ ' : ''}{s?.title || r.recordName}
        </div>
        {s?.date && <div className="text-xs text-muted-foreground">{s.date}</div>}
      </div>
    );
  };

  const detailHeader = active ? (
    <div className="border-b border-border bg-card">
      <div className="flex items-center gap-3 px-5 py-3">
        <h2 className="text-base font-semibold truncate flex-1 min-w-0">
          {sourceSummary(active)?.title || active.recordName}
        </h2>
        <SaveStatus status={status} dirty={dirty} />
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <DuplicateRecordAction recordType="Source" recordId={activeId} onNavigate={openScopedDuplicates} />
        <EditorModeControls mode={editorMode} locked={isRecordLocked(active)} />
      </div>
      <EditorSectionNavBar />
    </div>
  ) : null;

  const detail = active ? (
    <EditorModeBoundary editing={editorMode.editing}>
    <div className="p-5 max-w-4xl">
      <Section title="Source Information" accent={ACCENTS.info}>
        <Field label="Source Template">
          <select value={values.templateId || ''} onChange={(e) => setValues((v) => ({ ...v, templateId: e.target.value }))} className={inputClass}>
            <option value="">— no template —</option>
            {templates.map((t) => <option key={t.recordName} value={t.recordName}>{t.name}</option>)}
          </select>
        </Field>
        <div className="mt-3">
          <Field label="Repository">
            <select value={values.repositoryId || ''} onChange={(e) => setValues((v) => ({ ...v, repositoryId: e.target.value }))} className={inputClass}>
              <option value="">— no repository —</option>
              {repositories.map((repo) => <option key={repo.recordName} value={repo.recordName}>{repo.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {INFO_FIELDS.map((f) => (
            <Field key={f.id} label={f.label}>
              <input value={values.info?.[f.id] ?? ''} onChange={(e) => setValues((v) => ({ ...v, info: { ...v.info, [f.id]: e.target.value } }))} className={inputClass} />
            </Field>
          ))}
        </div>
      </Section>

      {templateFields.length > 0 && (
        <Section title="Template Fields" accent={ACCENTS.info}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templateFields.map((fieldDef) => (
              <Field key={fieldDef.keyId} label={fieldDef.label}>
                <input
                  value={values.templateValues?.[fieldDef.keyId] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, templateValues: { ...v.templateValues, [fieldDef.keyId]: e.target.value } }))}
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </Section>
      )}

      <Section title="Source Text" accent={ACCENTS.text}>
        <textarea value={values.text || ''} onChange={(e) => setValues((v) => ({ ...v, text: e.target.value }))} rows={8} className={textareaClass}
          placeholder="Type or paste the full source text here…" />
      </Section>

      <Section title="Referenced Entries" accent={ACCENTS.refs}>
        <SourceCitationsEditor ownerRecordName={activeId} ownerRecordType="Source" ownerRole="source" />
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div>
          <Section title="Media" accent={ACCENTS.media}>
            <MediaRelationsEditor ownerRecordName={activeId} ownerRecordType="Source" />
          </Section>
          <Section title="Notes" accent={ACCENTS.notes}>
            <NotesEditor ownerRecordName={activeId} ownerRecordType="Source" />
          </Section>
        </div>
        <div>
          <Section title="Labels" accent={ACCENTS.labels}>
            <div className="space-y-1">
              {labelDefs.map((def) => (
                <EditSwitch key={def.id} label={def.label} color={def.color}
                  checked={!!values.labels?.[def.id]} onChange={(checked) => setValues((v) => ({ ...v, labels: { ...v.labels, [def.id]: checked } }))} />
              ))}
            </div>
          </Section>
          <Section title="Reference Numbers" accent={ACCENTS.ref}>
            <div className="grid grid-cols-1 gap-3">
              {REF_NUMBER_FIELDS.map((f) => (
                <Field key={f.id} label={f.label}>
                  <input value={values.refNumbers?.[f.id] ?? ''} onChange={(e) => setValues((v) => ({ ...v, refNumbers: { ...v.refNumbers, [f.id]: e.target.value } }))} className={inputClass} />
                </Field>
              ))}
            </div>
          </Section>
          <Section title="Bookmarks" accent={ACCENTS.bookmarks}>
            <EditSwitch label="Bookmarked" checked={!!values.bookmarked} onChange={(checked) => setValues((v) => ({ ...v, bookmarked: checked }))} />
          </Section>
          <Section title="Private" accent={ACCENTS.private}>
            <EditSwitch label="Marked as Private" checked={!!values.isPrivate} onChange={(checked) => setValues((v) => ({ ...v, isPrivate: checked }))} />
          </Section>
          <Section title="Last Edited" accent={ACCENTS.edited}>
            <ReadOnly label="Change Date" value={formatTimestamp(active.fields?.mft_changeDate?.value || active.modified?.timestamp)} />
            <ReadOnly label="Creation Date" value={formatTimestamp(active.fields?.mft_creationDate?.value || active.created?.timestamp)} />
          </Section>
        </div>
      </div>
    </div>
    </EditorModeBoundary>
  ) : (
    <div className="p-10 text-muted-foreground">No source selected.</div>
  );

  return (
    <EditorSectionNavProvider>
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
          <PageTitle className="text-base font-semibold">Sources</PageTitle>
          <span className="text-xs text-muted-foreground">{sources.length}</span>
          <Button variant="primary" size="sm" onClick={createNewSource} className="ms-auto">+ New Source</Button>
        </header>
        <div className="flex-1 min-h-0">
          {sources.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <div className="text-sm text-foreground mb-2">No sources in this tree yet.</div>
              <Button variant="primary" size="md" onClick={createNewSource}>Add First Source</Button>
            </div>
          ) : (
            <MasterDetailList
              items={sources}
              activeId={activeId}
              onPick={setActiveId}
              renderRow={renderRow}
              placeholder="Search sources…"
              detail={detail}
              detailHeader={detailHeader}
              selection={selection}
              bulkBar={(
                <RecordBulkBar
                  selection={selection}
                  recordType="Source"
                  onDeleted={(ids) => {
                    if (ids.includes(activeId)) setActiveId(null);
                  }}
                />
              )}
            />
          )}
        </div>
      </div>
    </EditorSectionNavProvider>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-2xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
