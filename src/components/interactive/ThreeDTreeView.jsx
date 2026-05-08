import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import {
  BOTTOM_PLANE_MODES,
  CAMERA_MODES,
  GENERATION_BAND_STYLES,
  LIGHTING_MODES,
  PERSON_STYLES,
  APPEARANCE_MODES,
  VIEWER_OPTIONS_STORAGE_KEY,
} from './threeDTree/constants.js';
import { buildInteractiveLayout } from './threeDTree/layout.js';
import { makePalette } from './threeDTree/palette.js';
import { readInitialViewerOptions } from './threeDTree/viewerOptions.js';
import { Metric, PersonContextMenu, PersonHoverCard, TreeNavigationControls, ViewerSelect, dockToggleStyle } from './threeDTree/overlays.jsx';
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
  context,
  chrome = { navigation: true, people: true, inspector: true, header: true },
  onToggleChrome,
}) {
  const { theme } = useTheme();
  const appDark = theme === 'dark';
  const [viewerOptions, setViewerOptions] = useState(readInitialViewerOptions);
  const [controlsVisible, setControlsVisible] = useState(false);

  const dark = viewerOptions.appearanceMode === 'app' ? appDark : false;
  const palette = useMemo(() => makePalette(dark, viewerOptions.lightingMode), [dark, viewerOptions.lightingMode]);
  const layout = useMemo(
    () => buildInteractiveLayout(ancestorTree, descendantTree, activeId, familyGraph),
    [ancestorTree, descendantTree, activeId, familyGraph]
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
      onPointerEnter={() => setControlsVisible(true)}
      onPointerLeave={() => setControlsVisible(false)}
    >
      <div ref={containerRef} style={styles.canvas} />
      <div style={{ ...styles.controls, ...(!controlsVisible ? styles.controlsHidden : null) }}>
        <button type="button" onClick={() => actionsRef.current.zoom(0.82)} style={styles.iconButton} title="Zoom in">+</button>
        <button type="button" onClick={() => actionsRef.current.zoom(1.18)} style={styles.iconButton} title="Zoom out">-</button>
        <button type="button" onClick={() => actionsRef.current.fit()} style={styles.fitButton} title="Size to fit">Fit</button>
      </div>
      <div style={{ ...styles.bottomDock, ...(!controlsVisible ? styles.bottomDockHidden : null) }}>
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
          <ViewerSelect
            label="Canvas"
            value={viewerOptions.appearanceMode}
            options={APPEARANCE_MODES}
            onChange={(appearanceMode) => setViewerOptions((current) => ({ ...current, appearanceMode }))}
          />
          <ViewerSelect
            label="Style"
            value={viewerOptions.personStyle}
            options={PERSON_STYLES}
            onChange={(personStyle) => setViewerOptions((current) => ({ ...current, personStyle }))}
          />
          <ViewerSelect
            label="Camera"
            value={viewerOptions.cameraMode}
            options={CAMERA_MODES}
            onChange={(cameraMode) => setViewerOptions((current) => ({ ...current, cameraMode }))}
          />
          <ViewerSelect
            label="Lighting"
            value={viewerOptions.lightingMode}
            options={LIGHTING_MODES}
            onChange={(lightingMode) => setViewerOptions((current) => ({ ...current, lightingMode }))}
          />
          <ViewerSelect
            label="Floor"
            value={viewerOptions.bottomPlaneMode}
            options={BOTTOM_PLANE_MODES}
            onChange={(bottomPlaneMode) => setViewerOptions((current) => ({ ...current, bottomPlaneMode }))}
          />
          <ViewerSelect
            label="Bands"
            value={viewerOptions.generationBandStyle}
            options={GENERATION_BAND_STYLES}
            onChange={(generationBandStyle) => setViewerOptions((current) => ({ ...current, generationBandStyle }))}
          />
        </div>
        <div style={styles.dockGroup}>
          <button
            type="button"
            style={dockToggleStyle(chrome.navigation)}
            onClick={() => onToggleChrome?.('navigation')}
            aria-pressed={chrome.navigation}
          >
            Nav
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.people)}
            onClick={() => onToggleChrome?.('people')}
            aria-pressed={chrome.people}
          >
            People
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.inspector)}
            onClick={() => onToggleChrome?.('inspector')}
            aria-pressed={chrome.inspector}
          >
            Inspector
          </button>
          <button
            type="button"
            style={dockToggleStyle(chrome.header)}
            onClick={() => onToggleChrome?.('header')}
            aria-pressed={chrome.header}
          >
            Header
          </button>
        </div>
      </div>
      {(loading || !hasTree) && (
        <div style={styles.overlay}>
          {loading ? 'Loading tree...' : 'Pick a person from the list.'}
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
        />
      )}
    </div>
  );
}

export default ThreeDTreeView;
