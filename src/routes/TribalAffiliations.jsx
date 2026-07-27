import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/ui/Button.jsx';
import { buildSeedImportPlan, IRAQI_TRIBES_SEED } from '../lib/arabicTribesDataPackage.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { applyValuesToRecord, createWithChangeLog, deleteWithChangeLog } from '../lib/recordWrite.js';
import { readField, readRef } from '../lib/schema.js';
import {
  TRIBAL_AFFILIATION_LEVELS,
  TRIBAL_CONFIDENCE,
  affiliationConfidenceLabel,
  affiliationLevel,
  affiliationLevelLabel,
  affiliationName,
  createAffiliationRecord,
  createAffiliationRelation,
  loadTribalAffiliationModel,
} from '../lib/tribalAffiliations.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { SourceCitationsEditor } from '../components/editors/RelatedRecordEditors.jsx';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';
import { useModal } from '../contexts/ModalContext.jsx';

const AFFILIATION_FIELDS = ['name', 'arabicName', 'englishName', 'level', 'confidence', 'notes', 'evidenceText'];
const AFFILIATION_REF_FIELDS = { parentAffiliation: 'TribalAffiliation' };
const EMPTY_MODEL = { affiliations: [], memberships: [], people: [] };

function optionLabel(record) {
  if (!record) return '';
  return `${affiliationName(record)} (${affiliationLevelLabel(readField(record, ['level'], 'clan'))})`;
}

function toAffiliationValues(record) {
  return {
    name: affiliationName(record),
    arabicName: readField(record, ['arabicName'], ''),
    englishName: readField(record, ['englishName'], ''),
    level: affiliationLevel(record),
    parentAffiliation: readRef(record.fields?.parentAffiliation) || '',
    confidence: readField(record, ['confidence'], 'unknown'),
    notes: readField(record, ['notes', 'description'], ''),
    evidenceText: readField(record, ['evidenceText'], ''),
  };
}

// Mirrors the model's list ordering (level label, then name) for the hook's rows.
function compareAffiliationRecords(a, b) {
  return affiliationLevelLabel(affiliationLevel(a)).localeCompare(affiliationLevelLabel(affiliationLevel(b)))
    || affiliationName(a).localeCompare(affiliationName(b));
}

export default function TribalAffiliations() {
  const modal = useModal();
  const {
    active: activeRecord, activeId, setActiveId, values, setValues,
    dirty, saving, status, setStatus, flashStatus, onSave: onSaveRecord, onToggleLock,
  } = useRecordEditor({
    recordType: 'TribalAffiliation',
    noun: 'tribal affiliation',
    idPrefix: 'tribe',
    fields: AFFILIATION_FIELDS,
    refFields: AFFILIATION_REF_FIELDS,
    labelOf: affiliationName,
    sortRows: compareAffiliationRecords,
    toValues: toAffiliationValues,
  });
  const { records: affiliationRecords } = useRecords('TribalAffiliation');
  const { records: relationRecords } = useRecords('TribalAffiliationRelation');
  const { records: factRecords } = useRecords('PersonFact');
  const { records: personRecords } = useRecords('Person');
  const [model, setModel] = useState(EMPTY_MODEL);
  const [personId, setPersonId] = useState('');
  const [memberDrafts, setMemberDrafts] = useState({});

  // The list mixes real records with affiliations derived from imported person
  // facts, so rebuild the view model from the cached tables whenever they change.
  // loadTribalAffiliationModel only issues `query` calls; feed it the caches.
  useEffect(() => {
    let cancelled = false;
    const byType = {
      TribalAffiliation: affiliationRecords,
      TribalAffiliationRelation: relationRecords,
      PersonFact: factRecords,
      Person: personRecords,
    };
    loadTribalAffiliationModel({ query: async (type) => ({ records: byType[type] || [] }) })
      .then((next) => { if (!cancelled) setModel(next); });
    return () => { cancelled = true; };
  }, [affiliationRecords, relationRecords, factRecords, personRecords]);

  const active = model.affiliations.find((item) => item.recordName === activeId);
  const realAffiliations = useMemo(() => model.affiliations.filter((item) => !item.virtual), [model.affiliations]);
  const members = useMemo(() => model.memberships.filter((item) => item.affiliationId === activeId), [model.memberships, activeId]);

  // Keep the selection valid against the combined (real + derived) list — the
  // hook only knows about real TribalAffiliation records.
  useEffect(() => {
    if (model.affiliations.length === 0) return;
    if (!activeId || !model.affiliations.some((item) => item.recordName === activeId)) {
      setActiveId(model.affiliations[0].recordName);
    }
  }, [model.affiliations, activeId, setActiveId]);

  // The hook seeds values for real records; derived (virtual) rows have no
  // persisted record, so seed the editor from the view model instead.
  useEffect(() => {
    setPersonId('');
    if (!active?.virtual) return;
    setValues({
      name: active.name || '',
      arabicName: active.arabicName || readField(active.record, ['arabicName'], ''),
      englishName: active.englishName || readField(active.record, ['englishName'], ''),
      level: active.level || 'clan',
      parentAffiliation: active.parentId || '',
      confidence: active.confidence || 'unknown',
      notes: active.notes || '',
      evidenceText: active.evidenceText || readField(active.record, ['evidenceText'], ''),
    });
  }, [active, setValues]);

  useEffect(() => {
    setMemberDrafts(Object.fromEntries(members.filter((member) => !member.virtual).map((member) => [
      member.relation.recordName,
      {
        role: member.role || '',
        confidence: member.confidence || 'unknown',
        fromDate: member.fromDate || '',
        toDate: member.toDate || '',
        notes: member.notes || '',
      },
    ])));
  }, [members]);

  const onCreate = async () => {
    const record = createAffiliationRecord({ name: 'New affiliation', level: 'clan' });
    await createWithChangeLog(record);
    setActiveId(record.recordName);
  };

  const importIraqiSeed = async () => {
    const plan = buildSeedImportPlan(model.affiliations, IRAQI_TRIBES_SEED);
    if (plan.records.length === 0) {
      flashStatus('Iraqi seed already imported');
      return;
    }
    for (const record of plan.records) await createWithChangeLog(record);
    setActiveId(plan.records[0].recordName);
    flashStatus(`Imported ${plan.records.length} Iraqi seed affiliations`);
  };

  const materializeActive = async () => {
    if (!active?.virtual) return null;
    const base = createAffiliationRecord({
      name: active.name,
      level: active.level,
      confidence: active.confidence,
      notes: 'Created from imported person fact values.',
    });
    const record = applyValuesToRecord(
      base,
      { ...values, name: values.name || active.name },
      { fields: AFFILIATION_FIELDS, refFields: AFFILIATION_REF_FIELDS },
    );
    await createWithChangeLog(record);
    setActiveId(record.recordName);
    return record;
  };

  const onSave = async () => {
    if (!active) return;
    if (active.virtual) {
      await materializeActive();
      flashStatus('Saved');
      return;
    }
    await onSaveRecord();
  };

  const onDelete = async () => {
    if (!active || active.virtual || !activeRecord) return;
    if (isRecordLocked(activeRecord)) {
      setStatus('Unlock this tribal affiliation before deleting.');
      return;
    }
    const ok = await modal.confirm('Delete this tribal affiliation and its memberships?', {
      title: 'Delete tribal affiliation',
      okLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    for (const member of members) {
      if (!member.virtual) await deleteWithChangeLog(member.relation.recordName, 'TribalAffiliationRelation');
    }
    await deleteWithChangeLog(activeRecord.recordName, 'TribalAffiliation');
  };

  const addMember = async () => {
    if (!active || !personId) return;
    let affiliationId = active.recordName;
    if (active.virtual) {
      const record = await materializeActive();
      affiliationId = record?.recordName;
    }
    if (!affiliationId || members.some((member) => member.personId === personId)) return;
    const relation = createAffiliationRelation({ affiliationId, personId, confidence: values.confidence || 'unknown' });
    await createWithChangeLog(relation);
    setPersonId('');
  };

  const saveMember = async (member) => {
    const draft = memberDrafts[member.relation.recordName] || {};
    const fields = { ...member.relation.fields };
    for (const key of ['role', 'confidence', 'fromDate', 'toDate', 'notes']) {
      const value = draft[key];
      if (value) fields[key] = { value, type: 'STRING' };
      else delete fields[key];
    }
    await saveWithChangeLog({ ...member.relation, fields });
  };

  const removeMember = async (member) => {
    if (member.virtual) return;
    await deleteWithChangeLog(member.relation.recordName, 'TribalAffiliationRelation');
  };

  const renderRow = (item) => (
    <div>
      <div className="text-sm text-foreground truncate">{item.name}</div>
      <div className="text-xs text-muted-foreground">
        {affiliationLevelLabel(item.level)} · {model.memberships.filter((member) => member.affiliationId === item.recordName).length} member{model.memberships.filter((member) => member.affiliationId === item.recordName).length === 1 ? '' : 's'}
        {item.virtual ? ' · imported fact' : ''}
      </div>
    </div>
  );

  const detail = active ? (
    <div className="p-5 max-w-5xl">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-base font-semibold">{active.name}</h2>
        <span className="text-xs text-muted-foreground">{affiliationLevelLabel(active.level)}</span>
        {active.virtual && <span className="text-xs rounded bg-secondary px-2 py-1">Derived from imported facts</span>}
        <span className="ms-auto">
          {active.virtual
            ? (status ? <span className="text-xs text-emerald-500">{status}</span> : null)
            : <SaveStatus status={status} dirty={dirty} />}
        </span>
        {!active.virtual && <RecordLockButton record={activeRecord} saving={saving} onToggle={onToggleLock} />}
        {!active.virtual && (
          <button onClick={onDelete} disabled={isRecordLocked(activeRecord)} className="text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">Delete</button>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={onSave}
          disabled={active.virtual ? saving : (saving || isRecordLocked(activeRecord) || !dirty)}
          title="Save (⌘/Ctrl+S)"
        >
          {saving ? 'Saving...' : active.virtual ? 'Create & Save' : 'Save'}
        </Button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Affiliation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Name"><input value={values.name || ''} onChange={(e) => setValues({ ...values, name: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Arabic name"><input dir="rtl" value={values.arabicName || ''} onChange={(e) => setValues({ ...values, arabicName: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="English name"><input value={values.englishName || ''} onChange={(e) => setValues({ ...values, englishName: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Level">
            <select value={values.level || 'clan'} onChange={(e) => setValues({ ...values, level: e.target.value })} className={formClasses.input}>
              {TRIBAL_AFFILIATION_LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Parent affiliation">
            <select value={values.parentAffiliation || ''} onChange={(e) => setValues({ ...values, parentAffiliation: e.target.value })} className={formClasses.input}>
              <option value="">No parent</option>
              {realAffiliations.filter((item) => item.recordName !== active.recordName).map((item) => (
                <option key={item.recordName} value={item.recordName}>{optionLabel(item.record)}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Confidence">
            <select value={values.confidence || 'unknown'} onChange={(e) => setValues({ ...values, confidence: e.target.value })} className={formClasses.input}>
              {TRIBAL_CONFIDENCE.map((confidence) => <option key={confidence.id} value={confidence.id}>{confidence.label}</option>)}
            </select>
          </FieldRow>
        </div>
        {(active.dataPackageSourceId || active.evidenceText || values.evidenceText) && (
          <div className="mt-3 rounded-md border border-border/70 bg-secondary/30 p-3">
            <div className="text-xs font-semibold mb-2">Source evidence</div>
            {active.dataPackageSourceId && (
              <div className="text-xs text-muted-foreground mb-2">
                {active.dataPackageSourceId}
                {active.dataPackagePageIndex !== '' && active.dataPackagePageIndex !== undefined ? ` · page index ${active.dataPackagePageIndex}` : ''}
              </div>
            )}
            <textarea rows={3} value={values.evidenceText || ''} onChange={(e) => setValues({ ...values, evidenceText: e.target.value })} className={formClasses.textarea} />
          </div>
        )}
        <FieldRow label="Notes"><textarea rows={4} value={values.notes || ''} onChange={(e) => setValues({ ...values, notes: e.target.value })} className={formClasses.textarea} /></FieldRow>
      </section>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Members · {members.length}</h3>
        <div className="space-y-2 mb-3">
          {members.length === 0 ? <div className="text-sm text-muted-foreground">No members.</div> : members.map((member) => {
            const draft = memberDrafts[member.relation.recordName] || {};
            return (
              <div key={member.relation.recordName} className="rounded-md bg-secondary/30 border border-border/60 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm flex-1 min-w-0 truncate">{member.person?.label || member.personId}</span>
                  <span className="text-xs text-muted-foreground">{member.virtual ? 'Imported fact' : affiliationConfidenceLabel(member.confidence)}</span>
                  {!member.virtual && <button onClick={() => removeMember(member)} className="text-xs text-destructive">Remove</button>}
                </div>
                {!member.virtual && (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_120px_120px_auto] gap-2 mt-2">
                    <input value={draft.role || ''} onChange={(e) => setMemberDrafts((state) => ({ ...state, [member.relation.recordName]: { ...draft, role: e.target.value } }))} className="bg-background border border-border rounded-md px-2 py-1.5 text-xs" placeholder="Role / note" />
                    <select value={draft.confidence || 'unknown'} onChange={(e) => setMemberDrafts((state) => ({ ...state, [member.relation.recordName]: { ...draft, confidence: e.target.value } }))} className="bg-background border border-border rounded-md px-2 py-1.5 text-xs">
                      {TRIBAL_CONFIDENCE.map((confidence) => <option key={confidence.id} value={confidence.id}>{confidence.label}</option>)}
                    </select>
                    <DatePicker
                      value={draft.fromDate || ''}
                      onChange={(value) => setMemberDrafts((state) => ({ ...state, [member.relation.recordName]: { ...draft, fromDate: value } }))}
                      placeholder="From"
                      ariaLabel="Membership from date"
                      className="text-xs"
                    />
                    <DatePicker
                      value={draft.toDate || ''}
                      onChange={(value) => setMemberDrafts((state) => ({ ...state, [member.relation.recordName]: { ...draft, toDate: value } }))}
                      placeholder="To"
                      ariaLabel="Membership to date"
                      className="text-xs"
                    />
                    <button onClick={() => saveMember(member)} className="border border-border rounded-md px-2.5 py-1.5 text-xs hover:bg-accent">Save</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm">
            <option value="">Select person...</option>
            {model.people.map((person) => <option key={person.record.recordName} value={person.record.recordName}>{person.label}</option>)}
          </select>
          <button onClick={addMember} disabled={!personId} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs disabled:opacity-50">Add</button>
        </div>
      </section>

      {!active.virtual && (
        <section className="border border-border rounded-md bg-card p-3">
          <h3 className="text-sm font-semibold mb-3">Sources</h3>
          <SourceCitationsEditor ownerRecordName={active.recordName} ownerRecordType="TribalAffiliation" />
        </section>
      )}
    </div>
  ) : <div className="p-10 text-muted-foreground">No tribal affiliation selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Tribal Affiliations</h1>
        <span className="text-xs text-muted-foreground">{model.affiliations.length}</span>
        {status && <span className="text-xs text-emerald-500">{status}</span>}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <button onClick={importIraqiSeed} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Import Iraqi Seed</button>
          <Button variant="primary" size="sm" onClick={onCreate}>+ New</Button>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList
          items={model.affiliations}
          activeId={activeId}
          onPick={setActiveId}
          renderRow={renderRow}
          placeholder="Search tribal affiliations..."
          detail={detail}
        />
      </div>
    </div>
  );
}
