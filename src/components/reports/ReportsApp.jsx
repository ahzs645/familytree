/**
 * ReportsApp — pick a builder, pick report subjects, preview the report,
 * save the configuration, export to any supported format.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { listAllPersons, findStartPerson } from '../../lib/treeQuery.js';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { compareStrings } from '../../lib/i18n.js';
import { readField } from '../../lib/schema.js';
import {
  buildPersonSummary,
  buildPersonEventsReport,
  buildAncestorNarrative,
  buildGiaPhaLineageReport,
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
  buildRegisterReport,
  buildDescendancyReport,
  buildNarrativeReport,
  buildStoryReport,
  buildKinshipReport,
  buildMediaGalleryReport,
  buildTimelineReport,
  buildStatusReport,
  buildTodayReport,
  buildChangesListReport,
  buildFactsListReport,
  buildMarriageListReport,
  buildMapReport,
} from '../../lib/reports/builders.js';
import { applyPageStyle, listSavedReports, saveReport, deleteSavedReport, newReportId } from '../../lib/reports/savedReports.js';
import { EXPORT_FORMATS, downloadReport } from '../../lib/reports/export.js';
import { DEFAULT_PAGE_STYLE, PRESENTATION_THEMES, normalizePageStyle } from '../../lib/presentationSettings.js';
import { getAuthorInfo } from '../../lib/authorInfo.js';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { PresentationSettingsControls } from '../presentation/PresentationSettingsControls.jsx';
import { ReportPreview } from './ReportPreview.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { localizeReportAst } from '../../lib/reports/localizeReport.js';

export { normalizePageStyle };

export const REPORT_BUILDERS = [
  { id: 'person-summary', label: 'Person Summary', needsSubject: true, subjectType: 'Person', subjectLabel: 'Person', includeHeader: true, defaultOptions: {}, helpText: 'Summarizes the selected person, parents, families, children, and direct events.', run: (rn) => buildPersonSummary(rn) },
  { id: 'person-events', label: 'Person Events Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Person', includeHeader: true, defaultOptions: {}, helpText: 'Lists the selected person\'s direct events and linked family events with context.', run: (rn) => buildPersonEventsReport(rn) },
  { id: 'ancestor-narrative', label: 'Ancestor Narrative', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 5 }, helpText: 'Builds a generation-by-generation ancestor narrative from the selected proband.', run: (rn, o) => buildAncestorNarrative(rn, o.generations) },
  { id: 'gia-pha-lineage', label: 'Gia phả / Family Lineage Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Lineage subject', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 5 }, helpText: 'Builds a Vietnamese-oriented lineage register with ancestor and descendant branch codes.', run: (rn, o) => buildGiaPhaLineageReport(rn, o.generations) },
  { id: 'descendant-narrative', label: 'Descendant Narrative', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 4 }, helpText: 'Builds a descendant narrative grouped by generation.', run: (rn, o) => buildDescendantNarrative(rn, o.generations) },
  { id: 'narrative', label: 'Narrative Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Person', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 4 }, helpText: 'Combines family context and descendant narrative for the selected person.', run: (rn, o) => buildNarrativeReport(rn, o.generations) },
  { id: 'family-group-sheet', label: 'Family Group Sheet', needsSubject: true, subjectType: 'Person', subjectLabel: 'Person', includeHeader: true, defaultOptions: {}, helpText: 'Shows partner families and children for the selected person.', run: (rn) => buildFamilyGroupSheet(rn) },
  { id: 'story-report', label: 'Story Report', needsSubject: true, subjectType: 'Story', subjectLabel: 'Story', includeHeader: true, defaultOptions: {}, helpText: 'Prints a selected story with metadata, sections, and related people, families, events, and media.', run: (rn) => buildStoryReport(rn) },
  { id: 'kinship-report', label: 'Kinship Report', needsSubject: true, needsSecondSubject: true, subjectType: 'Person', subjectLabel: 'Person A', secondSubjectType: 'Person', secondSubjectLabel: 'Person B', includeHeader: true, defaultOptions: {}, helpText: 'Finds the shortest known family path between two selected people.', run: (rn, _o, second) => buildKinshipReport(rn, second) },
  { id: 'ahnentafel', label: 'Ahnentafel Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 6 }, helpText: 'Numbers ancestors using the standard Ahnentafel sequence.', run: (rn, o) => buildAhnentafelReport(rn, o.generations) },
  { id: 'register', label: 'Register Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 4 }, helpText: 'Creates a register-style descendant report from the selected person.', run: (rn, o) => buildRegisterReport(rn, o.generations) },
  { id: 'descendancy', label: 'Descendancy Report', needsSubject: true, subjectType: 'Person', subjectLabel: 'Proband', usesGenerations: true, includeHeader: true, defaultOptions: { generations: 5 }, helpText: 'Creates a tabular descendant report with parent context.', run: (rn, o) => buildDescendancyReport(rn, o.generations) },
  { id: 'persons-list', label: 'Persons List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists every public person with gender and life dates.', run: () => buildPersonsList() },
  { id: 'places-list', label: 'Places List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists recorded places with short names and GeoName identifiers.', run: () => buildPlacesList() },
  { id: 'sources-list', label: 'Sources List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists sources with dates and source text excerpts.', run: () => buildSourcesList() },
  { id: 'events-list', label: 'Events List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists person and family events with owner and place context.', run: () => buildEventsList() },
  { id: 'facts-list', label: 'Facts List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists recorded person facts with values and dates.', run: () => buildFactsListReport() },
  { id: 'marriage-list', label: 'Marriage List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists families and recorded marriage dates.', run: () => buildMarriageListReport() },
  { id: 'anniversary-list', label: 'Anniversary List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists birth and death anniversaries by month and day.', run: () => buildAnniversaryList() },
  { id: 'timeline-report', label: 'Timeline Report', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Orders all person and family events by date.', run: () => buildTimelineReport() },
  { id: 'media-gallery-report', label: 'Media Gallery Report', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists media records and their file or URL references.', run: () => buildMediaGalleryReport() },
  { id: 'status-report', label: 'Status Report', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Shows high-level database completeness and count metrics.', run: () => buildStatusReport() },
  { id: 'today-report', label: 'Today Report', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Shows recorded births and deaths that match today\'s month and day.', run: () => buildTodayReport() },
  { id: 'changes-list', label: 'Changes List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists recent change-log entries in reverse chronological order.', run: () => buildChangesListReport() },
  { id: 'map-report', label: 'Map Report', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists places with latitude, longitude, and GeoName identifiers.', run: () => buildMapReport() },
  { id: 'todo-list', label: 'ToDo List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Lists ToDo records with status, priority, due date, and description.', run: () => buildToDoListReport() },
  { id: 'plausibility-list', label: 'Plausibility List', needsSubject: false, includeHeader: true, defaultOptions: {}, helpText: 'Runs plausibility checks and lists resulting warnings.', run: () => buildPlausibilityReport() },
];

export function getReportBuilder(id) {
  return REPORT_BUILDERS.find((builder) => builder.id === id) || null;
}

export function defaultOptionsForBuilder(builderOrId) {
  const builder = typeof builderOrId === 'string' ? getReportBuilder(builderOrId) : builderOrId;
  return {
    includeHeader: builder?.includeHeader !== false,
    ...(builder?.defaultOptions || {}),
  };
}

export function normalizeReportOptions(builderOrId, options = {}) {
  return {
    ...defaultOptionsForBuilder(builderOrId),
    ...(options || {}),
  };
}

export function createSavedReportPayload({ name, builderId, targetId, secondTargetId, options, pageStyle, themeId = 'plain' }) {
  const builder = getReportBuilder(builderId) || REPORT_BUILDERS[0];
  const theme = PRESENTATION_THEMES.some((entry) => entry.id === themeId) ? themeId : 'plain';
  return {
    id: newReportId(),
    name,
    builderId: builder.id,
    targetRecordName: builder.needsSubject === false ? null : targetId || null,
    targetRecordType: builder.needsSubject === false ? null : builder.subjectType || 'Person',
    secondTargetRecordName: builder.needsSecondSubject ? secondTargetId || null : null,
    secondTargetRecordType: builder.needsSecondSubject ? builder.secondSubjectType || 'Person' : null,
    options: normalizeReportOptions(builder, options),
    pageStyle: normalizePageStyle(pageStyle),
    themeId: theme,
  };
}

export function stateFromSavedReport(entry) {
  const builder = getReportBuilder(entry?.builderId) || REPORT_BUILDERS[0];
  return {
    builderId: builder.id,
    targetId: entry?.targetRecordName || null,
    secondTargetId: entry?.secondTargetRecordName || null,
    options: normalizeReportOptions(builder, entry?.options),
    pageStyle: normalizePageStyle(entry?.pageStyle),
    themeId: PRESENTATION_THEMES.some((theme) => theme.id === entry?.themeId) ? entry.themeId : 'plain',
  };
}

export function applyReportContentOptions(report, options = {}) {
  if (options.includeHeader !== false || !report?.blocks?.length) return report;
  let removedHeader = false;
  return {
    ...report,
    blocks: report.blocks.filter((entry) => {
      if (!removedHeader && entry.kind === 'title' && entry.level === 1) {
        removedHeader = true;
        return false;
      }
      return true;
    }),
  };
}

export function ReportsApp() {
  const { t } = useTranslation();
  const modal = useModal();
  const [persons, setPersons] = useState([]);
  const [stories, setStories] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [secondTargetId, setSecondTargetId] = useState(null);
  const [builderId, setBuilderId] = useState('person-summary');
  const [options, setOptions] = useState(() => defaultOptionsForBuilder('person-summary'));
  const [pageStyle, setPageStyle] = useState(() => normalizePageStyle(DEFAULT_PAGE_STYLE));
  const [themeId, setThemeId] = useState('plain');
  const [report, setReport] = useState(null);
  const [savedList, setSavedList] = useState([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [authorInfo, setAuthorInfo] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const generationRequestRef = useRef(0);
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => {
    if (speechSupported) window.speechSynthesis.cancel();
  }, [speechSupported]);

  useEffect(() => {
    let cancelled = false;
    getAuthorInfo()
      .then((info) => {
        if (!cancelled) setAuthorInfo(info);
      })
      .catch(() => {
        if (!cancelled) setAuthorInfo(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const builder = useMemo(() => getReportBuilder(builderId) || REPORT_BUILDERS[0], [builderId]);
  const needsSubject = builder?.needsSubject !== false;
  const needsSecondSubject = !!builder?.needsSecondSubject;
  const usesGenerations = !!builder?.usesGenerations;
  const generationValue = Number(options.generations ?? builder?.defaultOptions?.generations ?? 5);
  const subjectItems = useMemo(() => getSubjectItemsForBuilder(builder, { persons, stories }), [builder, persons, stories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [personList, storyList, savedReports, start] = await Promise.all([
          listAllPersons(),
          listAllStories(),
          listSavedReports(),
          findStartPerson(),
        ]);
        if (cancelled) return;
        setPersons(personList);
        setStories(storyList);
        setSavedList(savedReports);
        setEmpty(personList.length === 0 && storyList.length === 0);

        const firstTarget = start?.recordName || personList[0]?.recordName || storyList[0]?.recordName || null;
        setTargetId(firstTarget);
        setSecondTargetId(personList.find((person) => person.recordName !== firstTarget)?.recordName || personList[0]?.recordName || null);
      } catch (error) {
        if (!cancelled) setGenerationError(error?.message || 'Unable to load report subjects.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading || !needsSubject) return;
    if (subjectItems.length === 0) {
      if (targetId !== null) setTargetId(null);
      return;
    }
    if (!subjectItems.some((item) => item.recordName === targetId)) {
      setTargetId(subjectItems[0].recordName);
    }
  }, [loading, needsSubject, subjectItems, targetId]);

  useEffect(() => {
    if (loading || !needsSecondSubject) return;
    if (persons.length === 0) {
      if (secondTargetId !== null) setSecondTargetId(null);
      return;
    }
    if (!persons.some((person) => person.recordName === secondTargetId)) {
      setSecondTargetId(persons.find((person) => person.recordName !== targetId)?.recordName || persons[0].recordName);
    }
  }, [loading, needsSecondSubject, persons, targetId, secondTargetId]);

  useEffect(() => {
    if (loading || !builder) return;
    const normalizedOptions = normalizeReportOptions(builder, options);
    const missingSubject = builder.needsSubject !== false && !targetId;
    const missingSecondSubject = builder.needsSecondSubject && !secondTargetId;
    if (missingSubject || missingSecondSubject) {
      setReport(null);
      setReportLoading(false);
      return;
    }

    let cancelled = false;
    const requestId = ++generationRequestRef.current;
    setReportLoading(true);
    setGenerationError('');

    (async () => {
      try {
        const ast = await builder.run(targetId, normalizedOptions, secondTargetId);
        const optioned = applyReportContentOptions(ast, normalizedOptions);
        const localized = localizeReportAst(optioned, t);
        const styled = applyPageStyle(localized, pageStyle);
        if (!cancelled && generationRequestRef.current === requestId) setReport(styled);
      } catch (error) {
        if (!cancelled && generationRequestRef.current === requestId) {
          setReport(null);
          setGenerationError(error?.message || 'Report generation failed.');
        }
      } finally {
        if (!cancelled && generationRequestRef.current === requestId) setReportLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, builder, targetId, secondTargetId, options, pageStyle, t]);

  const updateOption = useCallback((key, value) => {
    setOptions((current) => ({ ...current, [key]: value }));
  }, []);

  const onBuilderChange = useCallback((nextBuilderId) => {
    setBuilderId(nextBuilderId);
    setOptions(defaultOptionsForBuilder(nextBuilderId));
    setGenerationError('');
  }, []);

  const onSave = useCallback(async () => {
    const name = await modal.prompt('Name for this report:', '', { title: t('reports.saveReport') });
    if (!name) return;
    await saveReport(createSavedReportPayload({
      name,
      builderId,
      targetId,
      secondTargetId,
      options,
      pageStyle,
      themeId,
    }));
    setSavedList(await listSavedReports());
  }, [builderId, targetId, secondTargetId, options, pageStyle, themeId, modal, t]);

  const onApplySaved = useCallback(async (id) => {
    const entry = savedList.find((r) => r.id === id);
    if (!entry) return;
    const state = stateFromSavedReport(entry);
    setBuilderId(state.builderId);
    setTargetId(state.targetId);
    setSecondTargetId(state.secondTargetId);
    setOptions(state.options);
    setPageStyle(state.pageStyle);
    setThemeId(state.themeId);
  }, [savedList]);

  const onDelete = useCallback(async (id) => {
    if (!(await modal.confirm('Delete this saved report?', { title: t('reports.deleteReport'), okLabel: t('common.delete'), destructive: true }))) return;
    await deleteSavedReport(id);
    setSavedList(await listSavedReports());
  }, [modal, t]);

  const onExport = useCallback((fmt) => {
    if (!report) return;
    downloadReport(fmt, report, {
      filenameBase: report.title,
      author: authorInfo,
      theme: themeId === 'plain' ? null : { id: themeId },
    });
  }, [report, authorInfo, themeId]);

  const onSpeak = useCallback(() => {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = reportToSpeech(report);
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setSpeaking(true);
  }, [report, speaking, speechSupported]);

  const builderLabel = (entry) => t(`reports.builders.${entry.id}`);

  if (loading) return <div style={loadingStyle}>{t('common.loading')}</div>;
  if (empty) {
    return (
      <div style={loadingStyle}>
        {t('reports.noFamilyData')} <a href="/" style={{ color: 'hsl(var(--primary))', marginInlineStart: 6 }}>{t('common.import')}</a>
      </div>
    );
  }

  return (
    <div style={shell}>
      <header style={header}>
        <Field label={t('reports.type')}>
          <select value={builderId} onChange={(e) => onBuilderChange(e.target.value)} style={input}>
            {REPORT_BUILDERS.map((entry) => (
              <option key={entry.id} value={entry.id}>{builderLabel(entry)}</option>
            ))}
          </select>
        </Field>

        <button
          type="button"
          onClick={() => setOptionsOpen((open) => !open)}
          style={{ ...input, alignSelf: 'flex-end' }}
          className="sm:hidden"
          aria-expanded={optionsOpen}
        >
          {optionsOpen ? t('common.close') : 'Options'}
        </button>

        <div className={`${optionsOpen ? 'contents' : 'hidden'} sm:contents`}>
        {needsSubject && (
          <Field label={builder.subjectLabel || 'Subject'}>
            {builder.subjectType === 'Story' ? (
              <RecordSelect items={stories} value={targetId} onChange={setTargetId} placeholder={t('reports.selectStory')} />
            ) : (
              <PersonPicker persons={persons} value={targetId} onChange={setTargetId} />
            )}
          </Field>
        )}

        {needsSecondSubject && (
          <Field label={builder.secondSubjectLabel || 'Second subject'}>
            <PersonPicker persons={persons} value={secondTargetId} onChange={setSecondTargetId} />
          </Field>
        )}

        {usesGenerations && (
          <Field label={t('reports.generations')}>
            <input
              type="number"
              min={2}
              max={10}
              value={generationValue}
              onChange={(e) => updateOption('generations', Math.min(10, Math.max(2, +e.target.value || builder.defaultOptions.generations || 5)))}
              style={{ ...input, width: 70 }}
            />
          </Field>
        )}

        <Field label={t('reports.header')}>
          <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={options.includeHeader !== false} onChange={(e) => updateOption('includeHeader', e.target.checked)} /> {t('reports.title')}
          </label>
        </Field>

        <PresentationSettingsControls value={pageStyle} onChange={setPageStyle} />

        <Field label={t('reports.theme')}>
          <select value={themeId} onChange={(event) => setThemeId(event.target.value)} style={input}>
            {PRESENTATION_THEMES.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.label}</option>
            ))}
          </select>
        </Field>

        <Field label={t('reports.export')}>
          <div style={{ display: 'flex', gap: 4 }}>
            {EXPORT_FORMATS.map((format) => (
              <button key={format.id} onClick={() => onExport(format.id)} disabled={!report || reportLoading} style={input} title={format.label}>{format.label}</button>
            ))}
          </div>
        </Field>

        {speechSupported && (
          <Field label={t('reports.speak')}>
            <button
              onClick={onSpeak}
              disabled={!report || reportLoading}
              style={input}
              title={speaking ? 'Stop speaking' : 'Read this report aloud'}
            >
              {speaking ? 'Stop' : 'Play'}
            </button>
          </Field>
        )}

        <Field label={t('reports.saved')}>
          <div style={{ display: 'flex', gap: 4 }}>
            <select value="" onChange={(e) => e.target.value && onApplySaved(e.target.value)} style={{ ...input, minWidth: 120 }}>
              <option value="">{t('reports.load')}</option>
              {savedList.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
            <button onClick={onSave} style={input}>{t('common.save')}</button>
            {savedList.length > 0 && (
              <select value="" onChange={(e) => e.target.value && onDelete(e.target.value)} style={{ ...input, width: 70 }}>
                <option value="">Del…</option>
                {savedList.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            )}
          </div>
        </Field>

        {builder.helpText && <div style={helpText}>{builder.helpText}</div>}
        </div>
      </header>

      <main style={main}>
        {reportLoading && <div style={statusText}>{t('reports.generating', { label: builderLabel(builder) })}</div>}
        {generationError && <div style={errorText}>{generationError}</div>}
        <ReportPreview report={report} />
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginInlineEnd: 12 }}>
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

function RecordSelect({ items, value, onChange, placeholder }) {
  const { t } = useTranslation();
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value || null)} style={{ ...input, minWidth: 260 }}>
      <option value="">{placeholder || t('reports.selectRecord')}</option>
      {items.map((item) => (
        <option key={item.recordName} value={item.recordName}>{item.label}</option>
      ))}
    </select>
  );
}

function getSubjectItemsForBuilder(builder, { persons, stories }) {
  if (builder?.needsSubject === false) return [];
  if (builder?.subjectType === 'Story') return stories;
  return persons;
}

async function listAllStories() {
  const db = getLocalDatabase();
  const { records } = await db.query('Story', { limit: 100000 });
  return records
    .map(storySubject)
    .filter(Boolean)
    .sort((a, b) => compareStrings(a.label, b.label));
}

function reportToSpeech(report) {
  if (!report?.blocks?.length) return '';
  const lines = [];
  if (report.title) lines.push(report.title);
  for (const block of report.blocks) {
    switch (block.kind) {
      case 'title':
        if (block.text) lines.push(block.text);
        break;
      case 'paragraph':
        if (block.text) lines.push(block.text);
        break;
      case 'list':
        for (const item of block.items || []) if (item) lines.push(item);
        break;
      case 'table':
        for (const row of block.rows || []) {
          const cells = row.filter((c) => c != null && String(c).trim());
          if (cells.length) lines.push(cells.join(', '));
        }
        break;
      default:
        break;
    }
  }
  return lines.join('. ').slice(0, 32000);
}

function storySubject(record) {
  if (!record) return null;
  return {
    recordName: record.recordName,
    label: readField(record, ['title', 'name'], record.recordName || 'Story'),
  };
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', background: 'hsl(var(--background))' };
const header = { display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', flexWrap: 'wrap' };
const main = { flex: 1, overflow: 'auto', position: 'relative' };
const input = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 10px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none', cursor: 'pointer' };
const loadingStyle = { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--background))', fontFamily: '-apple-system, system-ui, sans-serif' };
const helpText = { flexBasis: '100%', color: 'hsl(var(--muted-foreground))', fontSize: 12, lineHeight: 1.35 };
const statusText = { position: 'sticky', top: 0, zIndex: 2, padding: '8px 20px', background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))', fontSize: 12 };
const errorText = { padding: '8px 20px', background: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))', fontSize: 12 };

export default ReportsApp;
