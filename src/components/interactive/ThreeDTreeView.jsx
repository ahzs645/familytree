import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import {
  BOTTOM_PLANE_MODES,
  CAMERA_MODES,
  GENERATION_BAND_STYLES,
  LIGHTING_MODES,
  PERSON_STYLES,
  VIEWER_OPTIONS_STORAGE_KEY,
} from './threeDTree/constants.js';
import { cameraFitSignature, fitCamera, persistCameraState, restoreCameraState } from './threeDTree/camera.js';
import { buildInteractiveLayout } from './threeDTree/layout.js';
import { makePalette } from './threeDTree/palette.js';
import {
  makeBottomPlane,
  makeConnector,
  makeFeaturedNode,
  makeGenerationBand,
  makeGenerationLabel,
  makePersonNode,
  preloadReferenceModels,
} from './threeDTree/sceneObjects.js';
import { clearGroup, disposeObject } from './threeDTree/threeUtils.js';
import { readInitialViewerOptions } from './threeDTree/viewerOptions.js';
import { Metric, PersonContextMenu, PersonHoverCard, ViewerSelect, dockToggleStyle } from './threeDTree/overlays.jsx';
import { styles } from './threeDTree/styles.js';

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
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const groupRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const clickablesRef = useRef([]);
  const actionsRef = useRef({ fit: () => {}, zoom: () => {}, zoomTo: () => {} });
  const downRef = useRef(null);
  const hoveredIdRef = useRef(null);
  const fitSignatureRef = useRef(null);
  const persistCameraTimerRef = useRef(0);
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [zoomPercent, setZoomPercent] = useState(100);
  const [modelRevision, setModelRevision] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  const [hoverCard, setHoverCard] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [viewerOptions, setViewerOptions] = useState(readInitialViewerOptions);

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

  useEffect(() => {
    preloadReferenceModels(viewerOptions.personStyle).then((loaded) => {
      if (loaded) setModelRevision((revision) => revision + 1);
    });
  }, [viewerOptions.personStyle]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEWER_OPTIONS_STORAGE_KEY, JSON.stringify(viewerOptions));
    } catch {
      // Persisting viewer preferences is optional.
    }
  }, [viewerOptions]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.background);
    scene.fog = new THREE.Fog(palette.background, 1700, 3900);

    const camera = new THREE.OrthographicCamera(-500, 500, 500, -500, 1, 6000);
    camera.position.set(0, -360, 1550);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.28;
    controls.maxZoom = 2.6;
    controls.maxPolarAngle = Math.PI * 0.68;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    const queueCameraPersistence = () => {
      if (persistCameraTimerRef.current) window.clearTimeout(persistCameraTimerRef.current);
      persistCameraTimerRef.current = window.setTimeout(() => {
        persistCameraTimerRef.current = 0;
        persistCameraState(camera, controls, viewerOptions.cameraMode, activeId);
      }, 180);
    };
    const updateZoomReadout = () => {
      setZoomPercent(Math.round(camera.zoom * 100));
      queueCameraPersistence();
    };
    controls.addEventListener('change', updateZoomReadout);

    scene.add(new THREE.AmbientLight(palette.ambient, 2.2));
    const key = new THREE.DirectionalLight(palette.keyLight, 2.5);
    key.position.set(240, -380, 700);
    key.castShadow = true;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    scene.add(key);
    const fill = new THREE.DirectionalLight(palette.fillLight, 1.25);
    fill.position.set(-500, 460, 420);
    scene.add(fill);

    const stage = new THREE.Group();
    scene.add(stage);

    sceneRef.current = scene;
    groupRef.current = stage;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;

    const fit = (bounds = layout.viewBounds || layout.bounds) => {
      fitCamera(camera, controls, bounds, container, viewerOptions.cameraMode);
      setZoomPercent(Math.round(camera.zoom * 100));
      persistCameraState(camera, controls, viewerOptions.cameraMode, activeId);
    };
    const zoom = (factor) => {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      controls.update();
      setZoomPercent(Math.round(camera.zoom * 100));
      persistCameraState(camera, controls, viewerOptions.cameraMode, activeId);
    };
    const zoomTo = (percent) => {
      camera.zoom = THREE.MathUtils.clamp(percent / 100, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      controls.update();
      setZoomPercent(Math.round(camera.zoom * 100));
      persistCameraState(camera, controls, viewerOptions.cameraMode, activeId);
    };
    actionsRef.current = { fit, zoom, zoomTo };

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const w = Math.max(1, width);
      const h = Math.max(1, height);
      renderer.setSize(w, h, false);
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const intersectPerson = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickablesRef.current, true)[0];
      let object = hit?.object;
      while (object && !object.userData.person) object = object.parent;
      return object?.userData.node || (object?.userData.person ? { person: object.userData.person } : null);
    };

    const onPointerDown = (event) => {
      setContextMenu(null);
      downRef.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event) => {
      if (event.button !== 0) return;
      const start = downRef.current;
      downRef.current = null;
      if (!start) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > 6) return;
      const person = intersectPerson(event);
      if (person?.person) onPick?.(person.person.recordName);
    };
    const onPointerMove = (event) => {
      const person = intersectPerson(event);
      const nextHoveredId = person?.person?.recordName || null;
      renderer.domElement.style.cursor = person ? 'pointer' : 'grab';
      setHoverCard(person ? { person: person.person, x: event.clientX, y: event.clientY } : null);
      if (hoveredIdRef.current !== nextHoveredId) {
        hoveredIdRef.current = nextHoveredId;
        setHoveredId(nextHoveredId);
      }
    };
    const onPointerLeave = () => {
      renderer.domElement.style.cursor = 'grab';
      setHoverCard(null);
      if (hoveredIdRef.current !== null) {
        hoveredIdRef.current = null;
        setHoveredId(null);
      }
    };
    const onContextMenu = (event) => {
      event.preventDefault();
      const person = intersectPerson(event);
      setContextMenu(person ? { node: person, person: person.person, x: event.clientX, y: event.clientY } : null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (persistCameraTimerRef.current) {
        window.clearTimeout(persistCameraTimerRef.current);
        persistCameraTimerRef.current = 0;
      }
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      controls.removeEventListener('change', updateZoomReadout);
      controls.dispose();
      disposeObject(stage);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      groupRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      hoveredIdRef.current = null;
      setHoverCard(null);
      setContextMenu(null);
      fitSignatureRef.current = null;
      clickablesRef.current = [];
    };
    // The scene is rebuilt only when the color system changes; layout changes update the stage below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, palette, viewerOptions.cameraMode]);

  useEffect(() => {
    const scene = sceneRef.current;
    const stage = groupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const container = containerRef.current;
    if (!scene || !stage || !camera || !controls || !container) return;

    clearGroup(stage);
    clickablesRef.current = [];

    stage.add(makeBottomPlane(palette, layout.bounds, viewerOptions.bottomPlaneMode));
    for (const band of layout.bands) {
      stage.add(makeGenerationBand(band, palette, viewerOptions.generationBandStyle));
      if (viewerOptions.generationBandStyle !== 'none') stage.add(makeGenerationLabel(band));
    }

    for (const link of layout.links) {
      stage.add(makeConnector(link, layout.nodes, palette));
    }

    for (const node of layout.nodes) {
      const object = node.featured
        ? makeFeaturedNode(node, palette, viewerOptions.personStyle, hoveredId === node.id)
        : makePersonNode(node, palette, viewerOptions.personStyle, hoveredId === node.id);
      stage.add(object);
      clickablesRef.current.push(object);
    }

    const fitSignature = cameraFitSignature(layout, activeId, viewerOptions.cameraMode);
    if (fitSignatureRef.current !== fitSignature) {
      const restored = restoreCameraState(camera, controls, viewerOptions.cameraMode, activeId);
      if (!restored) fitCamera(camera, controls, layout.viewBounds || layout.bounds, container, viewerOptions.cameraMode);
      fitSignatureRef.current = fitSignature;
      setZoomPercent(Math.round(camera.zoom * 100));
    }
    actionsRef.current.fit = () => {
      fitCamera(camera, controls, layout.viewBounds || layout.bounds, container, viewerOptions.cameraMode);
      setZoomPercent(Math.round(camera.zoom * 100));
      persistCameraState(camera, controls, viewerOptions.cameraMode, activeId);
    };
  }, [layout, palette, modelRevision, viewerOptions, hoveredId, activeId]);

  const hasTree = layout.nodes.length > 0;

  return (
    <div style={styles.shell}>
      <div ref={containerRef} style={styles.canvas} />
      <div style={styles.controls}>
        <button type="button" onClick={() => actionsRef.current.zoom(0.82)} style={styles.iconButton} title="Zoom in">+</button>
        <button type="button" onClick={() => actionsRef.current.zoom(1.18)} style={styles.iconButton} title="Zoom out">-</button>
        <button type="button" onClick={() => actionsRef.current.fit()} style={styles.fitButton} title="Size to fit">Fit</button>
      </div>
      <div style={styles.bottomDock}>
        <div style={styles.dockGroup}>
          <span style={styles.dockLabel}>Size to Fit</span>
          <input
            type="range"
            min="34"
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
        <div style={styles.dockGroup}>
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
