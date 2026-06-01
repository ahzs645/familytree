import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { buildSeedImportPlan, IRAQI_TRIBES_SEED } from '../lib/arabicTribesDataPackage.js';
import { logRecordCreated, logRecordDeleted, saveWithChangeLog } from '../lib/changeLog.js';
import { readField, writeRef } from '../lib/schema.js';
import {
  TRIBAL_AFFILIATION_LEVELS,
  TRIBAL_CONFIDENCE,
  affiliationConfidenceLabel,
  affiliationLevelLabel,
  affiliationName,
  createAffiliationRecord,
  createAffiliationRelation,
  loadTribalAffiliationModel,
} from '../lib/tribalAffiliations.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';
import { SourceCitationsEditor } from '../components/editors/RelatedRecordEditors.jsx';
import { DatePicker } from '../components/ui/DatePicker.jsx';

function optionLabel(record) {
  if (!record) return '';
  return `${affiliationName(record)} (${affiliationLevelLabel(readField(record, ['level'], 'clan'))})`;
}

export default function TribalAffiliations() {
  const [model, setModel] = useState({ affiliations: [], memberships: [], people: [] });
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [personId, setPersonId] = useState('');
  const [memberDrafts, setMemberDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const next = await loadTribalAffiliationModel(db);
    setModel(next);
    if (!next.affiliations.some((item) => item.recordName === activeId)) {
      setActiveId(next.affiliations[0]?.recordName || null);
    }
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);

  const active = model.affiliations.find((item) => item.recordName === activeId);
  const realAffiliations = useMemo(() => model.affiliations.filter((item) => !item.virtual), [model.affiliations]);
  const members = useMemo(() => model.memberships.filter((item) => item.affiliationId === activeId), [model.memberships, activeId]);

  useEffect(() => {
    if (!active) return;
    setValues({
      name: active.name || '',
      arabicName: active.arabicName || readField(active.record, ['arabicName'], ''),
      englishName: active.englishName || readField(active.record, ['englishName'], ''),
      level: active.level || 'clan',
      parentId: active.parentId || '',
      confidence: active.confidence || 'unknown',
      notes: active.notes || '',
      evidenceText: active.evidenceText || readField(active.record, ['evidenceText'], ''),
    });
    setPersonId('');
  }, [active]);

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

  const create = async () => {
    const db = getLocalDatabase();
    const record = createAffiliationRecord({ name: 'New affiliation', level: 'clan' });
    await db.saveRecord(record);
    await logRecordCreated(record);
    await reload();
    setActiveId(record.recordName);
  };

  const importIraqiSeed = async () => {
    const plan = buildSeedImportPlan(model.affiliations, IRAQI_TRIBES_SEED);
    if (plan.records.length === 0) {
      setStatus('Iraqi seed already imported');
      setTimeout(() => setStatus(null), 1800);
      return;
    }
    const db = getLocalDatabase();
    for (const record of plan.records) {
      await db.saveRecord(record);
      await logRecordCreated(record);
    }
    await reload();
    setActiveId(plan.records[0].recordName);
    setStatus(`Imported ${plan.records.length} Iraqi seed affiliations`);
    setTimeout(() => setStatus(null), 2200);
  };

  const materializeActive = async () => {
    if (!active?.virtual) return null;
    const db = getLocalDatabase();
    const record = createAffiliationRecord({
      name: active.name,
      level: active.level,
      confidence: active.confidence,
      notes: 'Created from imported person fact values.',
    });
    await db.saveRecord(record);
    await logRecordCreated(record);
    await reload();
    setActiveId(record.recordName);
    return record;
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    let record = active.record;
    if (active.virtual) {
      record = await materializeActive();
    }
    if (!record) return;
    const next = { ...record, fields: { ...record.fields } };
    for (const key of ['name', 'arabicName', 'englishName', 'level', 'confidence', 'notes', 'evidenceText']) {
      const value = values[key];
      if (value) next.fields[key] = { value, type: 'STRING' };
      else delete next.fields[key];
    }
    if (values.parentId) next.fields.parentAffiliation = writeRef(values.parentId, 'TribalAffiliation');
    else delete next.fields.parentAffiliation;
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  };

  const addMember = async () => {
    if (!active || !personId) return;
    let affiliationId = active.recordName;
    if (active.virtual) {
      const record = await materializeActive();
      affiliationId = record?.recordName;
    }
    if (!affiliationId || members.some((member) => member.personId === personId)) return;
    const db = getLocalDatabase();
    const relation = createAffiliationRelation({ affiliationId, personId, confidence: values.confidence || 'unknown' });
    await db.saveRecord(relation);
    await logRecordCreated(relation);
    setPersonId('');
    await reload();
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
    await reload();
  };

  const removeMember = async (member) => {
    if (member.virtual) return;
    const db = getLocalDatabase();
    await db.deleteRecord(member.relation.recordName);
    await logRecordDeleted(member.relation.recordName, 'TribalAffiliationRelation');
    await reload();
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
        {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
        <button onClick={save} disabled={saving} className="ms-auto bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : active.virtual ? 'Create & Save' : 'Save'}
        </button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Affiliation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Name"><input value={values.name || ''} onChange={(e) => setValues({ ...values, name: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Arabic name"><input dir="rtl" value={values.arabicName || ''} onChange={(e) => setValues({ ...values, arabicName: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="English name"><input value={values.englishName || ''} onChange={(e) => setValues({ ...values, englishName: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Level">
            <select value={values.level || 'clan'} onChange={(e) => setValues({ ...values, level: e.target.value })} style={editorInput}>
              {TRIBAL_AFFILIATION_LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Parent affiliation">
            <select value={values.parentId || ''} onChange={(e) => setValues({ ...values, parentId: e.target.value })} style={editorInput}>
              <option value="">No parent</option>
              {realAffiliations.filter((item) => item.recordName !== active.recordName).map((item) => (
                <option key={item.recordName} value={item.recordName}>{optionLabel(item.record)}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Confidence">
            <select value={values.confidence || 'unknown'} onChange={(e) => setValues({ ...values, confidence: e.target.value })} style={editorInput}>
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
            <textarea rows={3} value={values.evidenceText || ''} onChange={(e) => setValues({ ...values, evidenceText: e.target.value })} style={editorTextarea} />
          </div>
        )}
        <FieldRow label="Notes"><textarea rows={4} value={values.notes || ''} onChange={(e) => setValues({ ...values, notes: e.target.value })} style={editorTextarea} /></FieldRow>
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
          <SourceCitationsEditor ownerRecordName={active.recordName} ownerRecordType="TribalAffiliation" onChanged={reload} />
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
          <button onClick={create} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">+ New</button>
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
