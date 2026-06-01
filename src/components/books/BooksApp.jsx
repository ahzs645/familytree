/**
 * BooksApp — compose a multi-section book, preview compiled output, save/load,
 * and export using the same report exporters.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, BookOpen, FileDown, FileText, Printer, Save } from 'lucide-react';
import { listAllPersons, findStartPerson } from '../../lib/treeQuery.js';
import {
  SECTION_KINDS,
  listBooks,
  saveBook,
  deleteBook,
  compileBook,
  newBookId,
  downloadBookHTML,
  downloadBookBundle,
  validateBook,
  normalizeBookPresentationSettings,
} from '../../lib/books.js';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { readField } from '../../lib/schema.js';
import { EXPORT_FORMATS, downloadReport } from '../../lib/reports/export.js';
import { updatePageStyle } from '../../lib/presentationSettings.js';
import { compareStrings, formatInteger } from '../../lib/i18n.js';
import { sourceSummary } from '../../models/index.js';
import { listSavedReports } from '../../lib/reports/savedReports.js';
import { listChartDocuments } from '../../lib/chartDocuments.js';
import { SectionEditor } from './SectionEditor.jsx';
import { BookHasErrorsSheet } from './BookHasErrorsSheet.jsx';
import { PresentationSettingsControls } from '../presentation/PresentationSettingsControls.jsx';
import { ReportPreview } from '../reports/ReportPreview.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';

function blankBook() {
  return {
    id: null,
    title: 'My Family Book',
    presentationSettings: normalizeBookPresentationSettings(),
    sections: [
      { kind: 'cover', text: 'My Family Book', subtitle: '', author: '', date: '' },
      { kind: 'toc', tocStyle: 'numbered' },
    ],
  };
}

const SECTION_GROUPS = [
  { label: 'Chapters', ids: ['cover', 'chapter', 'title', 'toc'] },
  { label: 'Person / Family based', ids: ['person-summary', 'family-group-sheet', 'person-group', 'source-insert'] },
  { label: 'Reports for Persons', ids: ['ancestor-narrative', 'descendant-narrative', 'narrative-report', 'ahnentafel-report', 'register-report', 'descendancy-report'] },
  { label: 'Other', ids: ['persons-list', 'places-list', 'sources-list', 'bibliography', 'footnotes', 'media-gallery'] },
  { label: 'Saved Reports and Charts', ids: ['saved-report', 'saved-chart'] },
];

export function BooksApp() {
  const modal = useModal();
  const { recordName: activePersonId, setActivePerson } = useActivePerson();
  const [persons, setPersons] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sources, setSources] = useState([]);
  const [book, setBook] = useState(blankBook());
  const [compiled, setCompiled] = useState(null);
  const [savedBooks, setSavedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null);
  const [validation, setValidation] = useState({ errors: [], warnings: [] });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [includeWebsite, setIncludeWebsite] = useState(true);
  const [issueSheet, setIssueSheet] = useState(null);
  const controllerRef = React.useRef(null);
  const previewRef = React.useRef(null);
  const sectionRefs = React.useRef([]);
  const [savedReports, setSavedReports] = useState([]);
  const [savedCharts, setSavedCharts] = useState([]);

  useEffect(() => {
    (async () => {
      const db = getLocalDatabase();
      const [list, startPerson, reports, charts] = await Promise.all([
        listAllPersons(),
        findStartPerson(),
        listSavedReports(),
        listChartDocuments(),
      ]);
      setPersons(list);
      setSavedReports(reports);
      setSavedCharts(charts);
      const initialPersonId = list.some((person) => person.recordName === activePersonId)
        ? activePersonId
        : startPerson?.recordName || list[0]?.recordName || null;
      if (initialPersonId) setActivePerson(initialPersonId);
      setSavedBooks(await listBooks());
      const [groupRows, sourceRows] = await Promise.all([
        db.query('PersonGroup', { limit: 100000 }),
        db.query('Source', { limit: 100000 }),
      ]);
      setGroups(groupRows.records.map((group) => ({
        recordName: group.recordName,
        label: readField(group, ['name', 'title'], group.recordName),
      })).sort((a, b) => compareStrings(a.label, b.label)));
      setSources(sourceRows.records.map((source) => ({
        recordName: source.recordName,
        label: sourceSummary(source)?.title || source.recordName,
      })).sort((a, b) => compareStrings(a.label, b.label)));
      setLoading(false);
      if (list.length === 0) setEmpty(true);
    })();
    // Initial defaults only; book edits own later target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [r, v] = await Promise.all([compileBook(book), validateBook(book)]);
      if (!cancelled) {
        setCompiled(r);
        setValidation(v);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [book]);

  const jumpToSection = useCallback((index) => {
    const target = sectionRefs.current[index];
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const guardedExport = useCallback(async (next, label = 'Export') => {
    if (validation.errors.length > 0) {
      setIssueSheet({ ...validation, source: label });
      return;
    }
    await next();
  }, [validation]);

  const updateSection = useCallback((i, next) => {
    setBook((b) => ({ ...b, sections: b.sections.map((s, j) => (j === i ? next : s)) }));
  }, []);

  const buildDefaultSection = useCallback((kind) => {
    const def = SECTION_KINDS.find((k) => k.id === kind);
    const section = { kind };
    if (def?.needsPerson) {
      section.targetRecordName = persons.some((person) => person.recordName === activePersonId)
        ? activePersonId
        : persons.find((person) => person.isStartPerson)?.recordName || persons[0]?.recordName;
    }
    if (def?.needsGenerations) section.generations = 5;
    if (def?.needsGroup) section.groupRecordName = groups[0]?.recordName || '';
    if (def?.needsSource) section.sourceRecordName = sources[0]?.recordName || '';
    if (def?.needsSavedReport) section.savedReportId = savedReports[0]?.id || '';
    if (def?.needsSavedChart) section.savedChartId = savedCharts[0]?.id || '';
    if (kind === 'title' || kind === 'cover' || kind === 'chapter') section.text = kind === 'cover' ? book.title : 'New Section';
    if (kind === 'chapter') section.chapterType = 'content';
    if (kind === 'toc') section.tocStyle = 'numbered';
    return section;
  }, [activePersonId, book.title, groups, persons, savedCharts, savedReports, sources]);

  const addSection = useCallback((kind) => {
    const section = buildDefaultSection(kind);
    setBook((b) => ({ ...b, sections: [...b.sections, section] }));
  }, [buildDefaultSection]);

  const changeSectionKind = useCallback((i, kind) => {
    setBook((b) => {
      const previous = b.sections[i] || {};
      const next = { ...buildDefaultSection(kind) };
      if ((kind === 'title' || kind === 'cover' || kind === 'chapter') && previous.text) next.text = previous.text;
      if ((kind === 'title' || kind === 'cover' || kind === 'chapter') && previous.subtitle) next.subtitle = previous.subtitle;
      return { ...b, sections: b.sections.map((section, index) => (index === i ? next : section)) };
    });
  }, [buildDefaultSection]);

  const removeSection = useCallback((i) => {
    setBook((b) => ({ ...b, sections: b.sections.filter((_, j) => j !== i) }));
  }, []);

  const moveSection = useCallback((i, dir) => {
    setBook((b) => {
      const next = [...b.sections];
      const j = i + dir;
      if (j < 0 || j >= next.length) return b;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...b, sections: next };
    });
  }, []);

  const updateBookPageStyle = useCallback((pageStyle) => {
    setBook((current) => ({
      ...current,
      presentationSettings: updatePageStyle(current.presentationSettings, pageStyle),
    }));
  }, []);

  const onSave = useCallback(async () => {
    const name = await modal.prompt('Save book as:', book.title, { title: 'Save book' });
    if (!name) return;
    const toSave = { ...book, id: book.id || newBookId(), title: name, presentationSettings: normalizeBookPresentationSettings(book.presentationSettings) };
    await saveBook(toSave);
    setBook(toSave);
    setSavedBooks(await listBooks());
  }, [book, modal]);

  const onLoad = useCallback(async (id) => {
    const entry = savedBooks.find((b) => b.id === id);
    if (!entry) return;
    setBook({ ...entry, presentationSettings: normalizeBookPresentationSettings(entry.presentationSettings) });
  }, [savedBooks]);

  const onDelete = useCallback(async (id) => {
    if (!(await modal.confirm('Delete this book?', { title: 'Delete book', okLabel: 'Delete', destructive: true }))) return;
    await deleteBook(id);
    setSavedBooks(await listBooks());
  }, [modal]);

  const onExport = useCallback((fmt) => {
    if (!compiled) return;
    guardedExport(() => downloadReport(fmt, compiled, { filenameBase: book.title }), `Export as ${fmt.toUpperCase()}`);
  }, [compiled, book.title, guardedExport]);

  const onWebHTML = useCallback(async () => {
    guardedExport(async () => {
      setBusy(true);
      setStatus('Exporting web HTML...');
      try {
        await downloadBookHTML(book, { filenameBase: book.title });
        setStatus('Book HTML downloaded.');
      } catch (error) {
        setStatus(`Book HTML export failed: ${error.message}`);
      }
      setBusy(false);
    }, 'Web HTML export');
  }, [book, guardedExport]);

  const onPDF = useCallback(() => {
    if (!compiled) return;
    guardedExport(() => {
      setStatus('Opening PDF preview...');
      try {
        downloadReport('pdf', compiled, { filenameBase: book.title });
        setStatus('PDF preview opened.');
      } catch (error) {
        setStatus(`PDF preview failed: ${error.message}`);
      }
    }, 'PDF preview');
  }, [book.title, compiled, guardedExport]);

  const onBundle = useCallback(async () => {
    setBusy(true);
    setStatus('Building publish bundle...');
    setProgress(null);
    if (validation.errors.length > 0) {
      setIssueSheet({ ...validation, source: 'Bundle book' });
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await downloadBookBundle(book, {
        includeWebsite,
        siteOptions: { siteTitle: book.title },
        signal: controller.signal,
        onProgress: setProgress,
      });
      const sitePart = result.website ? ` Website pages: ${formatInteger(result.website.pages)}.` : ' Website export skipped.';
      setStatus(`Book bundle downloaded with ${formatInteger(result.sections)} sections.${sitePart}`);
    } catch (error) {
      if (error.name === 'AbortError') setStatus('Book bundle export canceled.');
      else setStatus(`Book bundle export failed: ${error.message}`);
    } finally {
      controllerRef.current = null;
      setBusy(false);
    }
  }, [book, includeWebsite, validation]);

  if (loading) return <div style={loadingStyle}>Loading…</div>;
  if (empty) {
    return (
      <div style={loadingStyle}>
        No family data. <a href="/" style={{ color: 'hsl(var(--primary))', marginInlineStart: 6 }}>Import a .mftpkg</a> first.
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={header}>
        <input
          value={book.title}
          onChange={(e) => setBook({ ...book, title: e.target.value })}
          style={{ ...input, minWidth: 220, fontSize: 14, fontWeight: 600, flex: '1 1 160px' }}
        />
        <button
          type="button"
          onClick={() => setOptionsOpen((open) => !open)}
          style={input}
          className="sm:hidden"
          aria-expanded={optionsOpen}
        >
          {optionsOpen ? 'Close' : 'Book Settings'}
        </button>
        <button
          type="button"
          onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          style={input}
          className="sm:hidden"
        >
          Preview
        </button>
        <div className={`${optionsOpen ? 'contents' : 'hidden'} sm:contents`}>
        <button onClick={onSave} style={input}><Save size={14} /> Save</button>
        <select value="" onChange={(e) => e.target.value && onLoad(e.target.value)} style={{ ...input, minWidth: 140 }}>
          <option value="">Load saved…</option>
          {savedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        {savedBooks.length > 0 && (
          <select value="" onChange={(e) => e.target.value && onDelete(e.target.value)} style={{ ...input, width: 70 }}>
            <option value="">Delete…</option>
            {savedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        )}
        <PresentationSettingsControls
          value={normalizeBookPresentationSettings(book.presentationSettings).pageStyle}
          onChange={updateBookPageStyle}
        />
        <span style={{ marginInlineStart: 'auto', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
          Export:
        </span>
        {EXPORT_FORMATS.map((f) => (
          <button key={f.id} onClick={() => onExport(f.id)} style={input}><FileText size={14} /> {f.label}</button>
        ))}
        <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, marginInlineStart: 8 }}>
          Publish:
        </span>
        <label style={toggleLabel}>
          <input
            type="checkbox"
            checked={includeWebsite}
            onChange={(e) => setIncludeWebsite(e.target.checked)}
          />
          Include website
        </label>
        <button onClick={onWebHTML} disabled={busy} style={input}><FileDown size={14} /> Web HTML</button>
        <button onClick={onPDF} disabled={busy} style={input}><Printer size={14} /> Save as PDF…</button>
        <button onClick={onBundle} disabled={busy} style={input}><BookOpen size={14} /> {includeWebsite ? 'Website/book bundle' : 'Book bundle'}</button>
        {busy && controllerRef.current && <button onClick={() => controllerRef.current?.abort()} style={input}>Cancel</button>}
        </div>
      </header>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <button type="button" onClick={() => setIssueSheet(validation)} style={{
          padding: '8px 16px',
          borderBottom: '1px solid hsl(var(--border))',
          borderInline: 0,
          borderTop: 0,
          width: '100%',
          textAlign: 'start',
          background: validation.errors.length > 0 ? 'hsl(var(--destructive) / 0.08)' : 'hsl(var(--secondary))',
          fontSize: 12,
          color: validation.errors.length > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))',
          cursor: 'pointer',
        }}>
          <AlertTriangle size={14} style={{ display: 'inline', marginInlineEnd: 6, verticalAlign: -2 }} />
          <strong>
            {validation.errors.length > 0
              ? `Please verify ${validation.errors.length} section${validation.errors.length === 1 ? '' : 's'}`
              : `${validation.warnings.length} warning${validation.warnings.length === 1 ? '' : 's'}`}
          </strong>
          {': '}
          {(validation.errors.length > 0 ? validation.errors : validation.warnings).slice(0, 3).map((v) => v.message).join(' · ')}
          {(validation.errors.length + validation.warnings.length) > 3 && ' …'}
        </button>
      )}

      <div style={body} className="flex-col overflow-auto sm:flex-row sm:overflow-hidden">
        <aside style={leftPane} className="w-full sm:w-[360px]">
          <div style={paneHead}>
            <div>
              <div style={paneEyebrow}>YOUR BOOKS</div>
              <div style={paneTitle}>Chapters and Sections</div>
            </div>
            <span style={sectionCount}>{formatInteger(book.sections.length)}</span>
          </div>
          <div style={{ flex: 1, padding: '0 14px' }} className="overflow-visible sm:overflow-auto">
            {book.sections.map((s, i) => (
              <div key={i} ref={(node) => { sectionRefs.current[i] = node; }}>
                <SectionEditor
                  section={s}
                  index={i}
                  total={book.sections.length}
                  persons={persons}
                  groups={groups}
                  sources={sources}
                  savedReports={savedReports}
                  savedCharts={savedCharts}
                  onChange={(next) => updateSection(i, next)}
                  onKindChange={(kind) => changeSectionKind(i, kind)}
                  onRemove={() => removeSection(i)}
                  onMoveUp={() => moveSection(i, -1)}
                  onMoveDown={() => moveSection(i, 1)}
                />
              </div>
            ))}
          </div>
          <div style={{ padding: 14, borderTop: '1px solid hsl(var(--border))' }}>
            <select
              value=""
              onChange={(e) => { if (e.target.value) { addSection(e.target.value); e.target.value = ''; } }}
              style={{ ...input, width: '100%' }}
            >
              <option value="">Add Book Elements…</option>
              {SECTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.ids.map((id) => {
                    const kind = SECTION_KINDS.find((entry) => entry.id === id);
                    return kind ? <option key={kind.id} value={kind.id}>{kind.label}</option> : null;
                  })}
                </optgroup>
              ))}
            </select>
          </div>
        </aside>
        <main ref={previewRef} style={main} className="min-h-[60vh] overflow-visible border-t border-border sm:min-h-0 sm:overflow-auto sm:border-t-0">
          {(status || progress) && (
            <div style={statusBar}>
              <span>{progress?.message || status}</span>
              {progress?.total ? <span>{Math.round((progress.completed / progress.total) * 100)}%</span> : null}
            </div>
          )}
          <ReportPreview report={compiled} />
        </main>
      </div>
      {issueSheet && (
        <BookHasErrorsSheet
          errors={issueSheet.errors}
          warnings={issueSheet.warnings}
          onJumpToSection={(index) => {
            setIssueSheet(null);
            requestAnimationFrame(() => jumpToSection(index));
          }}
          onClose={() => setIssueSheet(null)}
        />
      )}
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--background))' };
const header = { display: 'flex', gap: 6, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', flexWrap: 'wrap' };
const body = { flex: 1, display: 'flex', minHeight: 0 };
const leftPane = { display: 'flex', flexDirection: 'column', borderInlineEnd: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const main = { flex: 1, minHeight: 0 };
const input = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 10px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const toggleLabel = { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'hsl(var(--muted-foreground))', fontSize: 12, padding: '0 4px' };
const paneHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 14px 10px' };
const paneEyebrow = { color: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700, letterSpacing: 0.4 };
const paneTitle = { color: 'hsl(var(--foreground))', fontSize: 15, fontWeight: 700, marginTop: 2 };
const sectionCount = { minWidth: 28, height: 24, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 700 };
const statusBar = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 14px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', fontSize: 12 };
const loadingStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--background))' };

export default BooksApp;
