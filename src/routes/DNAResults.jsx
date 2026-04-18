import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { logRecordCreated, logRecordDeleted, saveWithChangeLog } from '../lib/changeLog.js';
import { readRef, writeRef } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow, editorInput, editorTextarea } from '../components/editors/FieldRow.jsx';

const TEST_TYPES = ['Autosomal', 'ATDNA', 'Y-DNA', 'MTDNA', 'mtDNA', 'X-DNA', 'Other'];
const STATUS_VALUES = ['Ordered', 'Processing', 'Complete', 'Needs Review', 'Archived'];
const DNA_FIELDS = [
  'testName', 'testType', 'status', 'lab', 'date', 'kitNumber', 'haplogroup', 'markers', 'matchCount', 'note',
  'rawDataFileName', 'rawDataSource', 'centimorgans', 'segments', 'relationshipEstimate', 'mtdnaHVR1', 'mtdnaHVR2',
  'mtdnaCodingRegion', 'mtdnaSnpDifferences', 'ystrMarkerCount', 'ystrMarkers', 'terminalSNP',
];

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function dnaLabel(record) {
  return record?.fields?.testName?.value || record?.fields?.lab?.value || record?.fields?.kitNumber?.value || record?.recordName || 'DNA result';
}

function personLabel(record) {
  return personSummary(record)?.fullName || record?.recordName || '';
}

export default function DNAResults() {
  const [results, setResults] = useState([]);
  const [persons, setPersons] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [resultRows, personRows] = await Promise.all([
      db.query('DNATestResult', { limit: 100000 }),
      db.query('Person', { limit: 100000 }),
    ]);
    const sortedResults = resultRows.records.sort((a, b) => dnaLabel(a).localeCompare(dnaLabel(b)));
    const sortedPersons = personRows.records.sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
    setResults(sortedResults);
    setPersons(sortedPersons);
    if (!activeId && sortedResults.length > 0) setActiveId(sortedResults[0].recordName);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const active = results.find((record) => record.recordName === activeId);
    if (!active) return;
    setValues({
      ...Object.fromEntries(DNA_FIELDS.map((field) => [field, active.fields?.[field]?.value || ''])),
      person: readRef(active.fields?.person) || '',
    });
  }, [activeId, results]);

  const active = results.find((record) => record.recordName === activeId);
  const personById = useMemo(() => new Map(persons.map((person) => [person.recordName, person])), [persons]);

  const onCreate = useCallback(async () => {
    const db = getLocalDatabase();
    const record = {
      recordName: uuid('dna'),
      recordType: 'DNATestResult',
      fields: {
        testName: { value: 'New DNA Test', type: 'STRING' },
        testType: { value: 'Autosomal', type: 'STRING' },
        status: { value: 'Complete', type: 'STRING' },
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
    for (const field of DNA_FIELDS) {
      const value = values[field];
      if (value) next.fields[field] = { value, type: 'STRING' };
      else delete next.fields[field];
    }
    if (values.person) next.fields.person = writeRef(values.person, 'Person');
    else delete next.fields.person;
    await saveWithChangeLog(next);
    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [active, reload, values]);

  const onDelete = useCallback(async () => {
    if (!active || !confirm('Delete this DNA result?')) return;
    const db = getLocalDatabase();
    await db.deleteRecord(active.recordName);
    await logRecordDeleted(active.recordName, 'DNATestResult');
    setActiveId(null);
    await reload();
  }, [active, reload]);

  const renderRow = (record) => {
    const person = personById.get(readRef(record.fields?.person));
    return (
      <div>
        <div className="text-sm text-foreground truncate">{dnaLabel(record)}</div>
        <div className="text-xs text-muted-foreground">
          {record.fields?.testType?.value || 'DNA'}{person ? ` - ${personLabel(person)}` : ''}
        </div>
      </div>
    );
  };

  const activePerson = personById.get(values.person);
  const detailMode = dnaDetailMode(values.testType);
  const detail = active ? (
    <div className="p-5 max-w-4xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold truncate">{dnaLabel(active)}</h2>
        {status && <span className="ml-auto text-xs text-emerald-500">{status}</span>}
        <button onClick={onDelete} className="ml-auto text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">Delete</button>
        <button onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Test</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Test name"><input value={values.testName || ''} onChange={(e) => setValues({ ...values, testName: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Person">
            <select value={values.person || ''} onChange={(e) => setValues({ ...values, person: e.target.value })} style={editorInput}>
              <option value="">No person linked</option>
              {persons.map((person) => <option key={person.recordName} value={person.recordName}>{personLabel(person)}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Type">
            <select value={values.testType || 'Autosomal'} onChange={(e) => setValues({ ...values, testType: e.target.value })} style={editorInput}>
              {TEST_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Status">
            <select value={values.status || 'Complete'} onChange={(e) => setValues({ ...values, status: e.target.value })} style={editorInput}>
              {STATUS_VALUES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Lab / provider"><input value={values.lab || ''} onChange={(e) => setValues({ ...values, lab: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Test date"><input value={values.date || ''} onChange={(e) => setValues({ ...values, date: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Kit / reference number"><input value={values.kitNumber || ''} onChange={(e) => setValues({ ...values, kitNumber: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Haplogroup"><input value={values.haplogroup || ''} onChange={(e) => setValues({ ...values, haplogroup: e.target.value })} style={editorInput} /></FieldRow>
        </div>
      </section>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Result Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Markers / SNPs"><input value={values.markers || ''} onChange={(e) => setValues({ ...values, markers: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Match count"><input value={values.matchCount || ''} onChange={(e) => setValues({ ...values, matchCount: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Raw data file"><input value={values.rawDataFileName || ''} onChange={(e) => setValues({ ...values, rawDataFileName: e.target.value })} style={editorInput} /></FieldRow>
          <FieldRow label="Raw data source"><input value={values.rawDataSource || ''} onChange={(e) => setValues({ ...values, rawDataSource: e.target.value })} style={editorInput} /></FieldRow>
        </div>
        {activePerson && (
          <div className="mt-3 text-xs text-muted-foreground">
            Linked to {personLabel(activePerson)}
          </div>
        )}
      </section>

      {detailMode === 'atdna' && (
        <section className="border border-border rounded-md bg-card p-3 mb-4">
          <h3 className="text-sm font-semibold mb-3">ATDNA Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="Shared cM"><input value={values.centimorgans || ''} onChange={(e) => setValues({ ...values, centimorgans: e.target.value })} style={editorInput} /></FieldRow>
            <FieldRow label="Segments"><input value={values.segments || ''} onChange={(e) => setValues({ ...values, segments: e.target.value })} style={editorInput} /></FieldRow>
            <FieldRow label="Relationship estimate"><input value={values.relationshipEstimate || ''} onChange={(e) => setValues({ ...values, relationshipEstimate: e.target.value })} style={editorInput} /></FieldRow>
          </div>
        </section>
      )}

      {detailMode === 'mtdna' && (
        <section className="border border-border rounded-md bg-card p-3 mb-4">
          <h3 className="text-sm font-semibold mb-3">MTDNA Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="HVR1"><input value={values.mtdnaHVR1 || ''} onChange={(e) => setValues({ ...values, mtdnaHVR1: e.target.value })} style={editorInput} /></FieldRow>
            <FieldRow label="HVR2"><input value={values.mtdnaHVR2 || ''} onChange={(e) => setValues({ ...values, mtdnaHVR2: e.target.value })} style={editorInput} /></FieldRow>
            <FieldRow label="Coding region"><input value={values.mtdnaCodingRegion || ''} onChange={(e) => setValues({ ...values, mtdnaCodingRegion: e.target.value })} style={editorInput} /></FieldRow>
            <FieldRow label="SNP differences"><textarea value={values.mtdnaSnpDifferences || ''} rows={3} onChange={(e) => setValues({ ...values, mtdnaSnpDifferences: e.target.value })} style={editorTextarea} /></FieldRow>
          </div>
        </section>
      )}

      {detailMode === 'ydna' && (
        <section className="border border-border rounded-md bg-card p-3 mb-4">
          <h3 className="text-sm font-semibold mb-3">Y-DNA Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="STR marker count"><input value={values.ystrMarkerCount || ''} onChange={(e) => setValues({ ...values, ystrMarkerCount: e.target.value })} style={editorInput} /></FieldRow>
            <FieldRow label="Terminal SNP"><input value={values.terminalSNP || ''} onChange={(e) => setValues({ ...values, terminalSNP: e.target.value })} style={editorInput} /></FieldRow>
            <FieldRow label="Y-STR markers"><textarea value={values.ystrMarkers || ''} rows={3} onChange={(e) => setValues({ ...values, ystrMarkers: e.target.value })} style={editorTextarea} /></FieldRow>
          </div>
        </section>
      )}

      <section className="border border-border rounded-md bg-card p-3">
        <h3 className="text-sm font-semibold mb-3">Notes</h3>
        <textarea value={values.note || ''} rows={6} onChange={(e) => setValues({ ...values, note: e.target.value })} style={editorTextarea} />
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">No DNA result selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">DNA Results</h1>
        <span className="text-xs text-muted-foreground">{results.length}</span>
        <button onClick={onCreate} className="ml-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">+ New</button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList
          items={results}
          activeId={activeId}
          onPick={setActiveId}
          renderRow={renderRow}
          placeholder="Search DNA results..."
          detail={detail}
        />
      </div>
    </div>
  );
}

function dnaDetailMode(testType) {
  const value = String(testType || '').toLowerCase();
  if (value.includes('y-dna') || value.includes('ydna')) return 'ydna';
  if (value.includes('mtdna') || value.includes('mt-dna')) return 'mtdna';
  if (value.includes('autosomal') || value.includes('atdna') || value.includes('x-dna')) return 'atdna';
  return 'atdna';
}
