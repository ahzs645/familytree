import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { CAMERA_MODES, VIEWER_OPTIONS_STORAGE_KEY } from './threeDTree/constants.js';
import { buildInteractiveLayout } from './threeDTree/layout.js';
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
  context,
  chrome = { navigation: true, people: true, inspector: true, header: true },
  onToggleChrome,
  onReturnToFamilyTree,
}) {
  const { theme } = useTheme();
  const appDark = theme === 'dark';
  const isMobile = useIsMobile();
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
    }),
    [ancestorTree, descendantTree, activeId, familyGraph, viewerOptions.ancestorGenerations, viewerOptions.descendantGenerations, viewerOptions.childSortingMode]
  );
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
    layout,
    onPick,
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
          Presentation — press Esc to exit
        </div>
      )}
      {!presentationMode && (
      <div style={styles.macTopBar}>
        <button type="button" onClick={() => onReturnToFamilyTree?.()} style={macBarButtonStyle}>
          Return to Family Tree
        </button>
        <button type="button" onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }} style={macBarButtonStyle}>
          Options
        </button>
        <button type="button" onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }} style={macBarButtonStyle}>
          Style
        </button>
        <button type="button" onClick={() => actionsRef.current.fit()} style={macBarButtonStyle}>
          Size to Fit
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
            Actions...
          </button>
          {actionsOpen && (
            <div style={styles.macActionMenu}>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onPick?.(activeId); actionsRef.current?.fit?.(); }}>Focus on Person</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); setPresentationMode(true); }}>Enter Presentation</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onEditPerson?.(activeId); }}>Edit Person</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onShowInfo?.(activeId); }}>Show Info</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onOpenAncestorChart?.(activeId); }}>Ancestor Chart</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onOpenDescendantChart?.(activeId); }}>Descendant Chart</button>
              <button type="button" style={styles.macActionItem} onClick={() => { setActionsOpen(false); onToggleChrome?.('people'); }}>Person List</button>
            </div>
          )}
        </div>
      </div>
      )}
      {!presentationMode && (
      <div style={{ ...styles.controls, ...(!controlsVisible ? styles.controlsHidden : null) }}>
        <button type="button" onClick={() => actionsRef.current.zoom(0.82)} style={styles.iconButton} title="Zoom in">+</button>
        <button type="button" onClick={() => actionsRef.current.zoom(1.18)} style={styles.iconButton} title="Zoom out">-</button>
        <button type="button" onClick={() => actionsRef.current.fit()} style={styles.fitButton} title="Size to fit">Fit</button>
      </div>
      )}
      {!presentationMode && (
      <div style={{ ...styles.bottomDock, ...(isMobile ? styles.bottomDockMobile : null), ...(!controlsVisible ? (isMobile ? styles.bottomDockHiddenMobile : styles.bottomDockHidden) : null) }}>
        <div style={styles.dockGroup}>
          <span style={styles.dockLabel}>Size to Fit</span>
          <input
            type="range"
            min="10"
            max="260"
            value={zoomPercent}
            onChange={(event) => actionsRef.current.zoomTo(Number(event.target.value))}
            style={styles.zoomSlider}
            aria-label="Tree zoom"
          />
          <span style={styles.zoomReadout}>{zoomPercent}%</span>
        </div>
        <div style={styles.dockGroup}>
          <Metric label="Parents" value={relationshipCounts.parents} />
          <Metric label="Partners" value={relationshipCounts.partners} />
          <Metric label="Children" value={relationshipCounts.children} />
        </div>
        <TreeNavigationControls context={context} onPick={onPick} />
        <div style={styles.dockGroup}>
          <button
            type="button"
            style={dockButtonStyle}
            onClick={() => { setOptionsPanelOpen(true); setControlsVisible(true); }}
            aria-pressed={optionsPanelOpen}
          >
            Options...
          </button>
          <ViewerSelect
            label="Camera"
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
            Nav
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.people, isMobile)}
            onClick={() => onToggleChrome?.('people')}
            aria-pressed={chrome.people}
          >
            People
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.inspector, isMobile)}
            onClick={() => onToggleChrome?.('inspector')}
            aria-pressed={chrome.inspector}
          >
            Inspector
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.header, isMobile)}
            onClick={() => onToggleChrome?.('header')}
            aria-pressed={chrome.header}
          >
            Header
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
        <div style={styles.overlay}>Loading tree...</div>
      )}
      {!loading && !hasTree && (
        <div style={styles.emptyCta}>
          <div style={styles.emptyCtaTitle}>No persons present</div>
          <div style={styles.emptyCtaMessage}>
            There are no persons in this family tree. Use the button below to start with a new person.
          </div>
          <button
            type="button"
            style={styles.emptyCtaButton}
            onClick={() => onAddRelative?.({ relation: 'new', anchorId: '' })}
          >
            Add First Person
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
          context={context}
        />
      )}
    </div>
  );
}

export default ThreeDTreeView;
