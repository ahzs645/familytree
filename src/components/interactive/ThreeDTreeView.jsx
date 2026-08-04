import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { CAMERA_MODES, VIEWER_OPTIONS_STORAGE_KEY } from './threeDTree/constants.js';
import { buildInteractiveLayout } from './threeDTree/layout.js';
import { calculateReferenceNumbers } from '../../lib/referenceNumbering.js';
import { makePalette } from './threeDTree/palette.js';
import { readInitialViewerOptions } from './threeDTree/viewerOptions.js';
import { Metric, PersonContextMenu, PersonHoverCard, TreeNavigationControls, ViewerSelect } from './threeDTree/overlays.jsx';
import { OptionsPanel } from './threeDTree/OptionsPanel.jsx';
import { useThreeTreeScene } from './threeDTree/useThreeTreeScene.js';
import { Button } from '../ui/Button.jsx';
import { cn } from '../../lib/utils.js';
import { AnchoredPopover } from '../ui/AnchoredPopover.jsx';

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
  // Mobile touch-target bump for the top-bar and dock buttons.
  const macBarButtonClass = cn('shrink-0 whitespace-nowrap font-bold', isMobile && 'h-10 px-3.5');
  const dockButtonClass = cn('font-bold', isMobile && 'h-[38px] min-h-[38px] shrink-0 px-3');
  const [viewerOptions, setViewerOptions] = useState(readInitialViewerOptions);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [optionsPanelOpen, setOptionsPanelOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const actionsButtonRef = useRef(null);

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
      className="relative h-full min-h-0 w-full overflow-hidden bg-background"
      onPointerMove={() => setControlsVisible(true)}
      onPointerLeave={() => setControlsVisible(true)}
    >
      <div ref={containerRef} className="h-full w-full" />
      {presentationMode && (
        <div className="absolute left-1/2 top-[18px] z-[28] -translate-x-1/2 rounded-full bg-[rgba(20,20,20,0.72)] px-3.5 py-[7px] text-xs font-semibold tracking-[0.2px] text-[#f4f5f7] shadow-[0_10px_28px_rgb(0_0_0/0.32)] backdrop-blur-[12px]">
          {t('interactiveTree.presentationBadge')}
        </div>
      )}
      {!presentationMode && (
      <div
        className={cn(
          // Reserve room for the zoom cluster (+/−/Fit ≈ 110px wide at inset 12px)
          // so the two bars never overlap on narrow screens.
          'absolute start-3 top-3 z-[22] flex max-w-[calc(100%-148px)] items-center gap-2 overflow-x-auto rounded-md border border-border bg-card/[0.88] p-1.5 shadow-[0_10px_24px_rgb(0_0_0/0.12)] backdrop-blur-md',
          // Mobile: wrap rather than scroll. At 390px the bar has ~240px of room
          // (the rest is reserved for the zoom cluster), so five buttons became
          // a 555px strip cut off mid-word with no affordance.
          isMobile && 'flex-wrap gap-y-1.5 overflow-x-visible'
        )}
      >
        <Button onClick={() => onReturnToFamilyTree?.()} className={macBarButtonClass}>
          {t('interactiveTree.returnToFamilyTree')}
        </Button>
        <Button onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }} className={macBarButtonClass}>
          {t('interactiveTree.options')}
        </Button>
        <Button onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }} className={macBarButtonClass}>
          {t('interactiveTree.style')}
        </Button>
        <Button onClick={() => actionsRef.current.fit()} className={macBarButtonClass}>
          {t('interactiveTree.sizeToFit')}
        </Button>
        <div className="relative shrink-0">
          <Button
            ref={actionsButtonRef}
            onClick={() => {
              setActionsOpen((open) => !open);
              setControlsVisible(true);
            }}
            className={macBarButtonClass}
            aria-expanded={actionsOpen}
          >
            {t('interactiveTree.actions')}
          </Button>
          {actionsOpen && (
            <AnchoredPopover
              anchorRef={actionsButtonRef}
              align="start"
              maxHeight="80vh"
              role="menu"
              className="w-[186px] rounded-md border border-border bg-card/[0.98] p-1.5 shadow-[0_18px_40px_rgb(0_0_0/0.22)] backdrop-blur-md"
            >
              <Button variant="ghost" className={macActionItemClass} onClick={() => { setActionsOpen(false); onPick?.(activeId); actionsRef.current?.fit?.(); }}>{t('interactiveTree.focusOnPerson')}</Button>
              <Button variant="ghost" className={macActionItemClass} onClick={() => { setActionsOpen(false); setPresentationMode(true); }}>{t('interactiveTree.enterPresentation')}</Button>
              <Button variant="ghost" className={macActionItemClass} onClick={() => { setActionsOpen(false); actionsRef.current?.snapshot?.(); }}>{t('interactiveTree.saveAsImage')}</Button>
              <Button variant="ghost" className={macActionItemClass} onClick={() => { setActionsOpen(false); onEditPerson?.(activeId); }}>{t('interactiveTree.editPerson')}</Button>
              <Button variant="ghost" className={macActionItemClass} onClick={() => { setActionsOpen(false); onShowInfo?.(activeId); }}>{t('interactiveTree.showInfo')}</Button>
              <Button variant="ghost" className={macActionItemClass} onClick={() => { setActionsOpen(false); onOpenAncestorChart?.(activeId); }}>{t('interactiveTree.ancestorChart')}</Button>
              <Button variant="ghost" className={macActionItemClass} onClick={() => { setActionsOpen(false); onOpenDescendantChart?.(activeId); }}>{t('interactiveTree.descendantChart')}</Button>
              <Button variant="ghost" className={macActionItemClass} onClick={() => { setActionsOpen(false); onToggleChrome?.('people'); }}>{t('interactiveTree.personList')}</Button>
            </AnchoredPopover>
          )}
        </div>
      </div>
      )}
      {!presentationMode && (
      <div
        className={cn(
          'absolute end-3 top-3 flex gap-1.5 rounded-md border border-border bg-card/[0.82] p-1.5 shadow-[0_10px_24px_rgb(0_0_0/0.12)] backdrop-blur-[12px] transition-[opacity,transform] duration-150',
          !controlsVisible && 'pointer-events-none -translate-y-[5px] opacity-0'
        )}
      >
        <Button size="icon" onClick={() => actionsRef.current.zoom(0.82)} className="h-[31px] w-[31px] text-[15px] font-bold" title={t('interactiveTree.zoomIn')}>+</Button>
        <Button size="icon" onClick={() => actionsRef.current.zoom(1.18)} className="h-[31px] w-[31px] text-[15px] font-bold" title={t('interactiveTree.zoomOut')}>-</Button>
        <Button onClick={() => actionsRef.current.fit()} className="font-bold" title={t('interactiveTree.sizeToFit')}>{t('interactiveTree.fit')}</Button>
      </div>
      )}
      {!presentationMode && (
      <div
        className={cn(
          'absolute bottom-3.5 left-1/2 flex max-w-[calc(100%-32px)] -translate-x-1/2 flex-wrap items-center justify-center gap-3 overflow-auto rounded-md border border-border bg-card/[0.86] px-2.5 py-2 text-foreground shadow-[0_14px_34px_rgb(0_0_0/0.16)] backdrop-blur-md transition-[opacity,transform] duration-150',
          // Mobile: pin edge-to-edge and wrap rather than scroll. As a nowrap
          // strip the dock ran ~1600px — over four phone screens — so reaching
          // Options meant a long blind swipe with no affordance. Wrapped, the
          // same groups occupy two or three short rows and every control is on
          // screen at once.
          isMobile && 'left-2 right-2 max-w-none translate-x-0 justify-start gap-2 gap-y-1.5 overflow-hidden px-2 py-1.5',
          !controlsVisible && 'pointer-events-none translate-y-2 opacity-0'
        )}
      >
        <div className={dockGroupClass}>
          <span className="whitespace-nowrap text-xs font-bold text-muted-foreground">{t('interactiveTree.sizeToFit')}</span>
          <input
            type="range"
            min="10"
            max="260"
            value={zoomPercent}
            onChange={(event) => actionsRef.current.zoomTo(Number(event.target.value))}
            className="w-[118px] accent-primary"
            aria-label={t('interactiveTree.treeZoomAria')}
          />
          <span className="w-[42px] text-xs font-bold text-foreground">{zoomPercent}%</span>
        </div>
        <div className={dockGroupClass}>
          <Metric label={t('interactiveTree.parents')} value={relationshipCounts.parents} />
          <Metric label={t('interactiveTree.partners')} value={relationshipCounts.partners} />
          <Metric label={t('interactiveTree.children')} value={relationshipCounts.children} />
        </div>
        <TreeNavigationControls context={context} onPick={onPick} />
        <div className={dockGroupClass}>
          <Button
            className={dockButtonClass}
            onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }}
            aria-pressed={optionsPanelOpen}
          >
            {t('interactiveTree.options')}...
          </Button>
          {/* Camera duplicates "Camera Perspective" inside the Options panel.
              Keep it on the dock where there is room; on a phone the dock is
              already several screens wide, so the panel is the only copy. */}
          {!isMobile && (
            <ViewerSelect
              label={t('interactiveTree.camera')}
              value={viewerOptions.cameraMode}
              options={CAMERA_MODES}
              onChange={(cameraMode) => setViewerOptions((current) => ({ ...current, cameraMode }))}
            />
          )}
        </div>
        {/* Chrome toggles. Only `navigation` does anything on mobile —
            InteractiveTreeApp forces the people list and header on, and hides
            the inspector outright, at that width (showPeople/showHeader/
            showInspector all short-circuit on isMobile). Rendering the other
            three there gave the dock four buttons that changed nothing. */}
        <div className={dockGroupClass}>
          <Button
            className={dockToggleClass(chrome.navigation, dockButtonClass)}
            onClick={() => onToggleChrome?.('navigation')}
            aria-pressed={chrome.navigation}
          >
            {t('interactiveTree.nav')}
          </Button>
          {!isMobile && (
            <>
              <Button
                className={dockToggleClass(chrome.people, dockButtonClass)}
                onClick={() => onToggleChrome?.('people')}
                aria-pressed={chrome.people}
              >
                {t('interactiveTree.people')}
              </Button>
              <Button
                className={dockToggleClass(chrome.inspector, dockButtonClass)}
                onClick={() => onToggleChrome?.('inspector')}
                aria-pressed={chrome.inspector}
              >
                {t('interactiveTree.inspector')}
              </Button>
              <Button
                className={dockToggleClass(chrome.header, dockButtonClass)}
                onClick={() => onToggleChrome?.('header')}
                aria-pressed={chrome.header}
              >
                {t('interactiveTree.header')}
              </Button>
            </>
          )}
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
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/[0.45] text-sm text-muted-foreground">{t('interactiveTree.loading')}</div>
      )}
      {!loading && !hasTree && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-6 text-center text-foreground">
          <div className="text-lg font-extrabold text-foreground">{t('interactiveTree.emptyTitle')}</div>
          <div className="max-w-[420px] text-sm font-semibold leading-snug text-muted-foreground">
            {t('interactiveTree.emptyMessage')}
          </div>
          <button
            type="button"
            className="mt-1.5 h-9 cursor-pointer rounded-md border border-primary/40 bg-primary/[0.12] px-4 text-sm font-bold text-foreground"
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

const macActionItemClass = 'w-full min-h-[30px] justify-start text-start font-bold';
const dockGroupClass = 'flex shrink-0 items-center gap-2';

// Dock chrome toggles: primary-tinted when the pane is shown, muted otherwise.
function dockToggleClass(active, base) {
  return cn(
    base,
    active
      ? 'border-primary/[0.45] bg-primary/[0.14] text-foreground'
      : 'text-muted-foreground'
  );
}

export default ThreeDTreeView;
