/**
 * BooksApp — compose a multi-section book, preview compiled output, save/load,
 * and export using the same report exporters.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, FileDown, FileText, Printer, Save } from 'lucide-react';
import { listAllPersons, findStartPerson } from '../../lib/treeQuery.js';
import {
  SECTION_KINDS,
  BOOK_TEMPLATES,
  bookFromTemplate,
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
import { useRecords } from '../../lib/data/useRecords.js';
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
import { Button } from '../ui/Button.jsx';
import { cn } from '../../lib/utils.js';

/**
 * Toolbar select/input chrome. Native <select> elements are kept (instead of
 * ui/Select) because these are action selects (Load…, Delete…, template picker,
 * "Add Book Elements…" with optgroups) that reset to an empty value on use —
 * semantics the custom Select doesn't model.
 */
const controlClass = 'cursor-pointer rounded-md border border-border bg-secondary text-secondary-foreground px-2.5 py-2 text-sm outline-none';

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
  const { records: groupRecords } = useRecords('PersonGroup');
  const { records: sourceRecords } = useRecords('Source');
  const groups = useMemo(() => groupRecords.map((group) => ({
    recordName: group.recordName,
    label: readField(group, ['name', 'title'], group.recordName),
  })).sort((a, b) => compareStrings(a.label, b.label)), [groupRecords]);
  const sources = useMemo(() => sourceRecords.map((source) => ({
    recordName: source.recordName,
    label: sourceSummary(source)?.title || source.recordName,
  })).sort((a, b) => compareStrings(a.label, b.label)), [sourceRecords]);
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
  const [pendingExport, setPendingExport] = useState(null);
  const controllerRef = React.useRef(null);
  const previewRef = React.useRef(null);
  const sectionRefs = React.useRef([]);
  const [savedReports, setSavedReports] = useState([]);
  const [savedCharts, setSavedCharts] = useState([]);

  useEffect(() => {
    (async () => {
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
      setPendingExport(null);
      setIssueSheet({ ...validation, source: label });
      return;
    }
    if (validation.warnings.length > 0) {
      // Warnings only: show the sheet and defer the export so the user can
      // review the warnings and choose "Export anyway".
      setPendingExport(() => next);
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
      setPendingExport(null);
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

  if (loading) return <div className={loadingClass}>Loading…</div>;
  if (empty) {
    return (
      <div className={loadingClass}>
        No family data. <Link to="/" className="ms-1.5 text-interactive">Import a .mftpkg</Link> first.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-4 py-3">
        <input
          aria-label="Book title"
          value={book.title}
          onChange={(e) => setBook({ ...book, title: e.target.value })}
          className={cn(controlClass, 'min-w-[220px] flex-[1_1_160px] cursor-text font-semibold')}
        />
        <Button
          size="md"
          onClick={() => setOptionsOpen((open) => !open)}
          className="sm:hidden"
          aria-expanded={optionsOpen}
        >
          {optionsOpen ? 'Close' : 'Book Settings'}
        </Button>
        <Button
          size="md"
          onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="sm:hidden"
        >
          Preview
        </Button>
        <div className={`${optionsOpen ? 'contents' : 'hidden'} sm:contents`}>
        <Button size="md" onClick={onSave}><Save size={14} /> Save</Button>
        <select
          aria-label="Start a new book from a template"
          value=""
          onChange={(e) => { if (e.target.value) setBook(bookFromTemplate(e.target.value)); }}
          className={cn(controlClass, 'min-w-[150px]')}
          title="Start a new book from a template"
        >
          <option value="">New from template…</option>
          {BOOK_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select aria-label="Load a saved book" value="" onChange={(e) => e.target.value && onLoad(e.target.value)} className={cn(controlClass, 'min-w-[140px]')}>
          <option value="">Load saved…</option>
          {savedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        {savedBooks.length > 0 && (
          <select aria-label="Delete a saved book" value="" onChange={(e) => e.target.value && onDelete(e.target.value)} className={cn(controlClass, 'w-[70px]')}>
            <option value="">Delete…</option>
            {savedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        )}
        <PresentationSettingsControls
          value={normalizeBookPresentationSettings(book.presentationSettings).pageStyle}
          onChange={updateBookPageStyle}
        />
        <span className="ms-auto text-xs text-muted-foreground">
          Export:
        </span>
        {EXPORT_FORMATS.map((f) => (
          <Button size="md" key={f.id} onClick={() => onExport(f.id)}><FileText size={14} /> {f.label}</Button>
        ))}
        <span className="ms-2 text-xs text-muted-foreground">
          Publish:
        </span>
        <label className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeWebsite}
            onChange={(e) => setIncludeWebsite(e.target.checked)}
          />
          Include website
        </label>
        <Button size="md" onClick={onWebHTML} disabled={busy}><FileDown size={14} /> Web HTML</Button>
        <Button size="md" onClick={onPDF} disabled={busy}><Printer size={14} /> Save as PDF…</Button>
        <Button size="md" onClick={onBundle} disabled={busy}><BookOpen size={14} /> {includeWebsite ? 'Website/book bundle' : 'Book bundle'}</Button>
        {busy && controllerRef.current && <Button size="md" onClick={() => controllerRef.current?.abort()}>Cancel</Button>}
        </div>
      </header>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <button type="button" onClick={() => { setPendingExport(null); setIssueSheet(validation); }} className={cn(
          'w-full cursor-pointer border-b border-border px-4 py-2 text-start text-xs',
          validation.errors.length > 0 ? 'bg-destructive/10 text-destructive-text' : 'bg-secondary text-muted-foreground',
        )}>
          <AlertTriangle size={14} className="me-1.5 inline align-[-2px]" />
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

      <div className="flex min-h-0 flex-1 flex-col overflow-auto sm:flex-row sm:overflow-hidden">
        <aside className="flex w-full flex-col border-e border-border bg-card sm:w-[360px]">
          <div className="flex items-center justify-between gap-3 px-3.5 pb-2.5 pt-3.5">
            <div>
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground">YOUR BOOKS</div>
              <div className="mt-0.5 text-[15px] font-bold text-foreground">Chapters and Sections</div>
            </div>
            <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">{formatInteger(book.sections.length)}</span>
          </div>
          <div className="flex-1 overflow-visible px-3.5 sm:overflow-auto">
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
          <div className="border-t border-border p-3.5">
            <select
              aria-label="Add Book Elements"
              value=""
              onChange={(e) => { if (e.target.value) { addSection(e.target.value); e.target.value = ''; } }}
              className={cn(controlClass, 'w-full')}
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
        <div ref={previewRef} className="min-h-[60vh] flex-1 overflow-visible border-t border-border sm:min-h-0 sm:overflow-auto sm:border-t-0">
          {(status || progress) && (
            <div className="flex justify-between gap-3 border-b border-border bg-secondary px-3.5 py-2 text-xs text-muted-foreground">
              <span>{progress?.message || status}</span>
              {progress?.total ? <span>{Math.round((progress.completed / progress.total) * 100)}%</span> : null}
            </div>
          )}
          <ReportPreview report={compiled} />
        </div>
      </div>
      {issueSheet && (
        <BookHasErrorsSheet
          errors={issueSheet.errors}
          warnings={issueSheet.warnings}
          onProceedAnyway={pendingExport ? () => {
            const run = pendingExport;
            setPendingExport(null);
            setIssueSheet(null);
            run?.();
          } : undefined}
          onJumpToSection={(index) => {
            setPendingExport(null);
            setIssueSheet(null);
            requestAnimationFrame(() => jumpToSection(index));
          }}
          onClose={() => { setPendingExport(null); setIssueSheet(null); }}
        />
      )}
    </div>
  );
}

const loadingClass = 'flex h-screen items-center justify-center bg-background text-muted-foreground';

export default BooksApp;
