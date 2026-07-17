import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { CAMERA_MODES, VIEWER_OPTIONS_STORAGE_KEY } from './threeDTree/constants.js';
import { buildInteractiveLayout } from './threeDTree/layout.js';
import { calculateReferenceNumbers } from '../../lib/referenceNumbering.js';
import { makePalette } from './threeDTree/palette.js';
import { readInitialViewerOptions } from './threeDTree/viewerOptions.js';
import { Metric, PersonContextMenu, PersonHoverCard, TreeNavigationControls, ViewerSelect, dockToggleStyle } from './threeDTree/overlays.jsx';
import { OptionsPanel } from './threeDTree/OptionsPanel.jsx';
import { styles } from './threeDTree/styles.js';
import { useThreeTreeScene } from './threeDTree/useThreeTreeScene.js';

export function ThreeDTreeView({
  ancestorTree,
  descendantTree,
  familyGraph,
  activeId,
  loading = false,
  onPick,
  onEditPerson,
  onOpenFamily,
  onShowInfo,
  onOpenAncestorChart,
  onOpenDescendantChart,
  onAddRelative,
  onDeletePerson,
  onDeleteFamily,
  onEditInfluential,
  onOpenFamilySearch,
  onToggleExpand,
  expandedIds,
  context,
  chrome = { navigation: true, people: true, inspector: true, header: true },
  onToggleChrome,
  onReturnToFamilyTree,
}) {
  const { theme } = useTheme();
  const appDark = theme === 'dark';
  const isMobile = useIsMobile();
  const { t } = useTranslation();
  const macBarButtonStyle = isMobile ? { ...styles.macBarButton, ...styles.macBarButtonMobile } : styles.macBarButton;
  const dockButtonStyle = isMobile ? { ...styles.dockButton, ...styles.dockButtonMobile } : styles.dockButton;
  const [viewerOptions, setViewerOptions] = useState(readInitialViewerOptions);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [optionsPanelOpen, setOptionsPanelOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);

  useEffect(() => {
    if (!presentationMode) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setPresentationMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentationMode]);

  const dark = viewerOptions.appearanceMode === 'app' ? appDark : false;
  const palette = useMemo(() => makePalette(dark, viewerOptions.lightingMode), [dark, viewerOptions.lightingMode]);
  const layout = useMemo(
    () => buildInteractiveLayout(ancestorTree, descendantTree, activeId, familyGraph, {
      ancestorGenerations: viewerOptions.ancestorGenerations,
      descendantGenerations: viewerOptions.descendantGenerations,
      childSortingMode: viewerOptions.childSortingMode,
      generationDirection: viewerOptions.generationDirection,
      parentsChildrenSpacing: viewerOptions.parentsChildrenSpacing,
      partnerSpacing: viewerOptions.partnerSpacing,
      branchSpacing: viewerOptions.branchSpacing,
      siblingGenerations: viewerOptions.siblingGenerations,
      ancestorScaleStartLevel: viewerOptions.ancestorScaleStartLevel,
      descendantScaleStartLevel: viewerOptions.descendantScaleStartLevel,
      siblingMinification: viewerOptions.siblingMinification,
      otherSiblingMinification: viewerOptions.otherSiblingMinification,
      adjustParentPositions: viewerOptions.adjustParentPositions,
      generationBandsSegmentByPedigree: viewerOptions.generationBandsSegmentByPedigree,
    }),
    [
      ancestorTree, descendantTree, activeId, familyGraph,
      viewerOptions.ancestorGenerations, viewerOptions.descendantGenerations, viewerOptions.childSortingMode,
      viewerOptions.generationDirection,
      viewerOptions.parentsChildrenSpacing, viewerOptions.partnerSpacing, viewerOptions.branchSpacing,
      viewerOptions.siblingGenerations, viewerOptions.ancestorScaleStartLevel, viewerOptions.descendantScaleStartLevel,
      viewerOptions.siblingMinification, viewerOptions.otherSiblingMinification,
      viewerOptions.adjustParentPositions, viewerOptions.generationBandsSegmentByPedigree,
    ]
  );
  // Reference numbering (Ahnentafel/d'Aboville/Henry/Generation) is loaded
  // lazily — only when the "Display Numbering System" option is on — then merged
  // onto the layout nodes so the label can render each person's number.
  const [numberingMap, setNumberingMap] = useState(null);
  useEffect(() => {
    if (!viewerOptions.displayNumberingSystem || !activeId) {
      setNumberingMap(null);
      return undefined;
    }
    let cancelled = false;
    calculateReferenceNumbers(activeId, viewerOptions.numberingSystem)
      .then((rows) => {
        if (cancelled) return;
        const map = new Map();
        for (const row of rows || []) map.set(row.personId, row.number);
        setNumberingMap(map);
      })
      .catch(() => { if (!cancelled) setNumberingMap(null); });
    return () => { cancelled = true; };
  }, [activeId, viewerOptions.displayNumberingSystem, viewerOptions.numberingSystem]);

  // LDS ordinance owners are loaded lazily — only when an Ordinances Display Mode
  // is active — and merged onto nodes so the figure can show an icon/colour.
  const [ordinanceSet, setOrdinanceSet] = useState(null);
  useEffect(() => {
    if (viewerOptions.ordinancesMode === 'none') {
      setOrdinanceSet(null);
      return undefined;
    }
    let cancelled = false;
    import('../../lib/listData.js')
      .then((m) => m.loadLdsOrdinanceRows())
      .then((result) => {
        if (cancelled) return;
        const set = new Set();
        for (const row of result?.rows || []) {
          if (row.ownerType === 'Person' && row.ownerId) set.add(row.ownerId);
          else if (row.ownerId) set.add(row.ownerId);
        }
        setOrdinanceSet(set);
      })
      .catch(() => { if (!cancelled) setOrdinanceSet(null); });
    return () => { cancelled = true; };
  }, [viewerOptions.ordinancesMode]);

  const decoratedLayout = useMemo(() => {
    const numberingOn = numberingMap && viewerOptions.displayNumberingSystem;
    const ordinancesOn = ordinanceSet && viewerOptions.ordinancesMode !== 'none';
    if (!numberingOn && !ordinancesOn) return layout;
    return {
      ...layout,
      nodes: layout.nodes.map((node) => {
        const refNumber = numberingOn && numberingMap.has(node.id) ? numberingMap.get(node.id) : undefined;
        const ordinance = ordinancesOn ? ordinanceSet.has(node.id) : undefined;
        if (refNumber === undefined && ordinance === undefined) return node;
        const next = { ...node };
        if (refNumber !== undefined) next.refNumber = refNumber;
        if (ordinance !== undefined) next.ordinance = ordinance;
        return next;
      }),
    };
  }, [layout, numberingMap, viewerOptions.displayNumberingSystem, ordinanceSet, viewerOptions.ordinancesMode]);

  const relationshipCounts = useMemo(() => ({
    parents: context?.parents?.flatMap((family) => [family.man, family.woman]).filter(Boolean).length || 0,
    partners: context?.families?.map((family) => family.partner).filter(Boolean).length || 0,
    children: context?.families?.flatMap((family) => family.children || []).filter(Boolean).length || 0,
  }), [context]);

  const {
    actionsRef,
    containerRef,
    contextMenu,
    hoverCard,
    setContextMenu,
    zoomPercent,
  } = useThreeTreeScene({
    activeId,
    dark,
    layout: decoratedLayout,
    onPick,
    onToggleExpand,
    expandedIds,
    palette,
    viewerOptions,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEWER_OPTIONS_STORAGE_KEY, JSON.stringify(viewerOptions));
    } catch {
      // Persisting viewer preferences is optional.
    }
  }, [viewerOptions]);

  const hasTree = layout.nodes.length > 0;

  return (
    <div
      style={styles.shell}
      onPointerMove={() => setControlsVisible(true)}
      onPointerLeave={() => setControlsVisible(true)}
    >
      <div ref={containerRef} style={styles.canvas} />
      {presentationMode && (
        <div style={styles.presentationBadge}>
          {t('interactiveTree.presentationBadge')}
        </div>
      )}
      {!presentationMode && (
      <div style={styles.macTopBar}>
        <button type="button" onClick={() => onReturnToFamilyTree?.()} style={macBarButtonStyle}>
          {t('interactiveTree.returnToFamilyTree')}
        </button>
        <button type="button" onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }} style={macBarButtonStyle}>
          {t('interactiveTree.options')}
        </button>
        <button type="button" onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }} style={macBarButtonStyle}>
          {t('interactiveTree.style')}
        </button>
        <button type="button" onClick={() => actionsRef.current.fit()} style={macBarButtonStyle}>
          {t('interactiveTree.sizeToFit')}
        </button>
        <div style={styles.macActionWrap}>
          <button
            type="button"
            onClick={() => {
              setActionsOpen((open) => !open);
              setControlsVisible(true);
            }}
            style={macBarButtonStyle}
            aria-expanded={actionsOpen}
          >
            {t('interactiveTree.actions')}
          </button>
          {actionsOpen && (
            <div style={styles.macActionMenu}>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onPick?.(activeId); actionsRef.current?.fit?.(); }}>{t('interactiveTree.focusOnPerson')}</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); setPresentationMode(true); }}>{t('interactiveTree.enterPresentation')}</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); actionsRef.current?.snapshot?.(); }}>{t('interactiveTree.saveAsImage')}</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onEditPerson?.(activeId); }}>{t('interactiveTree.editPerson')}</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onShowInfo?.(activeId); }}>{t('interactiveTree.showInfo')}</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onOpenAncestorChart?.(activeId); }}>{t('interactiveTree.ancestorChart')}</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onOpenDescendantChart?.(activeId); }}>{t('interactiveTree.descendantChart')}</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onToggleChrome?.('people'); }}>{t('interactiveTree.personList')}</button>
            </div>
          )}
        </div>
      </div>
      )}
      {!presentationMode && (
      <div style={{ ...styles.controls, ...(!controlsVisible ? styles.controlsHidden : null) }}>
        <button type="button" onClick={() => actionsRef.current.zoom(0.82)} style={styles.iconButton} title={t('interactiveTree.zoomIn')}>+</button>
        <button type="button" onClick={() => actionsRef.current.zoom(1.18)} style={styles.iconButton} title={t('interactiveTree.zoomOut')}>-</button>
        <button type="button" onClick={() => actionsRef.current.fit()} style={styles.fitButton} title={t('interactiveTree.sizeToFit')}>{t('interactiveTree.fit')}</button>
      </div>
      )}
      {!presentationMode && (
      <div style={{ ...styles.bottomDock, ...(isMobile ? styles.bottomDockMobile : null), ...(!controlsVisible ? (isMobile ? styles.bottomDockHiddenMobile : styles.bottomDockHidden) : null) }}>
        <div style={styles.dockGroup}>
          <span style={styles.dockLabel}>{t('interactiveTree.sizeToFit')}</span>
          <input
            type="range"
            min="10"
            max="260"
            value={zoomPercent}
            onChange={(event) => actionsRef.current.zoomTo(Number(event.target.value))}
            style={styles.zoomSlider}
            aria-label={t('interactiveTree.treeZoomAria')}
          />
          <span style={styles.zoomReadout}>{zoomPercent}%</span>
        </div>
        <div style={styles.dockGroup}>
          <Metric label={t('interactiveTree.parents')} value={relationshipCounts.parents} />
          <Metric label={t('interactiveTree.partners')} value={relationshipCounts.partners} />
          <Metric label={t('interactiveTree.children')} value={relationshipCounts.children} />
        </div>
        <TreeNavigationControls context={context} onPick={onPick} />
        <div style={styles.dockGroup}>
          <button
            type="button"
            style={dockButtonStyle}
            onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }}
            aria-pressed={optionsPanelOpen}
          >
            {t('interactiveTree.options')}...
          </button>
          <ViewerSelect
            label={t('interactiveTree.camera')}
            value={viewerOptions.cameraMode}
            options={CAMERA_MODES}
            onChange={(cameraMode) => setViewerOptions((current) => ({ ...current, cameraMode }))}
          />
        </div>
        <div style={styles.dockGroup}>
          <button
            type="button"
            style={dockToggleStyle(chrome.navigation, isMobile)}
            onClick={() => onToggleChrome?.('navigation')}
            aria-pressed={chrome.navigation}
          >
            {t('interactiveTree.nav')}
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.people, isMobile)}
            onClick={() => onToggleChrome?.('people')}
            aria-pressed={chrome.people}
          >
            {t('interactiveTree.people')}
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.inspector, isMobile)}
            onClick={() => onToggleChrome?.('inspector')}
            aria-pressed={chrome.inspector}
          >
            {t('interactiveTree.inspector')}
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.header, isMobile)}
            onClick={() => onToggleChrome?.('header')}
            aria-pressed={chrome.header}
          >
            {t('interactiveTree.header')}
          </button>
        </div>
      </div>
      )}
      {optionsPanelOpen && (
        <OptionsPanel
          viewerOptions={viewerOptions}
          onChange={setViewerOptions}
          onClose={() => setOptionsPanelOpen(false)}
        />
      )}
      {loading && (
        <div style={styles.overlay}>{t('interactiveTree.loading')}</div>
      )}
      {!loading && !hasTree && (
        <div style={styles.emptyCta}>
          <div style={styles.emptyCtaTitle}>{t('interactiveTree.emptyTitle')}</div>
          <div style={styles.emptyCtaMessage}>
            {t('interactiveTree.emptyMessage')}
          </div>
          <button
            type="button"
            style={styles.emptyCtaButton}
            onClick={() => onAddRelative?.({ relation: 'new', anchorId: '' })}
          >
            {t('interactiveTree.addFirstPerson')}
          </button>
        </div>
      )}
      {hoverCard && !contextMenu && (
        <PersonHoverCard person={hoverCard.person} x={hoverCard.x} y={hoverCard.y} />
      )}
      {contextMenu && (
        <PersonContextMenu
          node={contextMenu.node}
          person={contextMenu.person}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onPick={onPick}
          onEditPerson={onEditPerson}
          onOpenFamily={onOpenFamily}
          onShowInfo={onShowInfo}
          onOpenAncestorChart={onOpenAncestorChart}
          onOpenDescendantChart={onOpenDescendantChart}
          onAddRelative={onAddRelative}
          onDeletePerson={onDeletePerson}
          onDeleteFamily={onDeleteFamily}
          onEditInfluential={onEditInfluential}
          onOpenFamilySearch={onOpenFamilySearch}
          context={context}
        />
      )}
    </div>
  );
}

export default ThreeDTreeView;
