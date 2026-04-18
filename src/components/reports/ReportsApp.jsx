/**
 * ReportsApp — pick a builder, pick a target person, preview the report,
 * save the configuration, export to any supported format.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { listAllPersons, findStartPerson } from '../../lib/treeQuery.js';
import {
  buildPersonSummary,
  buildAncestorNarrative,
  buildFamilyGroupSheet,
  buildDescendantNarrative,
  buildPersonsList,
  buildPlacesList,
  buildSourcesList,
  buildEventsList,
  buildAnniversaryList,
  buildAhnentafelReport,
  buildPlausibilityReport,
  buildToDoListReport,
} from '../../lib/reports/builders.js';
import { applyPageStyle, listSavedReports, saveReport, deleteSavedReport, newReportId } from '../../lib/reports/savedReports.js';
import { EXPORT_FORMATS, downloadReport } from '../../lib/reports/export.js';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { ReportPreview } from './ReportPreview.jsx';

const BUILDERS = [
  { id: 'person-summary', label: 'Person Summary', needsSubject: true, run: (rn) => buildPersonSummary(rn) },
  { id: 'ancestor-narrative', label: 'Ancestor Narrative', needsSubject: true, usesGenerations: true, run: (rn, o) => buildAncestorNarrative(rn, o.generations || 5) },
  { id: 'descendant-narrative', label: 'Descendant Narrative', needsSubject: true, usesGenerations: true, run: (rn, o) => buildDescendantNarrative(rn, o.generations || 4) },
  { id: 'family-group-sheet', label: 'Family Group Sheet', needsSubject: true, run: (rn) => buildFamilyGroupSheet(rn) },
  { id: 'ahnentafel', label: 'Ahnentafel Report', needsSubject: true, usesGenerations: true, run: (rn, o) => buildAhnentafelReport(rn, o.generations || 6) },
  { id: 'persons-list', label: 'Persons List', needsSubject: false, run: () => buildPersonsList() },
  { id: 'places-list', label: 'Places List', needsSubject: false, run: () => buildPlacesList() },
  { id: 'sources-list', label: 'Sources List', needsSubject: false, run: () => buildSourcesList() },
  { id: 'events-list', label: 'Events List', needsSubject: false, run: () => buildEventsList() },
  { id: 'anniversary-list', label: 'Anniversary List', needsSubject: false, run: () => buildAnniversaryList() },
  { id: 'todo-list', label: 'ToDo List', needsSubject: false, run: () => buildToDoListReport() },
  { id: 'plausibility-list', label: 'Plausibility List', needsSubject: false, run: () => buildPlausibilityReport() },
];

export function ReportsApp() {
  const [persons, setPersons] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [builderId, setBuilderId] = useState('person-summary');
  const [generations, setGenerations] = useState(5);
  const [paginate, setPaginate] = useState(false);
  const [pageBackground, setPageBackground] = useState('none');
  const [pageSize, setPageSize] = useState('letter');
  const [orientation, setOrientation] = useState('portrait');
  const [margin, setMargin] = useState(48);
  const [report, setReport] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      setSavedList(await listSavedReports());
      if (list.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      const start = await findStartPerson();
      setTargetId(start?.recordName || list[0].recordName);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const builder = BUILDERS.find((b) => b.id === builderId);
    if (!builder || (builder.needsSubject && !targetId)) return;
    let cancelled = false;
    (async () => {
      const ast = await builder.run(targetId, { generations });
      const styled = applyPageStyle(ast, { paginate, background: pageBackground, pageSize, orientation, margin });
      if (!cancelled) setReport(styled);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetId, builderId, generations, paginate, pageBackground, pageSize, orientation, margin]);

  const onSave = useCallback(async () => {
    const name = prompt('Name for this report:');
    if (!name) return;
    await saveReport({
      id: newReportId(),
      name,
      builderId,
      targetRecordName: targetId,
      options: { generations },
      pageStyle: { paginate, background: pageBackground, pageSize, orientation, margin },
    });
    setSavedList(await listSavedReports());
  }, [builderId, targetId, generations, paginate, pageBackground, pageSize, orientation, margin]);

  const onApplySaved = useCallback(async (id) => {
    const entry = savedList.find((r) => r.id === id);
    if (!entry) return;
    setBuilderId(entry.builderId);
    setTargetId(entry.targetRecordName);
    setGenerations(entry.options?.generations ?? 5);
    setPaginate(!!entry.pageStyle?.paginate);
    setPageBackground(entry.pageStyle?.background || 'none');
    setPageSize(entry.pageStyle?.pageSize || 'letter');
    setOrientation(entry.pageStyle?.orientation || 'portrait');
    setMargin(entry.pageStyle?.margin || 48);
  }, [savedList]);

  const onDelete = useCallback(async (id) => {
    if (!confirm('Delete this saved report?')) return;
    await deleteSavedReport(id);
    setSavedList(await listSavedReports());
  }, []);

  const onExport = useCallback((fmt) => {
    if (!report) return;
    downloadReport(fmt, report, { filenameBase: report.title });
  }, [report]);

  const builder = BUILDERS.find((b) => b.id === builderId);
  const needsSubject = builder?.needsSubject !== false;
  const usesGenerations = useMemo(() => !!builder?.usesGenerations, [builder]);

  if (loading) return <div style={loadingStyle}>Loading…</div>;
  if (empty) {
    return (
      <div style={loadingStyle}>
        No family data. <a href="/" style={{ color: 'hsl(var(--primary))', marginLeft: 6 }}>Import a .mftpkg</a> first.
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={header}>
        <Field label="Type">
          <select value={builderId} onChange={(e) => setBuilderId(e.target.value)} style={input}>
            {BUILDERS.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </Field>

        {needsSubject && (
          <Field label="Subject">
            <PersonPicker persons={persons} value={targetId} onChange={setTargetId} />
          </Field>
        )}

        {usesGenerations && (
          <Field label="Generations">
            <input type="number" min={2} max={10} value={generations} onChange={(e) => setGenerations(+e.target.value || 5)} style={{ ...input, width: 70 }} />
          </Field>
        )}

        <Field label="Pagination">
          <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={paginate} onChange={(e) => setPaginate(e.target.checked)} /> Page breaks
          </label>
        </Field>

        <Field label="Page">
          <div style={{ display: 'flex', gap: 4 }}>
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={input}>
              <option value="letter">Letter</option>
              <option value="a4">A4</option>
              <option value="legal">Legal</option>
            </select>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value)} style={input}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
            <select value={pageBackground} onChange={(e) => setPageBackground(e.target.value)} style={input}>
              <option value="none">White</option>
              <option value="soft">Soft</option>
              <option value="sepia">Sepia</option>
            </select>
            <input type="number" min={24} max={96} value={margin} onChange={(e) => setMargin(+e.target.value || 48)} style={{ ...input, width: 64 }} title="Margin" />
          </div>
        </Field>

        <Field label="Export">
          <div style={{ display: 'flex', gap: 4 }}>
            {EXPORT_FORMATS.map((f) => (
              <button key={f.id} onClick={() => onExport(f.id)} style={input} title={f.label}>{f.label}</button>
            ))}
          </div>
        </Field>

        <Field label="Saved">
          <div style={{ display: 'flex', gap: 4 }}>
            <select value="" onChange={(e) => e.target.value && onApplySaved(e.target.value)} style={{ ...input, minWidth: 120 }}>
              <option value="">Load…</option>
              {savedList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button onClick={onSave} style={input}>Save</button>
            {savedList.length > 0 && (
              <select value="" onChange={(e) => e.target.value && onDelete(e.target.value)} style={{ ...input, width: 70 }}>
                <option value="">Del…</option>
                {savedList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </div>
        </Field>
      </header>

      <main style={main}>
        <ReportPreview report={report} />
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 12 }}>
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--background))' };
const header = { display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', flexWrap: 'wrap' };
const main = { flex: 1, overflow: 'auto' };
const input = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 10px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none', cursor: 'pointer' };
const loadingStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--background))', fontFamily: '-apple-system, system-ui, sans-serif' };

export default ReportsApp;
