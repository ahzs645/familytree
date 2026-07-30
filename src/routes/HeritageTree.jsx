import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../components/heritageTree/heritageTree.css';
import { CW, loadHeritageTreeData, layoutHeritageTree } from '../components/heritageTree/appTreeAdapter.js';
import PersonCard from '../components/heritageTree/PersonCard.jsx';
import Legend from '../components/heritageTree/Legend.jsx';
import Header from '../components/heritageTree/Header.jsx';
import AnalyticsModal from '../components/heritageTree/AnalyticsModal.jsx';
import { useActivePerson } from '../contexts/ActivePersonContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { APP_PREFERENCES_EVENT } from '../lib/appPreferences.js';

const MIN_SCALE = 0.1;
const MAX_SCALE = 2;
const DRAG_CLICK_THRESHOLD = 6;

function clampScale(scale) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export default function HeritageTree() {
  const [view, setView] = useState({ scale: 0.38, tx: 60, ty: 30 });
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(57);
  const pointersRef = useRef(new Map());
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    moved: false,
    pinchStartDistance: 0,
    pinchStartScale: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,
    pinchStartTx: 0,
    pinchStartTy: 0,
  });
  const suppressClickUntilRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRootId, setSelectedRootId] = useState(null);
  // 'app' derives the canvas from the app design tokens, so the page follows
  // the light/dark theme like every other route. The remaining palettes are
  // fixed decorative looks kept for PDF exports.
  const [theme, setTheme] = useState('app');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const { recordName: activeId, setActivePerson } = useActivePerson();
  const { t, localization } = useTranslation();

  const { nodes, connectors, maxGen, individuals, rootId, genBands, genLabels, indis, fams } = useMemo(
    () => treeData ? layoutHeritageTree(treeData, selectedRootId || activeId) : layoutHeritageTree(null),
    [treeData, selectedRootId, activeId]
  );
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const highlightedIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const highlight = new Set([hoveredNodeId]);

    const upQueue = [hoveredNodeId];
    while (upQueue.length > 0) {
      const curr = indis[upQueue.shift()];
      if (curr?.famc?.length > 0) {
        const fam = fams[curr.famc[0]];
        if (fam?.husb) {
          highlight.add(fam.husb);
          upQueue.push(fam.husb);
        }
        if (fam?.wife) {
          highlight.add(fam.wife);
          upQueue.push(fam.wife);
        }
      }
    }

    const downQueue = [hoveredNodeId];
    while (downQueue.length > 0) {
      const curr = indis[downQueue.shift()];
      curr?.fams?.forEach((fId) => {
        const fam = fams[fId];
        if (!fam) return;
        if (fam.husb) highlight.add(fam.husb);
        if (fam.wife) highlight.add(fam.wife);
        fam.chil.forEach((cId) => {
          highlight.add(cId);
          downQueue.push(cId);
        });
      });
    }
    return highlight;
  }, [hoveredNodeId, indis, fams]);

  const handleResetView = () => {
    const rootNode = nodes.find((n) => n.id === rootId);
    if (rootNode) {
      const targetScale = 0.75;
      const tx = (window.innerWidth / 2) - (rootNode.x + CW / 2) * targetScale;
      const ty = (window.innerHeight / 2) - (rootNode.y + 45) * targetScale;
      setView({ scale: targetScale, tx, ty });
    } else {
      setView({ scale: 0.38, tx: 60, ty: 30 });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const next = await loadHeritageTreeData();
      if (!cancelled) {
        setTreeData(next);
        setLoading(false);
      }
    };
    load();
    const onPreferences = () => {
      load();
    };
    window.addEventListener(APP_PREFERENCES_EVENT, onPreferences);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_PREFERENCES_EVENT, onPreferences);
    };
  }, []);

  useEffect(() => {
    handleResetView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId, nodes.length]);

  // The canvas and the generation labels start below the toolbar. That offset
  // used to be a hard-coded 62px, which the toolbar outgrows as soon as its
  // controls wrap — on a narrow window the top row of cards ended up hidden
  // underneath it. Measure the real toolbar instead.
  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === 'undefined') return undefined;
    // getBoundingClientRect, not entry.contentRect: the latter is the content
    // box, so it drops the toolbar's padding and border.
    const observer = new ResizeObserver(() => {
      const next = Math.round(header.getBoundingClientRect().height);
      setHeaderHeight((current) => (current === next ? current : next));
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, [loading]);

  const handleResetToDatasetDefault = () => {
    setSelectedRootId(null);
    if (selectedRootId === null) handleResetView();
  };
  const selectRoot = (recordName) => {
    setSelectedRootId(recordName);
    if (recordName) setActivePerson(recordName);
  };

  const handleHardReset = async () => {
    setLoading(true);
    const next = await loadHeritageTreeData();
    setTreeData(next);
    setSelectedRootId(null);
    setLoading(false);
  };

  const beginDrag = (pointer) => {
    dragRef.current = {
      ...dragRef.current,
      isDragging: true,
      startX: pointer.clientX,
      startY: pointer.clientY,
      startTx: view.tx,
      startTy: view.ty,
      moved: false,
      pinchStartDistance: 0,
    };
    setIsDragging(true);
  };

  const beginPinch = () => {
    const activePointers = [...pointersRef.current.values()];
    if (activePointers.length < 2) return;
    const [a, b] = activePointers;
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    dragRef.current = {
      ...dragRef.current,
      isDragging: true,
      moved: true,
      pinchStartDistance: distance || 1,
      pinchStartScale: view.scale,
      pinchCenterX: (a.clientX + b.clientX) / 2,
      pinchCenterY: (a.clientY + b.clientY) / 2,
      pinchStartTx: view.tx,
      pinchStartTy: view.ty,
    };
    setIsDragging(true);
  };

  const shouldIgnorePointer = (target) => target.closest?.('header, .legend, .analytics-backdrop, button, input, select, textarea, a');

  const handlePointerDown = (e) => {
    if (shouldIgnorePointer(e.target)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    if (pointersRef.current.size === 1) beginDrag({ clientX: e.clientX, clientY: e.clientY });
    if (pointersRef.current.size === 2) beginPinch();
  };

  const handlePointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    e.preventDefault();
    pointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    const activePointers = [...pointersRef.current.values()];

    if (activePointers.length >= 2 && dragRef.current.pinchStartDistance) {
      const [a, b] = activePointers;
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const centerX = (a.clientX + b.clientX) / 2;
      const centerY = (a.clientY + b.clientY) / 2;
      const nextScale = clampScale(dragRef.current.pinchStartScale * (distance / dragRef.current.pinchStartDistance));
      const scaleRatio = nextScale / dragRef.current.pinchStartScale;
      setView({
        scale: nextScale,
        tx: centerX - (dragRef.current.pinchCenterX - dragRef.current.pinchStartTx) * scaleRatio,
        ty: centerY - (dragRef.current.pinchCenterY - dragRef.current.pinchStartTy) * scaleRatio,
      });
      return;
    }

    if (!dragRef.current.isDragging) return;
    const pointer = activePointers[0];
    const dx = pointer.clientX - dragRef.current.startX;
    const dy = pointer.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD) dragRef.current.moved = true;
    setView((prev) => ({
      ...prev,
      tx: dragRef.current.startTx + dx,
      ty: dragRef.current.startTy + dy,
    }));
  };

  const handlePointerUp = (e) => {
    if (pointersRef.current.has(e.pointerId)) {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      pointersRef.current.delete(e.pointerId);
    }
    if (dragRef.current.moved) suppressClickUntilRef.current = Date.now() + 250;
    if (pointersRef.current.size === 1) {
      const [pointer] = pointersRef.current.values();
      beginDrag(pointer);
      return;
    }
    dragRef.current.isDragging = false;
    dragRef.current.pinchStartDistance = 0;
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    const zoomDelta = e.deltaY > 0 ? -0.08 : 0.08;
    setView((prev) => {
      const nextScale = clampScale(prev.scale + zoomDelta);
      const scaleRatio = nextScale / prev.scale;
      return {
        scale: nextScale,
        tx: e.clientX - (e.clientX - prev.tx) * scaleRatio,
        ty: e.clientY - (e.clientY - prev.ty) * scaleRatio,
      };
    });
  };

  const maxX = nodes.length > 0 ? Math.max(...nodes.map((p) => p.x + CW)) + 140 : window.innerWidth;
  const maxY = nodes.length > 0 ? Math.max(...nodes.map((p) => p.y + p.h)) + 140 : window.innerHeight;

  if (loading) {
    return (
      <div className="grid h-full place-items-center bg-background text-sm text-muted-foreground">
        {t('heritageTree.loading')}
      </div>
    );
  }

  return (
    <div
      className="heritage-tree-view"
      data-heritage-theme={theme}
      lang={localization.locale}
      dir={localization.direction}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ '--ht-header-h': `${headerHeight}px`, cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <Header
        headerRef={headerRef}
        maxGen={maxGen}
        rootName={byId[rootId]?.name}
        individuals={individuals}
        rootId={rootId}
        setSelectedRootId={selectRoot}
        theme={theme}
        setTheme={setTheme}
        handleFileUpload={null}
        setShowAnalytics={setShowAnalytics}
        view={view}
        setView={setView}
        handleRecenter={handleResetView}
        handleResetToDatasetDefault={handleResetToDatasetDefault}
        handleHardReset={handleHardReset}
      />

      <div
        id="canvas"
        style={{
          width: maxX,
          height: maxY,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transition: isDragging ? 'none' : 'transform 0.4s ease-out',
        }}
      >
        <svg id="connectors" width={maxX} height={maxY} style={{ opacity: highlightedIds ? 0.35 : 1 }}>
          {connectors?.map((c) => (
            <polyline
              key={c.id}
              points={c.path}
              stroke={c.isMarriage ? 'var(--ht-marriage-line)' : 'var(--ht-blood-line)'}
              strokeWidth="2"
              fill="none"
              strokeLinejoin="round"
              strokeDasharray={c.isMarriage ? '6,3' : 'none'}
              opacity={c.isMarriage ? '0.85' : '0.7'}
            />
          ))}
        </svg>

        {nodes.map((p) => (
          <PersonCard
            key={p.renderKey || p.id}
            person={p}
            isRoot={p.id === rootId}
            isDimmed={highlightedIds && !highlightedIds.has(p.id)}
            onMouseEnter={() => setHoveredNodeId(p.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => {
              if (Date.now() < suppressClickUntilRef.current) return;
              selectRoot(p.id);
            }}
          />
        ))}

        {genBands?.map((b) => (
          <div key={`band-${b.id}`} className="gen-band" style={{ top: b.y }} />
        ))}
      </div>

      {genLabels?.map((l) => (
        <div key={`label-${l.gen}`} className="gen-label" style={{ top: (l.y * view.scale + view.ty + headerHeight) }}>
          {t('heritageTree.generationLabel', { count: l.gen })}
        </div>
      ))}

      {/* Sits outside #canvas: inside it, the message inherited the pan/zoom
          transform and drifted off-screen the moment the view moved. */}
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-x-6 top-1/2 z-20 -translate-y-1/2 text-center text-sm text-muted-foreground">
          <p className="text-base font-medium text-foreground">{t('heritageTree.emptyTitle')}</p>
          <p className="mt-1">{t('heritageTree.emptyBody')}</p>
        </div>
      )}

      <Legend nodes={nodes} />

      <AnalyticsModal show={showAnalytics} onClose={() => setShowAnalytics(false)} indis={indis} nodes={nodes} fams={fams} rootId={rootId} />
    </div>
  );
}
