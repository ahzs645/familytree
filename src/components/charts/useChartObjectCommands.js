/**
 * Lightweight command stack for chart overlay objects.
 *
 * Supports:
 * - transient preview updates while dragging
 * - committed updates for undo/redo
 * - add/remove/reposition operations
 * - align and distribution helpers
 * - z-order helpers (front/back)
 */

import { useCallback, useMemo, useReducer } from 'react';
import { getContentRect } from '../../lib/pageLayout.js';
import { computePageBreakAdjustments } from '../../lib/chartObjectLayout.js';
import { generateId } from '../../lib/ids.js';

const MAX_HISTORY = 64;

function uid() {
  return generateId('overlay');
}

function clone(val) {
  return Array.isArray(val) ? [...val] : [];
}

function normalizeOverlayType(type = '') {
  const t = String(type || '').toLowerCase();
  if (t.includes('line')) return 'line';
  if (t.includes('image')) return 'image';
  if (t.includes('text')) return 'text';
  return t;
}

function normalizeOverlay(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = normalizeOverlayType(raw.type);
  return {
    id: String(raw.id || uid()),
    type: type || 'text',
    x: Number.isFinite(Number(raw.x)) ? Number(raw.x) : 0,
    y: Number.isFinite(Number(raw.y)) ? Number(raw.y) : 0,
    x1: Number.isFinite(Number(raw.x1)) ? Number(raw.x1) : 0,
    y1: Number.isFinite(Number(raw.y1)) ? Number(raw.y1) : 0,
    x2: Number.isFinite(Number(raw.x2)) ? Number(raw.x2) : 0,
    y2: Number.isFinite(Number(raw.y2)) ? Number(raw.y2) : 0,
    width: Number.isFinite(Number(raw.width)) ? Number(raw.width) : 180,
    height: Number.isFinite(Number(raw.height)) ? Number(raw.height) : 120,
    fontSize: Number.isFinite(Number(raw.fontSize)) ? Number(raw.fontSize) : 18,
    color: raw.color || '#222222',
    strokeWidth: Number.isFinite(Number(raw.strokeWidth)) ? Number(raw.strokeWidth) : 2,
    text: raw.text || 'Text',
    href: raw.href || '',
    ...raw,
    type,
  };
}

function normalizeAll(overlays) {
  return ensureArray(overlays)
    .map(normalizeOverlay)
    .filter(Boolean)
    .map((overlay, index) => ({ ...overlay, id: String(overlay.id || `overlay-${index}`) }));
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function compositorEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeStyleMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([id, style]) => [String(id), { ...(style || {}) }]));
}

function normalizeCompositor(value) {
  if (Array.isArray(value)) {
    return { overlays: normalizeAll(value), objectStyles: {}, connectionStyles: {} };
  }
  return {
    overlays: normalizeAll(value?.overlays),
    objectStyles: normalizeStyleMap(value?.objectStyles),
    connectionStyles: normalizeStyleMap(value?.connectionStyles),
  };
}

function moveLine(overlay, dx = 0, dy = 0) {
  if (overlay.type !== 'line') return overlay;
  return {
    ...overlay,
    x1: overlay.x1 + dx,
    x2: overlay.x2 + dx,
    y1: overlay.y1 + dy,
    y2: overlay.y2 + dy,
  };
}

function moveShape(overlay, dx = 0, dy = 0) {
  if (overlay.type === 'line') return moveLine(overlay, dx, dy);
  return {
    ...overlay,
    x: overlay.x + dx,
    y: overlay.y + dy,
  };
}

function overlayBounds(overlay) {
  if (!overlay || typeof overlay !== 'object') {
    return { x: 0, y: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }
  if (overlay.type === 'line') {
    const minX = Math.min(overlay.x1, overlay.x2);
    const maxX = Math.max(overlay.x1, overlay.x2);
    const minY = Math.min(overlay.y1, overlay.y2);
    const maxY = Math.max(overlay.y1, overlay.y2);
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }
  const width = overlay.width || 140;
  const height = overlay.height || 56;
  return {
    x: overlay.x,
    y: overlay.y,
    width,
    height,
    centerX: overlay.x + width / 2,
    centerY: overlay.y + height / 2,
  };
}

function ensureSelection(items, selectedId) {
  if (!selectedId) return null;
  return items.some((item) => item.id === selectedId) ? selectedId : (items[0]?.id || null);
}

function commitReducer(state, action) {
  switch (action.type) {
    case 'SET_FROM_SOURCE': {
      const compositor = normalizeCompositor(action.compositor);
      return {
        history: [compositor],
        index: 0,
        selectedId: action.preserveSelection ? ensureSelection(compositor.overlays, state.selectedId) : null,
        selectedObject: action.preserveSelection ? state.selectedObject : null,
      };
    }

    case 'PREVIEW': {
      const compositor = normalizeCompositor(action.compositor);
      const history = [...state.history];
      history[state.index] = compositor;
      return {
        ...state,
        history,
      };
    }

    case 'COMMIT': {
      const compositor = normalizeCompositor(action.compositor);
      const current = state.history[state.index] || normalizeCompositor({});
      if (compositorEqual(current, compositor)) return state;
      let history = state.history.slice(0, state.index + 1);
      history.push(items);
      let index = history.length - 1;
      if (history.length > MAX_HISTORY) {
        const drop = history.length - MAX_HISTORY;
        history = history.slice(drop);
        index -= drop;
      }
      return {
        ...state,
        history,
        index,
        selectedId: ensureSelection(compositor.overlays, action.selectedId || state.selectedId),
      };
    }

    case 'UNDO': {
      if (state.index <= 0) return state;
      return {
        ...state,
        index: state.index - 1,
        selectedId: ensureSelection(state.history[state.index - 1]?.overlays || [], state.selectedId),
      };
    }

    case 'REDO': {
      if (state.index >= state.history.length - 1) return state;
      return {
        ...state,
        index: state.index + 1,
        selectedId: ensureSelection(state.history[state.index + 1]?.overlays || [], state.selectedId),
      };
    }

    case 'SELECT': {
      return {
        ...state,
        selectedId: action.id ? String(action.id) : null,
        selectedObject: null,
      };
    }

    case 'SELECT_OBJECT': {
      return {
        ...state,
        selectedId: null,
        selectedObject: action.object?.id ? {
          id: String(action.object.id),
          kind: action.object.kind === 'connection' ? 'connection' : 'person',
          label: String(action.object.label || ''),
        } : null,
      };
    }

    default:
      return state;
  }
}

export function useChartObjectCommands(initialOverlays = []) {
  const [state, dispatch] = useReducer(commitReducer, {
    history: [normalizeCompositor({ overlays: initialOverlays })],
    index: 0,
    selectedId: null,
    selectedObject: null,
  });

  const compositor = useMemo(() => state.history[state.index] || normalizeCompositor({}), [state.history, state.index]);
  const overlays = compositor.overlays;
  const objectStyles = compositor.objectStyles;
  const connectionStyles = compositor.connectionStyles;
  const hasUndo = state.index > 0;
  const hasRedo = state.index < state.history.length - 1;

  const setFromSource = useCallback((next, options = {}) => {
    dispatch({
      type: 'SET_FROM_SOURCE',
      compositor: normalizeCompositor({
        overlays: next,
        objectStyles: options.objectStyles,
        connectionStyles: options.connectionStyles,
      }),
      preserveSelection: options.preserveSelection,
    });
  }, []);

  const setOverlaysPreview = useCallback((next) => {
    dispatch({
      type: 'PREVIEW',
      compositor: { ...compositor, overlays: normalizeAll(next) },
      selectedId: state.selectedId,
    });
  }, [compositor, state.selectedId]);

  const setOverlaysCommit = useCallback((next, options = {}) => {
    dispatch({
      type: 'COMMIT',
      compositor: { ...compositor, overlays: normalizeAll(next) },
      selectedId: options.selectedId,
    });
  }, [compositor]);

  const setCompositorCommit = useCallback((next, options = {}) => {
    dispatch({
      type: 'COMMIT',
      compositor: normalizeCompositor(next),
      selectedId: options.selectedId,
    });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const selectOverlay = useCallback((overlayId) => {
    dispatch({ type: 'SELECT', id: overlayId });
  }, []);

  const selectObject = useCallback((object) => {
    dispatch({ type: 'SELECT_OBJECT', object });
  }, []);

  const updateObjectStyle = useCallback((id, changes, options = {}) => {
    if (!id) return;
    const nextStyles = { ...objectStyles };
    if (options.replace && !Object.keys(changes || {}).length) delete nextStyles[id];
    else nextStyles[id] = options.replace ? { ...(changes || {}) } : { ...(objectStyles[id] || {}), ...changes };
    setCompositorCommit({
      ...compositor,
      objectStyles: nextStyles,
    });
  }, [compositor, objectStyles, setCompositorCommit]);

  const updateConnectionStyle = useCallback((id, changes, options = {}) => {
    if (!id) return;
    const nextStyles = { ...connectionStyles };
    if (options.replace && !Object.keys(changes || {}).length) delete nextStyles[id];
    else nextStyles[id] = options.replace ? { ...(changes || {}) } : { ...(connectionStyles[id] || {}), ...changes };
    setCompositorCommit({
      ...compositor,
      connectionStyles: nextStyles,
    });
  }, [compositor, connectionStyles, setCompositorCommit]);

  const moveSelected = useCallback((dx, dy) => {
    const selectedId = state.selectedId || overlays[0]?.id;
    if (!selectedId) return;
    const next = overlays.map((overlay) =>
      overlay.id === selectedId
        ? moveShape(overlay, dx, dy)
        : overlay
    );
    setOverlaysCommit(next, { selectedId });
  }, [overlays, setOverlaysCommit, state.selectedId]);

  const setOverlayCollection = useCallback((updater) => {
    const next = typeof updater === 'function'
      ? updater(overlays)
      : updater;
    setOverlaysCommit(next);
  }, [overlays, setOverlaysCommit]);

  const addText = useCallback((opts = {}) => {
    const text = String(opts.text || 'Annotation');
    const newOverlay = {
      id: uid(),
      type: 'text',
      text,
      x: opts.x || 96,
      y: opts.y || 120,
      fontSize: Number.isFinite(Number(opts.fontSize)) ? Number(opts.fontSize) : 20,
      color: opts.color || '#222222',
    };
    setOverlayCollection((current) => {
      const next = [...current, newOverlay];
      return next;
    });
    dispatch({ type: 'SELECT', id: newOverlay.id });
  }, [setOverlayCollection]);

  const addLine = useCallback((opts = {}) => {
    const newOverlay = {
      id: uid(),
      type: 'line',
      x1: opts.x1 || 120,
      y1: opts.y1 || 160,
      x2: opts.x2 || 300,
      y2: opts.y2 || 160,
      strokeWidth: Number.isFinite(Number(opts.strokeWidth)) ? Number(opts.strokeWidth) : 3,
      color: opts.color || '#2f2f2f',
    };
    setOverlayCollection((current) => [...current, newOverlay]);
    dispatch({ type: 'SELECT', id: newOverlay.id });
  }, [setOverlayCollection]);

  const addImage = useCallback((href, opts = {}) => {
    if (!href) return;
    const newOverlay = {
      id: uid(),
      type: 'image',
      href,
      x: opts.x || 120,
      y: opts.y || 140,
      width: Number.isFinite(Number(opts.width)) ? Number(opts.width) : 180,
      height: Number.isFinite(Number(opts.height)) ? Number(opts.height) : 120,
    };
    setOverlayCollection((current) => [...current, newOverlay]);
    dispatch({ type: 'SELECT', id: newOverlay.id });
  }, [setOverlayCollection]);

  const removeSelected = useCallback(() => {
    const selectedId = state.selectedId || overlays[0]?.id;
    if (!selectedId) return;
    const next = overlays.filter((overlay) => overlay.id !== selectedId);
    setOverlaysCommit(next);
    dispatch({ type: 'SELECT', id: next[0]?.id || null });
  }, [state.selectedId, overlays, setOverlaysCommit]);

  const moveOverlayCollection = useCallback((updater) => {
    const next = updater(overlays);
    setOverlaysCommit(next);
  }, [overlays, setOverlaysCommit]);

  const alignHorizontal = useCallback((mode = 'left') => {
    const selectedId = state.selectedId || overlays[0]?.id;
    if (!selectedId) return;
    const selected = overlays.filter((overlay) => overlay.id === selectedId);
    if (!selected.length) return;
    const refs = selected.map((overlay) => overlayBounds(overlay));
    const minLeft = Math.min(...refs.map((r) => r.x));
    const maxRight = Math.max(...refs.map((r) => r.x + r.width));
    const mid = refs.reduce((acc, rect) => acc + rect.centerX, 0) / refs.length;
    const newItems = overlays.map((overlay) => {
      if (overlay.id !== selectedId) return overlay;
      const rect = overlayBounds(overlay);
      if (overlay.type === 'line') {
        const width = rect.width;
        const target =
          mode === 'center' ? mid - width / 2
          : mode === 'right' ? maxRight - width
            : minLeft;
        const delta = target - rect.x;
        return {
          ...overlay,
          x1: overlay.x1 + delta,
          x2: overlay.x2 + delta,
        };
      }
      const target =
        mode === 'center' ? mid - rect.width / 2
        : mode === 'right' ? maxRight - rect.width
          : minLeft;
      return {
        ...overlay,
        x: target,
      };
    });
    setOverlaysCommit(newItems);
  }, [overlays, setOverlaysCommit, state.selectedId]);

  const alignVertical = useCallback((mode = 'top') => {
    const selectedId = state.selectedId || overlays[0]?.id;
    if (!selectedId) return;
    const selected = overlays.filter((overlay) => overlay.id === selectedId);
    if (!selected.length) return;
    const refs = selected.map((overlay) => overlayBounds(overlay));
    const minTop = Math.min(...refs.map((r) => r.y));
    const maxBottom = Math.max(...refs.map((r) => r.y + r.height));
    const mid = refs.reduce((acc, rect) => acc + rect.centerY, 0) / refs.length;

    const next = overlays.map((overlay) => {
      if (overlay.id !== selectedId) return overlay;
      const rect = overlayBounds(overlay);
      if (overlay.type === 'line') {
        const height = rect.height;
        const target =
          mode === 'middle' ? mid - height / 2
          : mode === 'bottom' ? maxBottom - height
            : minTop;
        const delta = target - rect.y;
        return {
          ...overlay,
          y1: overlay.y1 + delta,
          y2: overlay.y2 + delta,
        };
      }
      const target =
        mode === 'middle' ? mid - rect.height / 2
        : mode === 'bottom' ? maxBottom - rect.height
          : minTop;
      return {
        ...overlay,
        y: target,
      };
    });
    setOverlaysCommit(next);
  }, [overlays, setOverlaysCommit, state.selectedId]);

  const bringToFront = useCallback(() => {
    const selectedId = state.selectedId || overlays[0]?.id;
    if (!selectedId) return;
    const idx = overlays.findIndex((overlay) => overlay.id === selectedId);
    if (idx === -1 || idx === overlays.length - 1) return;
    const next = clone(overlays);
    const [moving] = next.splice(idx, 1);
    next.push(moving);
    setOverlaysCommit(next, { selectedId });
  }, [overlays, setOverlaysCommit, state.selectedId]);

  const sendToBack = useCallback(() => {
    const selectedId = state.selectedId || overlays[0]?.id;
    if (!selectedId) return;
    const idx = overlays.findIndex((overlay) => overlay.id === selectedId);
    if (idx <= 0) return;
    const next = clone(overlays);
    const [moving] = next.splice(idx, 1);
    next.unshift(moving);
    setOverlaysCommit(next, { selectedId });
  }, [overlays, setOverlaysCommit, state.selectedId]);
  const distributeEvenly = useCallback((direction = 'horizontal') => {
    if (overlays.length < 3) return;
    const selectedIds = [state.selectedId].filter(Boolean);
    if (!selectedIds.length) return;

    const selectedOverlays = overlays
      .map((overlay, index) => ({ overlay, index, rect: overlayBounds(overlay) }))
      .filter((entry) => selectedIds.includes(entry.overlay.id));

    if (!selectedOverlays.length) return;
    const axis = direction === 'vertical' ? 'y' : 'x';
    const span1 = axis === 'x'
      ? (rect) => rect.x + rect.width
      : (rect) => rect.y + rect.height;
    const start = Math.min(...selectedOverlays.map((entry) => (axis === 'x' ? entry.rect.x : entry.rect.y)));
    const end = Math.max(...selectedOverlays.map((entry) => span1(entry.rect)));
    const sorted = selectedOverlays
      .slice()
      .sort((a, b) => (axis === 'x' ? a.rect.centerX - b.rect.centerX : a.rect.centerY - b.rect.centerY));

    const range = Math.max(1, end - start);
    const gaps = sorted.length - 1;
    const step = range / gaps;
    const next = overlays.map((overlay) => overlay);

    sorted.forEach((entry, order) => {
      const idx = entry.index;
      const targetStart = start + step * order;
      const targetCenter = targetStart + entry.rect.width / 2;
      const rect = entry.rect;
      const currentCenter = axis === 'x' ? rect.centerX : rect.centerY;
      const delta = (axis === 'x' ? targetCenter : targetCenter) - currentCenter;
      if (axis === 'x') {
        next[idx] = moveShape(entry.overlay, delta, 0);
      } else {
        next[idx] = moveShape(entry.overlay, 0, delta);
      }
    });
    setOverlaysCommit(next);
  }, [overlays, setOverlaysCommit, state.selectedId]);

  const moveAwayFromPageCuts = useCallback((pageSetup = {}, measured = null) => {
    const objects = Array.isArray(measured?.objects)
      ? measured.objects
      : overlays.map((overlay) => ({ id: overlay.id, kind: 'overlay', bounds: overlayBounds(overlay) }));
    const contentBounds = measured?.contentBounds || objects.reduce((acc, object) => {
      const rect = object.bounds;
      acc.x = Math.min(acc.x, rect.x);
      acc.y = Math.min(acc.y, rect.y);
      acc.maxX = Math.max(acc.maxX, rect.x + rect.width);
      acc.maxY = Math.max(acc.maxY, rect.y + rect.height);
      return acc;
    }, { x: Infinity, y: Infinity, maxX: -Infinity, maxY: -Infinity });
    const normalizedBounds = Number.isFinite(contentBounds?.width)
      ? contentBounds
      : { x: contentBounds.x, y: contentBounds.y, width: contentBounds.maxX - contentBounds.x, height: contentBounds.maxY - contentBounds.y };
    const adjustments = computePageBreakAdjustments(objects, pageSetup, normalizedBounds);
    if (!adjustments.length) return;
    const overlayMoves = new Map(adjustments.filter((item) => item.kind === 'overlay').map((item) => [item.id, item]));
    const nextOverlays = overlays.map((overlay) => {
      const adjustment = overlayMoves.get(overlay.id);
      return adjustment ? moveShape(overlay, adjustment.dx, adjustment.dy) : overlay;
    });
    const nextObjectStyles = { ...objectStyles };
    for (const adjustment of adjustments) {
      if (adjustment.kind !== 'person') continue;
      const current = nextObjectStyles[adjustment.id] || {};
      nextObjectStyles[adjustment.id] = {
        ...current,
        offsetX: (Number(current.offsetX) || 0) + adjustment.dx,
        offsetY: (Number(current.offsetY) || 0) + adjustment.dy,
      };
    }
    setCompositorCommit({ ...compositor, overlays: nextOverlays, objectStyles: nextObjectStyles });
  }, [compositor, objectStyles, overlays, setCompositorCommit]);

  const distributeBorderToBorder = useCallback((direction = 'horizontal', pageSetup = {}) => {
    if (overlays.length < 2) return;
    const content = getContentRect(pageSetup);
    if (content.width <= 0 || content.height <= 0) return;
    const axis = direction === 'vertical' ? 'y' : 'x';
    const sorted = overlays
      .map((overlay, index) => ({ overlay, index, rect: overlayBounds(overlay) }))
      .sort((a, b) => (axis === 'x' ? a.rect.centerX - b.rect.centerX : a.rect.centerY - b.rect.centerY));
    const rangeStart = axis === 'x' ? content.x : content.y;
    const rangeEnd = axis === 'x' ? content.x + content.width : content.y + content.height;
    const gaps = Math.max(1, sorted.length - 1);
    const step = (rangeEnd - rangeStart) / gaps;
    const next = overlays.slice();
    sorted.forEach((entry, order) => {
      const targetCenter = rangeStart + step * order;
      const currentCenter = axis === 'x' ? entry.rect.centerX : entry.rect.centerY;
      const delta = targetCenter - currentCenter;
      next[entry.index] = axis === 'x'
        ? moveShape(entry.overlay, delta, 0)
        : moveShape(entry.overlay, 0, delta);
    });
    setOverlaysCommit(next);
  }, [overlays, setOverlaysCommit]);

  return {
    overlays,
    objectStyles,
    connectionStyles,
    selectedOverlayId: state.selectedId,
    selectedObject: state.selectedObject,
    hasUndo,
    hasRedo,
    setFromSource,
    setOverlaysPreview,
    setOverlaysCommit,
    moveSelected,
    setOverlayCollection,
    moveOverlayCollection,
    undo,
    redo,
    selectOverlay,
    selectObject,
    updateObjectStyle,
    updateConnectionStyle,
    addText,
    addLine,
    addImage,
    removeSelected,
    alignHorizontal,
    alignVertical,
    bringToFront,
    sendToBack,
    distributeEvenly,
    moveAwayFromPageCuts,
    distributeBorderToBorder,
  };
}
