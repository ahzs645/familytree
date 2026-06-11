import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cameraFitSignature, computeFitState, fitCamera, persistCameraState, restoreCameraState } from './camera.js';
import { animateCameraTo, createTweenManager, easeOutBack } from './animation.js';
import {
  makeBottomPlane,
  makeFamilyConnectors,
  makeFeaturedNode,
  makeGenerationBand,
  makeGenerationLabel,
  makePersonNode,
  preloadReferenceModels,
} from './sceneObjects.js';
import { clearGroup, disposeObject } from './threeUtils.js';
import { createCameraActions } from './treeSceneActions.js';
import { generationDepthZ } from './constants.js';

export function useThreeTreeScene({
  activeId,
  dark,
  layout,
  onPick,
  onToggleExpand,
  expandedIds,
  palette,
  viewerOptions,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const groupRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const clickablesRef = useRef([]);
  const connectorsRef = useRef(null);
  const actionsRef = useRef({ fit: () => {}, zoom: () => {}, zoomTo: () => {} });
  const downRef = useRef(null);
  const hoveredIdRef = useRef(null);
  const hoveredConnectionRef = useRef(null);
  // Native line-highlight behaviour: hovering a PERSON lights up the family
  // lines TOUCHING it (not a traced lineage path). connHighlightKeysRef holds
  // the set of family ids to glow; familiesByPersonRef caches person→families
  // built from the layout links (link.nodeIds are record names = node ids).
  const connHighlightKeysRef = useRef(new Set());
  const familiesByPersonRef = useRef({ links: null, map: new Map() });
  const fitSignatureRef = useRef(null);
  const persistCameraTimerRef = useRef(0);
  const tweensRef = useRef(null);
  const cameraTweenRef = useRef(null);
  const nodeTweensRef = useRef([]);
  const firstFitRef = useRef(true);
  const prevNodeIdsRef = useRef(null);
  // Generation-label groups + a live viewerOptions ref so the persistent animate
  // loop can keep band labels in view while the user scrolls.
  const genLabelsRef = useRef([]);
  const viewerOptionsRef = useRef(viewerOptions);
  viewerOptionsRef.current = viewerOptions;
  // Live refs so the once-registered keydown handler always sees current data.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onToggleExpandRef = useRef(onToggleExpand);
  onToggleExpandRef.current = onToggleExpand;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const animationsEnabled = viewerOptions?.animationDuration !== 0;
  const animationScale = Number.isFinite(viewerOptions?.animationDuration) ? viewerOptions.animationDuration : 1;
  const [zoomPercent, setZoomPercent] = useState(100);
  const [modelRevision, setModelRevision] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);
  // Signature of the currently glowing family-line set (drives connector rebuild).
  const [connHighlightSig, setConnHighlightSig] = useState('');
  const [hoverCard, setHoverCard] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  // Hover/selection swap individual node objects instead of rebuilding the
  // whole stage (which clones models + re-renders every canvas texture and made
  // pointer-move feel sluggish). The heavy build effect reads these refs; the
  // light effects below patch the live scene.
  const selectedIdRef = useRef(null);
  const nodeObjectsRef = useRef(new Map());
  const stageCtxRef = useRef(null);
  const renderedHoverRef = useRef({ hoveredId: null, selectedId: null });
  const renderedConnKeyRef = useRef(null);
  // Cheap raycast target lists: invisible person hit-proxies / expand-pin pads
  // and coarse connector hit-tubes. Raycasting the full stage (high-poly .dae
  // clones + every rendered tube) cost ~370ms per pointer-move.
  const hitTargetsRef = useRef([]);
  const connectorHitsRef = useRef([]);
  // Demand-rendering flag: the animate loop only draws when this is set (or
  // tweens/controls are active). Set it after any scene mutation.
  const needsRenderRef = useRef(true);
  const refreshHitTargets = () => {
    const targets = [];
    for (const object of nodeObjectsRef.current.values()) {
      object.traverse((child) => {
        if (child.isMesh && (child.userData.hitProxy || child.userData.expandFor)) targets.push(child);
      });
    }
    hitTargetsRef.current = targets;
  };
  const refreshConnectorHits = () => {
    const hits = [];
    connectorsRef.current?.traverse((child) => {
      if (child.isMesh && child.userData.connectorHit) hits.push(child);
    });
    connectorHitsRef.current = hits;
  };
  const fitBoundsForOptions = () => {
    if (viewerOptions.appearanceMode === 'macLight' && viewerOptions.cameraMode === 'top') {
      return layout.bounds;
    }
    return layout.viewBounds || layout.bounds;
  };

  useEffect(() => {
    preloadReferenceModels(viewerOptions.personStyle).then((loaded) => {
      if (loaded) setModelRevision((revision) => revision + 1);
    });
  }, [viewerOptions.personStyle]);

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
    // Pre-fit placeholder at the default preset's tilt (topDownSlight, -63°).
    camera.position.set(0, -772, 1515);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true; // zoom toward the pointer, like the native viewer
    controls.minZoom = 0.1;
    controls.maxZoom = 4.5; // allow close inspection of the small busts
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
      needsRenderRef.current = true;
      setZoomPercent(Math.round(camera.zoom * 100));
      queueCameraPersistence();
    };
    controls.addEventListener('change', updateZoomReadout);

    const illumination = Number.isFinite(viewerOptions.illuminationStrength) ? viewerOptions.illuminationStrength : 1;
    const shadowStrength = Number.isFinite(viewerOptions.shadowStrength) ? viewerOptions.shadowStrength : 1;
    // Match the native SceneKit rig (decompiled from InteractiveTreeView3DViewer
    // setupSceneEssentials): ONE strong spot/key light from above (~850) + a
    // dimmer ambient fill (~550), ratio ~1.5:1, no separate fill light. The
    // figures' "glossy" look is NOT material specular (native materials are
    // matte Blinn, shininess 0) — it is this single overhead key producing a
    // bright-top / dark-bottom gradient on each rounded body.
    scene.add(new THREE.AmbientLight(palette.ambient, 1.0 * illumination));
    const shadowRadius = Number.isFinite(viewerOptions.shadowRadius) ? viewerOptions.shadowRadius : 1;
    const key = new THREE.DirectionalLight(palette.keyLight, 2.3 * illumination);
    // High overhead, only slightly toward the camera (-y) so tops catch light
    // and a soft contact shadow falls behind each figure.
    key.position.set(60, -240, 940);
    key.castShadow = shadowStrength > 0;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.bias = -0.0005;
    key.shadow.radius = Math.max(0, 3 * shadowRadius);
    scene.add(key);
    // Faint cool fill only to keep shadow sides from going fully black — the
    // native rig has no second directional, just ambient, so keep this low.
    const fill = new THREE.DirectionalLight(palette.fillLight, 0.4 * illumination);
    fill.position.set(-420, 380, 520);
    scene.add(fill);
    renderer.shadowMap.enabled = shadowStrength > 0;

    const stage = new THREE.Group();
    scene.add(stage);
    scene.userData.renderer = renderer;

    groupRef.current = stage;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    // Fresh scene (created on camera-mode / palette / lighting change) → the
    // next framing should snap, not fly. Subsequent focus changes animate.
    tweensRef.current = createTweenManager();
    cameraTweenRef.current = null;
    nodeTweensRef.current = [];
    firstFitRef.current = true;

    actionsRef.current = createCameraActions({
      activeId,
      camera,
      container,
      controls,
      getBounds: fitBoundsForOptions,
      setZoomPercent,
      viewerOptions,
      tweens: tweensRef.current,
      cameraTweenRef,
    });

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
      needsRenderRef.current = true;
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
      const hit = raycaster.intersectObjects(hitTargetsRef.current, false)[0];
      let object = hit?.object;
      // Walk up to the owning person, noting an expand-pin on the way (the pin is
      // a child of the person group, so we see it before the person itself).
      let expandFor = null;
      while (object) {
        if (expandFor === null && object.userData.expandFor) expandFor = object.userData.expandFor;
        if (object.userData.person) break;
        object = object.parent;
      }
      const node = object?.userData.node || (object?.userData.person ? { person: object.userData.person } : null);
      if (node) node.expandFor = expandFor;
      return node;
    };

    // Raycast the connector group and return the family id of the connection
    // under the cursor (or null) so it can be hover-highlighted.
    const intersectConnection = (event) => {
      const connectors = connectorsRef.current;
      if (!connectors) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(connectorHitsRef.current, false);
      return hits[0]?.object?.userData?.connectionKey || null;
    };

    // The set of family ids that should glow: all families touching the hovered
    // person, or the single hovered connection. Mirrors the native rule (touched
    // lines, not a lineage path). Rebuilds the person→families cache lazily when
    // the layout changes.
    const familiesForPerson = (personId) => {
      const currentLayout = layoutRef.current;
      if (!personId || !currentLayout) return null;
      const cache = familiesByPersonRef.current;
      if (cache.links !== currentLayout.links) {
        const map = new Map();
        for (const link of currentLayout.links || []) {
          if (!link.familyId || !link.nodeIds) continue;
          for (const pid of link.nodeIds) {
            if (!map.has(pid)) map.set(pid, new Set());
            map.get(pid).add(link.familyId);
          }
        }
        familiesByPersonRef.current = { links: currentLayout.links, map };
      }
      return familiesByPersonRef.current.map.get(personId) || null;
    };
    const updateConnHighlight = (personId, connectionKey) => {
      let keys;
      if (personId) keys = familiesForPerson(personId) || new Set();
      else if (connectionKey) keys = new Set([connectionKey]);
      else keys = new Set();
      const sig = [...keys].sort().join('|');
      const prevSig = [...connHighlightKeysRef.current].sort().join('|');
      if (sig === prevSig) return;
      connHighlightKeysRef.current = keys;
      setConnHighlightSig(sig);
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
      // Clicking a "further persons" pin expands/collapses that person's hidden
      // families in place (native click-to-expand on the further-persons mark).
      if (person?.expandFor && onToggleExpandRef.current) {
        onToggleExpandRef.current(person.expandFor);
        return;
      }
      // Native model: single-click SELECTS (highlight ring); double-click focuses
      // (re-roots, see onDblClick). Clicking empty space clears the selection.
      selectedIdRef.current = person?.person ? person.person.recordName : null;
      setSelectedId(selectedIdRef.current);
    };
    const onDblClick = (event) => {
      const person = intersectPerson(event);
      if (person?.person) onPickRef.current?.(person.person.recordName);
    };
    // Process at most one hover hit-test per animation frame — pointer-move can
    // fire far faster than the frame rate and each test does two raycasts.
    let pendingMove = null;
    let moveRaf = 0;
    const processMove = () => {
      moveRaf = 0;
      const event = pendingMove;
      pendingMove = null;
      if (!event) return;
      const person = intersectPerson(event);
      const nextHoveredId = person?.person?.recordName || null;
      // A person under the cursor wins; otherwise test the connection lines so a
      // hovered relationship highlights (thicker + brighter), like the source.
      const nextConnection = person ? null : intersectConnection(event);
      renderer.domElement.style.cursor = person || nextConnection ? 'pointer' : 'grab';
      setHoverCard(person ? { person: person.person, x: event.clientX, y: event.clientY } : null);
      if (hoveredIdRef.current !== nextHoveredId) {
        hoveredIdRef.current = nextHoveredId;
        setHoveredId(nextHoveredId);
      }
      hoveredConnectionRef.current = nextConnection;
      // Hovering a person glows the lines touching it; hovering a bare line glows
      // just that line. (Native: touched lines, no traced path.)
      updateConnHighlight(nextHoveredId, nextConnection);
    };
    const onPointerMove = (event) => {
      pendingMove = { clientX: event.clientX, clientY: event.clientY };
      if (!moveRaf) moveRaf = requestAnimationFrame(processMove);
    };
    const onPointerLeave = () => {
      renderer.domElement.style.cursor = 'grab';
      setHoverCard(null);
      if (hoveredIdRef.current !== null) {
        hoveredIdRef.current = null;
        setHoveredId(null);
      }
      hoveredConnectionRef.current = null;
      updateConnHighlight(null, null);
    };
    const onContextMenu = (event) => {
      event.preventDefault();
      const person = intersectPerson(event);
      setContextMenu(person ? { node: person, person: person.person, x: event.clientX, y: event.clientY } : null);
    };

    // Arrow-key navigation: move focus to the nearest person in that direction
    // from the current root (the native viewer's findObjectNextToObject:).
    const DIRECTIONS = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
    };
    const onKeyDown = (event) => {
      const dir = DIRECTIONS[event.key];
      if (!dir) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      const nodes = layoutRef.current?.nodes || [];
      const current = nodes.find((n) => n.id === activeIdRef.current) || nodes.find((n) => n.featured);
      if (!current) return;
      let best = null;
      let bestScore = Infinity;
      for (const node of nodes) {
        if (node.id === current.id) continue;
        const dx = node.x - current.x;
        const dy = node.y - current.y;
        const along = dx * dir[0] + dy * dir[1];
        if (along <= 1) continue; // node must lie in the pressed direction
        const perp = Math.abs(dx * dir[1] - dy * dir[0]);
        const score = along + perp * 2.5; // prefer aligned + nearby
        if (score < bestScore) { bestScore = score; best = node; }
      }
      if (best) { event.preventDefault(); onPickRef.current?.(best.id); }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('dblclick', onDblClick);
    window.addEventListener('keydown', onKeyDown);

    // "Keep Labels Visible While Scrolling": slide each generation label right so
    // it stays at the left viewport edge once its band has scrolled off, clamped
    // so it never crosses the band's right edge. No-op (and resets) when off.
    const updateStickyLabels = (cam, ctrls) => {
      const labels = genLabelsRef.current;
      if (!labels?.length) return;
      if (!viewerOptionsRef.current?.keepLabelsVisible) {
        for (const lg of labels) { if (lg.position.x !== 0) lg.position.x = 0; }
        return;
      }
      const halfW = (cam.right - cam.left) / (2 * Math.max(0.0001, cam.zoom));
      const viewLeft = ctrls.target.x - halfW;
      const margin = 40;
      for (const lg of labels) {
        const natural = lg.userData.naturalX ?? 0;
        const maxRight = lg.userData.bandMaxX ?? (natural + 600);
        const maxShift = Math.max(0, maxRight - 220 - natural);
        const desiredShift = (viewLeft + margin) - natural;
        lg.position.x = Math.min(Math.max(0, desiredShift), maxShift);
      }
    };

    // Render on demand: with high-poly figure models and soft shadow mapping a
    // continuous 60fps loop pegged the GPU even when nothing moved. A frame is
    // drawn only when tweens run, the controls move the camera, or an effect
    // explicitly requests one (scene mutation, resize).
    let raf = 0;
    let lastFrame = performance.now();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;
      const tweensActive = (tweensRef.current?.active || 0) > 0;
      tweensRef.current?.update(dt);
      const controlsMoved = controls.update() === true;
      if (!tweensActive && !controlsMoved && !needsRenderRef.current) return;
      needsRenderRef.current = false;
      updateStickyLabels(camera, controls);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (moveRaf) cancelAnimationFrame(moveRaf);
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
      renderer.domElement.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('keydown', onKeyDown);
      controls.removeEventListener('change', updateZoomReadout);
      controls.dispose();
      disposeObject(stage);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      groupRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      hoveredIdRef.current = null;
      setHoverCard(null);
      setContextMenu(null);
      fitSignatureRef.current = null;
      clickablesRef.current = [];
      tweensRef.current?.clear();
      tweensRef.current = null;
      cameraTweenRef.current = null;
      nodeTweensRef.current = [];
    };
    // The scene is rebuilt only when the color system changes; layout changes update the stage below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, palette, viewerOptions.cameraMode, viewerOptions.illuminationStrength, viewerOptions.shadowStrength, viewerOptions.shadowRadius]);

  useEffect(() => {
    const scene = sceneRef.current;
    const stage = groupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const container = containerRef.current;
    if (!scene || !stage || !camera || !controls || !container) return;

    // Stop any in-flight node tweens before the objects they target are
    // disposed by clearGroup.
    const tweens = tweensRef.current;
    if (tweens) tweens.cancelAll(nodeTweensRef.current);
    nodeTweensRef.current = [];

    if (typeof window !== 'undefined') {
      window.__treeStageBuilds = (window.__treeStageBuilds || 0) + 1;
      window.__treeRenderInfo = () => sceneRef.current?.userData?.renderer?.info;
    }
    clearGroup(stage);
    clickablesRef.current = [];

    stage.add(makeBottomPlane(palette, layout.bounds, viewerOptions.bottomPlaneMode, viewerOptions));
    const genLabels = [];
    for (const band of layout.bands) {
      const bandObject = makeGenerationBand(band, palette, viewerOptions.generationBandStyle, viewerOptions);
      bandObject.position.z += generationDepthZ(band.generation);
      stage.add(bandObject);
      if (viewerOptions.generationBandStyle !== 'none') {
        const labelGroup = makeGenerationLabel(band, viewerOptions);
        labelGroup.position.z += generationDepthZ(band.generation);
        stage.add(labelGroup);
        if (labelGroup.userData?.isGenerationLabel) genLabels.push(labelGroup);
      }
    }
    genLabelsRef.current = genLabels;

    const connectors = makeFamilyConnectors(layout.links, layout.nodes, palette, { ...viewerOptions, hoveredKeys: connHighlightKeysRef.current });
    stage.add(connectors);
    connectorsRef.current = connectors;
    renderedConnKeyRef.current = hoveredConnectionRef.current;

    const nodeObjects = [];
    nodeObjectsRef.current = new Map();
    for (const node of layout.nodes) {
      const selected = selectedIdRef.current === node.id && !node.featured;
      const object = node.featured
        ? makeFeaturedNode(node, palette, viewerOptions.personStyle, hoveredIdRef.current === node.id, viewerOptions)
        : makePersonNode(node, palette, viewerOptions.personStyle, hoveredIdRef.current === node.id, viewerOptions, selected);
      object.position.z += generationDepthZ(node.generation);
      stage.add(object);
      clickablesRef.current.push(object);
      nodeObjects.push(object);
      nodeObjectsRef.current.set(node.id, object);
    }
    stageCtxRef.current = { palette, viewerOptions };
    renderedHoverRef.current = { hoveredId: hoveredIdRef.current, selectedId: selectedIdRef.current };
    refreshHitTargets();
    refreshConnectorHits();
    needsRenderRef.current = true;

    const fitBounds = fitBoundsForOptions();
    const fitSignature = cameraFitSignature(layout, activeId, viewerOptions.cameraMode, fitBounds);
    // Never frame an empty layout — doing so would consume the first-fit on the
    // 0-node initial render and snap the camera to the empty fallback bounds,
    // leaving the real tree off-screen when it arrives.
    if (layout.nodes.length > 0 && fitSignatureRef.current !== fitSignature) {
      const shouldRestoreCamera = !(viewerOptions.appearanceMode === 'macLight' && viewerOptions.cameraMode === 'top');
      if (firstFitRef.current) {
        // First framing of a freshly built scene → snap into place.
        const restored = shouldRestoreCamera && restoreCameraState(camera, controls, viewerOptions.cameraMode, activeId);
        if (!restored) fitCamera(camera, controls, fitBounds, container, viewerOptions.cameraMode);
        firstFitRef.current = false;
      } else if (tweens && animationsEnabled) {
        // Focus changed (e.g. a new person was selected) → fly the camera.
        if (cameraTweenRef.current) tweens.cancel(cameraTweenRef.current);
        const target = computeFitState(fitBounds, container, viewerOptions.cameraMode);
        cameraTweenRef.current = animateCameraTo(tweens, camera, controls, target, {
          duration: 0.72 * (animationScale || 1),
          onUpdate: () => setZoomPercent(Math.round(camera.zoom * 100)),
          onComplete: () => persistCameraState(camera, controls, viewerOptions.cameraMode, activeId),
        });
      } else {
        fitCamera(camera, controls, fitBounds, container, viewerOptions.cameraMode);
      }
      fitSignatureRef.current = fitSignature;
      setZoomPercent(Math.round(camera.zoom * 100));
    }

    // Build-in "order-in" morph: on the first assembly every node pops; on a
    // re-root only the NEW nodes rise/scale in while nodes that persist stay put
    // (matches MFT's re-root, where stable people don't re-animate). Hover/option
    // rebuilds keep the same id set, so nothing re-pops. New objects are detected
    // by person id vs. the previous frame's id set.
    const previousIds = prevNodeIdsRef.current;
    const currentIds = new Set(layout.nodes.map((node) => node.id));
    if (tweens && animationsEnabled && layout.nodes.length > 0) {
      let order = 0;
      for (const object of nodeObjects) {
        const id = object.userData.node?.id;
        const isNew = previousIds === null || !previousIds.has(id);
        if (!isNew) continue;
        const finalZ = object.position.z;
        object.position.z = finalZ - 28;
        object.scale.setScalar(0.62);
        const tween = tweens.add({
          duration: 0.42 * (animationScale || 1),
          delay: Math.min(0.5, order * 0.012) * (animationScale || 1),
          ease: easeOutBack,
          onUpdate: (t) => {
            object.position.z = finalZ - 28 + 28 * t;
            object.scale.setScalar(0.62 + 0.38 * t);
          },
          onComplete: () => {
            object.position.z = finalZ;
            object.scale.setScalar(1);
          },
        });
        nodeTweensRef.current.push(tween);
        order += 1;
      }
    }
    // Remember the id set once real nodes exist, so the empty initial render
    // doesn't pre-empt the build-in animation for the real tree.
    if (layout.nodes.length > 0) prevNodeIdsRef.current = currentIds;

    actionsRef.current = {
      ...actionsRef.current,
      ...createCameraActions({
        activeId,
        camera,
        container,
        controls,
        getBounds: fitBoundsForOptions,
        setZoomPercent,
        viewerOptions,
        tweens: tweensRef.current,
        cameraTweenRef,
      }),
    };
  }, [layout, palette, modelRevision, viewerOptions, activeId]);

  // Hover/selection: swap only the affected person objects — the full stage
  // build above is far too heavy to run per pointer-move.
  useEffect(() => {
    const stage = groupRef.current;
    const ctx = stageCtxRef.current;
    const nodes = layoutRef.current?.nodes || [];
    if (!stage || !ctx) return;
    const previous = renderedHoverRef.current;
    const affected = new Set(
      [previous.hoveredId, previous.selectedId, hoveredId, selectedId].filter(Boolean)
    );
    for (const id of affected) {
      const old = nodeObjectsRef.current.get(id);
      const node = nodes.find((candidate) => candidate.id === id);
      if (!old || !node) continue;
      const selected = selectedId === id && !node.featured;
      const next = node.featured
        ? makeFeaturedNode(node, ctx.palette, ctx.viewerOptions.personStyle, hoveredId === id, ctx.viewerOptions)
        : makePersonNode(node, ctx.palette, ctx.viewerOptions.personStyle, hoveredId === id, ctx.viewerOptions, selected);
      stage.remove(old);
      disposeObject(old);
      stage.add(next);
      nodeObjectsRef.current.set(id, next);
      const clickableIndex = clickablesRef.current.indexOf(old);
      if (clickableIndex >= 0) clickablesRef.current[clickableIndex] = next;
    }
    if (affected.size > 0) {
      refreshHitTargets();
      needsRenderRef.current = true;
    }
    renderedHoverRef.current = { hoveredId, selectedId };
  }, [hoveredId, selectedId]);

  // Line highlight: rebuild only the connector group so the family lines touching
  // the hovered person (or the single hovered line) glow + thicken, like the
  // native viewer. Keyed off the highlight-set signature.
  useEffect(() => {
    const stage = groupRef.current;
    const ctx = stageCtxRef.current;
    const currentLayout = layoutRef.current;
    if (!stage || !ctx || !currentLayout) return;
    if (renderedConnKeyRef.current === connHighlightSig) return;
    const old = connectorsRef.current;
    if (old) {
      stage.remove(old);
      disposeObject(old);
    }
    const connectors = makeFamilyConnectors(currentLayout.links, currentLayout.nodes, ctx.palette, { ...ctx.viewerOptions, hoveredKeys: connHighlightKeysRef.current });
    stage.add(connectors);
    connectorsRef.current = connectors;
    renderedConnKeyRef.current = connHighlightSig;
    refreshConnectorHits();
    needsRenderRef.current = true;
  }, [connHighlightSig]);

  // A focus change (re-root) clears the click-selection.
  useEffect(() => {
    selectedIdRef.current = null;
    setSelectedId(null);
  }, [activeId]);

  return {
    actionsRef,
    containerRef,
    contextMenu,
    hoverCard,
    setContextMenu,
    zoomPercent,
  };
}
