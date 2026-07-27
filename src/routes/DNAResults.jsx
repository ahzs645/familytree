import React, { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readRef } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';

const TEST_TYPES = ['Autosomal', 'ATDNA', 'Y-DNA', 'MTDNA', 'mtDNA', 'X-DNA', 'Other'];
const STATUS_VALUES = ['Ordered', 'Processing', 'Complete', 'Needs Review', 'Archived'];
const DNA_FIELDS = [
  'testName', 'testType', 'status', 'lab', 'date', 'kitNumber', 'haplogroup', 'markers', 'matchCount', 'note',
  'rawDataFileName', 'rawDataSource', 'centimorgans', 'segments', 'relationshipEstimate', 'mtdnaHVR1', 'mtdnaHVR2',
  'mtdnaCodingRegion', 'mtdnaSnpDifferences', 'ystrMarkerCount', 'ystrMarkers', 'terminalSNP',
];

function dnaLabel(record) {
  return record?.fields?.testName?.value || record?.fields?.lab?.value || record?.fields?.kitNumber?.value || record?.recordName || 'DNA result';
}

function personLabel(record) {
  return personSummary(record)?.fullName || record?.recordName || '';
}

export default function DNAResults() {
  const [searchParams] = useSearchParams();
  const queryDnaId = searchParams.get('dnaId');
  const {
    rows: results, active, activeId, setActiveId, values, setValues,
    dirty, saving, status, onCreate, onSave, onDelete, onToggleLock,
  } = useRecordEditor({
    recordType: 'DNATestResult',
    noun: 'DNA result',
    idPrefix: 'dna',
    fields: DNA_FIELDS,
    refFields: { person: 'Person' },
    labelOf: dnaLabel,
    createValues: () => ({ testName: 'New DNA Test', testType: 'Autosomal', status: 'Complete' }),
  });
  const { records: personRecords } = useRecords('Person');
  const persons = useMemo(
    () => [...personRecords].sort((a, b) => personLabel(a).localeCompare(personLabel(b))),
    [personRecords],
  );

  useEffect(() => {
    if (!queryDnaId || results.length === 0) return;
    if (results.some((result) => result.recordName === queryDnaId)) setActiveId(queryDnaId);
  }, [queryDnaId, results, setActiveId]);

  const personById = useMemo(() => new Map(persons.map((person) => [person.recordName, person])), [persons]);

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
        <span className="ms-auto"><SaveStatus status={status} dirty={dirty} /></span>
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(active)} className="ms-auto text-destructive border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">Delete</button>
        <button onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)" className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Test</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Test name"><input value={values.testName || ''} onChange={(e) => setValues({ ...values, testName: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Person">
            <select value={values.person || ''} onChange={(e) => setValues({ ...values, person: e.target.value })} className={formClasses.input}>
              <option value="">No person linked</option>
              {persons.map((person) => <option key={person.recordName} value={person.recordName}>{personLabel(person)}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Type">
            <select value={values.testType || 'Autosomal'} onChange={(e) => setValues({ ...values, testType: e.target.value })} className={formClasses.input}>
              {TEST_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Status">
            <select value={values.status || 'Complete'} onChange={(e) => setValues({ ...values, status: e.target.value })} className={formClasses.input}>
              {STATUS_VALUES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Lab / provider"><input value={values.lab || ''} onChange={(e) => setValues({ ...values, lab: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Test date">
            <DatePicker
              value={values.date || ''}
              onChange={(value) => setValues({ ...values, date: value })}
              placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
            />
          </FieldRow>
          <FieldRow label="Kit / reference number"><input value={values.kitNumber || ''} onChange={(e) => setValues({ ...values, kitNumber: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Haplogroup"><input value={values.haplogroup || ''} onChange={(e) => setValues({ ...values, haplogroup: e.target.value })} className={formClasses.input} /></FieldRow>
        </div>
      </section>

      <section className="border border-border rounded-md bg-card p-3 mb-4">
        <h3 className="text-sm font-semibold mb-3">Result Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldRow label="Markers / SNPs"><input value={values.markers || ''} onChange={(e) => setValues({ ...values, markers: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Match count"><input value={values.matchCount || ''} onChange={(e) => setValues({ ...values, matchCount: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Raw data file"><input value={values.rawDataFileName || ''} onChange={(e) => setValues({ ...values, rawDataFileName: e.target.value })} className={formClasses.input} /></FieldRow>
          <FieldRow label="Raw data source"><input value={values.rawDataSource || ''} onChange={(e) => setValues({ ...values, rawDataSource: e.target.value })} className={formClasses.input} /></FieldRow>
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
            <FieldRow label="Shared cM"><input value={values.centimorgans || ''} onChange={(e) => setValues({ ...values, centimorgans: e.target.value })} className={formClasses.input} /></FieldRow>
            <FieldRow label="Segments"><input value={values.segments || ''} onChange={(e) => setValues({ ...values, segments: e.target.value })} className={formClasses.input} /></FieldRow>
            <FieldRow label="Relationship estimate"><input value={values.relationshipEstimate || ''} onChange={(e) => setValues({ ...values, relationshipEstimate: e.target.value })} className={formClasses.input} /></FieldRow>
          </div>
        </section>
      )}

      {detailMode === 'mtdna' && (
        <section className="border border-border rounded-md bg-card p-3 mb-4">
          <h3 className="text-sm font-semibold mb-3">MTDNA Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="HVR1"><input value={values.mtdnaHVR1 || ''} onChange={(e) => setValues({ ...values, mtdnaHVR1: e.target.value })} className={formClasses.input} /></FieldRow>
            <FieldRow label="HVR2"><input value={values.mtdnaHVR2 || ''} onChange={(e) => setValues({ ...values, mtdnaHVR2: e.target.value })} className={formClasses.input} /></FieldRow>
            <FieldRow label="Coding region"><input value={values.mtdnaCodingRegion || ''} onChange={(e) => setValues({ ...values, mtdnaCodingRegion: e.target.value })} className={formClasses.input} /></FieldRow>
            <FieldRow label="SNP differences"><textarea value={values.mtdnaSnpDifferences || ''} rows={3} onChange={(e) => setValues({ ...values, mtdnaSnpDifferences: e.target.value })} className={formClasses.textarea} /></FieldRow>
          </div>
        </section>
      )}

      {detailMode === 'ydna' && (
        <section className="border border-border rounded-md bg-card p-3 mb-4">
          <h3 className="text-sm font-semibold mb-3">Y-DNA Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="STR marker count"><input value={values.ystrMarkerCount || ''} onChange={(e) => setValues({ ...values, ystrMarkerCount: e.target.value })} className={formClasses.input} /></FieldRow>
            <FieldRow label="Terminal SNP"><input value={values.terminalSNP || ''} onChange={(e) => setValues({ ...values, terminalSNP: e.target.value })} className={formClasses.input} /></FieldRow>
            <FieldRow label="Y-STR markers"><textarea value={values.ystrMarkers || ''} rows={3} onChange={(e) => setValues({ ...values, ystrMarkers: e.target.value })} className={formClasses.textarea} /></FieldRow>
          </div>
        </section>
      )}

      <section className="border border-border rounded-md bg-card p-3">
        <h3 className="text-sm font-semibold mb-3">Notes</h3>
        <textarea value={values.note || ''} rows={6} onChange={(e) => setValues({ ...values, note: e.target.value })} className={formClasses.textarea} />
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">No DNA result selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">DNA Results</h1>
        <span className="text-xs text-muted-foreground">{results.length}</span>
        <button onClick={onCreate} className="ms-auto bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">+ New</button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList
          items={results}
          activeId={activeId}
          onPick={setActiveId}
          renderRow={renderRow}
          placeholder="Search DNA results..."
          detail={detail}
          emptyTitle="No DNA results yet"
          emptyHint="Tap + New to add a DNA test result."
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
