import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Gender, lifeSpanLabel } from '../../models/index.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';

const GEN_STEP = 225;
const NODE_SPACING = 240;
const PARTNER_OFFSET = 178;
const AVATAR_RADIUS = 46;
const ROOT_CARD = { w: 230, h: 230 };
const SKIN = '#f4d3a5';
const SKIN_SHADOW = '#dcae7a';
const BAND_LABEL_GUTTER = 310;

export function ThreeDTreeView({
  ancestorTree,
  descendantTree,
  activeId,
  loading = false,
  onPick,
  context,
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
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [zoomPercent, setZoomPercent] = useState(100);

  const palette = useMemo(() => makePalette(dark), [dark]);
  const layout = useMemo(
    () => buildInteractiveLayout(ancestorTree, descendantTree, activeId),
    [ancestorTree, descendantTree, activeId]
  );
  const relationshipCounts = useMemo(() => ({
    parents: context?.parents?.flatMap((family) => [family.man, family.woman]).filter(Boolean).length || 0,
    partners: context?.families?.map((family) => family.partner).filter(Boolean).length || 0,
    children: context?.families?.flatMap((family) => family.children || []).filter(Boolean).length || 0,
  }), [context]);

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
    const updateZoomReadout = () => setZoomPercent(Math.round(camera.zoom * 100));
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
      fitCamera(camera, controls, bounds, container);
      setZoomPercent(Math.round(camera.zoom * 100));
    };
    const zoom = (factor) => {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      controls.update();
      setZoomPercent(Math.round(camera.zoom * 100));
    };
    const zoomTo = (percent) => {
      camera.zoom = THREE.MathUtils.clamp(percent / 100, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      controls.update();
      setZoomPercent(Math.round(camera.zoom * 100));
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
      actionsRef.current.fit?.();
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
      return object?.userData.person || null;
    };

    const onPointerDown = (event) => {
      downRef.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event) => {
      const start = downRef.current;
      downRef.current = null;
      if (!start) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > 6) return;
      const person = intersectPerson(event);
      if (person) onPick?.(person.recordName);
    };
    const onPointerMove = (event) => {
      renderer.domElement.style.cursor = intersectPerson(event) ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('contextmenu', preventContextMenu);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('contextmenu', preventContextMenu);
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
      clickablesRef.current = [];
    };
    // The scene is rebuilt only when the color system changes; layout changes update the stage below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, palette]);

  useEffect(() => {
    const scene = sceneRef.current;
    const stage = groupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const container = containerRef.current;
    if (!scene || !stage || !camera || !controls || !container) return;

    clearGroup(stage);
    clickablesRef.current = [];

    stage.add(makeGrid(palette, layout.bounds));
    for (const band of layout.bands) {
      stage.add(makeGenerationBand(band, palette));
      stage.add(makeGenerationLabel(band));
    }

    const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
    for (const link of layout.links) {
      const from = nodeById.get(link.from);
      const to = nodeById.get(link.to);
      if (!from || !to) continue;
      stage.add(makeConnector(from, to, link.type, palette));
    }

    for (const node of layout.nodes) {
      const object = node.featured ? makeFeaturedNode(node, palette) : makePersonNode(node, palette);
      stage.add(object);
      clickablesRef.current.push(object);
    }

    fitCamera(camera, controls, layout.viewBounds || layout.bounds, container);
    setZoomPercent(Math.round(camera.zoom * 100));
    actionsRef.current.fit = () => {
      fitCamera(camera, controls, layout.viewBounds || layout.bounds, container);
      setZoomPercent(Math.round(camera.zoom * 100));
    };
  }, [layout, palette]);

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
          <button type="button" style={styles.dockButton} onClick={() => actionsRef.current.fit()}>Options</button>
          <button type="button" style={styles.dockButton} onClick={() => actionsRef.current.fit()}>Style</button>
        </div>
      </div>
      {(loading || !hasTree) && (
        <div style={styles.overlay}>
          {loading ? 'Loading tree...' : 'Pick a person from the list.'}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricValue}>{value}</span>
      <span style={styles.metricLabel}>{label}</span>
    </div>
  );
}

function preventContextMenu(event) {
  event.preventDefault();
}

function buildInteractiveLayout(ancestorTree, descendantTree, activeId) {
  const nodes = new Map();
  const links = [];
  const root = ancestorTree?.person || descendantTree?.person || null;
  const rootId = activeId || root?.recordName || null;

  const addNode = (person, generation, x, role) => {
    if (!person?.recordName) return null;
    const existing = nodes.get(person.recordName);
    const featured = person.recordName === rootId;
    const candidate = {
      id: person.recordName,
      person,
      generation,
      x,
      y: -generation * GEN_STEP,
      z: featured ? 52 : 22 + Math.min(Math.abs(generation) * 3, 18),
      role,
      featured,
    };
    if (!existing) {
      nodes.set(person.recordName, candidate);
      return candidate;
    }
    if (featured || Math.abs(generation) < Math.abs(existing.generation)) {
      nodes.set(person.recordName, { ...existing, ...candidate, role: mergeRole(existing.role, role) });
    } else {
      existing.role = mergeRole(existing.role, role);
    }
    return nodes.get(person.recordName);
  };

  const addLink = (from, to, type) => {
    if (!from || !to || from === to) return;
    const key = `${from}:${to}:${type}`;
    if (links.some((link) => link.key === key)) return;
    links.push({ key, from, to, type });
  };

  if (ancestorTree) {
    const visitAncestor = (node, generation, slot, childId) => {
      if (!node?.person) return;
      const total = 2 ** generation;
      const spacing = NODE_SPACING + generation * 38;
      const x = generation === 0 ? 0 : (slot - (total - 1) / 2) * spacing;
      addNode(node.person, -generation, x, generation === 0 ? 'root' : 'ancestor');
      if (childId) addLink(node.person.recordName, childId, 'ancestor');
      if (generation >= 4) return;
      visitAncestor(node.father, generation + 1, slot * 2, node.person.recordName);
      visitAncestor(node.mother, generation + 1, slot * 2 + 1, node.person.recordName);
    };
    visitAncestor(ancestorTree, 0, 0, null);
  }

  if (descendantTree) {
    const measure = (node) => {
      if (!node) return 1;
      const childWidths = (node.unions || []).flatMap((union) => union.children || []).map(measure);
      if (childWidths.length === 0) return 1;
      return Math.max(1, childWidths.reduce((sum, width) => sum + width, 0));
    };

    const placeDescendant = (node, generation, centerX, parentId = null) => {
      if (!node?.person) return;
      addNode(node.person, generation, centerX, generation === 0 ? 'root' : 'descendant');
      if (parentId) addLink(parentId, node.person.recordName, 'descendant');

      const unions = node.unions || [];
      if (generation === 0) unions.forEach((union, index) => {
        if (union.partner?.recordName) {
          const side = index % 2 === 0 ? 1 : -1;
          const baseOffset = generation === 0 ? ROOT_CARD.w / 2 + 172 : PARTNER_OFFSET;
          const offset = side * (baseOffset + Math.floor(index / 2) * 105);
          addNode(union.partner, generation, centerX + offset, 'partner');
          addLink(node.person.recordName, union.partner.recordName, 'partner');
        }
      });

      const children = unions.flatMap((union) => union.children || []);
      if (children.length === 0) return;
      const totalWidth = children.reduce((sum, child) => sum + measure(child), 0);
      let cursor = centerX - ((totalWidth - 1) * NODE_SPACING) / 2;
      for (const child of children) {
        const childWidth = measure(child);
        const childCenter = cursor + ((childWidth - 1) * NODE_SPACING) / 2;
        placeDescendant(child, generation + 1, childCenter, node.person.recordName);
        cursor += childWidth * NODE_SPACING;
      }
    };

    placeDescendant(descendantTree, 0, 0, null);
  }

  const allNodes = [...nodes.values()].sort((a, b) => a.generation - b.generation || a.x - b.x);
  const rootNode = allNodes.find((node) => node.featured) || allNodes.find((node) => node.generation === 0);
  const rootX = rootNode?.x || 0;
  const nodeList = allNodes.filter((node) => (
    node.generation >= -2 &&
    node.generation <= 1 &&
    Math.abs(node.x - rootX) <= 1180
  ));
  const visibleIds = new Set(nodeList.map((node) => node.id));
  const visibleLinks = links.filter((link) => visibleIds.has(link.from) && visibleIds.has(link.to));
  const bands = buildBands(nodeList, rootX);
  const bounds = boundsFor(nodeList, bands);
  const viewBounds = focusBoundsFor(nodeList, bands, bounds);
  return { nodes: nodeList, links: visibleLinks, bands, bounds, viewBounds };
}

function mergeRole(a, b) {
  if (!a || a === b) return b;
  if (!b) return a;
  if (a === 'root' || b === 'root') return 'root';
  return `${a} ${b}`;
}

function buildBands(nodes, rootX = 0) {
  const grouped = new Map();
  for (const node of nodes) {
    if (!grouped.has(node.generation)) grouped.set(node.generation, []);
    grouped.get(node.generation).push(node);
  }

  return [...grouped.entries()].map(([generation, group]) => {
    const minX = Math.min(...group.map((node) => node.x));
    const maxX = Math.max(...group.map((node) => node.x));
    const years = yearRange(group.map((node) => node.person));
    const width = Math.max(390, maxX - minX + 280 + BAND_LABEL_GUTTER);
    const height = generation === 0 ? 216 : 112;
    const title =
      generation === 0
        ? 'Focus Person'
        : generation < 0
          ? `Ancestor Generation ${Math.abs(generation)}`
          : `Descendant Generation ${generation}`;
    return {
      generation,
      x: (minX + maxX) / 2 - BAND_LABEL_GUTTER / 2,
      y: -generation * GEN_STEP,
      width,
      height,
      title,
      subtitle: years,
      count: group.length,
    };
  });
}

function yearRange(persons) {
  const years = [];
  for (const person of persons) {
    const birth = extractYear(person?.birthDate);
    const death = extractYear(person?.deathDate);
    if (Number.isFinite(birth)) years.push(birth);
    if (Number.isFinite(death)) years.push(death);
  }
  if (years.length === 0) return '';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} - ${max}`;
}

function extractYear(value) {
  const match = String(value || '').match(/\b([12]\d{3}|20\d{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1000 && year <= 2099 ? year : null;
}

function boundsFor(nodes, bands) {
  if (nodes.length === 0) return { minX: -400, maxX: 400, minY: -260, maxY: 260 };
  const xs = nodes.flatMap((node) => [node.x - 170, node.x + 170]);
  const ys = nodes.flatMap((node) => [node.y - 120, node.y + 120]);
  for (const band of bands) {
    xs.push(band.x - band.width / 2, band.x + band.width / 2);
    ys.push(band.y - band.height / 2, band.y + band.height / 2);
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function focusBoundsFor(nodes, bands, fallback) {
  const root = nodes.find((node) => node.featured) || nodes.find((node) => node.generation === 0);
  const rootX = root?.x || 0;
  const rootY = root?.y || 0;
  const focusedNodes = nodes.filter((node) => (
    node.generation >= -2 &&
    node.generation <= 1 &&
    Math.abs(node.x - rootX) <= 980
  ));
  if (focusedNodes.length === 0) return fallback;
  const focusedGenerations = new Set(focusedNodes.map((node) => node.generation));
  const focusedBands = bands
    .filter((band) => focusedGenerations.has(band.generation))
    .map((band) => ({
      ...band,
      width: Math.min(band.width, 1500),
      x: Math.max(rootX - 200, Math.min(rootX + 200, band.x)),
    }));
  const bounds = boundsFor(focusedNodes, focusedBands);
  const maxWidth = 1500;
  const maxHeight = 860;
  const centerX = rootX - BAND_LABEL_GUTTER / 2;
  const centerY = rootY + 110;
  const width = Math.min(Math.max(bounds.maxX - bounds.minX, 760), maxWidth);
  const height = Math.min(Math.max(bounds.maxY - bounds.minY, 560), maxHeight);
  return {
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: centerY - height / 2,
    maxY: centerY + height / 2,
  };
}

function makePalette(dark) {
  return dark
    ? {
        background: '#10131a',
        grid: '#303848',
        gridStrong: '#46536a',
        text: '#f4f6fa',
        muted: '#9aa5b5',
        shadow: '#05070b',
        ambient: '#dfe7ff',
        keyLight: '#fff2d8',
        fillLight: '#bad5ff',
        male: '#6aa7ff',
        maleDeep: '#285fbc',
        female: '#ff9ab5',
        femaleDeep: '#b94b6c',
        unknown: '#e4d7b3',
        unknownDeep: '#8f7f59',
        ancestorLine: '#b49a54',
        descendantLine: '#d04fa4',
        partnerLine: '#9b8a69',
        bandText: '#f4f6fa',
      }
    : {
        background: '#f7f8f7',
        grid: '#e2e6e9',
        gridStrong: '#cfd6dc',
        text: '#1d1f24',
        muted: '#717985',
        shadow: '#a4a8ad',
        ambient: '#ffffff',
        keyLight: '#fff7de',
        fillLight: '#dceaff',
        male: '#79b7ff',
        maleDeep: '#3779d7',
        female: '#ffa2bd',
        femaleDeep: '#d56984',
        unknown: '#f3e8c7',
        unknownDeep: '#b9a36d',
        ancestorLine: '#aa8236',
        descendantLine: '#c93d94',
        partnerLine: '#9c8a64',
        bandText: '#33353a',
      };
}

function makeGrid(palette, bounds) {
  const group = new THREE.Group();
  const sizeX = Math.max(2400, bounds.maxX - bounds.minX + 900);
  const sizeY = Math.max(1800, bounds.maxY - bounds.minY + 900);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const step = 95;
  const left = centerX - sizeX / 2;
  const right = centerX + sizeX / 2;
  const bottom = centerY - sizeY / 2;
  const top = centerY + sizeY / 2;

  const makeLines = (positions, color, opacity) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    return new THREE.LineSegments(geometry, material);
  };

  const regular = [];
  const strong = [];
  let index = 0;
  for (let x = left; x <= right; x += step, index += 1) {
    const target = index % 4 === 0 ? strong : regular;
    target.push(x, bottom, -82, x, top, -82);
  }
  index = 0;
  for (let y = bottom; y <= top; y += step, index += 1) {
    const target = index % 4 === 0 ? strong : regular;
    target.push(left, y, -82, right, y, -82);
  }
  group.add(makeLines(regular, palette.grid, 0.72));
  group.add(makeLines(strong, palette.gridStrong, 0.46));
  return group;
}

function makeGenerationBand(band, palette) {
  const texture = makeBandTexture(band, palette);
  const geometry = new THREE.PlaneGeometry(band.width, band.height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(band.x, band.y, -34);
  mesh.renderOrder = 1;
  return mesh;
}

function makeBandTexture(band, palette) {
  const fill = band.generation === 0
    ? 'rgba(248, 191, 218, 0.68)'
    : band.generation < 0
      ? ancestorBandColor(Math.abs(band.generation))
      : descendantBandColor(band.generation);
  return makeCanvasTexture(1024, 256, (ctx, w, h) => {
    ctx.shadowColor = 'rgba(0,0,0,0.16)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    roundedRect(ctx, 24, 32, w - 48, h - 64, 34);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2;
    ctx.strokeStyle = band.generation === 0 ? 'rgba(191, 82, 150, 0.28)' : 'rgba(130, 112, 72, 0.22)';
    ctx.stroke();

  });
}

function makeGenerationLabel(band) {
  const label = generationLabel(band.generation);
  const sublabel = band.subtitle || `${band.count} ${band.count === 1 ? 'person' : 'people'}`;
  const texture = makeCanvasTexture(520, 170, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = band.generation === 0 ? 'rgba(157, 58, 117, 0.54)' : 'rgba(93, 84, 42, 0.58)';
    ctx.font = '800 42px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText(label, 24, 78);
    ctx.fillStyle = 'rgba(80, 86, 96, 0.62)';
    ctx.font = '750 25px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.fillText(sublabel, 26, 116);
  });
  const labelWidth = Math.min(BAND_LABEL_GUTTER - 34, 250);
  const labelHeight = 82;
  const plane = makePlaneFromTexture(texture, labelWidth, labelHeight);
  plane.position.set(band.x - band.width / 2 + BAND_LABEL_GUTTER / 2, band.y + 2, -18);
  plane.material.depthTest = false;
  plane.renderOrder = 18;
  return plane;
}

function generationLabel(generation) {
  if (generation === 0) return 'Focus';
  if (generation < 0) return `Ancestor ${Math.abs(generation)}`;
  return `Descendant ${generation}`;
}

function ancestorBandColor(generation) {
  const colors = [
    'rgba(255, 220, 191, 0.72)',
    'rgba(255, 238, 170, 0.67)',
    'rgba(225, 237, 168, 0.62)',
    'rgba(189, 228, 200, 0.58)',
  ];
  return colors[(generation - 1) % colors.length];
}

function descendantBandColor(generation) {
  const colors = [
    'rgba(242, 191, 231, 0.65)',
    'rgba(213, 205, 255, 0.58)',
    'rgba(194, 226, 248, 0.58)',
    'rgba(206, 234, 215, 0.56)',
  ];
  return colors[(generation - 1) % colors.length];
}

function makePersonNode(node, palette) {
  const group = new THREE.Group();
  group.position.set(node.x, node.y, node.z);
  group.userData.person = node.person;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(58, 56),
    new THREE.MeshBasicMaterial({ color: palette.shadow, transparent: true, opacity: 0.15, depthWrite: false })
  );
  shadow.scale.set(1.28, 0.38, 1);
  shadow.position.set(8, -4, -18);
  shadow.renderOrder = 2;
  group.add(shadow);

  const icon = makePlaneFromTexture(makeMacPersonIconTexture(node.person, palette, false), 116, 92);
  icon.position.set(0, 18, 22);
  icon.renderOrder = 8;
  group.add(icon);

  const label = makePlaneFromTexture(makePersonLabelTexture(node.person, palette), 168, 66);
  label.position.set(0, -58, 16);
  group.add(label);

  return group;
}

function makeFeaturedNode(node, palette) {
  const group = new THREE.Group();
  group.position.set(node.x, node.y, node.z);
  group.userData.person = node.person;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(ROOT_CARD.w * 0.47, 72),
    new THREE.MeshBasicMaterial({ color: palette.shadow, transparent: true, opacity: 0.16, depthWrite: false })
  );
  shadow.scale.set(1.04, 0.96, 1);
  shadow.position.set(10, -16, -16);
  shadow.renderOrder = 2;
  group.add(shadow);

  const card = makePlaneFromTexture(makeFeaturedTexture(node.person, palette), ROOT_CARD.w, ROOT_CARD.h);
  card.position.set(0, 0, 0);
  card.renderOrder = 3;
  group.add(card);

  const icon = makePlaneFromTexture(makeMacPersonIconTexture(node.person, palette, true), 144, 116);
  icon.position.set(0, 56, 36);
  icon.renderOrder = 9;
  group.add(icon);

  return group;
}

function makeMacPersonIconTexture(person, palette, featured) {
  const colors = colorsForGender(person?.gender, palette);
  return makeCanvasTexture(360, 300, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, featured ? h / 2 + 6 : h / 2 + 10);
    ctx.scale(featured ? 1.1 : 1, featured ? 1.1 : 1);

    const shadow = ctx.createRadialGradient(22, 54, 10, 22, 54, 118);
    shadow.addColorStop(0, 'rgba(0,0,0,0.2)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(18, 66, 112, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyGradient = ctx.createRadialGradient(-34, 22, 12, -18, 30, 86);
    bodyGradient.addColorStop(0, lightenHex(colors.base, 0.32));
    bodyGradient.addColorStop(0.55, colors.base);
    bodyGradient.addColorStop(1, colors.deep);
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(-20, 34, 70, 39, -0.12, 0, Math.PI * 2);
    ctx.fill();

    const bodyHighlight = ctx.createRadialGradient(-48, 15, 4, -42, 18, 44);
    bodyHighlight.addColorStop(0, 'rgba(255,255,255,0.62)');
    bodyHighlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bodyHighlight;
    ctx.beginPath();
    ctx.ellipse(-36, 22, 42, 18, -0.16, 0, Math.PI * 2);
    ctx.fill();

    const frontGradient = ctx.createRadialGradient(35, 28, 8, 35, 34, 58);
    frontGradient.addColorStop(0, lightenHex(colors.base, 0.22));
    frontGradient.addColorStop(1, colors.base);
    ctx.fillStyle = frontGradient;
    ctx.beginPath();
    ctx.ellipse(34, 40, 48, 31, -0.18, 0, Math.PI * 2);
    ctx.fill();

    const neckGradient = ctx.createLinearGradient(0, -2, 0, 34);
    neckGradient.addColorStop(0, SKIN);
    neckGradient.addColorStop(1, SKIN_SHADOW);
    ctx.fillStyle = neckGradient;
    roundedRect(ctx, -17, -4, 34, 46, 16);
    ctx.fill();

    const headGradient = ctx.createRadialGradient(-16, -42, 4, 6, -24, 46);
    headGradient.addColorStop(0, '#ffe9bf');
    headGradient.addColorStop(0.55, SKIN);
    headGradient.addColorStop(1, SKIN_SHADOW);
    ctx.fillStyle = headGradient;
    ctx.beginPath();
    ctx.arc(0, -32, featured ? 38 : 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-14, -46, featured ? 12 : 10, featured ? 8 : 7, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

function makeAvatarBust(person, palette, scale = 1) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const colors = colorsForGender(person?.gender, palette);
  const torsoMaterial = new THREE.MeshStandardMaterial({
    color: colors.base,
    roughness: 0.28,
    metalness: 0.02,
    emissive: colors.base,
    emissiveIntensity: 0.06,
  });
  const deepMaterial = new THREE.MeshStandardMaterial({
    color: colors.deep,
    roughness: 0.36,
    metalness: 0.02,
    transparent: true,
    opacity: 0.34,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: SKIN,
    roughness: 0.34,
    metalness: 0,
    emissive: SKIN,
    emissiveIntensity: 0.04,
  });
  const skinShadeMaterial = new THREE.MeshStandardMaterial({
    color: SKIN_SHADOW,
    roughness: 0.42,
    metalness: 0,
    transparent: true,
    opacity: 0.38,
  });

  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(54, 48, 18), torsoMaterial);
  shoulders.scale.set(1.28, 0.42, 0.5);
  shoulders.position.set(0, 0, 0);
  shoulders.castShadow = true;
  shoulders.receiveShadow = true;
  group.add(shoulders);

  const torsoShade = new THREE.Mesh(new THREE.SphereGeometry(45, 42, 14), deepMaterial);
  torsoShade.scale.set(1.18, 0.2, 0.34);
  torsoShade.position.set(0, -6, 5);
  group.add(torsoShade);

  const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(31, 32, 14), torsoMaterial);
  leftShoulder.scale.set(1.05, 0.74, 0.52);
  leftShoulder.position.set(-42, 6, 4);
  leftShoulder.castShadow = true;
  group.add(leftShoulder);

  const rightShoulder = leftShoulder.clone();
  rightShoulder.position.x = 42;
  group.add(rightShoulder);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(13, 17, 22, 28), skinMaterial);
  neck.position.set(0, 34, 12);
  neck.castShadow = true;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(28, 42, 26), skinMaterial);
  head.scale.set(0.92, 1.04, 0.88);
  head.position.set(0, 64, 18);
  head.castShadow = true;
  group.add(head);

  const cheek = new THREE.Mesh(new THREE.SphereGeometry(22, 32, 14), skinShadeMaterial);
  cheek.scale.set(0.55, 0.35, 0.18);
  cheek.position.set(9, 56, 37);
  group.add(cheek);

  const shine = new THREE.Mesh(
    new THREE.SphereGeometry(19, 28, 12),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, depthWrite: false })
  );
  shine.scale.set(0.42, 0.22, 0.14);
  shine.position.set(-13, 77, 39);
  shine.renderOrder = 8;
  group.add(shine);

  return group;
}

function makeConnector(from, to, type, palette) {
  const group = new THREE.Group();
  const color = type === 'partner'
    ? palette.partnerLine
    : type === 'ancestor'
      ? palette.ancestorLine
      : palette.descendantLine;
  const z = 2;
  const points = type === 'partner'
    ? partnerPoints(from, to, z)
    : orthogonalPoints(from, to, z);

  for (let i = 1; i < points.length; i += 1) {
    group.add(makeTube(points[i - 1], points[i], color, type === 'partner' ? 2.4 : 3.2));
  }
  return group;
}

function partnerPoints(from, to, z) {
  const y = Math.max(partnerLineY(from), partnerLineY(to));
  return [
    new THREE.Vector3(edgeX(from, to), y, z),
    new THREE.Vector3(edgeX(to, from), y, z),
  ];
}

function partnerLineY(node) {
  return node.y + (node.featured ? 38 : 14);
}

function orthogonalPoints(from, to, z) {
  const fromEdgeRadius = nodeVerticalRadius(from);
  const toEdgeRadius = nodeVerticalRadius(to);
  const fromEdge = from.y > to.y ? from.y - fromEdgeRadius : from.y + fromEdgeRadius;
  const toEdge = from.y > to.y ? to.y + toEdgeRadius : to.y - toEdgeRadius;
  const midY = (fromEdge + toEdge) / 2;
  return [
    new THREE.Vector3(from.x, fromEdge, z),
    new THREE.Vector3(from.x, midY, z),
    new THREE.Vector3(to.x, midY, z),
    new THREE.Vector3(to.x, toEdge, z),
  ];
}

function edgeX(a, b) {
  const radius = a.featured ? ROOT_CARD.w * 0.44 : 58;
  return a.x + Math.sign(b.x - a.x || 1) * radius;
}

function nodeVerticalRadius(node) {
  return node.featured ? ROOT_CARD.h * 0.44 : 72;
}

function makeTube(a, b, color, radius) {
  const length = a.distanceTo(b);
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.02,
    transparent: true,
    opacity: 0.88,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(b, a).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  mesh.renderOrder = 4;
  return mesh;
}

function makePersonLabelTexture(person, palette) {
  return makeCanvasTexture(420, 170, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = palette.text;
    ctx.font = '700 30px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    for (const [line, y] of wrapText(ctx, person?.fullName || 'Unknown', 19, 2).map((line, index) => [line, 48 + index * 34])) {
      ctx.fillText(line, w / 2, y);
    }
    const life = lifeSpanLabel(person);
    if (life) {
      ctx.fillStyle = palette.muted;
      ctx.font = '600 23px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(life, w / 2, 132);
    }
  });
}

function makeFeaturedTexture(person, palette) {
  return makeCanvasTexture(560, 560, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const radius = w * 0.38;

    ctx.clearRect(0, 0, w, h);
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(238, 249, 255, 0.96)';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
    ctx.lineCap = 'round';
    ctx.setLineDash([1, 22]);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(80, 145, 196, 0.58)';
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(78, 166, 214, 0.34)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#17191d';
    ctx.font = '800 35px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    const nameLines = wrapText(ctx, person?.fullName || 'Unknown', 17, 2);
    const firstNameY = nameLines.length === 1 ? 340 : 320;
    nameLines.forEach((line, index) => ctx.fillText(line, cx, firstNameY + index * 39));

    const life = lifeSpanLabel(person);
    if (life) {
      ctx.fillStyle = '#747b86';
      ctx.font = '700 28px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(life, cx, 428);
    }
  });
}

function colorsForGender(gender, palette) {
  if (gender === Gender.Male) return { base: palette.male, deep: palette.maleDeep };
  if (gender === Gender.Female) return { base: palette.female, deep: palette.femaleDeep };
  return { base: palette.unknown, deep: palette.unknownDeep };
}

function lightenHex(hex, amount) {
  const normalized = String(hex || '').replace('#', '');
  if (normalized.length !== 6) return hex;
  const next = [0, 2, 4].map((index) => {
    const value = parseInt(normalized.slice(index, index + 2), 16);
    return Math.round(value + (255 - value) * amount).toString(16).padStart(2, '0');
  });
  return `#${next.join('')}`;
}

function wrapText(ctx, text, maxChars, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  const limited = lines.slice(0, maxLines);
  if (words.join(' ').length > limited.join(' ').length && limited.length > 0) {
    limited[limited.length - 1] = `${limited[limited.length - 1].replace(/\.*$/, '')}...`;
  }
  return limited.length ? limited : ['Unknown'];
}

function makePlaneFromTexture(texture, width, height) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  plane.renderOrder = 5;
  return plane;
}

function makeCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fitCamera(camera, controls, bounds, container) {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const rect = container.getBoundingClientRect();
  const viewportWidth = Math.max(1, rect.width);
  const viewportHeight = Math.max(1, rect.height);
  const zoomForWidth = viewportWidth / width;
  const zoomForHeight = viewportHeight / height;
  const nextZoom = THREE.MathUtils.clamp(Math.min(zoomForWidth, zoomForHeight) * 0.82, 0.34, 1.45);

  camera.zoom = nextZoom;
  camera.position.set(centerX, centerY - 360, 1550);
  controls.target.set(centerX, centerY, 0);
  camera.lookAt(centerX, centerY, 0);
  camera.updateProjectionMatrix();
  controls.update();
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    disposeObject(child);
  }
}

function disposeObject(object) {
  object.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (material.map) material.map.dispose();
        material.dispose();
      }
    }
  });
}

const styles = {
  shell: {
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
    background: 'hsl(var(--background))',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    top: 12,
    insetInlineEnd: 12,
    display: 'flex',
    gap: 6,
    padding: 6,
    borderRadius: 8,
    background: 'hsl(var(--card) / 0.82)',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 10px 24px rgb(0 0 0 / 0.12)',
    backdropFilter: 'blur(12px)',
  },
  bottomDock: {
    position: 'absolute',
    left: '50%',
    bottom: 14,
    transform: 'translateX(-50%)',
    maxWidth: 'calc(100% - 32px)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'hsl(var(--card) / 0.86)',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 14px 34px rgb(0 0 0 / 0.16)',
    backdropFilter: 'blur(14px)',
    color: 'hsl(var(--foreground))',
    overflow: 'hidden',
  },
  dockGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  dockLabel: {
    color: 'hsl(var(--muted-foreground))',
    font: '700 11px -apple-system, system-ui, sans-serif',
    whiteSpace: 'nowrap',
  },
  zoomSlider: {
    width: 118,
    accentColor: 'hsl(var(--primary))',
  },
  zoomReadout: {
    width: 42,
    color: 'hsl(var(--foreground))',
    font: '750 11px -apple-system, system-ui, sans-serif',
  },
  metric: {
    minWidth: 58,
    textAlign: 'center',
    padding: '2px 6px',
    borderInlineStart: '1px solid hsl(var(--border))',
  },
  metricValue: {
    display: 'block',
    color: 'hsl(var(--foreground))',
    font: '800 13px -apple-system, system-ui, sans-serif',
  },
  metricLabel: {
    display: 'block',
    color: 'hsl(var(--muted-foreground))',
    font: '650 10px -apple-system, system-ui, sans-serif',
  },
  dockButton: {
    height: 30,
    borderRadius: 6,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--secondary))',
    color: 'hsl(var(--foreground))',
    font: '750 11px -apple-system, system-ui, sans-serif',
    padding: '0 10px',
    cursor: 'pointer',
  },
  iconButton: {
    width: 31,
    height: 31,
    borderRadius: 6,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--secondary))',
    color: 'hsl(var(--foreground))',
    font: '700 15px -apple-system, system-ui, sans-serif',
    cursor: 'pointer',
  },
  fitButton: {
    height: 31,
    borderRadius: 6,
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--secondary))',
    color: 'hsl(var(--foreground))',
    font: '700 12px -apple-system, system-ui, sans-serif',
    padding: '0 10px',
    cursor: 'pointer',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'hsl(var(--muted-foreground))',
    font: '14px -apple-system, system-ui, sans-serif',
    pointerEvents: 'none',
    background: 'hsl(var(--background) / 0.45)',
  },
};

export default ThreeDTreeView;
