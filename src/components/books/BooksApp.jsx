/**
 * BooksApp — compose a multi-section book, preview compiled output, save/load,
 * and export using the same report exporters.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useBeforeUnload, useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, FileDown, FileText, Plus, Printer, Save } from 'lucide-react';
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
  BOOK_THEME_PRESETS,
  DEFAULT_BOOK_THEME_ID,
  bookEditSignature,
} from '../../lib/books.js';
import { useRecords } from '../../lib/data/useRecords.js';
import { readField } from '../../lib/schema.js';
import { EXPORT_FORMATS, downloadReport } from '../../lib/reports/export.js';
import { updatePageStyle } from '../../lib/presentationSettings.js';
import { compareStrings, formatInteger } from '../../lib/i18n.js';
import { familySummary, sourceSummary } from '../../models/index.js';
import { listSavedReports } from '../../lib/reports/savedReports.js';
import { listChartDocuments } from '../../lib/chartDocuments.js';
import { SectionEditor } from './SectionEditor.jsx';
import { BookHasErrorsSheet } from './BookHasErrorsSheet.jsx';
import { NewBookAssistant } from './NewBookAssistant.jsx';
import { PresentationSettingsControls } from '../presentation/PresentationSettingsControls.jsx';
import { ReportPreview } from '../reports/ReportPreview.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { Button } from '../ui/Button.jsx';
import { cn } from '../../lib/utils.js';
import { NoDataYet } from '../NoDataYet.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

/**
 * Toolbar select/input chrome. Native <select> elements are kept (instead of
 * ui/Select) because these are action selects (Load…, Delete…, template picker,
 * "Add Book Elements…" with optgroups) that reset to an empty value on use —
 * semantics the custom Select doesn't model.
 *
 * They still sit on the app's 40px control rung, so they line up with the
 * Buttons beside them; height is declared rather than left to padding, which
 * had them landing on 38px.
 */
const controlClass = 'h-10 cursor-pointer rounded-md border border-border bg-secondary text-secondary-foreground px-2.5 text-sm outline-none';

function blankBook(title = 'My Family Book', outputLanguage = 'en') {
  return {
    id: null,
    title,
    outputLanguage,
    themeId: DEFAULT_BOOK_THEME_ID,
    presentationSettings: normalizeBookPresentationSettings(),
    sections: [
      { kind: 'cover', text: title, subtitle: '', author: '', date: '' },
      { kind: 'toc', tocStyle: 'numbered' },
    ],
  };
}

const SECTION_GROUPS = [
  { labelKey: 'books.sectionGroups.chapters', ids: ['cover', 'chapter', 'title', 'toc', 'custom-page'] },
  { labelKey: 'books.sectionGroups.personFamily', ids: ['person-summary', 'family-group-sheet', 'person-group', 'source-insert'] },
  { labelKey: 'books.sectionGroups.personReports', ids: ['ancestor-narrative', 'descendant-narrative', 'narrative-report', 'ahnentafel-report', 'register-report', 'descendancy-report'] },
  { labelKey: 'books.sectionGroups.other', ids: ['persons-list', 'places-list', 'sources-list', 'bibliography', 'footnotes', 'media-gallery'] },
  { labelKey: 'books.sectionGroups.saved', ids: ['saved-report', 'saved-chart'] },
];

export function BooksApp() {
  const modal = useModal();
  const navigate = useNavigate();
  const { t, localization } = useTranslation();
  const { recordName: activePersonId, setActivePerson } = useActivePerson();
  const [persons, setPersons] = useState([]);
  const { records: familyRecords } = useRecords('Family');
  const { records: groupRecords } = useRecords('PersonGroup');
  const { records: sourceRecords } = useRecords('Source');
  const { records: mediaRecords } = useRecords('Media');
  const groups = useMemo(() => groupRecords.map((group) => ({
    recordName: group.recordName,
    label: readField(group, ['name', 'title'], group.recordName),
  })).sort((a, b) => compareStrings(a.label, b.label)), [groupRecords]);
  const sources = useMemo(() => sourceRecords.map((source) => ({
    recordName: source.recordName,
    label: sourceSummary(source)?.title || source.recordName,
  })).sort((a, b) => compareStrings(a.label, b.label)), [sourceRecords]);
  const media = useMemo(() => mediaRecords.map((record) => ({
    recordName: record.recordName,
    label: readField(record, ['caption', 'title', 'filename', 'fileName'], record.recordName),
  })).sort((a, b) => compareStrings(a.label, b.label)), [mediaRecords]);
  const families = useMemo(() => {
    const personNames = new Map(persons.map((person) => [person.recordName, person.fullName]));
    return familyRecords.map((record) => {
      const summary = familySummary(record);
      const names = [personNames.get(summary?.manRecordName), personNames.get(summary?.womanRecordName)].filter(Boolean);
      return {
        recordName: record.recordName,
        label: names.join(' & ') || summary?.familyName || record.recordName,
        primaryPersonRecordName: summary?.manRecordName || summary?.womanRecordName || '',
      };
    }).sort((a, b) => compareStrings(a.label, b.label));
  }, [familyRecords, persons]);
  const [book, setBook] = useState(() => blankBook(t('books.defaultTitle'), localization.locale));
  const [cleanSignature, setCleanSignature] = useState(() => bookEditSignature(blankBook(t('books.defaultTitle'), localization.locale)));
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
  const [assistantOpen, setAssistantOpen] = useState(false);
  const dirty = useMemo(() => bookEditSignature(book) !== cleanSignature, [book, cleanSignature]);

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

  useBeforeUnload((event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }, { capture: true });

  useEffect(() => {
    if (!dirty || window.localStorage?.getItem('cloudtreeweb:disable-unsaved-guard') === '1') return undefined;
    const onDocumentClick = (event) => {
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || (anchor.target && anchor.target !== '_self')) return;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#')) return;
      const next = new URL(href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search && next.hash === window.location.hash) return;
      event.preventDefault();
      event.stopPropagation();
      modal.confirm(t('books.dirty.message'), {
        title: t('books.dirty.title'),
        okLabel: t('books.dirty.discard'),
        destructive: true,
      }).then((confirmed) => {
        if (confirmed) navigate(`${next.pathname}${next.search}${next.hash}`);
      });
    };
    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, [dirty, modal, navigate, t]);

  const confirmDiscardIfDirty = useCallback(async () => {
    if (!dirty || window.localStorage?.getItem('cloudtreeweb:disable-unsaved-guard') === '1') return true;
    return modal.confirm(t('books.dirty.switchMessage'), {
      title: t('books.dirty.title'),
      okLabel: t('books.dirty.discard'),
      destructive: true,
    });
  }, [dirty, modal, t]);

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

  const guardedExport = useCallback(async (next, label = t('books.export')) => {
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
  }, [t, validation]);

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
    if (def?.needsMedia) section.targetRecordName = media[0]?.recordName || '';
    if (kind === 'title' || kind === 'cover' || kind === 'chapter' || kind === 'custom-page') section.text = kind === 'cover' ? book.title : t('books.newSection');
    if (kind === 'chapter') section.chapterType = 'content';
    if (kind === 'toc') section.tocStyle = 'numbered';
    return section;
  }, [activePersonId, book.title, groups, media, persons, savedCharts, savedReports, sources, t]);

  const addSection = useCallback((kind) => {
    const section = buildDefaultSection(kind);
    setBook((b) => ({ ...b, sections: [...b.sections, section] }));
  }, [buildDefaultSection]);

  const changeSectionKind = useCallback((i, kind) => {
    setBook((b) => {
      const previous = b.sections[i] || {};
      const next = { ...buildDefaultSection(kind) };
      if ((kind === 'title' || kind === 'cover' || kind === 'chapter' || kind === 'custom-page') && previous.text) next.text = previous.text;
      if ((kind === 'title' || kind === 'cover' || kind === 'chapter' || kind === 'custom-page') && previous.subtitle) next.subtitle = previous.subtitle;
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
    const name = await modal.prompt(t('books.savePrompt'), book.title, { title: t('books.saveBook') });
    if (!name) return;
    const toSave = { ...book, id: book.id || newBookId(), title: name, presentationSettings: normalizeBookPresentationSettings(book.presentationSettings) };
    await saveBook(toSave);
    setBook(toSave);
    setCleanSignature(bookEditSignature(toSave));
    setSavedBooks(await listBooks());
  }, [book, modal, t]);

  const onLoad = useCallback(async (id) => {
    const entry = savedBooks.find((b) => b.id === id);
    if (!entry) return;
    if (!(await confirmDiscardIfDirty())) return;
    const loaded = { ...entry, presentationSettings: normalizeBookPresentationSettings(entry.presentationSettings) };
    setBook(loaded);
    setCleanSignature(bookEditSignature(loaded));
  }, [confirmDiscardIfDirty, savedBooks]);

  const onNewBook = useCallback(async (next) => {
    if (!(await confirmDiscardIfDirty())) return false;
    setBook(next);
    setCleanSignature(null);
    setAssistantOpen(false);
    return true;
  }, [confirmDiscardIfDirty]);

  const onTemplate = useCallback(async (templateId) => {
    const template = BOOK_TEMPLATES.find((entry) => entry.id === templateId);
    const next = bookFromTemplate(templateId, template ? t(template.labelKey) : t('books.defaultTitle'), localization.locale);
    await onNewBook(next);
  }, [localization.locale, onNewBook, t]);

  const onDelete = useCallback(async (id) => {
    if (!(await modal.confirm(t('books.deletePrompt'), { title: t('books.deleteBook'), okLabel: t('common.delete'), destructive: true }))) return;
    await deleteBook(id);
    setSavedBooks(await listBooks());
  }, [modal, t]);

  const onExport = useCallback((fmt) => {
    if (!compiled) return;
    guardedExport(() => downloadReport(fmt, compiled, { filenameBase: book.title, theme: compiled.bookTheme }), t('books.exportAs', { format: fmt.toUpperCase() }));
  }, [compiled, book.title, guardedExport, t]);

  const onWebHTML = useCallback(async () => {
    guardedExport(async () => {
      setBusy(true);
      setStatus(t('books.status.exportingHtml'));
      try {
        await downloadBookHTML(book, { filenameBase: book.title });
        setStatus(t('books.status.htmlDownloaded'));
      } catch (error) {
        setStatus(t('books.status.htmlFailed', { message: error.message }));
      }
      setBusy(false);
    }, t('books.webHtmlExport'));
  }, [book, guardedExport, t]);

  const onPDF = useCallback(() => {
    if (!compiled) return;
    guardedExport(() => {
      setStatus(t('books.status.openingPdf'));
      try {
        downloadReport('pdf', compiled, { filenameBase: book.title, theme: compiled.bookTheme });
        setStatus(t('books.status.pdfOpened'));
      } catch (error) {
        setStatus(t('books.status.pdfFailed', { message: error.message }));
      }
    }, t('books.pdfPreview'));
  }, [book.title, compiled, guardedExport, t]);

  const onBundle = useCallback(async () => {
    setBusy(true);
    setStatus(t('books.status.buildingBundle'));
    setProgress(null);
    if (validation.errors.length > 0) {
      setPendingExport(null);
      setIssueSheet({ ...validation, source: t('books.bundleBook') });
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
      const sitePart = result.website ? t('books.status.websitePages', { count: formatInteger(result.website.pages) }) : t('books.status.websiteSkipped');
      setStatus(t('books.status.bundleDownloaded', { count: formatInteger(result.sections), website: sitePart }));
    } catch (error) {
      if (error.name === 'AbortError') setStatus(t('books.status.bundleCanceled'));
      else setStatus(t('books.status.bundleFailed', { message: error.message }));
    } finally {
      controllerRef.current = null;
      setBusy(false);
    }
  }, [book, includeWebsite, t, validation]);

  if (loading) return <div className={loadingClass}>{t('common.loading')}</div>;
  if (empty) return <NoDataYet />;

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-center gap-1.5 border-b border-border bg-card px-4 py-3">
        <input
          aria-label={t('books.bookTitle')}
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
          {optionsOpen ? t('common.close') : t('books.bookSettings')}
        </Button>
        <Button
          size="md"
          onClick={() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="sm:hidden"
        >
          {t('books.preview.title')}
        </Button>
        <div className={`${optionsOpen ? 'contents' : 'hidden'} sm:contents`}>
        <Button size="md" variant={dirty ? 'primary' : 'secondary'} onClick={onSave}><Save size={14} /> {t('common.save')}</Button>
        <Button size="md" onClick={() => setAssistantOpen(true)}><Plus size={14} /> {t('books.newBook')}</Button>
        <select
          aria-label={t('books.newFromTemplateAria')}
          value=""
          onChange={(e) => { if (e.target.value) onTemplate(e.target.value); }}
          className={cn(controlClass, 'min-w-[150px]')}
          title={t('books.newFromTemplateAria')}
        >
          <option value="">{t('books.newFromTemplate')}</option>
          {BOOK_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{t(template.labelKey)}</option>)}
        </select>
        <select aria-label={t('books.loadSavedAria')} value="" onChange={(e) => e.target.value && onLoad(e.target.value)} className={cn(controlClass, 'min-w-[140px]')}>
          <option value="">{t('books.loadSaved')}</option>
          {savedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
        {savedBooks.length > 0 && (
          <select aria-label={t('books.deleteSavedAria')} value="" onChange={(e) => e.target.value && onDelete(e.target.value)} className={cn(controlClass, 'min-w-[100px]')}>
            <option value="">{t('books.deleteAction')}</option>
            {savedBooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        )}
        <select aria-label={t('books.bookTheme')} value={book.themeId || DEFAULT_BOOK_THEME_ID} onChange={(event) => setBook((current) => ({ ...current, themeId: event.target.value }))} className={cn(controlClass, 'min-w-[130px]')}>
          {BOOK_THEME_PRESETS.map((theme) => <option key={theme.id} value={theme.id}>{t(theme.labelKey)}</option>)}
        </select>
        <PresentationSettingsControls
          value={normalizeBookPresentationSettings(book.presentationSettings).pageStyle}
          onChange={updateBookPageStyle}
        />
        <span className="ms-auto text-xs text-muted-foreground">
          {t('books.export')}:
        </span>
        {EXPORT_FORMATS.map((f) => (
          <Button size="md" key={f.id} onClick={() => onExport(f.id)}><FileText size={14} /> {t(`books.exportFormats.${f.id}`, { defaultValue: f.label })}</Button>
        ))}
        <span className="ms-2 text-xs text-muted-foreground">
          {t('books.publish')}:
        </span>
        <label className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeWebsite}
            onChange={(e) => setIncludeWebsite(e.target.checked)}
          />
          {t('books.includeWebsite')}
        </label>
        <Button size="md" onClick={onWebHTML} disabled={busy}><FileDown size={14} /> {t('books.webHtml')}</Button>
        <Button size="md" onClick={onPDF} disabled={busy}><Printer size={14} /> {t('books.savePdf')}</Button>
        <Button size="md" onClick={onBundle} disabled={busy}><BookOpen size={14} /> {includeWebsite ? t('books.websiteBundle') : t('books.bookBundle')}</Button>
        {busy && controllerRef.current && <Button size="md" onClick={() => controllerRef.current?.abort()}>{t('common.cancel')}</Button>}
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
              ? t('books.validation.verifySections', { count: validation.errors.length })
              : t('books.validation.warningCount', { count: validation.warnings.length })}
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
              <div className="text-2xs font-bold tracking-wider text-muted-foreground">{t('books.yourBook')}</div>
              <div className="mt-0.5 text-[15px] font-bold text-foreground">{t('books.chaptersAndSections')}</div>
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
                  families={families}
                  groups={groups}
                  sources={sources}
                  media={media}
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
              aria-label={t('books.addElements')}
              value=""
              onChange={(e) => { if (e.target.value) { addSection(e.target.value); e.target.value = ''; } }}
              className={cn(controlClass, 'w-full')}
            >
              <option value="">{t('books.addElements')}</option>
              {SECTION_GROUPS.map((group) => (
                <optgroup key={group.labelKey} label={t(group.labelKey)}>
                  {group.ids.map((id) => {
                    const kind = SECTION_KINDS.find((entry) => entry.id === id);
                    return kind ? <option key={kind.id} value={kind.id}>{t(kind.labelKey)}</option> : null;
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
      {assistantOpen && (
        <NewBookAssistant
          persons={persons}
          families={families}
          initialPersonId={activePersonId}
          outputLanguage={book.outputLanguage || localization.locale}
          onFinish={onNewBook}
          onCancel={() => setAssistantOpen(false)}
        />
      )}
    </div>
  );
}

const loadingClass = 'flex h-screen items-center justify-center bg-background text-muted-foreground';

export default BooksApp;
