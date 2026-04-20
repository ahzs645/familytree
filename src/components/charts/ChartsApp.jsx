/**
 * ChartsApp — top-level UI for the charts page.
 * Picks a person, chooses chart type and theme, renders the chart.
 * Supports a second-person picker for Double Ancestor and Relationship Path.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listAllPersons, findStartPerson, buildAncestorTree, buildDescendantTree } from '../../lib/treeQuery.js';
import { useActivePerson } from '../../contexts/ActivePersonContext.jsx';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { findRelationshipPaths } from '../../lib/relationshipPath.js';
import { listChartTemplates, saveChartTemplate, deleteChartTemplate, newTemplateId } from '../../lib/chartTemplates.js';
import { listChartDocuments, saveChartDocument, deleteChartDocument, newChartDocumentId } from '../../lib/chartDocuments.js';
import { loadSavedChartDocument } from '../../lib/chartContainerLoader.js';
import { normalizeChartDocument } from '../../lib/chartDocumentSchema.js';
import { buildShareUrl } from '../../lib/chartShareLink.js';
import { ChartBackgroundSheet } from './ChartBackgroundSheet.jsx';
import { PageSetupSheet } from '../PageSetupSheet.jsx';
import { buildTimelineData } from '../../lib/chartData/timelineBuilder.js';
import { buildGenogramData } from '../../lib/chartData/genogramBuilder.js';
import { buildDistributionData } from '../../lib/chartData/distributionBuilder.js';
import { buildVirtualTreeData } from '../../lib/chartData/virtualTreeBuilder.js';
import { THEMES, getTheme } from './theme.js';
import { PersonPicker } from './PersonPicker.jsx';
import { AncestorChart } from './AncestorChart.jsx';
import { DescendantChart } from './DescendantChart.jsx';
import { HourglassChart } from './HourglassChart.jsx';
import { TreeChart } from './TreeChart.jsx';
import { DoubleAncestorChart } from './DoubleAncestorChart.jsx';
import { FanChart } from './FanChart.jsx';
import { RelationshipPathChart } from './RelationshipPathChart.jsx';
import { VirtualTreeDiagram } from './VirtualTreeDiagram.jsx';
import { VirtualTree3D, SYMBOL_MODES, COLOR_MODES, DOF_DEFAULTS } from './VirtualTree3D.jsx';
import { useChartObjectCommands } from './useChartObjectCommands.js';
import { useModal } from '../../contexts/ModalContext.jsx';
import {
  CircularAncestorChart,
  DistributionChart,
  TimelineChart,
  GenogramChart,
  FractalAncestorChart,
} from './SpecializedCharts.jsx';
import { ChartSelectionProvider } from './ChartSelectionContext.jsx';
import { PersonSidePanel } from './PersonSidePanel.jsx';
import { ChartObjectInspector } from './ChartObjectInspector.jsx';

const CHART_TYPES = [
  { id: 'ancestor', label: 'Ancestor', needsSecond: false },
  { id: 'descendant', label: 'Descendant', needsSecond: false },
  { id: 'hourglass', label: 'Hourglass', needsSecond: false },
  { id: 'tree', label: 'Tree (horizontal)', needsSecond: false },
  { id: 'double-ancestor', label: 'Double Ancestor', needsSecond: true },
  { id: 'fan', label: 'Fan', needsSecond: false },
  { id: 'circular', label: 'Circular Tree', needsSecond: false },
  { id: 'symmetrical', label: 'Symmetrical Tree', needsSecond: false },
  { id: 'distribution', label: 'Distribution', needsSecond: false },
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
  const [searchParams] = useSearchParams();
  const { recordName: sharedRootId, setActivePerson } = useActivePerson();
  const [persons, setPersons] = useState([]);
  const [rootId, setRootId] = useState(sharedRootId);
  const [secondId, setSecondId] = useState(null);
  const [chartType, setChartType] = useState(searchParams.get('type') || 'ancestor');
  const [generations, setGenerations] = useState(5);
  const [themeId, setThemeId] = useState('auto');
  const { theme: appTheme } = useTheme();
  const [virtualSource, setVirtualSource] = useState('descendant');
  const [virtualOrientation, setVirtualOrientation] = useState('vertical');
  const [virtualHSpacing, setVirtualHSpacing] = useState(24);
  const [virtualVSpacing, setVirtualVSpacing] = useState(110);
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
  const [virtualTreeData, setVirtualTreeData] = useState(null);
  const [virtualViewMode, setVirtualViewMode] = useState('2d');
  const [virtualSymbolMode, setVirtualSymbolMode] = useState('sphere');
  const [virtualColorMode, setVirtualColorMode] = useState('gender');
  const [virtualDof, setVirtualDof] = useState(DOF_DEFAULTS);
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [currentDocumentName, setCurrentDocumentName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const dirtyGuardRef = useRef(false);
  const [exportFormat, setExportFormat] = useState('png');
  const [exportScale, setExportScale] = useState(1);
  const [exportIncludeBackground, setExportIncludeBackground] = useState(true);
  const [exportJpegQuality, setExportJpegQuality] = useState(0.92);
  const [exportFileNameTemplate, setExportFileNameTemplate] = useState('{title}-{date}');
  const [chartTitle, setChartTitle] = useState('');
  const [chartNote, setChartNote] = useState('');
  const [pageSize, setPageSize] = useState('letter');
  const [pageOrientation, setPageOrientation] = useState('landscape');
  const [chartBackground, setChartBackground] = useState('');
  const [backgroundSheetOpen, setBackgroundSheetOpen] = useState(false);
  const [pageSetupSheetOpen, setPageSetupSheetOpen] = useState(false);
  const [pageMargins, setPageMargins] = useState({ top: 36, right: 36, bottom: 36, left: 36 });
  const [pagePrintMargins, setPagePrintMargins] = useState({ top: 36, right: 36, bottom: 36, left: 36 });
  const [pageOverlap, setPageOverlap] = useState(0);
  const [pageCutMarks, setPageCutMarks] = useState(false);
  const [pagePrintPageNumbers, setPagePrintPageNumbers] = useState(false);
  const [pageOmitEmptyPages, setPageOmitEmptyPages] = useState(true);
  const [ancestorTree, setAncestorTree] = useState(null);
  const [descendantTree, setDescendantTree] = useState(null);
  const [secondAncestorTree, setSecondAncestorTree] = useState(null);
  const [relationshipPaths, setRelationshipPaths] = useState([]);
  const [selectedRelationshipPathId, setSelectedRelationshipPathId] = useState(null);
  const [relationshipBloodlineOnly, setRelationshipBloodlineOnly] = useState(false);
  const [relationshipMaxPaths, setRelationshipMaxPaths] = useState(12);
  const [relationshipMaxDepth, setRelationshipMaxDepth] = useState(12);
  const [relationshipExcludeNonBiological, setRelationshipExcludeNonBiological] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const moreRef = useRef(null);
  const [panelPersonId, setPanelPersonId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
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

  // Dirty tracking — flip isDirty on any change to persisted chart state after
  // initial mount, unless explicitly suppressed (on load/save). Watched values
  // cover everything currentDocumentState reads.
  useEffect(() => {
    if (dirtyGuardRef.current) {
      dirtyGuardRef.current = false;
      return;
    }
    setIsDirty(true);
  }, [
    chartType, rootId, secondId, themeId, generations, descendantGenerations,
    hourglassAncestorGens, hourglassDescendantGens, doubleAncestorLeftGens,
    doubleAncestorRightGens, fanArcDegrees, ancestorBranch, virtualSource,
    virtualOrientation, virtualHSpacing, virtualVSpacing, chartTitle,
    chartNote, pageSize, pageOrientation, chartBackground,
    relationshipBloodlineOnly, selectedRelationshipPathId, overlays,
    pageMargins, pagePrintMargins, pageOverlap, pageCutMarks,
    pagePrintPageNumbers, pageOmitEmptyPages,
  ]);

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

  // Edit lifecycle: mark the document dirty whenever any persisted state changes
  // after the initial mount or after an explicit load/save. The dirtyGuardRef
  // lets applyDocumentState/onSaveDocument temporarily suppress the next dirty
  // sweep so loading or saving doesn't instantly flip the flag back on.
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
    const list = await listAllPersons();
      const docs = await listChartDocuments();
      const tpls = await listChartTemplates();
      setPersons(list);
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
      const requestedRootId = requestedDoc ? normalizeChartDocument(requestedDoc).roots.primaryPersonId : null;
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
    : chartType === 'descendant' || chartType === 'genogram' || chartType === 'sociogram' || chartType === 'tree' || chartType === 'symmetrical'
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
        const data = await buildTimelineData({ rootPersonId: rootId || null });
        if (!cancelled) setTimelineData(data);
      } catch (_error) {
        if (!cancelled) setTimelineData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId]);

  useEffect(() => {
    if (chartType !== 'genogram' && chartType !== 'sociogram') { setGenogramData(null); return undefined; }
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

  useEffect(() => {
    if (chartType !== 'distribution') { setDistributionData(null); return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const data = await buildDistributionData({ distributionType });
        if (!cancelled) setDistributionData(data);
      } catch (_error) {
        if (!cancelled) setDistributionData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, distributionType]);

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
        });
        if (!cancelled) setVirtualTreeData(data);
      } catch (_error) {
        if (!cancelled) setVirtualTreeData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [chartType, rootId, virtualSource, generations, virtualHSpacing, virtualVSpacing, virtualOrientation]);

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

  const onPersonClick = useCallback(
    (p) => {
      setRootId(p.recordName);
      setActivePerson(p.recordName);
    },
    [setActivePerson]
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
      common: { generations },
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
  }), [chartType, rootId, secondId, themeId, generations, virtualSource, virtualOrientation, virtualHSpacing, virtualVSpacing, chartTitle, chartNote, pageSize, pageOrientation, chartBackground, relationshipBloodlineOnly, selectedRelationshipPathId, overlays, selectedOverlayId, pageMargins, pagePrintMargins, pageOverlap, pageCutMarks, pagePrintPageNumbers, pageOmitEmptyPages, exportFormat, exportScale, exportIncludeBackground, exportJpegQuality, exportFileNameTemplate]);

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
      await navigator.clipboard?.writeText(url).catch(() => {});
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
      await navigator.clipboard?.writeText(url).catch(() => {});
      await modal.alert(`Share dialog not supported on this browser. Link copied:\n\n${url}`, { title: 'Share' });
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
    const needle = findText.trim().toLowerCase();
    if (!needle) return;
    const match = persons.find((person) => {
      const fullName = String(person.fullName || `${person.firstName || ''} ${person.lastName || ''}`).toLowerCase();
      const byId = String(person.recordName || '').toLowerCase();
      return fullName.includes(needle) || byId.includes(needle);
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

  if (loading) return <div style={loadingStyle}>Loading family data…</div>;
  if (empty) {
    return (
      <div style={loadingStyle}>
        No family data found. <a href="/" style={{ color: 'hsl(var(--primary))', marginLeft: 6 }}>Import a .mftpkg</a> first.
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <header style={headerStyle}>
        <Field label="Person">
          <PersonPicker persons={persons} value={rootId} onChange={onRootChange} />
        </Field>

        {needsSecond && (
          <Field label={chartType === 'relationship' ? 'Compare to' : 'Partner'}>
            <PersonPicker persons={persons} value={secondId} onChange={setSecondId} />
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
          <select value={chartType} onChange={(e) => setChartType(e.target.value)} style={selectStyle}>
            {CHART_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Gen" hideOnNarrow>
          <input
            type="number"
            min={2}
            max={8}
            value={generations}
            onChange={(e) => setGenerations(Math.min(8, Math.max(2, +e.target.value || 5)))}
            style={{ ...selectStyle, width: 60 }}
          />
        </Field>

        <div ref={moreRef} style={{ position: 'relative', marginInlineStart: 'auto' }}>
          <button
            onClick={() => setMoreOpen((v) => !v)}
            style={{ ...selectStyle, padding: '8px 12px' }}
            aria-expanded={moreOpen}
          >
            More ▾
          </button>
          {moreOpen && (
            <div style={popoverStyle}>
              <Section label="Theme">
                <select value={themeId} onChange={(e) => setThemeId(e.target.value)} style={optionSelect}>
                  {THEMES.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Section>

              <Section label="Generations">
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={generations}
                  onChange={(e) => setGenerations(Math.min(8, Math.max(2, +e.target.value || 5)))}
                  style={optionSelect}
                />
              </Section>

              {(chartType === 'descendant' || chartType === 'tree' || chartType === 'symmetrical' || chartType === 'genogram' || chartType === 'sociogram') && (
                <Section label="Descendant generations">
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={descendantGenerations}
                    onChange={(e) => setDescendantGenerations(Math.min(8, Math.max(1, +e.target.value || 5)))}
                    style={optionSelect}
                  />
                </Section>
              )}

              {chartType === 'hourglass' && (
                <Section label="Hourglass generations">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <label style={{ display: 'block' }}>
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Ancestors</div>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={hourglassAncestorGens}
                        onChange={(e) => setHourglassAncestorGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
                        style={optionSelect}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Descendants</div>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={hourglassDescendantGens}
                        onChange={(e) => setHourglassDescendantGens(Math.min(8, Math.max(1, +e.target.value || 3)))}
                        style={optionSelect}
                      />
                    </label>
                  </div>
                </Section>
              )}

              {chartType === 'double-ancestor' && (
                <Section label="Double ancestor generations">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <label style={{ display: 'block' }}>
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Left / Father</div>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={doubleAncestorLeftGens}
                        onChange={(e) => setDoubleAncestorLeftGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
                        style={optionSelect}
                      />
                    </label>
                    <label style={{ display: 'block' }}>
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Right / Mother</div>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={doubleAncestorRightGens}
                        onChange={(e) => setDoubleAncestorRightGens(Math.min(8, Math.max(1, +e.target.value || 4)))}
                        style={optionSelect}
                      />
                    </label>
                  </div>
                </Section>
              )}

              {(chartType === 'ancestor' || chartType === 'fan' || chartType === 'circular' || chartType === 'fractal-tree' || chartType === 'fractal-h-tree' || chartType === 'square-tree') && (
                <Section label="Ancestor branches">
                  <select value={ancestorBranch} onChange={(e) => setAncestorBranch(e.target.value)} style={optionSelect}>
                    <option value="both">Maternal and paternal</option>
                    <option value="paternal">Only paternal</option>
                    <option value="maternal">Only maternal</option>
                    <option value="paternal-from-start">Paternal from start person</option>
                    <option value="maternal-from-start">Maternal from start person</option>
                  </select>
                </Section>
              )}

              {chartType === 'fan' && (
                <Section label="Fan arc">
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Arc ({fanArcDegrees}°)</div>
                  <input
                    type="range"
                    min={90}
                    max={360}
                    step={15}
                    value={fanArcDegrees}
                    onChange={(e) => setFanArcDegrees(+e.target.value)}
                    style={{ width: '100%' }}
                  />
                </Section>
              )}

              <Section label="Title">
                <input value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="Optional title" style={optionSelect} />
              </Section>

              <Section label="Note">
                <input value={chartNote} onChange={(e) => setChartNote(e.target.value)} placeholder="Optional note" style={optionSelect} />
              </Section>

              <Section label="Page">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} style={optionSelect}>
                    <option value="letter">Letter</option>
                    <option value="a4">A4</option>
                    <option value="legal">Legal</option>
                  </select>
                  <select value={pageOrientation} onChange={(e) => setPageOrientation(e.target.value)} style={optionSelect}>
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input value={chartBackground} onChange={(e) => setChartBackground(e.target.value)} placeholder="CSS value or click Edit…" style={{ ...optionSelect, flex: 1 }} title="CSS background color" />
                  <button type="button" onClick={() => setBackgroundSheetOpen(true)} style={optionSelect} title="Color / gradient / image background editor">
                    Edit…
                  </button>
                </div>
                <ChartBackgroundSheet
                  open={backgroundSheetOpen}
                  value={chartBackground}
                  onApply={(value) => { setChartBackground(value); setBackgroundSheetOpen(false); }}
                  onClose={() => setBackgroundSheetOpen(false)}
                />
                <div style={{ marginTop: 6 }}>
                  <button type="button" onClick={() => setPageSetupSheetOpen(true)} style={optionSelect} title="Margins, overlap, cut marks, page numbers, omit empty pages, export format/scale/quality">
                    Page setup…
                  </button>
                </div>
              </Section>

              <Section label="Templates">
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    value=""
                    onChange={(e) => e.target.value && onApplyTemplate(e.target.value)}
                    style={{ ...optionSelect, flex: 1 }}
                  >
                    <option value="">Load saved…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button onClick={onSaveTemplate} style={optionSelect}>Save</button>
                </div>
                {templates.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => e.target.value && onDeleteTemplate(e.target.value)}
                    style={{ ...optionSelect, marginTop: 6 }}
                    title="Delete a saved template"
                  >
                    <option value="">Delete…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </Section>

              <Section label={`Documents${currentDocumentName ? ` — ${currentDocumentName}${isDirty ? ' •' : ''}${isReadOnly ? ' (read-only)' : ''}` : ''}`}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value="" onChange={(e) => e.target.value && onApplyDocument(e.target.value)} style={{ ...optionSelect, flex: 1 }}>
                    <option value="">Open…</option>
                    {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
                  </select>
                  <button onClick={onSaveDocument} style={optionSelect} disabled={isReadOnly} title={isReadOnly ? 'Read-only — use Save as new' : currentDocumentId ? 'Overwrite existing document' : 'Save new document'}>
                    {currentDocumentId ? 'Save' : 'Save…'}
                  </button>
                  <button onClick={onSaveAsDocument} style={optionSelect} title="Save a new copy">Save as…</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                  <button onClick={onNewChart} style={optionSelect} title="Start a new blank chart. Prompts if there are unsaved changes.">New chart</button>
                  <button onClick={onFinishEditing} style={optionSelect} disabled={isReadOnly} title="Exit edit mode. Prompts to save unsaved changes, then locks the chart as read-only.">Finish editing</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={onCopyShareLink}
                    style={optionSelect}
                    title="Copy a compressed read-only link to the clipboard."
                    disabled={!rootId}
                  >
                    Copy link
                  </button>
                  <button
                    onClick={onShareChart}
                    style={optionSelect}
                    title="Open the system share sheet (iOS/macOS/Android) or copy if unsupported."
                    disabled={!rootId}
                  >
                    Share…
                  </button>
                  <button
                    onClick={onShareByEmail}
                    style={optionSelect}
                    title="Open a new email with the share link."
                    disabled={!rootId}
                  >
                    Email
                  </button>
                </div>
                {documents.length > 0 && (
                  <select value="" onChange={(e) => e.target.value && onDeleteDocument(e.target.value)} style={{ ...optionSelect, marginTop: 6 }}>
                    <option value="">Delete…</option>
                    {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
                  </select>
                )}
              </Section>

              <Section label={`Overlays${isReadOnly ? ' (read-only)' : ''}`}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  <button onClick={addTextOverlay} style={optionSelect} disabled={isReadOnly}>Text</button>
                  <button onClick={addLineOverlay} style={optionSelect} disabled={isReadOnly}>Line</button>
                  <button onClick={addImageOverlay} style={optionSelect} disabled={isReadOnly}>Image</button>
                  <button onClick={removeSelected} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Delete</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                  <button onClick={undo} disabled={!hasUndo || isReadOnly} style={optionSelect}>Undo</button>
                  <button onClick={redo} disabled={!hasRedo || isReadOnly} style={optionSelect}>Redo</button>
                  <button onClick={() => alignHorizontal('left')} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Align left</button>
                  <button onClick={() => alignHorizontal('center')} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Align center</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                  <button onClick={() => alignVertical('top')} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Align top</button>
                  <button onClick={() => alignVertical('middle')} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Align middle</button>
                  <button onClick={bringToFront} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Bring to front</button>
                  <button onClick={sendToBack} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Send to back</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                  <button onClick={() => distributeEvenly('horizontal')} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Distribute H</button>
                  <button onClick={() => distributeEvenly('vertical')} disabled={!selectedOverlayId || isReadOnly} style={optionSelect}>Distribute V</button>
                  <button onClick={focusRootInCanvas} style={optionSelect}>Focus root</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                  <button onClick={() => moveAwayFromPageCuts({ paperSize: pageSize, orientation: pageOrientation })} disabled={!overlays.length || isReadOnly} style={optionSelect} title="Shift objects that cross a page-tile boundary so they fit inside one page">Away from cuts</button>
                  <button onClick={() => distributeBorderToBorder('horizontal', { paperSize: pageSize, orientation: pageOrientation })} disabled={overlays.length < 2 || isReadOnly} style={optionSelect} title="Distribute objects evenly across the page content rect">Border-to-border H</button>
                  <button onClick={() => distributeBorderToBorder('vertical', { paperSize: pageSize, orientation: pageOrientation })} disabled={overlays.length < 2 || isReadOnly} style={optionSelect} title="Distribute objects evenly from top to bottom">Border-to-border V</button>
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

              <Section label="Find + Export">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, marginBottom: 6 }}>
                  <input
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="Find person name/record"
                    style={optionSelect}
                  />
                  <button onClick={onFindPerson} style={optionSelect}>Find</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  <label style={{ display: 'block' }}>
                    <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Format</div>
                    <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)} style={optionSelect}>
                      <option value="png">PNG</option>
                      <option value="jpeg">JPEG</option>
                    </select>
                  </label>
                  <label style={{ display: 'block' }}>
                    <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Scale ({exportScale.toFixed(2)}×)</div>
                    <input
                      type="range"
                      min={0.25}
                      max={4}
                      step={0.25}
                      value={exportScale}
                      onChange={(e) => setExportScale(+e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </label>
                </div>
                {exportFormat === 'jpeg' && (
                  <label style={{ display: 'block', marginBottom: 6 }}>
                    <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>JPEG quality ({Math.round(exportJpegQuality * 100)}%)</div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={exportJpegQuality}
                      onChange={(e) => setExportJpegQuality(+e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </label>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={exportIncludeBackground}
                    onChange={(e) => setExportIncludeBackground(e.target.checked)}
                  />
                  Include background
                </label>
                <label style={{ display: 'block', marginBottom: 6 }}>
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>File name template</div>
                  <input
                    value={exportFileNameTemplate}
                    onChange={(e) => setExportFileNameTemplate(e.target.value)}
                    placeholder="{title}-{date}"
                    style={optionSelect}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  <button onClick={exportSvg} style={optionSelect}>Save SVG</button>
                  <button onClick={exportPng} style={optionSelect}>Save {exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}</button>
                  <button onClick={exportPdf} style={optionSelect}>Save PDF</button>
                </div>
              </Section>
            </div>
          )}
        </div>
      </header>

      <ChartSelectionProvider openPerson={openPersonInPanel}>
      <div style={canvasRowStyle}>
      <main style={mainStyle}>
        {chartType === 'ancestor' && (
          <AncestorChart
            chartCanvasRef={chartCanvasRef}
            tree={ancestorTree}
            generations={generations}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            overlays={overlays}
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
            {...overlayChartProps}
            variant={chartType === 'symmetrical' ? 'symmetrical' : 'horizontal'}
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
            {...overlayChartProps}
          />
        )}
        {chartType === 'distribution' && (
          <DistributionChart
            chartCanvasRef={chartCanvasRef}
            persons={persons}
            distributionData={distributionData}
            theme={theme}
            page={chartPage}
            overlays={overlays}
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
          <GenogramChart
            chartCanvasRef={chartCanvasRef}
            tree={descendantTree}
            genogramData={genogramData}
            onPersonClick={onPersonClick}
            theme={theme}
            page={chartPage}
            sociogram
            overlays={overlays}
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
            {...overlayChartProps}
          />
        )}
        {chartType === 'virtual' && (
          <div style={{ display: 'flex', height: '100%', minWidth: 0 }}>
            <aside style={{ width: 220, padding: 16, borderInlineEnd: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: 13 }}>
              <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 8, letterSpacing: 0.4 }}>VIRTUAL TREE OPTIONS</div>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Renderer</div>
                <select value={virtualViewMode} onChange={(e) => setVirtualViewMode(e.target.value)} style={optionSelect}>
                  <option value="2d">2D (SVG)</option>
                  <option value="3d">3D (Three.js — experimental)</option>
                </select>
              </label>
              {virtualViewMode === '3d' && (
                <>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Symbol mode</div>
                    <select value={virtualSymbolMode} onChange={(e) => setVirtualSymbolMode(e.target.value)} style={optionSelect}>
                      {SYMBOL_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'block', marginBottom: 10 }}>
                    <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Color mode</div>
                    <select value={virtualColorMode} onChange={(e) => setVirtualColorMode(e.target.value)} style={optionSelect}>
                      {COLOR_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={virtualDof.enabled}
                      onChange={(e) => setVirtualDof((d) => ({ ...d, enabled: e.target.checked }))}
                    />
                    Depth of field
                  </label>
                  {virtualDof.enabled && (
                    <>
                      <label style={{ display: 'block', marginBottom: 8 }}>
                        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Focus ({Math.round(virtualDof.focus)})</div>
                        <input
                          type="range"
                          min={100}
                          max={2000}
                          step={10}
                          value={virtualDof.focus}
                          onChange={(e) => setVirtualDof((d) => ({ ...d, focus: +e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </label>
                      <label style={{ display: 'block', marginBottom: 8 }}>
                        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Aperture ({virtualDof.aperture.toFixed(5)})</div>
                        <input
                          type="range"
                          min={0}
                          max={0.001}
                          step={0.00005}
                          value={virtualDof.aperture}
                          onChange={(e) => setVirtualDof((d) => ({ ...d, aperture: +e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </label>
                      <label style={{ display: 'block', marginBottom: 10 }}>
                        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Max blur ({virtualDof.maxblur.toFixed(3)})</div>
                        <input
                          type="range"
                          min={0}
                          max={0.05}
                          step={0.001}
                          value={virtualDof.maxblur}
                          onChange={(e) => setVirtualDof((d) => ({ ...d, maxblur: +e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </label>
                    </>
                  )}
                </>
              )}
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Source</div>
                <select value={virtualSource} onChange={(e) => setVirtualSource(e.target.value)} style={optionSelect}>
                  <option value="descendant">Descendants</option>
                  <option value="ancestor">Ancestors</option>
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Orientation</div>
                <select value={virtualOrientation} onChange={(e) => setVirtualOrientation(e.target.value)} style={optionSelect}>
                  <option value="vertical">Vertical</option>
                  <option value="horizontal">Horizontal</option>
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Sibling spacing ({virtualHSpacing}px)</div>
                <input type="range" min={8} max={80} value={virtualHSpacing} onChange={(e) => setVirtualHSpacing(+e.target.value)} style={{ width: '100%' }} />
              </label>
              <label style={{ display: 'block', marginBottom: 10 }}>
                <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>Generation spacing ({virtualVSpacing}px)</div>
                <input type="range" min={50} max={200} value={virtualVSpacing} onChange={(e) => setVirtualVSpacing(+e.target.value)} style={{ width: '100%' }} />
              </label>
            </aside>
            <div style={{ flex: 1, position: 'relative' }}>
              {virtualViewMode === '3d' ? (
                <VirtualTree3D
                  virtualTreeData={virtualTreeData}
                  symbolMode={virtualSymbolMode}
                  colorMode={virtualColorMode}
                  relationshipPathIds={relationshipPathIds}
                  dof={virtualDof}
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
                  {...overlayChartProps}
                  options={{ orientation: virtualOrientation, hSpacing: virtualHSpacing, vSpacing: virtualVSpacing }}
                />
              )}
            </div>
          </div>
        )}
      </main>
        <PersonSidePanel
          recordName={panelPersonId}
          open={panelOpen}
          onClose={closePanel}
          onReroot={rerootFromPanel}
        />
      </div>
      </ChartSelectionProvider>
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

function Field({ label, children, hideOnNarrow }) {
  return (
    <div
      className={hideOnNarrow ? 'hidden sm:flex' : 'flex'}
      style={{ flexDirection: 'column', marginInlineEnd: 12 }}
    >
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

function RelationshipPathControls({
  bloodlineOnly,
  onBloodlineOnlyChange,
  maxPaths,
  onMaxPathsChange,
  maxDepth,
  onMaxDepthChange,
  excludeNonBiological,
  onExcludeNonBiologicalChange,
  paths,
  selectedPathId,
  onSelectedPathChange,
  onReset,
  disabled,
}) {
  return (
    <div style={relationshipControlsStyle}>
      <label style={relationshipToggleStyle}>
        <input
          type="checkbox"
          checked={bloodlineOnly}
          onChange={(event) => onBloodlineOnlyChange(event.target.checked)}
          disabled={disabled}
        />
        <span>Bloodlines only</span>
      </label>
      <label style={relationshipToggleStyle} title="Skip paths that cross adopted or step relationships.">
        <input
          type="checkbox"
          checked={excludeNonBiological}
          onChange={(event) => onExcludeNonBiologicalChange(event.target.checked)}
          disabled={disabled}
        />
        <span>Full-blood only</span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11 }}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Max paths</span>
        <input
          type="number"
          min={1}
          max={40}
          value={maxPaths}
          onChange={(event) => onMaxPathsChange(Math.max(1, Math.min(40, Number(event.target.value) || 1)))}
          disabled={disabled}
          style={{ ...selectStyle, width: 60 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11 }}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Max depth</span>
        <input
          type="number"
          min={2}
          max={24}
          value={maxDepth}
          onChange={(event) => onMaxDepthChange(Math.max(2, Math.min(24, Number(event.target.value) || 2)))}
          disabled={disabled}
          style={{ ...selectStyle, width: 60 }}
        />
      </label>
      <select
        value={selectedPathId || ''}
        onChange={(event) => onSelectedPathChange(event.target.value || null)}
        disabled={disabled || paths.length === 0}
        style={{ ...selectStyle, minWidth: 180 }}
        title="Relationship path"
      >
        <option value="">{disabled ? 'Pick compare person' : paths.length ? 'Select path...' : 'No path found'}</option>
        {paths.map((path, index) => (
          <option key={path.id} value={path.id}>
            {index + 1}. {path.label} ({path.steps.length - 1} step{path.steps.length === 2 ? '' : 's'})
          </option>
        ))}
      </select>
      <button type="button" onClick={onReset} disabled={disabled} style={selectStyle}>
        Reset
      </button>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 4, letterSpacing: 0.3 }}>{label}</div>
      {children}
    </div>
  );
}

const shellStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'hsl(var(--background))',
};
const headerStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  padding: '12px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  flexWrap: 'wrap',
};
const mainStyle = { flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 };
const canvasRowStyle = { flex: 1, display: 'flex', minHeight: 0, minWidth: 0 };
const relationshipControlsStyle = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  marginInlineEnd: 12,
};
const relationshipToggleStyle = {
  minHeight: 34,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: 'hsl(var(--foreground))',
  font: '13px -apple-system, system-ui, sans-serif',
  whiteSpace: 'nowrap',
};
const selectStyle = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  padding: '8px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
  cursor: 'pointer',
};
const popoverStyle = {
  position: 'absolute',
  insetInlineEnd: 0,
  top: 'calc(100% + 6px)',
  width: 280,
  maxHeight: '70vh',
  overflowY: 'auto',
  background: 'hsl(var(--card))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 10,
  padding: 14,
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  zIndex: 20,
};
const optionSelect = {
  width: '100%',
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '6px 8px',
  font: '12px -apple-system, system-ui, sans-serif',
  outline: 'none',
};
const loadingStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'hsl(var(--muted-foreground))',
  background: 'hsl(var(--background))',
};

export default ChartsApp;
