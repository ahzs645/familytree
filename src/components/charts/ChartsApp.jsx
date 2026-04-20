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
import { buildTimelineData } from '../../lib/chartData/timelineBuilder.js';
import { buildGenogramData } from '../../lib/chartData/genogramBuilder.js';
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
import { useChartObjectCommands } from './useChartObjectCommands.js';
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
  const [ancestorTree, setAncestorTree] = useState(null);
  const [descendantTree, setDescendantTree] = useState(null);
  const [secondAncestorTree, setSecondAncestorTree] = useState(null);
  const [relationshipPaths, setRelationshipPaths] = useState([]);
  const [selectedRelationshipPathId, setSelectedRelationshipPathId] = useState(null);
  const [relationshipBloodlineOnly, setRelationshipBloodlineOnly] = useState(false);
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
    orientation: pageOrientation,
    backgroundColor: chartBackground || theme.background,
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
        const result = await findRelationshipPaths(rootId, secondId, { bloodlineOnly: relationshipBloodlineOnly });
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
  }, [secondId, chartType, generations, doubleAncestorRightGens, needsSecond, rootId, relationshipBloodlineOnly]);

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

  const selectedRelationshipResult = useMemo(() => (
    relationshipPaths.find((path) => path.id === selectedRelationshipPathId) || relationshipPaths[0] || null
  ), [relationshipPaths, selectedRelationshipPathId]);

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
    const name = prompt('Name for this chart template:');
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
  }, [chartType, themeId, generations, chartTitle, chartNote, pageSize, pageOrientation, chartBackground]);

  const onApplyTemplate = useCallback(async (id) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setChartType(tpl.chartType);
    setThemeId(tpl.themeId);
    setGenerations(tpl.generations);
    setChartTitle(tpl.title || '');
    setChartNote(tpl.note || '');
    setPageSize(tpl.page?.size || 'letter');
    setPageOrientation(tpl.page?.orientation || 'landscape');
    setChartBackground(tpl.page?.backgroundColor || '');
  }, [templates]);

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
    },
  }), [chartType, rootId, secondId, themeId, generations, virtualSource, virtualOrientation, virtualHSpacing, virtualVSpacing, chartTitle, chartNote, pageSize, pageOrientation, chartBackground, relationshipBloodlineOnly, selectedRelationshipPathId, overlays, selectedOverlayId]);

  const onSaveDocument = useCallback(async () => {
    if (isReadOnly) {
      alert('This chart is read-only (imported). Use "Save as new…" to make an editable copy.');
      return;
    }
    if (currentDocumentId) {
      suppressDirtyOnce();
      await saveChartDocument(currentDocumentState(currentDocumentName || 'Untitled Chart', currentDocumentId));
      setDocuments(await listChartDocuments());
      setIsDirty(false);
      return;
    }
    const name = prompt('Name for this chart document:');
    if (!name) return;
    suppressDirtyOnce();
    const id = newChartDocumentId();
    await saveChartDocument(currentDocumentState(name, id));
    setCurrentDocumentId(id);
    setCurrentDocumentName(name);
    setDocuments(await listChartDocuments());
    setIsDirty(false);
  }, [currentDocumentState, currentDocumentId, currentDocumentName, isReadOnly, suppressDirtyOnce]);

  const onSaveAsDocument = useCallback(async () => {
    const name = prompt('Save as new chart — name:', currentDocumentName || '');
    if (!name) return;
    suppressDirtyOnce();
    const id = newChartDocumentId();
    await saveChartDocument(currentDocumentState(name, id));
    setCurrentDocumentId(id);
    setCurrentDocumentName(name);
    setIsReadOnly(false);
    setDocuments(await listChartDocuments());
    setIsDirty(false);
  }, [currentDocumentState, currentDocumentName, suppressDirtyOnce]);

  const onApplyDocument = useCallback((id) => {
    const doc = documents.find((item) => item.id === id);
    if (!doc) return;
    applyDocumentState(doc, { preserveSelection: false });
  }, [applyDocumentState, documents]);

  const onDeleteDocument = useCallback(async (id) => {
    if (!confirm('Delete this chart document?')) return;
    await deleteChartDocument(id);
    setDocuments(await listChartDocuments());
  }, []);

  const onDeleteTemplate = useCallback(async (id) => {
    if (!confirm('Delete this template?')) return;
    await deleteChartTemplate(id);
    setTemplates(await listChartTemplates());
  }, []);

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

  const addTextOverlay = useCallback(() => {
    const text = prompt('Text label:', 'Annotation');
    if (!text) return;
    addText({ text, x: 96, y: 120, fontSize: 20, color: theme.text });
  }, [addText, theme.text]);

  const addLineOverlay = useCallback(() => {
    addLine({ x1: 120, y1: 160, x2: 300, y2: 160, strokeWidth: 3, color: theme.connector });
  }, [addLine, theme.connector]);

  const addImageOverlay = useCallback(() => {
    const href = prompt('Image URL:');
    if (!href) return;
    addImage(href, { x: 120, y: 140, width: 180, height: 120 });
  }, [addImage]);

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
                <input value={chartBackground} onChange={(e) => setChartBackground(e.target.value)} placeholder="Background color" style={{ ...optionSelect, marginTop: 6 }} title="CSS background color" />
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
                {documents.length > 0 && (
                  <select value="" onChange={(e) => e.target.value && onDeleteDocument(e.target.value)} style={{ ...optionSelect, marginTop: 6 }}>
                    <option value="">Delete…</option>
                    {documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
                  </select>
                )}
              </Section>

              <Section label="Overlays">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  <button onClick={addTextOverlay} style={optionSelect}>Text</button>
                  <button onClick={addLineOverlay} style={optionSelect}>Line</button>
                  <button onClick={addImageOverlay} style={optionSelect}>Image</button>
                  <button onClick={removeSelected} disabled={!selectedOverlayId} style={optionSelect}>Delete</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                  <button onClick={undo} disabled={!hasUndo} style={optionSelect}>Undo</button>
                  <button onClick={redo} disabled={!hasRedo} style={optionSelect}>Redo</button>
                  <button onClick={() => alignHorizontal('left')} disabled={!selectedOverlayId} style={optionSelect}>Align left</button>
                  <button onClick={() => alignHorizontal('center')} disabled={!selectedOverlayId} style={optionSelect}>Align center</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                  <button onClick={() => alignVertical('top')} disabled={!selectedOverlayId} style={optionSelect}>Align top</button>
                  <button onClick={() => alignVertical('middle')} disabled={!selectedOverlayId} style={optionSelect}>Align middle</button>
                  <button onClick={bringToFront} disabled={!selectedOverlayId} style={optionSelect}>Bring to front</button>
                  <button onClick={sendToBack} disabled={!selectedOverlayId} style={optionSelect}>Send to back</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 6 }}>
                  <button onClick={() => distributeEvenly('horizontal')} disabled={!selectedOverlayId} style={optionSelect}>Distribute H</button>
                  <button onClick={() => distributeEvenly('vertical')} disabled={!selectedOverlayId} style={optionSelect}>Distribute V</button>
                  <button onClick={focusRootInCanvas} style={optionSelect}>Focus root</button>
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
              <VirtualTreeDiagram
                chartCanvasRef={chartCanvasRef}
                tree={virtualSource === 'ancestor' ? ancestorTree : descendantTree}
                source={virtualSource}
                onPersonClick={onPersonClick}
                theme={theme}
                page={chartPage}
                overlays={overlays}
                {...overlayChartProps}
                options={{ orientation: virtualOrientation, hSpacing: virtualHSpacing, vSpacing: virtualVSpacing }}
              />
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
