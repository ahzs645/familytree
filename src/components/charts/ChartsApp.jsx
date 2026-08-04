/**
 * ChartsApp — top-level UI for the charts page.
 * Picks a person, chooses chart type and theme, renders the chart.
 * Supports a second-person picker for Double Ancestor and Relationship Path.
 *
 * State and behavior are split into cohesive hooks (see ./hooks/): selection,
 * theming, data pipeline, document load/save, library, sharing, and bootstrap.
 * This component wires them together, keeps the header/panel chrome state, and
 * hands rendering to ChartStage.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { matchesSearchText } from '../../lib/i18n.js';
import { PageSetupSheet } from '../PageSetupSheet.jsx';
import { Select } from '../ui/Select.jsx';
import { AnchoredPopover } from '../ui/AnchoredPopover.jsx';
import { colorForCompleteness } from '../../lib/researchCompleteness.js';
import { getTheme } from './theme.js';
import { PersonPicker } from './PersonPicker.jsx';
import { useChartObjectCommands } from './useChartObjectCommands.js';
import { useModal } from '../../contexts/ModalContext.jsx';
import { ChartSelectionProvider } from './ChartSelectionContext.jsx';
import { ChartContentProvider } from './ChartContentContext.jsx';
import { PersonSidePanel } from './PersonSidePanel.jsx';
import { Field } from './parts/FormFields.jsx';
import { RelationshipPathControls } from './parts/RelationshipPathControls.jsx';
import { ChartPersonBrowser } from './parts/ChartPersonBrowser.jsx';
import { ChartBottomToolbar } from './parts/ChartBottomToolbar.jsx';
import { ChartOptionsPanel } from './parts/ChartOptionsPanel.jsx';
import { MoreViewTab, MoreLayoutTab, MorePageTab } from './parts/MorePopoverViewTabs.jsx';
import { MoreLibraryTab, MoreOverlaysTab, MoreExportTab } from './parts/MorePopoverLibraryTabs.jsx';
import { ChartShareQrDialog } from './parts/ChartShareQrDialog.jsx';
import { chartColorForPerson } from './coloring.js';
import { ChartStage } from './ChartStage.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils.js';
import { useChartSelection } from './hooks/useChartSelection.js';
import { useChartTheming } from './hooks/useChartTheming.js';
import { useExportSettings } from './hooks/useExportSettings.js';
import { usePageSetup } from './hooks/usePageSetup.js';
import { useVirtualTreeOptions } from './hooks/useVirtualTreeOptions.js';
import { useRelationshipPaths } from './hooks/useRelationshipPaths.js';
import { useChartDocument } from './hooks/useChartDocument.js';
import { useChartDocumentIO } from './hooks/useChartDocumentIO.js';
import { useChartLibrary } from './hooks/useChartLibrary.js';
import { useChartSharing } from './hooks/useChartSharing.js';
import { useChartsBootstrap } from './hooks/useChartsBootstrap.js';
import { useChartData } from './hooks/useChartData.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { NoDataYet } from '../NoDataYet.jsx';
import { RelativesSelectionSheet } from '../editors/RelativesSelectionSheet.jsx';
import { FamilyPicker } from '../editors/FamilyPickerSheet.jsx';
import { useRecords } from '../../lib/data/useRecords.js';
import { familySummary } from '../../models/index.js';

const LOADING_CLASSES = 'flex h-full items-center justify-center bg-background text-muted-foreground';

// Tab strip inside the chart "More" popover. Switches which option group is
// visible so 14+ sections don't pile up in one column. Bottom-border tab style
// keeps the active state visible while taking less horizontal room than pills,
// so all six labels fit inside the popover at desktop width and degrade to a
// horizontal scroll only on the narrowest phones.
function morePopoverTabClasses(active) {
  return cn(
    'flex-none cursor-pointer whitespace-nowrap border-b-2 bg-transparent px-2 pb-2 pt-1.5 -mb-px text-xs font-semibold',
    active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground',
  );
}

const CHART_TYPES = [
  { id: 'ancestor', label: 'Ancestor', needsSecond: false },
  { id: 'descendant', label: 'Descendant', needsSecond: false },
  { id: 'hourglass', label: 'Hourglass', needsSecond: false },
  { id: 'tree', label: 'Tree (horizontal)', needsSecond: false },
  { id: 'family-chart', label: 'Family Chart', needsSecond: false },
  { id: 'double-ancestor', label: 'Double Ancestor', needsSecond: true },
  { id: 'fan', label: 'Fan', needsSecond: false },
  { id: 'circular', label: 'Circular Tree', needsSecond: false },
  { id: 'radial-descendant', label: 'Radial Descendant', needsSecond: false },
  { id: 'symmetrical', label: 'Symmetrical Tree', needsSecond: false },
  { id: 'distribution', label: 'Distribution', needsSecond: false },
  { id: 'statistics', label: 'Statistics', needsSecond: false },
  { id: 'lifespan', label: 'Lifespan', needsSecond: false },
  { id: 'timeline', label: 'Timeline', needsSecond: false },
  { id: 'genogram', label: 'Genogram', needsSecond: false },
  { id: 'sociogram', label: 'Sociogram', needsSecond: false },
  { id: 'fractal-h-tree', label: 'Fractal H-Tree', needsSecond: false },
  { id: 'square-tree', label: 'Square Tree', needsSecond: false },
  { id: 'fractal-tree', label: 'Fractal Tree', needsSecond: false },
  { id: 'relationship', label: 'Relationship Path', needsSecond: true },
  { id: 'virtual', label: 'Virtual Tree (configurable)', needsSecond: false },
];

export function ChartsApp() {
  const { t } = useTranslation();
  const modal = useModal();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { recordName: sharedRootId, setActivePerson } = useActivePerson();
  const selection = useChartSelection(searchParams, sharedRootId);
  const {
    rootId, setRootId,
    secondId, setSecondId,
    chartType, setChartType,
    generations, setGenerations,
    chartClickAction, setChartClickAction,
    descendantGenerations, setDescendantGenerations,
    hourglassAncestorGens, setHourglassAncestorGens,
    hourglassDescendantGens, setHourglassDescendantGens,
    doubleAncestorLeftGens, setDoubleAncestorLeftGens,
    doubleAncestorRightGens, setDoubleAncestorRightGens,
    fanArcDegrees, setFanArcDegrees,
    ancestorBranch, setAncestorBranch,
    ancestorConfig, setAncestorConfig,
    descendantConfig, setDescendantConfig,
    treeConfig, setTreeConfig,
    fanConfig, setFanConfig,
    hourglassConfig, setHourglassConfig,
    genogramConfig, setGenogramConfig,
    distributionType, setDistributionType,
    distributionRelativeValues, setDistributionRelativeValues,
    distributionGraphType, setDistributionGraphType,
    distributionFromYear, setDistributionFromYear,
    distributionToYear, setDistributionToYear,
    sociogramConfig, setSociogramConfig,
    timelineGrouping, setTimelineGrouping,
    timelineCollapse, setTimelineCollapse,
    timelineMarkerMode, setTimelineMarkerMode,
  } = selection;
  const theming = useChartTheming();
  const {
    themeId, setThemeId,
    completenessColorMode, setCompletenessColorMode,
    completenessRowsByPerson, setCompletenessRowsByPerson,
    coloringMode, setColoringMode,
    chartContent, setChartContent,
    chartPhotos, setChartPhotos,
  } = theming;
  const { theme: appTheme } = useTheme();
  const virtualOptions = useVirtualTreeOptions();
  const chartDoc = useChartDocument();
  const {
    currentDocumentId,
    currentDocumentName,
    isDirty,
    isReadOnly,
  } = chartDoc;
  const exportSettingsState = useExportSettings();
  const {
    exportFormat, setExportFormat,
    exportScale, setExportScale,
    exportIncludeBackground, setExportIncludeBackground,
    exportJpegQuality, setExportJpegQuality,
    exportFileNameTemplate, setExportFileNameTemplate,
  } = exportSettingsState;
  const pageSetup = usePageSetup();
  const {
    chartTitle, setChartTitle,
    chartNote, setChartNote,
    pageSize, setPageSize,
    pageOrientation, setPageOrientation,
    chartBackground, setChartBackground,
    backgroundSheetOpen, setBackgroundSheetOpen,
    pageSetupSheetOpen, setPageSetupSheetOpen,
    pageMargins, setPageMargins,
    pagePrintMargins, setPagePrintMargins,
    pageOverlap, setPageOverlap,
    pageCutMarks, setPageCutMarks,
    pagePrintPageNumbers, setPagePrintPageNumbers,
    pageOmitEmptyPages, setPageOmitEmptyPages,
    pageWatermark, setPageWatermark,
  } = pageSetup;
  const relationship = useRelationshipPaths();
  const {
    relationshipPaths, setRelationshipPaths,
    selectedRelationshipPathId, setSelectedRelationshipPathId,
    relationshipBloodlineOnly, setRelationshipBloodlineOnly,
    relationshipMaxPaths, setRelationshipMaxPaths,
    relationshipMaxDepth, setRelationshipMaxDepth,
    relationshipExcludeNonBiological, setRelationshipExcludeNonBiological,
  } = relationship;
  const [moreOpen, setMoreOpen] = useState(false);
  // Which group of options is visible in the "More" popover. The popover used
  // to stack ~14 unrelated Sections vertically; the tab strip splits them into
  // View / Layout / Page / Library / Overlays / Export so the panel scans at
  // a glance on both desktop and mobile.
  const [morePopoverTab, setMorePopoverTab] = useState('view');
  const [chartOptionsOpen, setChartOptionsOpen] = useState(false);
  const [chartOptionsTab, setChartOptionsTab] = useState('general');
  // The People browser pane is helpful on desktop where it sits beside the
  // canvas, but on a phone it covers the chart entirely. Default it closed at
  // mobile widths — users can still open it via the People button on the
  // bottom toolbar.
  const [personBrowserOpen, setPersonBrowserOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 767px)').matches;
  });
  const [personBrowserQuery, setPersonBrowserQuery] = useState('');
  const [personBrowserGroup, setPersonBrowserGroup] = useState('lastName');
  const [chartSpacing, setChartSpacing] = useState({ horizontal: 24, vertical: 110, branch: 44 });
  const [showKinships, setShowKinships] = useState(false);
  const [collapseDuplicates, setCollapseDuplicates] = useState(true);
  // Defaults to true: the chart data pipeline already excludes records flagged
  // private, so keeping this on preserves the long-standing rendered behavior.
  const [hidePrivateChartInfo, setHidePrivateChartInfo] = useState(true);
  const [chartPersonGroupMode, setChartPersonGroupMode] = useState('all');
  const moreRef = useRef(null);
  const moreButtonRef = useRef(null);
  const [panelPersonId, setPanelPersonId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [relativePickerOpen, setRelativePickerOpen] = useState(false);
  const { records: familyRecords } = useRecords('Family');
  const chartCanvasRef = useRef(null);
  const overlayCommands = useChartObjectCommands([]);
  const {
    overlays,
    objectStyles,
    connectionStyles,
    selectedOverlayId,
    selectedObject,
    hasUndo,
    hasRedo,
    setOverlaysPreview,
    setOverlaysCommit,
    addText,
    addLine,
    addImage,
    undo,
    redo,
    removeSelected,
    alignHorizontal,
    alignVertical,
    bringToFront,
    sendToBack,
    distributeEvenly,
    moveAwayFromPageCuts,
    distributeBorderToBorder,
    selectOverlay,
    selectObject,
    updateObjectStyle,
    updateConnectionStyle,
  } = overlayCommands;
  const theme = getTheme(themeId, appTheme === 'dark');
  const needsSecond = CHART_TYPES.find((t) => t.id === chartType)?.needsSecond;
  const chartPage = {
    title: chartTitle,
    note: chartNote,
    size: pageSize,
    paperSize: pageSize,
    orientation: pageOrientation,
    backgroundColor: chartBackground || theme.background,
    margins: pageMargins,
    printMargins: pagePrintMargins,
    overlap: pageOverlap,
    cutMarks: pageCutMarks,
    printPageNumbers: pagePrintPageNumbers,
    omitEmptyPages: pageOmitEmptyPages,
    watermark: pageWatermark,
  };
  const chartTitleOrDefault = chartTitle || 'chart';

  // Document load/save plumbing + dirty tracking (see useChartDocumentIO).
  const documentIO = useChartDocumentIO({
    selection,
    theming,
    virtualOptions,
    pageSetup,
    exportSettings: exportSettingsState,
    relationship,
    overlayCommands,
    chartDoc,
    setActivePerson,
  });
  const { applyDocumentState, currentDocumentState } = documentIO;

  // Saved templates/documents and their lifecycle actions.
  const {
    templates,
    setTemplates,
    documents,
    setDocuments,
    onSaveTemplate,
    onApplyTemplate,
    onDeleteTemplate,
    onSaveDocument,
    onSaveAsDocument,
    onApplyDocument,
    onNewChart,
    onFinishEditing,
    onDeleteDocument,
  } = useChartLibrary({ selection, theming, pageSetup, chartDoc, overlayCommands, documentIO });

  const {
    qrShare,
    setQrShare,
    onCopyShareLink,
    onShareChart,
    onShareByEmail,
    onShowShareQr,
  } = useChartSharing({ rootId, chartTitle, currentDocumentId, currentDocumentName, currentDocumentState });

  // One-shot mount load: person summaries, saved documents/templates,
  // completeness rows, requested document, initial root person.
  const { persons, privateIds, loading, empty } = useChartsBootstrap({
    searchParams,
    rootId,
    setRootId,
    setActivePerson,
    setCompletenessRowsByPerson,
    setTemplates,
    setDocuments,
    applyDocumentState,
  });

  // Trees + record-backed chart data feeding the canvas.
  const {
    ancestorTree,
    descendantTree,
    secondAncestorTree,
    partnerAncestorTree,
    completeTreeData,
    timelineData,
    genogramData,
    distributionData,
    sociogramData,
    selectedRelationshipResult,
    relationshipPathIds,
    virtualLayoutOptions,
    generationIndex,
    chartPersons,
  } = useChartData({
    selection,
    needsSecond,
    relationship,
    virtualOptions,
    persons,
    privateIds,
    hidePrivateChartInfo,
    showPortraits: chartContent.showPortraits || Object.values(objectStyles).some((style) => style?.showPhoto === true),
    setChartPhotos,
  });

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    setOrDelete(next, 'type', chartType, 'ancestor');
    setOrDelete(next, 'person', rootId);
    setOrDelete(next, 'second', needsSecond ? secondId : null);
    setOrDelete(next, 'gen', generations === 5 ? null : String(generations));
    setOrDelete(next, 'click', chartClickAction === 'reroot' ? null : chartClickAction);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [chartClickAction, chartType, generations, needsSecond, rootId, searchParams, secondId, setSearchParams]);

  const openPersonInPanel = useCallback((person) => {
    if (!person?.recordName) return;
    setPanelPersonId(person.recordName);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const rerootFromPanel = useCallback((id) => {
    if (!id) return;
    setRootId(id);
    setActivePerson(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActivePerson]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const colorForPerson = useCallback((person) => {
    if (!person?.recordName) return null;
    // Aesthetic coloring mode (by generation / pedigree / year / age / …) wins.
    const aesthetic = chartColorForPerson(coloringMode, person, generationIndex);
    if (aesthetic) return aesthetic;
    // Otherwise fall back to the research-completeness overlay, then theme gender.
    if (completenessColorMode === 'gender') return null;
    return colorForCompleteness(completenessRowsByPerson.get(person.recordName), completenessColorMode);
  }, [coloringMode, generationIndex, completenessColorMode, completenessRowsByPerson]);

  const onPersonClick = useCallback(
    (p) => {
      if (chartClickAction === 'panel') {
        openPersonInPanel(p);
        return;
      }
      setRootId(p.recordName);
      setActivePerson(p.recordName);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartClickAction, openPersonInPanel, setActivePerson]
  );
  const onRootChange = useCallback(
    (id) => {
      setRootId(id);
      setActivePerson(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setActivePerson]
  );

  const onEditPerson = useCallback(
    (person) => person?.recordName && navigate(`/person/${person.recordName}`),
    [navigate]
  );

  const onOverlaysChange = useCallback((next, meta = {}) => {
    if (meta?.finalize) {
      setOverlaysCommit(next, { selectedId: selectedOverlayId });
      return;
    }
    setOverlaysPreview(next);
  }, [selectedOverlayId, setOverlaysCommit, setOverlaysPreview]);

  const onUpdateOverlay = useCallback((id, next) => {
    if (!id) return;
    const updated = overlays.map((overlay) => (overlay?.id === id ? { ...overlay, ...next } : overlay));
    setOverlaysCommit(updated, { selectedId: id });
  }, [overlays, setOverlaysCommit]);

  const onSelectChartObject = useCallback((object) => {
    selectObject(object);
    if (object?.id) {
      setMorePopoverTab('overlays');
      setMoreOpen(true);
    }
  }, [selectObject]);

  const onMoveAwayFromPageBreaks = useCallback(() => {
    moveAwayFromPageCuts(chartPage, chartCanvasRef.current?.measurePageBreakObjects?.());
  }, [chartPage, moveAwayFromPageCuts]);

  const addTextOverlay = useCallback(async () => {
    const text = await modal.prompt('Text label:', 'Annotation', { title: 'Add text' });
    if (!text) return;
    addText({ text, x: 96, y: 120, fontSize: 20, color: theme.text });
  }, [addText, theme.text, modal]);

  const addLineOverlay = useCallback(() => {
    addLine({ x1: 120, y1: 160, x2: 300, y2: 160, strokeWidth: 3, color: theme.connector });
  }, [addLine, theme.connector]);

  const addImageOverlay = useCallback(async () => {
    const href = await modal.prompt('Image URL:', '', { title: 'Add image', placeholder: 'https://…' });
    if (!href) return;
    addImage(href, { x: 120, y: 140, width: 180, height: 120 });
  }, [addImage, modal]);

  const focusRootInCanvas = useCallback(() => {
    chartCanvasRef.current?.focusRoot?.();
  }, []);

  const exportSvg = useCallback(() => {
    chartCanvasRef.current?.exportSvg?.();
  }, []);

  const exportPng = useCallback(() => {
    chartCanvasRef.current?.exportPng?.();
  }, []);

  const exportPdf = useCallback(() => {
    chartCanvasRef.current?.exportPdf?.() || chartCanvasRef.current?.print?.();
  }, []);

  const exportSettings = useMemo(() => ({
    format: exportFormat,
    scale: exportScale,
    includeBackground: exportIncludeBackground,
    jpegQuality: exportJpegQuality,
    fileNameTemplate: exportFileNameTemplate,
  }), [exportFormat, exportScale, exportIncludeBackground, exportJpegQuality, exportFileNameTemplate]);

  const chartPersonBrowserRows = useMemo(() => {
    const query = personBrowserQuery.trim();
    let next = query
      ? chartPersons.filter((person) => matchesSearchText(String(person.fullName || `${person.firstName || ''} ${person.lastName || ''}`), query))
      : chartPersons;
    if (chartPersonGroupMode === 'bookmarked') next = next.filter((person) => person.bookmarked);
    return [...next].sort((a, b) => {
      if (personBrowserGroup === 'birth') return (a.birthYear || 99999) - (b.birthYear || 99999);
      const av = personBrowserGroup === 'firstName' ? a.firstName : a.lastName;
      const bv = personBrowserGroup === 'firstName' ? b.firstName : b.lastName;
      return String(av || a.fullName || '').localeCompare(String(bv || b.fullName || ''));
    });
  }, [chartPersonGroupMode, personBrowserGroup, personBrowserQuery, chartPersons]);
  const selectedFamilyId = useMemo(() => familyRecords.find((record) => {
    const summary = familySummary(record);
    return summary?.manRecordName === rootId || summary?.womanRecordName === rootId;
  })?.recordName || '', [familyRecords, rootId]);

  const overlayChartProps = useMemo(
    () => ({
      onOverlaysChange,
      onOverlaysPreview: setOverlaysPreview,
      onOverlaysCommit: setOverlaysCommit,
      selectedOverlayId,
      onSelectOverlay: selectOverlay,
      filename: chartTitleOrDefault,
      exportSettings,
    }),
    [onOverlaysChange, setOverlaysCommit, setOverlaysPreview, selectedOverlayId, selectOverlay, chartTitleOrDefault, exportSettings]
  );

  if (loading) return <div className={LOADING_CLASSES}>Loading family data…</div>;
  if (empty) return <NoDataYet />;

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-5 py-3">
        <Field label={t('charts.person', { defaultValue: 'Person' })}>
          <PersonPicker persons={chartPersons} value={rootId} onChange={onRootChange} />
        </Field>

        <Button size="md" onClick={() => setRelativePickerOpen(true)}>{t('relativeSelection.chartButton')}</Button>

        {chartType === 'family-chart' && (
          <Field label={t('familyPicker.family')}>
            <FamilyPicker
              value={selectedFamilyId}
              families={familyRecords}
              persons={chartPersons}
              ariaLabel={t('familyPicker.family')}
              onChange={(_familyId, family) => family?.primaryPersonRecordName && onRootChange(family.primaryPersonRecordName)}
            />
          </Field>
        )}

        {needsSecond && (
          <Field label={chartType === 'relationship' ? 'Compare to' : 'Partner'}>
            <PersonPicker persons={chartPersons} value={secondId} onChange={setSecondId} />
          </Field>
        )}

        {chartType === 'relationship' && (
          <RelationshipPathControls
            bloodlineOnly={relationshipBloodlineOnly}
            onBloodlineOnlyChange={setRelationshipBloodlineOnly}
            maxPaths={relationshipMaxPaths}
            onMaxPathsChange={setRelationshipMaxPaths}
            maxDepth={relationshipMaxDepth}
            onMaxDepthChange={setRelationshipMaxDepth}
            excludeNonBiological={relationshipExcludeNonBiological}
            onExcludeNonBiologicalChange={setRelationshipExcludeNonBiological}
            paths={relationshipPaths}
            selectedPathId={selectedRelationshipPathId}
            onSelectedPathChange={setSelectedRelationshipPathId}
            onReset={() => {
              setSecondId(null);
              setRelationshipPaths([]);
              setSelectedRelationshipPathId(null);
            }}
            disabled={!secondId}
          />
        )}

        <Field label={t('charts.type', { defaultValue: 'Type' })}>
          <Select
            value={chartType}
            onChange={setChartType}
            options={CHART_TYPES.map((type) => ({ value: type.id, label: t(`charts.chartType.${type.id}`, { defaultValue: type.label }) }))}
            align="start"
          />
        </Field>

        <Field label={t('charts.generations', { defaultValue: 'Gen' })} hideOnNarrow>
          <Input
            type="number"
            min={2}
            max={8}
            value={generations}
            onChange={(e) => setGenerations(Math.min(8, Math.max(2, +e.target.value || 5)))}
            className="w-[60px]"
          />
        </Field>

        <div ref={moreRef} className="relative ms-auto">
          <Button ref={moreButtonRef} size="md" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
            {t('charts.more', { defaultValue: 'More' })} ▾
          </Button>
          {moreOpen && (
            <AnchoredPopover
              anchorRef={moreButtonRef}
              align="end"
              gap={6}
              maxHeight="70vh"
              role="dialog"
              aria-label={t('charts.more', { defaultValue: 'More' })}
              className="w-[380px] rounded-lg border border-border bg-card p-3.5 text-card-foreground shadow-lg"
            >
              <div className="no-scrollbar -mx-0.5 mb-2.5 flex gap-0.5 overflow-x-auto border-b border-border" role="tablist" aria-label={t('charts.optionsTabs', { defaultValue: 'Chart options' })}>
                {[
                  ['view', 'View'],
                  ['layout', 'Layout'],
                  ['page', 'Page'],
                  ['library', 'Library'],
                  ['overlays', 'Overlays'],
                  ['export', 'Export'],
                ].map(([id, fallback]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={morePopoverTab === id}
                    onClick={() => setMorePopoverTab(id)}
                    className={morePopoverTabClasses(morePopoverTab === id)}
                  >
                    {t(`charts.tab.${id}`, { defaultValue: fallback })}
                  </button>
                ))}
              </div>
              {morePopoverTab === 'view' && (
                <MoreViewTab
                  themeId={themeId}
                  setThemeId={setThemeId}
                  completenessColorMode={completenessColorMode}
                  setCompletenessColorMode={setCompletenessColorMode}
                  chartClickAction={chartClickAction}
                  setChartClickAction={setChartClickAction}
                />
              )}

              {morePopoverTab === 'layout' && (
                <MoreLayoutTab
                  chartType={chartType}
                  generations={generations}
                  setGenerations={setGenerations}
                  descendantGenerations={descendantGenerations}
                  setDescendantGenerations={setDescendantGenerations}
                  hourglassAncestorGens={hourglassAncestorGens}
                  setHourglassAncestorGens={setHourglassAncestorGens}
                  hourglassDescendantGens={hourglassDescendantGens}
                  setHourglassDescendantGens={setHourglassDescendantGens}
                  doubleAncestorLeftGens={doubleAncestorLeftGens}
                  setDoubleAncestorLeftGens={setDoubleAncestorLeftGens}
                  doubleAncestorRightGens={doubleAncestorRightGens}
                  setDoubleAncestorRightGens={setDoubleAncestorRightGens}
                  ancestorBranch={ancestorBranch}
                  setAncestorBranch={setAncestorBranch}
                  fanArcDegrees={fanArcDegrees}
                  setFanArcDegrees={setFanArcDegrees}
                  treeConfig={treeConfig}
                  setTreeConfig={setTreeConfig}
                  fanConfig={fanConfig}
                  setFanConfig={setFanConfig}
                />
              )}

              {morePopoverTab === 'page' && (
                <MorePageTab
                  chartTitle={chartTitle}
                  setChartTitle={setChartTitle}
                  chartNote={chartNote}
                  setChartNote={setChartNote}
                  pageSize={pageSize}
                  setPageSize={setPageSize}
                  pageOrientation={pageOrientation}
                  setPageOrientation={setPageOrientation}
                  chartBackground={chartBackground}
                  setChartBackground={setChartBackground}
                  backgroundSheetOpen={backgroundSheetOpen}
                  setBackgroundSheetOpen={setBackgroundSheetOpen}
                  setPageSetupSheetOpen={setPageSetupSheetOpen}
                />
              )}

              {morePopoverTab === 'library' && (
                <MoreLibraryTab
                  templates={templates}
                  documents={documents}
                  currentDocumentId={currentDocumentId}
                  currentDocumentName={currentDocumentName}
                  isDirty={isDirty}
                  isReadOnly={isReadOnly}
                  rootId={rootId}
                  onApplyTemplate={onApplyTemplate}
                  onSaveTemplate={onSaveTemplate}
                  onDeleteTemplate={onDeleteTemplate}
                  onApplyDocument={onApplyDocument}
                  onSaveDocument={onSaveDocument}
                  onSaveAsDocument={onSaveAsDocument}
                  onNewChart={onNewChart}
                  onFinishEditing={onFinishEditing}
                  onCopyShareLink={onCopyShareLink}
                  onShareChart={onShareChart}
                  onShareByEmail={onShareByEmail}
                  onShowShareQr={onShowShareQr}
                  onDeleteDocument={onDeleteDocument}
                />
              )}

              {morePopoverTab === 'overlays' && (
                <MoreOverlaysTab
                  overlays={overlays}
                  objectStyles={objectStyles}
                  connectionStyles={connectionStyles}
                  selectedOverlayId={selectedOverlayId}
                  selectedObject={selectedObject}
                  isReadOnly={isReadOnly}
                  hasUndo={hasUndo}
                  hasRedo={hasRedo}
                  addTextOverlay={addTextOverlay}
                  addLineOverlay={addLineOverlay}
                  addImageOverlay={addImageOverlay}
                  removeSelected={removeSelected}
                  undo={undo}
                  redo={redo}
                  alignHorizontal={alignHorizontal}
                  alignVertical={alignVertical}
                  bringToFront={bringToFront}
                  sendToBack={sendToBack}
                  distributeEvenly={distributeEvenly}
                  focusRootInCanvas={focusRootInCanvas}
                  moveAwayFromPageCuts={onMoveAwayFromPageBreaks}
                  distributeBorderToBorder={distributeBorderToBorder}
                  pageSize={pageSize}
                  pageOrientation={pageOrientation}
                  onUpdateOverlay={onUpdateOverlay}
                  onUpdateObjectStyle={updateObjectStyle}
                  onUpdateConnectionStyle={updateConnectionStyle}
                />
              )}

              {morePopoverTab === 'export' && (
                <MoreExportTab
                  exportFormat={exportFormat}
                  setExportFormat={setExportFormat}
                  exportScale={exportScale}
                  setExportScale={setExportScale}
                  exportJpegQuality={exportJpegQuality}
                  setExportJpegQuality={setExportJpegQuality}
                  exportIncludeBackground={exportIncludeBackground}
                  setExportIncludeBackground={setExportIncludeBackground}
                  exportFileNameTemplate={exportFileNameTemplate}
                  setExportFileNameTemplate={setExportFileNameTemplate}
                  exportSvg={exportSvg}
                  exportPng={exportPng}
                  exportPdf={exportPdf}
                />
              )}
            </AnchoredPopover>
          )}
        </div>
      </header>

      <ChartShareQrDialog qrShare={qrShare} onClose={() => setQrShare(null)} />

      <ChartSelectionProvider
        openPerson={openPersonInPanel}
        selectedObject={selectedObject}
        selectObject={onSelectChartObject}
        objectStyles={objectStyles}
        connectionStyles={connectionStyles}
      >
      <ChartContentProvider content={chartContent} photosById={chartPhotos}>
      <div className="flex min-h-0 min-w-0 flex-1">
        <ChartStage
          chartType={chartType}
          chartCanvasRef={chartCanvasRef}
          theme={theme}
          chartPage={chartPage}
          overlays={overlays}
          colorForPerson={colorForPerson}
          overlayChartProps={overlayChartProps}
          onPersonClick={onPersonClick}
          openPersonInPanel={openPersonInPanel}
          onEditPerson={onEditPerson}
          rootId={rootId}
          secondId={secondId}
          generations={generations}
          hourglassAncestorGens={hourglassAncestorGens}
          doubleAncestorLeftGens={doubleAncestorLeftGens}
          doubleAncestorRightGens={doubleAncestorRightGens}
          fanArcDegrees={fanArcDegrees}
          ancestorTree={ancestorTree}
          descendantTree={descendantTree}
          secondAncestorTree={secondAncestorTree}
          partnerAncestorTree={partnerAncestorTree}
          completeTreeData={completeTreeData}
          ancestorConfig={ancestorConfig}
          descendantConfig={descendantConfig}
          treeConfig={treeConfig}
          fanConfig={fanConfig}
          hourglassConfig={hourglassConfig}
          genogramConfig={genogramConfig}
          chartPersons={chartPersons}
          distributionData={distributionData}
          distributionType={distributionType}
          timelineData={timelineData}
          genogramData={genogramData}
          sociogramData={sociogramData}
          selectedRelationshipResult={selectedRelationshipResult}
          relationshipPaths={relationshipPaths}
          relationshipPathIds={relationshipPathIds}
          chartSpacing={chartSpacing}
          showKinships={showKinships}
          collapseDuplicates={collapseDuplicates}
          isReadOnly={isReadOnly}
          virtualOptions={virtualOptions}
          virtualLayoutOptions={virtualLayoutOptions}
        />
        {personBrowserOpen && (
          <ChartPersonBrowser
            persons={chartPersonBrowserRows}
            rootId={rootId}
            query={personBrowserQuery}
            onQueryChange={setPersonBrowserQuery}
            group={personBrowserGroup}
            onGroupChange={setPersonBrowserGroup}
            onPick={openPersonInPanel}
            onAllPersons={() => {
              setPersonBrowserQuery('');
              setChartPersonGroupMode('all');
            }}
            onSmartFilters={() => setChartPersonGroupMode((current) => current === 'bookmarked' ? 'all' : 'bookmarked')}
          />
        )}
        <PersonSidePanel
          recordName={panelPersonId}
          open={panelOpen}
          onClose={closePanel}
          onReroot={rerootFromPanel}
        />
      </div>
      </ChartContentProvider>
      </ChartSelectionProvider>
      <ChartBottomToolbar
        personBrowserOpen={personBrowserOpen}
        onTogglePersonBrowser={() => setPersonBrowserOpen((open) => !open)}
        onFocus={focusRootInCanvas}
        onSave={onSaveDocument}
        onShare={onShareChart}
        onExport={exportPng}
        // Theme/Spacing/Localization are tabs inside ChartOptionsPanel — exposing
        // them as separate toolbar buttons was redundant. The user picks a tab
        // inside the panel after opening it.
        onChart={() => {
          // Land directly on the per-chart "Chart" tab for chart types that
          // have dedicated options (distribution/sociogram/timeline); otherwise
          // open to General.
          setChartOptionsTab(
            ['ancestor', 'descendant', 'tree', 'fan', 'hourglass', 'genogram', 'distribution', 'sociogram', 'timeline'].includes(chartType)
              ? 'chart'
              : 'general'
          );
          setChartOptionsOpen((open) => !open);
        }}
        chartOptionsOpen={chartOptionsOpen}
      />
      {chartOptionsOpen && (
        <ChartOptionsPanel
          tab={chartOptionsTab}
          onTabChange={setChartOptionsTab}
          onClose={() => setChartOptionsOpen(false)}
          generations={generations}
          onGenerationsChange={setGenerations}
          descendantGenerations={descendantGenerations}
          onDescendantGenerationsChange={setDescendantGenerations}
          hidePrivateChartInfo={hidePrivateChartInfo}
          onHidePrivateChartInfoChange={setHidePrivateChartInfo}
          showKinships={showKinships}
          onShowKinshipsChange={setShowKinships}
          collapseDuplicates={collapseDuplicates}
          onCollapseDuplicatesChange={setCollapseDuplicates}
          spacing={chartSpacing}
          onSpacingChange={setChartSpacing}
          personGroupMode={chartPersonGroupMode}
          onPersonGroupModeChange={setChartPersonGroupMode}
          coloringMode={coloringMode}
          onColoringModeChange={setColoringMode}
          chartContent={chartContent}
          onChartContentChange={setChartContent}
          chartType={chartType}
          ancestorConfig={ancestorConfig}
          onAncestorConfigChange={setAncestorConfig}
          descendantConfig={descendantConfig}
          onDescendantConfigChange={setDescendantConfig}
          treeConfig={treeConfig}
          onTreeConfigChange={setTreeConfig}
          fanConfig={fanConfig}
          onFanConfigChange={setFanConfig}
          fanArcDegrees={fanArcDegrees}
          onFanArcDegreesChange={setFanArcDegrees}
          hourglassConfig={hourglassConfig}
          onHourglassConfigChange={setHourglassConfig}
          genogramConfig={genogramConfig}
          onGenogramConfigChange={setGenogramConfig}
          distributionType={distributionType}
          onDistributionTypeChange={setDistributionType}
          distributionRelativeValues={distributionRelativeValues}
          onDistributionRelativeValuesChange={setDistributionRelativeValues}
          distributionGraphType={distributionGraphType}
          onDistributionGraphTypeChange={setDistributionGraphType}
          distributionFromYear={distributionFromYear}
          onDistributionFromYearChange={setDistributionFromYear}
          distributionToYear={distributionToYear}
          onDistributionToYearChange={setDistributionToYear}
          sociogramConfig={sociogramConfig}
          onSociogramConfigChange={setSociogramConfig}
          timelineGrouping={timelineGrouping}
          onTimelineGroupingChange={setTimelineGrouping}
          timelineCollapse={timelineCollapse}
          onTimelineCollapseChange={setTimelineCollapse}
          timelineMarkerMode={timelineMarkerMode}
          onTimelineMarkerModeChange={setTimelineMarkerMode}
        />
      )}
      {pageSetupSheetOpen && (
        <PageSetupSheet
          title={t('charts.pageSetup.title')}
          pageSetup={{
            paperSize: pageSize,
            orientation: pageOrientation,
            margins: pageMargins,
            printMargins: pagePrintMargins,
            overlap: pageOverlap,
            cutMarks: pageCutMarks,
            printPageNumbers: pagePrintPageNumbers,
            omitEmptyPages: pageOmitEmptyPages,
            watermark: pageWatermark,
            backgroundColor: chartBackground,
          }}
          exportSettings={{
            format: exportFormat,
            scale: exportScale,
            jpegQuality: exportJpegQuality,
            includeBackground: exportIncludeBackground,
          }}
          onCancel={() => setPageSetupSheetOpen(false)}
          onApply={(nextPage, nextExport) => {
            setPageSize(nextPage.paperSize || 'letter');
            setPageOrientation(nextPage.orientation || 'landscape');
            setPageMargins(nextPage.margins || pageMargins);
            setPagePrintMargins(nextPage.printMargins || pagePrintMargins);
            setPageOverlap(Number(nextPage.overlap) || 0);
            setPageCutMarks(Boolean(nextPage.cutMarks));
            setPagePrintPageNumbers(Boolean(nextPage.printPageNumbers));
            setPageOmitEmptyPages(nextPage.omitEmptyPages !== false);
            setPageWatermark(nextPage.watermark || '');
            if (nextPage.backgroundColor !== undefined) setChartBackground(nextPage.backgroundColor);
            if (nextExport) {
              setExportFormat(nextExport.format || 'png');
              setExportScale(Number(nextExport.scale) || 1);
              setExportJpegQuality(Number(nextExport.jpegQuality) || 0.92);
              setExportIncludeBackground(nextExport.includeBackground !== false);
            }
            setPageSetupSheetOpen(false);
          }}
        />
      )}
      <RelativesSelectionSheet
        open={relativePickerOpen}
        onClose={() => setRelativePickerOpen(false)}
        persons={chartPersons}
        initialPersonId={rootId}
        onApply={(_ids, selection) => {
          onRootChange(selection.personId);
          if (selection.relationSet === 'ancestors') setChartType('ancestor');
          if (selection.relationSet === 'descendants') setChartType('descendant');
        }}
      />
    </div>
  );
}

function setOrDelete(params, key, value, defaultValue = null) {
  if (value == null || value === '' || value === defaultValue) params.delete(key);
  else params.set(key, String(value));
}

export default ChartsApp;
