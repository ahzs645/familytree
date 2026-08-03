/**
 * Load/save plumbing between the live chart state and the persisted chart
 * document format:
 *
 * - `currentDocumentState(name, id)` serializes everything into a normalized
 *   chart document.
 * - `applyDocumentState(doc, options)` pushes a loaded document back into all
 *   the state hooks.
 * - Dirty tracking: compares a signature of the persisted state against the
 *   last loaded/saved baseline (see comment below), plus the beforeunload
 *   prompt while dirty and the `confirmDiscardIfDirty` guard.
 *
 * Receives the sibling state-hook result objects so every value/setter keeps
 * its original name.
 */
import { useCallback, useEffect } from 'react';
import { normalizeChartDocument } from '../../../lib/chartDocumentSchema.js';
import { newChartDocumentId } from '../../../lib/chartDocuments.js';
import { DEFAULT_CHART_CONTENT } from '../ChartContentContext.jsx';
import { useModal } from '../../../contexts/ModalContext.jsx';

export function useChartDocumentIO({
  selection,
  theming,
  virtualOptions,
  pageSetup,
  exportSettings,
  relationship,
  overlayCommands,
  chartDoc,
  setActivePerson,
}) {
  const modal = useModal();
  const {
    rootId, setRootId,
    secondId, setSecondId,
    chartType, setChartType,
    generations, setGenerations,
    descendantGenerations,
    hourglassAncestorGens, hourglassDescendantGens,
    doubleAncestorLeftGens, doubleAncestorRightGens,
    fanArcDegrees, ancestorBranch,
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
  const {
    themeId, setThemeId,
    coloringMode, setColoringMode,
    chartContent, setChartContent,
  } = theming;
  const {
    virtualSource, setVirtualSource,
    virtualOrientation, setVirtualOrientation,
    virtualHSpacing, setVirtualHSpacing,
    virtualVSpacing, setVirtualVSpacing,
  } = virtualOptions;
  const {
    chartTitle, setChartTitle,
    chartNote, setChartNote,
    pageSize, setPageSize,
    pageOrientation, setPageOrientation,
    chartBackground, setChartBackground,
    pageMargins, setPageMargins,
    pagePrintMargins, setPagePrintMargins,
    pageOverlap, setPageOverlap,
    pageCutMarks, setPageCutMarks,
    pagePrintPageNumbers, setPagePrintPageNumbers,
    pageOmitEmptyPages, setPageOmitEmptyPages,
    pageWatermark, setPageWatermark,
  } = pageSetup;
  const {
    exportFormat, setExportFormat,
    exportScale, setExportScale,
    exportIncludeBackground, setExportIncludeBackground,
    exportJpegQuality, setExportJpegQuality,
    exportFileNameTemplate, setExportFileNameTemplate,
  } = exportSettings;
  const {
    relationshipBloodlineOnly, setRelationshipBloodlineOnly,
    selectedRelationshipPathId, setSelectedRelationshipPathId,
  } = relationship;
  const {
    overlays,
    objectStyles,
    connectionStyles,
    selectedOverlayId,
    selectedObject,
    setFromSource,
  } = overlayCommands;
  const {
    setCurrentDocumentId, setCurrentDocumentName,
    isDirty, setIsDirty, setIsReadOnly, dirtyGuardRef,
  } = chartDoc;

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
    relationshipBloodlineOnly, selectedRelationshipPathId, overlays, objectStyles, connectionStyles,
    pageMargins, pagePrintMargins, pageOverlap, pageCutMarks,
    pagePrintPageNumbers, pageOmitEmptyPages, pageWatermark, coloringMode, chartContent,
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
    if (!isDirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Edit lifecycle: applyDocumentState/onSaveDocument ask for a re-baseline so
  // loading or saving doesn't instantly flip the flag back on.
  const suppressDirtyOnce = useCallback(() => {
    dirtyGuardRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setPageWatermark(normalized.pageSetup.watermark || '');
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
      objectStyles: normalized.compositorConfig.objectStyles,
      connectionStyles: normalized.compositorConfig.connectionStyles,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActivePerson, setFromSource]);

  const confirmDiscardIfDirty = useCallback(async (action = 'load') => {
    if (!isDirty) return true;
    const verb = action === 'new' ? 'start a new chart' : action === 'load' ? 'load this chart' : 'continue';
    return await modal.confirm(`You have unsaved changes. Save changes to chart?\n\nClick Cancel to keep editing, OK to discard changes and ${verb}.`, { title: 'Unsaved changes', okLabel: 'Discard changes' });
  }, [isDirty, modal]);

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
      objectStyles,
      connectionStyles,
      selectedObjectIds: selectedObject?.id ? [selectedObject.id] : selectedOverlayId ? [selectedOverlayId] : [],
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
      watermark: pageWatermark,
    },
    exportSettings: {
      format: exportFormat,
      scale: exportScale,
      includeBackground: exportIncludeBackground,
      jpegQuality: exportJpegQuality,
      fileNameTemplate: exportFileNameTemplate,
    },
  }), [chartType, rootId, secondId, themeId, generations, virtualSource, virtualOrientation, virtualHSpacing, virtualVSpacing, chartTitle, chartNote, pageSize, pageOrientation, chartBackground, relationshipBloodlineOnly, selectedRelationshipPathId, overlays, objectStyles, connectionStyles, selectedOverlayId, selectedObject, pageMargins, pagePrintMargins, pageOverlap, pageCutMarks, pagePrintPageNumbers, pageOmitEmptyPages, pageWatermark, exportFormat, exportScale, exportIncludeBackground, exportJpegQuality, exportFileNameTemplate, coloringMode, chartContent, distributionType, distributionRelativeValues, distributionGraphType, distributionFromYear, distributionToYear, sociogramConfig, timelineGrouping, timelineCollapse, timelineMarkerMode]);

  return {
    suppressDirtyOnce,
    applyDocumentState,
    currentDocumentState,
    confirmDiscardIfDirty,
  };
}
