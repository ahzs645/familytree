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
  const actionsRef = useRef({ fit: () => {}, zoom: () => {}, zoomTo: () => {} });
  const downRef = useRef(null);
  const hoveredIdRef = useRef(null);
  const fitSignatureRef = useRef(null);
  const persistCameraTimerRef = useRef(0);
  const tweensRef = useRef(null);
  const cameraTweenRef = useRef(null);
  const nodeTweensRef = useRef([]);
  const firstFitRef = useRef(true);
  const prevNodeIdsRef = useRef(null);
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
  const [hoverCard, setHoverCard] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
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
    camera.position.set(0, -360, 1550);
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
      setZoomPercent(Math.round(camera.zoom * 100));
      queueCameraPersistence();
    };
    controls.addEventListener('change', updateZoomReadout);

    const illumination = Number.isFinite(viewerOptions.illuminationStrength) ? viewerOptions.illuminationStrength : 1;
    const shadowStrength = Number.isFinite(viewerOptions.shadowStrength) ? viewerOptions.shadowStrength : 1;
    scene.add(new THREE.AmbientLight(palette.ambient, 1.45 * illumination));
    const shadowRadius = Number.isFinite(viewerOptions.shadowRadius) ? viewerOptions.shadowRadius : 1;
    const key = new THREE.DirectionalLight(palette.keyLight, 1.85 * illumination);
    key.position.set(240, -380, 700);
    key.castShadow = shadowStrength > 0;
    key.shadow.mapSize.width = 2048;
    key.shadow.mapSize.height = 2048;
    key.shadow.bias = -0.0005;
    key.shadow.radius = Math.max(0, 2 * shadowRadius);
    scene.add(key);
    const fill = new THREE.DirectionalLight(palette.fillLight, 1.35 * illumination);
    fill.position.set(-500, 460, 420);
    scene.add(fill);
    renderer.shadowMap.enabled = shadowStrength > 0;

    const stage = new THREE.Group();
    scene.add(stage);

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
      setSelectedId(person?.person ? person.person.recordName : null);
    };
    const onDblClick = (event) => {
      const person = intersectPerson(event);
      if (person?.person) onPickRef.current?.(person.person.recordName);
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

    let raf = 0;
    let lastFrame = performance.now();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;
      tweensRef.current?.update(dt);
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
    // disposed by clearGroup (this effect also re-runs on hover).
    const tweens = tweensRef.current;
    if (tweens) tweens.cancelAll(nodeTweensRef.current);
    nodeTweensRef.current = [];

    clearGroup(stage);
    clickablesRef.current = [];

    stage.add(makeBottomPlane(palette, layout.bounds, viewerOptions.bottomPlaneMode, viewerOptions));
    for (const band of layout.bands) {
      stage.add(makeGenerationBand(band, palette, viewerOptions.generationBandStyle, viewerOptions));
      if (viewerOptions.generationBandStyle !== 'none') stage.add(makeGenerationLabel(band, viewerOptions));
    }

    stage.add(makeFamilyConnectors(layout.links, layout.nodes, palette, viewerOptions));

    const nodeObjects = [];
    for (const node of layout.nodes) {
      const selected = selectedId === node.id && !node.featured;
      const object = node.featured
        ? makeFeaturedNode(node, palette, viewerOptions.personStyle, hoveredId === node.id, viewerOptions)
        : makePersonNode(node, palette, viewerOptions.personStyle, hoveredId === node.id, viewerOptions, selected);
      stage.add(object);
      clickablesRef.current.push(object);
      nodeObjects.push(object);
    }

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
  }, [layout, palette, modelRevision, viewerOptions, hoveredId, activeId, selectedId]);

  // A focus change (re-root) clears the click-selection.
  useEffect(() => {
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
