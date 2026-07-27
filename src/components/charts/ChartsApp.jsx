/**
 * ChartsApp — top-level UI for the charts page.
 * Picks a person, chooses chart type and theme, renders the chart.
 * Supports a second-person picker for Double Ancestor and Relationship Path.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileDown, Focus, Palette, Search, Settings2, Share2, SlidersHorizontal, Users, ZoomIn } from 'lucide-react';
import { listAllPersons, findStartPerson, buildAncestorTree, buildDescendantTree } from '../../lib/treeQuery.js';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { findRelationshipPaths } from '../../lib/relationshipPath.js';
import { listChartTemplates, saveChartTemplate, deleteChartTemplate, newTemplateId } from '../../lib/chartTemplates.js';
import { listChartDocuments, saveChartDocument, deleteChartDocument, newChartDocumentId } from '../../lib/chartDocuments.js';
import { loadSavedChartDocument } from '../../lib/chartContainerLoader.js';
import { normalizeChartDocument } from '../../lib/chartDocumentSchema.js';
import { buildShareUrl } from '../../lib/chartShareLink.js';
import { matchesSearchText } from '../../lib/i18n.js';
import { ChartBackgroundSheet } from './ChartBackgroundSheet.jsx';
import { PageSetupSheet } from '../PageSetupSheet.jsx';
import { Select } from '../ui/Select.jsx';
import { buildTimelineData } from '../../lib/chartData/timelineBuilder.js';
import { buildGenogramData } from '../../lib/chartData/genogramBuilder.js';
import { buildDistributionData } from '../../lib/chartData/distributionBuilder.js';
import { buildSociogramData } from '../../lib/chartData/sociogramBuilder.js';
import { buildVirtualTreeData } from '../../lib/chartData/virtualTreeBuilder.js';
import { COMPLETENESS_COLOR_MODES, COMPLETENESS_LEGEND, colorForCompleteness, loadCompletenessRowsByPerson } from '../../lib/researchCompleteness.js';
import { THEMES, getTheme } from './theme.js';
import { PersonPicker } from './PersonPicker.jsx';
import { AncestorChart } from './AncestorChart.jsx';
import { DescendantChart } from './DescendantChart.jsx';
import { HourglassChart } from './HourglassChart.jsx';
import { TreeChart } from './TreeChart.jsx';
import { FamilyChartView } from './FamilyChartView.jsx';
import { DoubleAncestorChart } from './DoubleAncestorChart.jsx';
import { FanChart } from './FanChart.jsx';
import { RelationshipPathChart } from './RelationshipPathChart.jsx';
import { VirtualTreeDiagram } from './VirtualTreeDiagram.jsx';
import { VirtualTree3D, SYMBOL_MODES, COLOR_MODES, DOF_DEFAULTS } from './VirtualTree3D.jsx';
import { useChartObjectCommands } from './useChartObjectCommands.js';
import { useModal } from '../../contexts/ModalContext.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import {
  CircularAncestorChart,
  DistributionChart,
  TimelineChart,
  RadialDescendantTimelineChart,
  LifespanDescendantChart,
  GenogramChart,
  SociogramChart,
  FractalAncestorChart,
} from './SpecializedCharts.jsx';
import { StatisticsChart } from './StatisticsChart.jsx';
import { ChartSelectionProvider } from './ChartSelectionContext.jsx';
import { ChartContentProvider, DEFAULT_CHART_CONTENT, loadChartPortraits } from './ChartContentContext.jsx';
import { PersonSidePanel } from './PersonSidePanel.jsx';
import { ChartObjectInspector } from './ChartObjectInspector.jsx';
import { Field, RangeField, CheckOption, SelectOption, Section } from './parts/FormFields.jsx';
import { RelationshipPathControls } from './parts/RelationshipPathControls.jsx';
import { ChartPersonBrowser } from './parts/ChartPersonBrowser.jsx';
import { ChartBottomToolbar } from './parts/ChartBottomToolbar.jsx';
import { ChartOptionsPanel } from './parts/ChartOptionsPanel.jsx';
import { buildGenerationIndex, chartColorForPerson } from './coloring.js';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils.js';
import { useExportSettings } from './hooks/useExportSettings.js';
import { usePageSetup } from './hooks/usePageSetup.js';
import { useVirtualTreeOptions } from './hooks/useVirtualTreeOptions.js';
import { useRelationshipPaths } from './hooks/useRelationshipPaths.js';
import { useChartDocument } from './hooks/useChartDocument.js';
import { copyTextToClipboard } from '../../lib/clipboard.js';

// Compact trigger override for ui/Select when it sits in the dense option
// panels/popovers (matches the compact Input size).
const COMPACT_SELECT_TRIGGER = 'h-8 ps-2 text-xs';

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
  const modal = useModal();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { recordName: sharedRootId, setActivePerson } = useActivePerson();
  const [persons, setPersons] = useState([]);
  // Record names flagged private (`isPrivate`). The chart data source filters
  // these out when "Hide Information marked as Private" is on. Derived by
  // diffing the private-inclusive person list against the public-only one,
  // since person summaries don't carry a privacy flag of their own.
  const [privateIds, setPrivateIds] = useState(() => new Set());
  const [rootId, setRootId] = useState(searchParams.get('person') || sharedRootId);
  const [secondId, setSecondId] = useState(searchParams.get('second') || null);
  const [chartType, setChartType] = useState(searchParams.get('type') || 'ancestor');
  const [generations, setGenerations] = useState(Math.min(8, Math.max(2, Number(searchParams.get('gen')) || 5)));
  const [chartClickAction, setChartClickAction] = useState(searchParams.get('click') || 'reroot');
  const [themeId, setThemeId] = useState('auto');
  const [completenessColorMode, setCompletenessColorMode] = useState('gender');
  const [completenessRowsByPerson, setCompletenessRowsByPerson] = useState(new Map());
  const [coloringMode, setColoringMode] = useState('gender');
  const [chartContent, setChartContent] = useState(DEFAULT_CHART_CONTENT);
  const [chartPhotos, setChartPhotos] = useState(null);
  const { theme: appTheme } = useTheme();
  const {
    virtualSource, setVirtualSource,
    virtualOrientation, setVirtualOrientation,
    virtualHSpacing, setVirtualHSpacing,
    virtualVSpacing, setVirtualVSpacing,
    virtualTreeData, setVirtualTreeData,
    virtualViewMode, setVirtualViewMode,
    virtualSymbolMode, setVirtualSymbolMode,
    virtualColorMode, setVirtualColorMode,
    virtualShowGenerationBands, setVirtualShowGenerationBands,
    virtualDof, setVirtualDof,
  } = useVirtualTreeOptions();
  const [descendantGenerations, setDescendantGenerations] = useState(5);
  const [hourglassAncestorGens, setHourglassAncestorGens] = useState(4);
  const [hourglassDescendantGens, setHourglassDescendantGens] = useState(3);
  const [doubleAncestorLeftGens, setDoubleAncestorLeftGens] = useState(4);
  const [doubleAncestorRightGens, setDoubleAncestorRightGens] = useState(4);
  const [fanArcDegrees, setFanArcDegrees] = useState(180);
  const [ancestorBranch, setAncestorBranch] = useState('both');
  const [timelineData, setTimelineData] = useState(null);
  const [genogramData, setGenogramData] = useState(null);
  const [distributionData, setDistributionData] = useState(null);
  const [distributionType, setDistributionType] = useState('gender');
  const [distributionRelativeValues, setDistributionRelativeValues] = useState(false);
  const [distributionGraphType, setDistributionGraphType] = useState('bar');
  const [distributionFromYear, setDistributionFromYear] = useState('');
  const [distributionToYear, setDistributionToYear] = useState('');
  const [sociogramData, setSociogramData] = useState(null);
  const [sociogramConfig, setSociogramConfig] = useState({
    showParents: true,
    showGrandparents: false,
    showPartners: true,
    showChildren: true,
    showAssociateRelationsOfStartPerson: true,
    showAssociateRelationsOfPartners: false,
    showAssociateRelationsOfChildren: false,
    associatedPersonsSpacing: 80,
  });
  const [timelineGrouping, setTimelineGrouping] = useState('none');
  const [timelineCollapse, setTimelineCollapse] = useState(true);
  const [timelineMarkerMode, setTimelineMarkerMode] = useState('bar');
  const {
    currentDocumentId, setCurrentDocumentId,
    currentDocumentName, setCurrentDocumentName,
    isDirty, setIsDirty,
    isReadOnly, setIsReadOnly,
    dirtyGuardRef,
  } = useChartDocument();
  const {
    exportFormat, setExportFormat,
    exportScale, setExportScale,
    exportIncludeBackground, setExportIncludeBackground,
    exportJpegQuality, setExportJpegQuality,
    exportFileNameTemplate, setExportFileNameTemplate,
  } = useExportSettings();
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
  } = usePageSetup();
  const [ancestorTree, setAncestorTree] = useState(null);
  const [descendantTree, setDescendantTree] = useState(null);
  const [secondAncestorTree, setSecondAncestorTree] = useState(null);
  const {
    relationshipPaths, setRelationshipPaths,
    selectedRelationshipPathId, setSelectedRelationshipPathId,
    relationshipBloodlineOnly, setRelationshipBloodlineOnly,
    relationshipMaxPaths, setRelationshipMaxPaths,
    relationshipMaxDepth, setRelationshipMaxDepth,
    relationshipExcludeNonBiological, setRelationshipExcludeNonBiological,
  } = useRelationshipPaths();
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  // Which group of options is visible in the "More" popover. The popover used
  // to stack ~14 unrelated Sections vertically; the tab strip splits them into
  // View / Layout / Page / Library / Overlays / Export so the panel scans at
  // a glance on both desktop and mobile.
  const [morePopoverTab, setMorePopoverTab] = useState('view');
  const [findText, setFindText] = useState('');
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
  const [panelPersonId, setPanelPersonId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [qrShare, setQrShare] = useState(null);
  const chartCanvasRef = useRef(null);
  const {
    overlays,
    selectedOverlayId,
    hasUndo,
    hasRedo,
    setFromSource,
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
  } = useChartObjectCommands([]);
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
  };
  const chartTitleOrDefault = chartTitle || 'chart';

  // Dirty tracking — flip isDirty when persisted chart state actually differs
  // from the last loaded/saved baseline.
  //
  // Signature of everything currentDocumentState persists. Comparing against a
  // baseline is what makes this reliable: a one-shot guard could only absorb
  // the first sweep, but chart state settles asynchronously (the root person
  // resolves from the tree after mount), so later settling writes marked a
  // freshly opened chart dirty and produced a beforeunload prompt on a chart
  // nobody had edited.
  const dirtySignature = JSON.stringify([
    chartType, rootId, secondId, themeId, generations, descendantGenerations,
    hourglassAncestorGens, hourglassDescendantGens, doubleAncestorLeftGens,
    doubleAncestorRightGens, fanArcDegrees, ancestorBranch, virtualSource,
    virtualOrientation, virtualHSpacing, virtualVSpacing, chartTitle,
    chartNote, pageSize, pageOrientation, chartBackground,
    relationshipBloodlineOnly, selectedRelationshipPathId, overlays,
    pageMargins, pagePrintMargins, pageOverlap, pageCutMarks,
    pagePrintPageNumbers, pageOmitEmptyPages, coloringMode, chartContent,
    distributionType, distributionRelativeValues, distributionGraphType,
    distributionFromYear, distributionToYear, sociogramConfig,
    timelineGrouping, timelineCollapse, timelineMarkerMode,
  ]);

  useEffect(() => {
    if (dirtyGuardRef.current === null || dirtyGuardRef.current === true) {
      // Fresh mount, or an explicit load/save asked for a re-baseline. Hold off
      // until the chart has a root person: on a cold load rootId starts null
      // and resolves from the tree a tick later, and baselining before that
      // recorded null as "clean", so the resolution itself looked like an edit.
      if (dirtyGuardRef.current === null && !rootId) return;
      dirtyGuardRef.current = dirtySignature;
      return;
    }
    if (dirtyGuardRef.current !== dirtySignature) setIsDirty(true);
  }, [dirtySignature, rootId, dirtyGuardRef, setIsDirty]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    setOrDelete(next, 'type', chartType, 'ancestor');
    setOrDelete(next, 'person', rootId);
    setOrDelete(next, 'second', needsSecond ? secondId : null);
    setOrDelete(next, 'gen', generations === 5 ? null : String(generations));
    setOrDelete(next, 'click', chartClickAction === 'reroot' ? null : chartClickAction);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [chartClickAction, chartType, generations, needsSecond, rootId, searchParams, secondId, setSearchParams]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

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
  }, [setActivePerson]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  // Edit lifecycle: applyDocumentState/onSaveDocument ask for a re-baseline so
  // loading or saving doesn't instantly flip the flag back on.
  const suppressDirtyOnce = useCallback(() => {
    dirtyGuardRef.current = true;
  }, []);

  const applyDocumentState = useCallback((doc, options = {}) => {
    if (!doc || typeof doc !== 'object') return;
    const normalized = normalizeChartDocument(doc);
    suppressDirtyOnce();
    setCurrentDocumentId(normalized.id || null);
    setCurrentDocumentName(normalized.name || '');
    setIsDirty(false);
    setIsReadOnly(Boolean(options.readOnly) || Boolean(normalized.importedMac?.sourceRecordName && options.readOnly !== false && options.fromImport));
    const nextGenerations = Math.max(2, Math.min(8, Number(normalized.builderConfig.common.generations) || 5));
    setChartType(normalized.chartType || 'ancestor');
    if (normalized.roots.primaryPersonId) {
      setRootId(normalized.roots.primaryPersonId);
      setActivePerson(normalized.roots.primaryPersonId);
    }
    setSecondId(normalized.roots.secondaryPersonId || null);
    setThemeId(normalized.compositorConfig.themeId || 'auto');
    setGenerations(nextGenerations);
    setColoringMode(normalized.builderConfig.common?.coloringMode || 'gender');
    setChartContent({ ...DEFAULT_CHART_CONTENT, ...(normalized.builderConfig.common?.chartContent || {}) });
    const common = normalized.builderConfig.common || {};
    if (common.distributionType) setDistributionType(common.distributionType);
    setDistributionRelativeValues(Boolean(common.distributionRelativeValues));
    setDistributionGraphType(common.distributionGraphType === 'line' ? 'line' : 'bar');
    setDistributionFromYear(common.distributionFromYear ?? '');
    setDistributionToYear(common.distributionToYear ?? '');
    if (common.sociogramConfig && typeof common.sociogramConfig === 'object') {
      setSociogramConfig((current) => ({ ...current, ...common.sociogramConfig }));
    }
    if (common.timelineGrouping) setTimelineGrouping(common.timelineGrouping);
    setTimelineCollapse(common.timelineCollapse !== false);
    setTimelineMarkerMode(common.timelineMarkerMode === 'event' ? 'event' : 'bar');
    setVirtualSource(normalized.builderConfig.virtual?.source || 'descendant');
    setVirtualOrientation(normalized.builderConfig.virtual?.orientation || 'vertical');
    setVirtualHSpacing(normalized.builderConfig.virtual?.hSpacing || 24);
    setVirtualVSpacing(normalized.builderConfig.virtual?.vSpacing || 110);
    setChartTitle(normalized.pageSetup.title || normalized.name || '');
    setChartNote(normalized.pageSetup.note || '');
    setPageSize(normalized.pageSetup.paperSize || 'letter');
    setPageOrientation(normalized.pageSetup.orientation || 'landscape');
    setChartBackground(normalized.pageSetup.backgroundColor || '');
    setPageMargins({
      top: normalized.pageSetup.margins?.top ?? 36,
      right: normalized.pageSetup.margins?.right ?? 36,
      bottom: normalized.pageSetup.margins?.bottom ?? 36,
      left: normalized.pageSetup.margins?.left ?? 36,
    });
    setPagePrintMargins({
      top: normalized.pageSetup.printMargins?.top ?? normalized.pageSetup.margins?.top ?? 36,
      right: normalized.pageSetup.printMargins?.right ?? normalized.pageSetup.margins?.right ?? 36,
      bottom: normalized.pageSetup.printMargins?.bottom ?? normalized.pageSetup.margins?.bottom ?? 36,
      left: normalized.pageSetup.printMargins?.left ?? normalized.pageSetup.margins?.left ?? 36,
    });
    setPageOverlap(Number(normalized.pageSetup.overlap) || 0);
    setPageCutMarks(Boolean(normalized.pageSetup.cutMarks));
    setPagePrintPageNumbers(Boolean(normalized.pageSetup.printPageNumbers));
    setPageOmitEmptyPages(normalized.pageSetup.omitEmptyPages !== false);
    if (normalized.exportSettings) {
      setExportFormat(normalized.exportSettings.format || 'png');
      setExportScale(Number(normalized.exportSettings.scale) || 1);
      setExportJpegQuality(Number(normalized.exportSettings.jpegQuality) || 0.92);
      setExportIncludeBackground(normalized.exportSettings.includeBackground !== false);
      setExportFileNameTemplate(normalized.exportSettings.fileNameTemplate || '{title}-{date}');
    }
    const relationshipConfig = normalized.builderConfig.relationship || {};
    setRelationshipBloodlineOnly(Boolean(relationshipConfig.bloodlineOnly));
    setSelectedRelationshipPathId(relationshipConfig.selectedPathId || null);
    setFromSource(Array.isArray(normalized.compositorConfig.overlays) ? normalized.compositorConfig.overlays : [], {
      preserveSelection: options.preserveSelection ?? false,
    });
  }, [setActivePerson, setFromSource]);

  useEffect(() => {
    (async () => {
    const [list, publicList] = await Promise.all([
        listAllPersons({ includePrivate: true }),
        listAllPersons(),
      ]);
      const docs = await listChartDocuments();
      const tpls = await listChartTemplates();
      const completenessRows = await loadCompletenessRowsByPerson();
      const publicIds = new Set(publicList.map((person) => person.recordName));
      setPrivateIds(new Set(
        list.filter((person) => !publicIds.has(person.recordName)).map((person) => person.recordName)
      ));
      setPersons(list);
      setCompletenessRowsByPerson(completenessRows);
      setTemplates(tpls);
      setDocuments(docs);
      const importedRecord = searchParams.get('imported');
      const requestedDocId = searchParams.get('document');
      const requestedTemplateId = searchParams.get('template');
      let requestedDoc = null;

      if (importedRecord) {
        try {
          requestedDoc = await loadSavedChartDocument(importedRecord);
        } catch (_error) {
          requestedDoc = null;
        }
      } else if (requestedDocId) {
        requestedDoc = docs.find((doc) => doc.id === requestedDocId);
      } else if (requestedTemplateId) {
        requestedDoc = tpls.find((tpl) => tpl.id === requestedTemplateId);
      }

      if (requestedDoc) {
        applyDocumentState(requestedDoc, { fromImport: Boolean(importedRecord) });
      }
      if (list.length === 0) {
        setEmpty(true);
        setLoading(false);
        return;
      }
      const requestedRootId = requestedDoc ? normalizeChartDocument(requestedDoc).roots.primaryPersonId : searchParams.get('person');
      const desiredRootId = requestedRootId || rootId;
      if (!desiredRootId || !list.some((p) => p.recordName === desiredRootId)) {
        const start = await findStartPerson();
        const pick = start?.recordName || list[0].recordName;
        setRootId(pick);
        setActivePerson(pick);
      } else if (requestedRootId) {
        setActivePerson(requestedRootId);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build trees as inputs change.
  // Ancestor depth follows the relevant per-chart ancestor count so hourglass
  // can keep its ancestor ring small while the main ancestor chart uses the
  // user's full `generations` slider. Descendant depth follows the matching
  // per-chart descendant count so descendant/genogram/sociogram charts no
  // longer get silently clamped to 4 generations.
  const ancestorDepth = chartType === 'hourglass'
    ? hourglassAncestorGens
    : chartType === 'double-ancestor'
      ? doubleAncestorLeftGens
      : generations;
  const descendantDepth = chartType === 'hourglass'
    ? hourglassDescendantGens
    : chartType === 'descendant' || chartType === 'genogram' || chartType === 'sociogram' || chartType === 'tree' || chartType === 'symmetrical' || chartType === 'family-chart' || chartType === 'radial-descendant' || chartType === 'lifespan'
      ? descendantGenerations
      : descendantGenerations;

  useEffect(() => {
    if (!rootId) return;
    let cancelled = false;
    (async () => {
      const ancestorOptions = chartType === 'ancestor' || chartType === 'fan' || chartType === 'circular'
        || chartType === 'fractal-tree' || chartType === 'fractal-h-tree' || chartType === 'square-tree'
        ? { branch: ancestorBranch }
        : undefined;
      const a = await buildAncestorTree(rootId, ancestorDepth, ancestorOptions);
      const d = await buildDescendantTree(rootId, descendantDepth);
      if (!cancelled) {
        setAncestorTree(a);
        setDescendantTree(d);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootId, ancestorDepth, descendantDepth, chartType, ancestorBranch]);

  useEffect(() => {
    if (!secondId || !needsSecond) {
      setSecondAncestorTree(null);
      setRelationshipPaths([]);
      setSelectedRelationshipPathId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      if (chartType === 'double-ancestor') {
        const a2 = await buildAncestorTree(secondId, doubleAncestorRightGens);
        if (!cancelled) setSecondAncestorTree(a2);
      } else if (chartType === 'relationship') {
        const result = await findRelationshipPaths(rootId, secondId, {
          bloodlineOnly: relationshipBloodlineOnly,
          maxPaths: relationshipMaxPaths,
          maxDepth: relationshipMaxDepth,
          excludeNonBiological: relationshipExcludeNonBiological,
        });
        if (!cancelled) {
          const paths = result.paths || [];
          setRelationshipPaths(paths);
          setSelectedRelationshipPathId((current) => {
            if (current && paths.some((path) => path.id === current)) return current;
            return result.selectedPathId || paths[0]?.id || null;
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [secondId, chartType, generations, doubleAncestorRightGens, needsSecond, rootId, relationshipBloodlineOnly, relationshipMaxPaths, relationshipMaxDepth, relationshipExcludeNonBiological]);

  // Build record-backed timeline/genogram data from chartData builders when the
  // active chart needs events/facts. The builders query PersonEvent,
  // FamilyEvent, PersonFact, AssociateRelation so the rendered chart reflects
  // more than the ancestor/descendant tree skeleton.
  useEffect(() => {
    if (chartType !== 'timeline') { setTimelineData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildTimelineData({
          rootPersonId: rootId || null,
          grouping: timelineGrouping,
          collapseForBestFit: timelineCollapse,
          markerMode: timelineMarkerMode,
        });
        if (!cancelled) setTimelineData(data);
      } catch (_error) {
        if (!cancelled) setTimelineData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId, timelineGrouping, timelineCollapse, timelineMarkerMode]);

  useEffect(() => {
    if (chartType !== 'genogram') { setGenogramData(null); return undefined; }
    if (!rootId) { setGenogramData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildGenogramData({ rootPersonId: rootId, generations: descendantGenerations });
        if (!cancelled) setGenogramData(data);
      } catch (_error) {
        if (!cancelled) setGenogramData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId, descendantGenerations]);

  // Sociogram uses its own builder (buildSociogramData) so the relationship
  // inclusion toggles (parents/grandparents/partners/children/associates) and
  // the associated-persons spacing slider drive a dedicated social-graph
  // render rather than reusing the genogram descendant pipeline.
  useEffect(() => {
    if (chartType !== 'sociogram') { setSociogramData(null); return undefined; }
    if (!rootId) { setSociogramData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildSociogramData({ rootPersonId: rootId, ...sociogramConfig });
        if (!cancelled) setSociogramData(data);
      } catch (_error) {
        if (!cancelled) setSociogramData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId, sociogramConfig]);

  useEffect(() => {
    if (chartType !== 'distribution') { setDistributionData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const fromYear = Number.parseInt(distributionFromYear, 10);
        const toYear = Number.parseInt(distributionToYear, 10);
        const data = await buildDistributionData({
          distributionType,
          relativeValues: distributionRelativeValues,
          graphType: distributionGraphType,
          fromYear: Number.isFinite(fromYear) ? fromYear : null,
          toYear: Number.isFinite(toYear) ? toYear : null,
        });
        if (!cancelled) setDistributionData(data);
      } catch (_error) {
        if (!cancelled) setDistributionData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, distributionType, distributionRelativeValues, distributionGraphType, distributionFromYear, distributionToYear]);

  useEffect(() => {
    if (chartType !== 'virtual') { setVirtualTreeData(null); return undefined; }
    if (!rootId) { setVirtualTreeData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildVirtualTreeData({
          rootPersonId: rootId,
          collectMode: virtualSource,
          generations,
          hSpacing: virtualHSpacing,
          vSpacing: virtualVSpacing,
          orientation: virtualOrientation,
          symbolMode: virtualSymbolMode,
          colorMode: virtualColorMode,
        });
        if (!cancelled) setVirtualTreeData(data);
      } catch (_error) {
        if (!cancelled) setVirtualTreeData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId, virtualSource, generations, virtualHSpacing, virtualVSpacing, virtualOrientation, virtualSymbolMode, virtualColorMode]);

  const selectedRelationshipResult = useMemo(() => (
    relationshipPaths.find((path) => path.id === selectedRelationshipPathId) || relationshipPaths[0] || null
  ), [relationshipPaths, selectedRelationshipPathId]);

  // Record names participating in the currently selected relationship path,
  // for highlighting inside the Virtual Tree 3D renderer.
  const relationshipPathIds = useMemo(() => {
    const steps = selectedRelationshipResult?.steps;
    if (!Array.isArray(steps)) return [];
    return steps.map((step) => step.recordName).filter(Boolean);
  }, [selectedRelationshipResult]);

  const virtualLayoutOptions = useMemo(() => ({
    hSpacing: virtualHSpacing,
    vSpacing: virtualVSpacing,
    orientation: virtualOrientation,
  }), [virtualHSpacing, virtualVSpacing, virtualOrientation]);

  const generationIndex = useMemo(
    () => buildGenerationIndex({ ancestorTree, descendantTree }),
    [ancestorTree, descendantTree]
  );

  // Load portraits for the charted persons when "Show portraits" is on (#25).
  useEffect(() => {
    if (!chartContent.showPortraits) { setChartPhotos(null); return undefined; }
    let cancelled = false;
    const ids = [...(generationIndex?.byId?.keys() || [])];
    loadChartPortraits(ids).then((map) => { if (!cancelled) setChartPhotos(map); }).catch(() => {});
    return () => { cancelled = true; };
  }, [chartContent.showPortraits, generationIndex]);

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
    [chartClickAction, openPersonInPanel, setActivePerson]
  );
  const onRootChange = useCallback(
    (id) => {
      setRootId(id);
      setActivePerson(id);
    },
    [setActivePerson]
  );

  const onSaveTemplate = useCallback(async () => {
    const name = await modal.prompt('Name for this chart template:', '', { title: 'Save chart template' });
    if (!name) return;
    const tpl = {
      id: newTemplateId(),
      name,
      chartType,
      themeId,
      generations,
      title: chartTitle,
      note: chartNote,
      page: { size: pageSize, orientation: pageOrientation, backgroundColor: chartBackground },
    };
    await saveChartTemplate(tpl);
    setTemplates(await listChartTemplates());
  }, [chartType, themeId, generations, chartTitle, chartNote, pageSize, pageOrientation, chartBackground, modal]);

  const confirmDiscardIfDirty = useCallback(async (action = 'load') => {
    if (!isDirty) return true;
    const verb = action === 'new' ? 'start a new chart' : action === 'load' ? 'load this chart' : 'continue';
    return await modal.confirm(`You have unsaved changes. Save changes to chart?\n\nClick Cancel to keep editing, OK to discard changes and ${verb}.`, { title: 'Unsaved changes', okLabel: 'Discard changes' });
  }, [isDirty, modal]);

  const onApplyTemplate = useCallback(async (id) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (!(await confirmDiscardIfDirty('load'))) return;
    setChartType(tpl.chartType);
    setThemeId(tpl.themeId);
    setGenerations(tpl.generations);
    setChartTitle(tpl.title || '');
    setChartNote(tpl.note || '');
    setPageSize(tpl.page?.size || 'letter');
    setPageOrientation(tpl.page?.orientation || 'landscape');
    setChartBackground(tpl.page?.backgroundColor || '');
  }, [templates, confirmDiscardIfDirty]);

  const currentDocumentState = useCallback((name, id = newChartDocumentId()) => normalizeChartDocument({
    id,
    name,
    chartType,
    roots: {
      primaryPersonId: rootId,
      secondaryPersonId: secondId,
    },
    builderConfig: {
      common: {
        generations,
        coloringMode,
        chartContent,
        distributionType,
        distributionRelativeValues,
        distributionGraphType,
        distributionFromYear,
        distributionToYear,
        sociogramConfig,
        timelineGrouping,
        timelineCollapse,
        timelineMarkerMode,
      },
      relationship: {
        bloodlineOnly: relationshipBloodlineOnly,
        selectedPathId: selectedRelationshipPathId,
      },
      virtual: {
        source: virtualSource,
        orientation: virtualOrientation,
        hSpacing: virtualHSpacing,
        vSpacing: virtualVSpacing,
      },
    },
    compositorConfig: {
      themeId,
      overlays,
      selectedObjectIds: selectedOverlayId ? [selectedOverlayId] : [],
    },
    pageSetup: {
      title: chartTitle,
      note: chartNote,
      paperSize: pageSize,
      orientation: pageOrientation,
      backgroundColor: chartBackground,
      margins: pageMargins,
      printMargins: pagePrintMargins,
      overlap: pageOverlap,
      cutMarks: pageCutMarks,
      printPageNumbers: pagePrintPageNumbers,
      omitEmptyPages: pageOmitEmptyPages,
    },
    exportSettings: {
      format: exportFormat,
      scale: exportScale,
      includeBackground: exportIncludeBackground,
      jpegQuality: exportJpegQuality,
      fileNameTemplate: exportFileNameTemplate,
    },
  }), [chartType, rootId, secondId, themeId, generations, virtualSource, virtualOrientation, virtualHSpacing, virtualVSpacing, chartTitle, chartNote, pageSize, pageOrientation, chartBackground, relationshipBloodlineOnly, selectedRelationshipPathId, overlays, selectedOverlayId, pageMargins, pagePrintMargins, pageOverlap, pageCutMarks, pagePrintPageNumbers, pageOmitEmptyPages, exportFormat, exportScale, exportIncludeBackground, exportJpegQuality, exportFileNameTemplate, coloringMode, chartContent, distributionType, distributionRelativeValues, distributionGraphType, distributionFromYear, distributionToYear, sociogramConfig, timelineGrouping, timelineCollapse, timelineMarkerMode]);

  const buildChartShareUrl = useCallback(async () => {
    const doc = currentDocumentState(currentDocumentName || 'Shared Chart', currentDocumentId || 'shared');
    return buildShareUrl(doc, {
      baseUrl: window.location.origin,
      basePath: import.meta.env?.BASE_URL || '/',
    });
  }, [currentDocumentState, currentDocumentName, currentDocumentId]);

  const onCopyShareLink = useCallback(async () => {
    if (!rootId) {
      await modal.alert('Select a root person before creating a share link.');
      return;
    }
    try {
      const { url, token } = await buildChartShareUrl();
      const copied = await copyTextToClipboard(url);
      if (!copied) {
        // Clipboard unavailable (insecure origin / permission denied) — show
        // the link so the user can copy it manually.
        await modal.prompt('Copy the share link:', url, { title: 'Share link' });
        return;
      }
      const size = Math.round(token.length / 1024 * 10) / 10;
      modal.toast(`Token size: ~${size}KB\nLink length: ${url.length.toLocaleString()} characters`, {
        title: 'Share link copied',
        kind: 'success',
      });
    } catch (error) {
      console.error('[ChartsApp] share-link failed', error);
      await modal.alert(`Share link failed: ${error.message}`, { title: 'Share link failed' });
    }
  }, [rootId, buildChartShareUrl, modal]);

  const onShareChart = useCallback(async () => {
    if (!rootId) {
      await modal.alert('Select a root person before sharing.');
      return;
    }
    try {
      const { url } = await buildChartShareUrl();
      const title = currentDocumentName || chartTitle || 'Family chart';
      if (navigator.share) {
        await navigator.share({ title, text: `View ${title}`, url });
        return;
      }
      const copied = await copyTextToClipboard(url);
      await modal.alert(
        copied
          ? `Share dialog not supported on this browser. Link copied:\n\n${url}`
          : `Share dialog not supported on this browser. Copy the link manually:\n\n${url}`,
        { title: 'Share' }
      );
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('[ChartsApp] share failed', error);
      await modal.alert(`Share failed: ${error.message}`, { title: 'Share failed' });
    }
  }, [rootId, buildChartShareUrl, currentDocumentName, chartTitle, modal]);

  const onShareByEmail = useCallback(async () => {
    if (!rootId) {
      await modal.alert('Select a root person before sharing.');
      return;
    }
    try {
      const { url } = await buildChartShareUrl();
      const title = currentDocumentName || chartTitle || 'Family chart';
      const subject = encodeURIComponent(title);
      const body = encodeURIComponent(`${title}\n\n${url}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (error) {
      console.error('[ChartsApp] share-email failed', error);
      await modal.alert(`Email share failed: ${error.message}`, { title: 'Email share failed' });
    }
  }, [rootId, buildChartShareUrl, currentDocumentName, chartTitle, modal]);

  const onShowShareQr = useCallback(async () => {
    if (!rootId) {
      await modal.alert('Select a root person before creating a QR code.');
      return;
    }
    try {
      const { url } = await buildChartShareUrl();
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 240 });
      setQrShare({ url, dataUrl, title: currentDocumentName || chartTitle || 'Family chart' });
    } catch (error) {
      await modal.alert(`QR code failed: ${error.message}`, { title: 'QR code failed' });
    }
  }, [rootId, buildChartShareUrl, currentDocumentName, chartTitle, modal]);

  const onSaveDocument = useCallback(async () => {
    if (isReadOnly) {
      await modal.alert('This chart is read-only (imported). Use "Save as new…" to make an editable copy.', { title: 'Read-only chart' });
      return;
    }
    if (currentDocumentId) {
      suppressDirtyOnce();
      await saveChartDocument(currentDocumentState(currentDocumentName || 'Untitled Chart', currentDocumentId));
      setDocuments(await listChartDocuments());
      setIsDirty(false);
      return;
    }
    const name = await modal.prompt('Name for this chart document:', '', { title: 'Save chart document' });
    if (!name) return;
    suppressDirtyOnce();
    const id = newChartDocumentId();
    await saveChartDocument(currentDocumentState(name, id));
    setCurrentDocumentId(id);
    setCurrentDocumentName(name);
    setDocuments(await listChartDocuments());
    setIsDirty(false);
  }, [currentDocumentState, currentDocumentId, currentDocumentName, isReadOnly, suppressDirtyOnce, modal]);

  const onSaveAsDocument = useCallback(async () => {
    const name = await modal.prompt('Save as new chart — name:', currentDocumentName || '', { title: 'Save as new chart' });
    if (!name) return;
    suppressDirtyOnce();
    const id = newChartDocumentId();
    await saveChartDocument(currentDocumentState(name, id));
    setCurrentDocumentId(id);
    setCurrentDocumentName(name);
    setIsReadOnly(false);
    setDocuments(await listChartDocuments());
    setIsDirty(false);
  }, [currentDocumentState, currentDocumentName, suppressDirtyOnce, modal]);

  const onApplyDocument = useCallback(async (id) => {
    const doc = documents.find((item) => item.id === id);
    if (!doc) return;
    if (!(await confirmDiscardIfDirty('load'))) return;
    applyDocumentState(doc, { preserveSelection: false });
  }, [applyDocumentState, confirmDiscardIfDirty, documents]);

  const onNewChart = useCallback(async () => {
    if (!(await confirmDiscardIfDirty('new'))) return;
    suppressDirtyOnce();
    setCurrentDocumentId(null);
    setCurrentDocumentName('');
    setIsReadOnly(false);
    setIsDirty(false);
    setFromSource([], { preserveSelection: false });
    setChartTitle('');
    setChartNote('');
    setChartBackground('');
  }, [confirmDiscardIfDirty, setFromSource, suppressDirtyOnce]);

  const onFinishEditing = useCallback(async () => {
    if (isDirty) {
      const save = await modal.confirm('Save changes before finishing?', {
        title: 'Finish editing',
        okLabel: 'Save',
        cancelLabel: 'Discard',
      });
      if (save) {
        await onSaveDocument();
      } else {
        suppressDirtyOnce();
        setIsDirty(false);
      }
    }
    setIsReadOnly(true);
  }, [isDirty, modal, onSaveDocument, suppressDirtyOnce]);

  const onDeleteDocument = useCallback(async (id) => {
    if (!(await modal.confirm('Delete this chart document?', { title: 'Delete chart', okLabel: 'Delete', destructive: true }))) return;
    await deleteChartDocument(id);
    setDocuments(await listChartDocuments());
  }, [modal]);

  const onDeleteTemplate = useCallback(async (id) => {
    if (!(await modal.confirm('Delete this template?', { title: 'Delete template', okLabel: 'Delete', destructive: true }))) return;
    await deleteChartTemplate(id);
    setTemplates(await listChartTemplates());
  }, [modal]);

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

  const onFindPerson = useCallback(() => {
    const needle = findText.trim();
    if (!needle) return;
    const match = persons.find((person) => {
      const fullName = String(person.fullName || `${person.firstName || ''} ${person.lastName || ''}`);
      return matchesSearchText(fullName, needle) || matchesSearchText(person.recordName, needle);
    });
    if (!match) return;
    setRootId(match.recordName);
    setActivePerson(match.recordName);
    focusRootInCanvas();
  }, [focusRootInCanvas, findText, persons, setActivePerson]);

  const exportSettings = useMemo(() => ({
    format: exportFormat,
    scale: exportScale,
    includeBackground: exportIncludeBackground,
    jpegQuality: exportJpegQuality,
    fileNameTemplate: exportFileNameTemplate,
  }), [exportFormat, exportScale, exportIncludeBackground, exportJpegQuality, exportFileNameTemplate]);

  // People available to the chart's data sources (person browser, picker,
  // distribution chart). When "Hide Information marked as Private" is on we drop
  // records flagged private so the rendered chart — and therefore exports —
  // never surface them.
  const chartPersons = useMemo(() => (
    hidePrivateChartInfo && privateIds.size
      ? persons.filter((person) => !privateIds.has(person.recordName))
      : persons
  ), [persons, privateIds, hidePrivateChartInfo]);

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
  if (empty) {
    return (
      <div className={LOADING_CLASSES}>
        No family data found. <Link to="/" className="ms-1.5 text-primary">Import a .mftpkg</Link> first.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex flex-wrap items-end gap-2 border-b border-border bg-card px-5 py-3">
        <Field label="Person">
          <PersonPicker persons={chartPersons} value={rootId} onChange={onRootChange} />
        </Field>

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

        <Field label="Type">
          <Select
            value={chartType}
            onChange={setChartType}
            options={CHART_TYPES.map((type) => ({ value: type.id, label: type.label }))}
            align="start"
          />
        </Field>

        <Field label="Gen" hideOnNarrow>
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
          <Button size="md" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
            More ▾
          </Button>
          {moreOpen && (
            <div className="absolute end-0 top-[calc(100%+6px)] z-20 w-[380px] max-w-[calc(100vw-24px)] max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card p-3.5 text-card-foreground shadow-lg">
              <div className="no-scrollbar -mx-0.5 mb-2.5 flex gap-0.5 overflow-x-auto border-b border-border" role="tablist" aria-label="Chart options">
                {[
                  ['view', 'View'],
                  ['layout', 'Layout'],
                  ['page', 'Page'],
                  ['library', 'Library'],
                  ['overlays', 'Overlays'],
                  ['export', 'Export'],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={morePopoverTab === id}
                    onClick={() => setMorePopoverTab(id)}
                    className={morePopoverTabClasses(morePopoverTab === id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {morePopoverTab === 'view' && (<>
              <Section label="Theme">
                <Select
                  value={themeId}
                  onChange={setThemeId}
                  options={THEMES.map((themeOption) => ({ value: themeOption.id, label: themeOption.name }))}
                  triggerClassName={COMPACT_SELECT_TRIGGER}
                />
              </Section>
              <Section label="Research overlay">
                <Select
                  value={completenessColorMode}
                  onChange={setCompletenessColorMode}
                  options={COMPLETENESS_COLOR_MODES.map((mode) => ({ value: mode.id, label: mode.label }))}
                  triggerClassName={COMPACT_SELECT_TRIGGER}
                />
                {COMPLETENESS_LEGEND[completenessColorMode] && (
                  <div className="mt-2 grid gap-1">
                    {COMPLETENESS_LEGEND[completenessColorMode].map(([color, label]) => (
                      <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section label="Chart interaction">
                <Select
                  value={chartClickAction}
                  onChange={setChartClickAction}
                  options={[
                    { value: 'reroot', label: 'Click person to re-root' },
                    { value: 'panel', label: 'Click person to inspect' },
                  ]}
                  triggerClassName={COMPACT_SELECT_TRIGGER}
                />
              </Section>
              </>)}

              {morePopoverTab === 'layout' && (<>
              <Section label="Generations">
                <Input
                  compact
                  type="number"
                  min={2}
                  max={8}
                  value={generations}
                  onChange={(e) => setGenerations(Math.min(8, Math.max(2, +e.target.value || 5)))}
                />
              </Section>

              {(chartType === 'descendant' || chartType === 'tree' || chartType === 'symmetrical' || chartType === 'family-chart' || chartType === 'radial-descendant' || chartType === 'lifespan' || chartType === 'genogram' || chartType === 'sociogram') && (
                <Section label="Descendant generations">
                  <Input
                    compact
                    type="number"
                    min={1}
                    max={8}
                    value={descendantGenerations}
                    onChange={(e) => setDescendantGenerations(Math.min(8, Math.max(1, +e.target.value || 5)))}
                  />
                </Section>
              )}

              {chartType === 'hourglass' && (
                <Section label="Hourglass generations">
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="block">
                      <div className="mb-1 text-xs text-muted-foreground">Ancestors</div>
                      <Input
                        compact
                        type="number"
                        min={1}
                        max={8}
                        value={hourglassAncestorGens}
                        onChange={(e) => setHourglassAncestorGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-muted-foreground">Descendants</div>
                      <Input
                        compact
                        type="number"
                        min={1}
                        max={8}
                        value={hourglassDescendantGens}
                        onChange={(e) => setHourglassDescendantGens(Math.min(8, Math.max(1, +e.target.value || 3)))}
                      />
                    </label>
                  </div>
                </Section>
              )}

              {chartType === 'double-ancestor' && (
                <Section label="Double ancestor generations">
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="block">
                      <div className="mb-1 text-xs text-muted-foreground">Left / Father</div>
                      <Input
                        compact
                        type="number"
                        min={1}
                        max={8}
                        value={doubleAncestorLeftGens}
                        onChange={(e) => setDoubleAncestorLeftGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-muted-foreground">Right / Mother</div>
                      <Input
                        compact
                        type="number"
                        min={1}
                        max={8}
                        value={doubleAncestorRightGens}
                        onChange={(e) => setDoubleAncestorRightGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
                      />
                    </label>
                  </div>
                </Section>
              )}

              {(chartType === 'ancestor' || chartType === 'fan' || chartType === 'circular' || chartType === 'fractal-tree' || chartType === 'fractal-h-tree' || chartType === 'square-tree') && (
                <Section label="Ancestor branches">
                  <Select
                    value={ancestorBranch}
                    onChange={setAncestorBranch}
                    options={[
                      { value: 'both', label: 'Maternal and paternal' },
                      { value: 'paternal', label: 'Only paternal' },
                      { value: 'maternal', label: 'Only maternal' },
                      { value: 'paternal-from-start', label: 'Paternal from start person' },
                      { value: 'maternal-from-start', label: 'Maternal from start person' },
                    ]}
                    triggerClassName={COMPACT_SELECT_TRIGGER}
                  />
                </Section>
              )}

              {chartType === 'fan' && (
                <Section label="Fan arc">
                  <div className="mb-1 text-xs text-muted-foreground">Arc ({fanArcDegrees}°)</div>
                  <input
                    type="range"
                    min={90}
                    max={360}
                    step={15}
                    value={fanArcDegrees}
                    onChange={(e) => setFanArcDegrees(+e.target.value)}
                    className="w-full"
                  />
                </Section>
              )}
              </>)}

              {morePopoverTab === 'page' && (<>
              <Section label="Title">
                <Input compact value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="Optional title" />
              </Section>

              <Section label="Note">
                <Input compact value={chartNote} onChange={(e) => setChartNote(e.target.value)} placeholder="Optional note" />
              </Section>

              <Section label="Page">
                <div className="grid grid-cols-2 gap-1.5">
                  <Select
                    value={pageSize}
                    onChange={setPageSize}
                    options={[
                      { value: 'letter', label: 'Letter' },
                      { value: 'a4', label: 'A4' },
                      { value: 'legal', label: 'Legal' },
                    ]}
                    triggerClassName={COMPACT_SELECT_TRIGGER}
                  />
                  <Select
                    value={pageOrientation}
                    onChange={setPageOrientation}
                    options={[
                      { value: 'landscape', label: 'Landscape' },
                      { value: 'portrait', label: 'Portrait' },
                    ]}
                    triggerClassName={COMPACT_SELECT_TRIGGER}
                  />
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <Input compact value={chartBackground} onChange={(e) => setChartBackground(e.target.value)} placeholder="CSS value or click Edit…" className="flex-1" title="CSS background color" />
                  <Button onClick={() => setBackgroundSheetOpen(true)} title="Color / gradient / image background editor">
                    Edit…
                  </Button>
                </div>
                <ChartBackgroundSheet
                  open={backgroundSheetOpen}
                  value={chartBackground}
                  onApply={(value) => { setChartBackground(value); setBackgroundSheetOpen(false); }}
                  onClose={() => setBackgroundSheetOpen(false)}
                />
                <div className="mt-1.5">
                  <Button onClick={() => setPageSetupSheetOpen(true)} className="w-full" title="Margins, overlap, cut marks, page numbers, omit empty pages, export format/scale/quality">
                    Page setup…
                  </Button>
                </div>
              </Section>
              </>)}

              {morePopoverTab === 'library' && (<>
              <Section label="Templates">
                <div className="flex gap-1.5">
                  <Select
                    value=""
                    onChange={(value) => value && onApplyTemplate(value)}
                    options={[
                      { value: '', label: 'Load saved…' },
                      ...templates.map((template) => ({ value: template.id, label: template.name })),
                    ]}
                    className="flex-1"
                    triggerClassName={COMPACT_SELECT_TRIGGER}
                  />
                  <Button onClick={onSaveTemplate}>Save</Button>
                </div>
                {templates.length > 0 && (
                  <Select
                    value=""
                    onChange={(value) => value && onDeleteTemplate(value)}
                    options={[
                      { value: '', label: 'Delete…' },
                      ...templates.map((template) => ({ value: template.id, label: template.name })),
                    ]}
                    className="mt-1.5"
                    triggerClassName={COMPACT_SELECT_TRIGGER}
                    ariaLabel="Delete a saved template"
                  />
                )}
              </Section>

              <Section label={`Documents${currentDocumentName ? ` — ${currentDocumentName}${isDirty ? ' •' : ''}${isReadOnly ? ' (read-only)' : ''}` : ''}`}>
                <div className="flex gap-1.5">
                  <Select
                    value=""
                    onChange={(value) => value && onApplyDocument(value)}
                    options={[
                      { value: '', label: 'Open…' },
                      ...documents.map((doc) => ({ value: doc.id, label: doc.name })),
                    ]}
                    className="flex-1"
                    triggerClassName={COMPACT_SELECT_TRIGGER}
                  />
                  <Button onClick={onSaveDocument} disabled={isReadOnly} title={isReadOnly ? 'Read-only — use Save as new' : currentDocumentId ? 'Overwrite existing document' : 'Save new document'}>
                    {currentDocumentId ? 'Save' : 'Save…'}
                  </Button>
                  <Button onClick={onSaveAsDocument} title="Save a new copy">Save as…</Button>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <Button onClick={onNewChart} title="Start a new blank chart. Prompts if there are unsaved changes.">New chart</Button>
                  <Button onClick={onFinishEditing} disabled={isReadOnly} title="Exit edit mode. Prompts to save unsaved changes, then locks the chart as read-only.">Finish editing</Button>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  <Button
                    onClick={onCopyShareLink}
                    title="Copy a compressed read-only link to the clipboard."
                    disabled={!rootId}
                  >
                    Copy link
                  </Button>
                  <Button
                    onClick={onShareChart}
                    title="Open the system share sheet (iOS/macOS/Android) or copy if unsupported."
                    disabled={!rootId}
                  >
                    Share…
                  </Button>
                  <Button
                    onClick={onShareByEmail}
                    title="Open a new email with the share link."
                    disabled={!rootId}
                  >
                    Email
                  </Button>
                  <Button
                    onClick={onShowShareQr}
                    title="Show a QR code for the chart share link."
                    disabled={!rootId}
                  >
                    QR
                  </Button>
                </div>
                {documents.length > 0 && (
                  <Select
                    value=""
                    onChange={(value) => value && onDeleteDocument(value)}
                    options={[
                      { value: '', label: 'Delete…' },
                      ...documents.map((doc) => ({ value: doc.id, label: doc.name })),
                    ]}
                    className="mt-1.5"
                    triggerClassName={COMPACT_SELECT_TRIGGER}
                  />
                )}
              </Section>
              </>)}

              {morePopoverTab === 'overlays' && (<>
              <Section label={`Overlays${isReadOnly ? ' (read-only)' : ''}`}>
                <div className="grid grid-cols-4 gap-1.5">
                  <Button onClick={addTextOverlay} disabled={isReadOnly}>Text</Button>
                  <Button onClick={addLineOverlay} disabled={isReadOnly}>Line</Button>
                  <Button onClick={addImageOverlay} disabled={isReadOnly}>Image</Button>
                  <Button onClick={removeSelected} disabled={!selectedOverlayId || isReadOnly}>Delete</Button>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  <Button onClick={undo} disabled={!hasUndo || isReadOnly}>Undo</Button>
                  <Button onClick={redo} disabled={!hasRedo || isReadOnly}>Redo</Button>
                  <Button onClick={() => alignHorizontal('left')} disabled={!selectedOverlayId || isReadOnly}>Align left</Button>
                  <Button onClick={() => alignHorizontal('center')} disabled={!selectedOverlayId || isReadOnly}>Align center</Button>
                </div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  <Button onClick={() => alignVertical('top')} disabled={!selectedOverlayId || isReadOnly}>Align top</Button>
                  <Button onClick={() => alignVertical('middle')} disabled={!selectedOverlayId || isReadOnly}>Align middle</Button>
                  <Button onClick={bringToFront} disabled={!selectedOverlayId || isReadOnly}>Bring to front</Button>
                  <Button onClick={sendToBack} disabled={!selectedOverlayId || isReadOnly}>Send to back</Button>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  <Button onClick={() => distributeEvenly('horizontal')} disabled={!selectedOverlayId || isReadOnly}>Distribute H</Button>
                  <Button onClick={() => distributeEvenly('vertical')} disabled={!selectedOverlayId || isReadOnly}>Distribute V</Button>
                  <Button onClick={focusRootInCanvas}>Focus root</Button>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  <Button className="whitespace-normal" onClick={() => moveAwayFromPageCuts({ paperSize: pageSize, orientation: pageOrientation })} disabled={!overlays.length || isReadOnly} title="Shift objects that cross a page-tile boundary so they fit inside one page">Away from cuts</Button>
                  <Button className="whitespace-normal" onClick={() => distributeBorderToBorder('horizontal', { paperSize: pageSize, orientation: pageOrientation })} disabled={overlays.length < 2 || isReadOnly} title="Distribute objects evenly across the page content rect">Border-to-border H</Button>
                  <Button className="whitespace-normal" onClick={() => distributeBorderToBorder('vertical', { paperSize: pageSize, orientation: pageOrientation })} disabled={overlays.length < 2 || isReadOnly} title="Distribute objects evenly from top to bottom">Border-to-border V</Button>
                </div>
              </Section>

              {selectedOverlayId && (
                <Section label="Object inspector">
                  <ChartObjectInspector
                    overlays={overlays}
                    selectedOverlayId={selectedOverlayId}
                    onUpdateOverlay={onUpdateOverlay}
                  />
                </Section>
              )}
              </>)}

              {morePopoverTab === 'export' && (<>
              <Section label="Find + Export">
                <div className="mb-1.5 grid grid-cols-[1fr_auto] gap-1.5">
                  <Input
                    compact
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="Find person name/record"
                  />
                  <Button onClick={onFindPerson}>Find</Button>
                </div>
                <div className="mb-1.5 grid grid-cols-2 gap-1.5">
                  <label className="block">
                    <div className="mb-1 text-xs text-muted-foreground">Format</div>
                    <Select
                      value={exportFormat}
                      onChange={setExportFormat}
                      options={[
                        { value: 'png', label: 'PNG' },
                        { value: 'jpeg', label: 'JPEG' },
                      ]}
                      triggerClassName={COMPACT_SELECT_TRIGGER}
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-muted-foreground">Scale ({exportScale.toFixed(2)}×)</div>
                    <input
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.25}
                      value={exportScale}
                      onChange={(e) => setExportScale(+e.target.value)}
                      className="w-full"
                    />
                  </label>
                </div>
                {exportFormat === 'jpeg' && (
                  <label className="mb-1.5 block">
                    <div className="mb-1 text-xs text-muted-foreground">JPEG quality ({Math.round(exportJpegQuality * 100)}%)</div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={exportJpegQuality}
                      onChange={(e) => setExportJpegQuality(+e.target.value)}
                      className="w-full"
                    />
                  </label>
                )}
                <label className="mb-1.5 flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={exportIncludeBackground}
                    onChange={(e) => setExportIncludeBackground(e.target.checked)}
                  />
                  Include background
                </label>
                <label className="mb-1.5 block">
                  <div className="mb-1 text-xs text-muted-foreground">File name template</div>
                  <Input
                    compact
                    value={exportFileNameTemplate}
                    onChange={(e) => setExportFileNameTemplate(e.target.value)}
                    placeholder="{title}-{date}"
                  />
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button onClick={exportSvg}>Save SVG</Button>
                  <Button onClick={exportPng}>Save {exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}</Button>
                  <Button onClick={exportPdf} title={t('charts.printHint')}>{t('charts.print')}</Button>
                </div>
              </Section>
              </>)}
            </div>
          )}
        </div>
      </header>

      {qrShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6" onClick={() => setQrShare(null)}>
          <div className="rounded-lg border border-border bg-card p-5 shadow-xl w-full max-w-sm" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold truncate">{qrShare.title}</div>
              <button type="button" onClick={() => setQrShare(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <img src={qrShare.dataUrl} alt="Chart share QR code" className="w-60 h-60 mx-auto bg-white rounded-md p-2" />
            <button
              type="button"
              onClick={() => copyTextToClipboard(qrShare.url)}
              className="mt-4 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm hover:bg-accent"
            >
              Copy link
            </button>
          </div>
        </div>
      )}

      <ChartSelectionProvider openPerson={openPersonInPanel}>
      <ChartContentProvider content={chartContent} photosById={chartPhotos}>
      <div className="flex min-h-0 min-w-0 flex-1">
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {chartType === 'ancestor' && (
          <AncestorChart
            chartCanvasRef={chartCanvasRef}
            tree={ancestorTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'descendant' && (
          <DescendantChart
            chartCanvasRef={chartCanvasRef}
            tree={descendantTree}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'hourglass' && (
          <HourglassChart
            chartCanvasRef={chartCanvasRef}
            ancestorTree={ancestorTree}
            descendantTree={descendantTree}
            generations={hourglassAncestorGens}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {(chartType === 'tree' || chartType === 'symmetrical') && (
          <TreeChart
            chartCanvasRef={chartCanvasRef}
            ancestorTree={ancestorTree}
            descendantTree={descendantTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
            variant={chartType === 'symmetrical' ? 'symmetrical' : 'horizontal'}
          />
        )}
        {chartType === 'family-chart' && (
          <FamilyChartView
            chartCanvasRef={chartCanvasRef}
            ancestorTree={ancestorTree}
            descendantTree={descendantTree}
            rootId={rootId}
            onPersonClick={onPersonClick}
            onInspectPerson={openPersonInPanel}
            onEditPerson={(person) => person?.recordName && navigate(`/person/${person.recordName}`)}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            spacing={chartSpacing}
            showKinships={showKinships}
            collapseDuplicates={collapseDuplicates}
            editable={!isReadOnly}
            {...overlayChartProps}
          />
        )}
        {chartType === 'double-ancestor' && (
          <DoubleAncestorChart
            chartCanvasRef={chartCanvasRef}
            leftTree={ancestorTree}
            rightTree={secondAncestorTree}
            leftGenerations={doubleAncestorLeftGens}
            rightGenerations={doubleAncestorRightGens}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'fan' && (
          <FanChart
            chartCanvasRef={chartCanvasRef}
            tree={ancestorTree}
            generations={generations}
            arcDegrees={fanArcDegrees}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'circular' && (
          <CircularAncestorChart
            chartCanvasRef={chartCanvasRef}
            tree={ancestorTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'radial-descendant' && (
          <RadialDescendantTimelineChart
            chartCanvasRef={chartCanvasRef}
            tree={descendantTree}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'distribution' && (
          <DistributionChart
            chartCanvasRef={chartCanvasRef}
            persons={chartPersons}
            distributionData={distributionData}
            distributionType={distributionType}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'statistics' && (
          <StatisticsChart chartCanvasRef={chartCanvasRef} theme={theme} />
        )}
        {chartType === 'lifespan' && (
          <LifespanDescendantChart
            chartCanvasRef={chartCanvasRef}
            tree={descendantTree}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'timeline' && (
          <TimelineChart
            chartCanvasRef={chartCanvasRef}
            ancestorTree={ancestorTree}
            descendantTree={descendantTree}
            timelineData={timelineData}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'genogram' && (
          <GenogramChart
            chartCanvasRef={chartCanvasRef}
            tree={descendantTree}
            genogramData={genogramData}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            {...overlayChartProps}
          />
        )}
        {chartType === 'sociogram' && (
          <SociogramChart
            chartCanvasRef={chartCanvasRef}
            sociogramData={sociogramData}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'fractal-h-tree' && (
          <FractalAncestorChart
            chartCanvasRef={chartCanvasRef}
            tree={ancestorTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            variant="h-tree"
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'square-tree' && (
          <FractalAncestorChart
            chartCanvasRef={chartCanvasRef}
            tree={ancestorTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            variant="square"
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'fractal-tree' && (
          <FractalAncestorChart
            chartCanvasRef={chartCanvasRef}
            tree={ancestorTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            variant="fractal"
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'relationship' && (
          <RelationshipPathChart
            chartCanvasRef={chartCanvasRef}
            result={selectedRelationshipResult}
            pathCount={relationshipPaths.length}
            secondPicked={!!secondId}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
            colorForPerson={colorForPerson}
            {...overlayChartProps}
          />
        )}
        {chartType === 'virtual' && (
          <div className="flex h-full min-w-0">
            <aside className="w-[220px] border-e border-border bg-card p-4 text-sm text-card-foreground">
              <div className="mb-2 text-xs tracking-wide text-muted-foreground">VIRTUAL TREE OPTIONS</div>
              <label className="mb-2.5 block">
                <div className="mb-1 text-xs text-muted-foreground">Renderer</div>
                <Select
                  value={virtualViewMode}
                  onChange={setVirtualViewMode}
                  options={[
                    { value: '2d', label: '2D (SVG)' },
                    { value: '3d', label: '3D (Three.js)' },
                  ]}
                  triggerClassName={COMPACT_SELECT_TRIGGER}
                />
              </label>
              {virtualViewMode === '3d' && (
                <>
                  <label className="mb-2.5 block">
                    <div className="mb-1 text-xs text-muted-foreground">Symbol mode</div>
                    <Select
                      value={virtualSymbolMode}
                      onChange={setVirtualSymbolMode}
                      options={SYMBOL_MODES.map((mode) => ({ value: mode, label: mode }))}
                      triggerClassName={COMPACT_SELECT_TRIGGER}
                    />
                  </label>
                  <label className="mb-2.5 block">
                    <div className="mb-1 text-xs text-muted-foreground">Color mode</div>
                    <Select
                      value={virtualColorMode}
                      onChange={setVirtualColorMode}
                      options={COLOR_MODES.map((mode) => ({ value: mode, label: mode }))}
                      triggerClassName={COMPACT_SELECT_TRIGGER}
                    />
                  </label>
                  <label className="mb-2 flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={virtualShowGenerationBands}
                      onChange={(e) => setVirtualShowGenerationBands(e.target.checked)}
                    />
                    Generation bands
                  </label>
                  <label className="mb-2 flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={virtualDof.enabled}
                      onChange={(e) => setVirtualDof((d) => ({ ...d, enabled: e.target.checked }))}
                    />
                    Depth of field
                  </label>
                  {virtualDof.enabled && (
                    <>
                      <label className="mb-2 block">
                        <div className="mb-1 text-xs text-muted-foreground">Focus ({Math.round(virtualDof.focus)})</div>
                        <input
                          type="range"
                          min={100}
                          max={2000}
                          step={10}
                          value={virtualDof.focus}
                          onChange={(e) => setVirtualDof((d) => ({ ...d, focus: +e.target.value }))}
                          className="w-full"
                        />
                      </label>
                      <label className="mb-2 block">
                        <div className="mb-1 text-xs text-muted-foreground">Aperture ({virtualDof.aperture.toFixed(5)})</div>
                        <input
                          type="range"
                          min={0}
                          max={0.001}
                          step={0.00005}
                          value={virtualDof.aperture}
                          onChange={(e) => setVirtualDof((d) => ({ ...d, aperture: +e.target.value }))}
                          className="w-full"
                        />
                      </label>
                      <label className="mb-2.5 block">
                        <div className="mb-1 text-xs text-muted-foreground">Max blur ({virtualDof.maxblur.toFixed(3)})</div>
                        <input
                          type="range"
                          min={0}
                          max={0.05}
                          step={0.001}
                          value={virtualDof.maxblur}
                          onChange={(e) => setVirtualDof((d) => ({ ...d, maxblur: +e.target.value }))}
                          className="w-full"
                        />
                      </label>
                    </>
                  )}
                </>
              )}
              <label className="mb-2.5 block">
                <div className="mb-1 text-xs text-muted-foreground">Source</div>
                <Select
                  value={virtualSource}
                  onChange={setVirtualSource}
                  options={[
                    { value: 'descendant', label: 'Descendants' },
                    { value: 'ancestor', label: 'Ancestors' },
                    { value: 'hourglass', label: 'Hourglass' },
                  ]}
                  triggerClassName={COMPACT_SELECT_TRIGGER}
                />
              </label>
              <label className="mb-2.5 block">
                <div className="mb-1 text-xs text-muted-foreground">Orientation</div>
                <Select
                  value={virtualOrientation}
                  onChange={setVirtualOrientation}
                  options={[
                    { value: 'vertical', label: 'Vertical' },
                    { value: 'horizontal', label: 'Horizontal' },
                  ]}
                  triggerClassName={COMPACT_SELECT_TRIGGER}
                />
              </label>
              <label className="mb-2.5 block">
                <div className="mb-1 text-xs text-muted-foreground">Sibling spacing ({virtualHSpacing}px)</div>
                <input type="range" min={8} max={80} value={virtualHSpacing} onChange={(e) => setVirtualHSpacing(+e.target.value)} className="w-full" />
              </label>
              <label className="mb-2.5 block">
                <div className="mb-1 text-xs text-muted-foreground">Generation spacing ({virtualVSpacing}px)</div>
                <input type="range" min={50} max={200} value={virtualVSpacing} onChange={(e) => setVirtualVSpacing(+e.target.value)} className="w-full" />
              </label>
            </aside>
            <div className="relative flex-1">
              {virtualViewMode === '3d' ? (
                <VirtualTree3D
                  virtualTreeData={virtualTreeData}
                  symbolMode={virtualSymbolMode}
                  colorMode={virtualColorMode}
                  relationshipPathIds={relationshipPathIds}
                  dof={virtualDof}
                  layoutOptions={virtualLayoutOptions}
                  showGenerationBands={virtualShowGenerationBands}
                  onPick={(id) => openPersonInPanel({ recordName: id })}
                />
              ) : (
                <VirtualTreeDiagram
                  chartCanvasRef={chartCanvasRef}
                  tree={virtualSource === 'ancestor' ? ancestorTree : descendantTree}
                  source={virtualSource}
                  virtualTreeData={virtualTreeData}
                  onPersonClick={onPersonClick}
                  theme={theme}
                  page={chartPage}
                  overlays={overlays}
                  colorForPerson={colorForPerson}
                  {...overlayChartProps}
                  options={{ orientation: virtualOrientation, hSpacing: virtualHSpacing, vSpacing: virtualVSpacing }}
                />
              )}
            </div>
          </div>
        )}
      </div>
        {personBrowserOpen && (
          <ChartPersonBrowser
            persons={chartPersonBrowserRows}
            rootId={rootId}
            query={personBrowserQuery}
            onQueryChange={setPersonBrowserQuery}
            group={personBrowserGroup}
            onGroupChange={setPersonBrowserGroup}
            onPick={(id) => {
              setRootId(id);
              setActivePerson(id);
              focusRootInCanvas();
            }}
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
        findText={findText}
        onFindTextChange={setFindText}
        onFind={onFindPerson}
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
            chartType === 'distribution' || chartType === 'sociogram' || chartType === 'timeline'
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
          title="Page setup"
          pageSetup={{
            paperSize: pageSize,
            orientation: pageOrientation,
            margins: pageMargins,
            printMargins: pagePrintMargins,
            overlap: pageOverlap,
            cutMarks: pageCutMarks,
            printPageNumbers: pagePrintPageNumbers,
            omitEmptyPages: pageOmitEmptyPages,
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
    </div>
  );
}

function setOrDelete(params, key, value, defaultValue = null) {
  if (value == null || value === '' || value === defaultValue) params.delete(key);
  else params.set(key, String(value));
}

export default ChartsApp;
