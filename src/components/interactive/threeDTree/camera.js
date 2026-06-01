import * as THREE from 'three';
import { CAMERA_STATE_STORAGE_KEY, CAMERA_STATE_VERSION } from './constants.js';

export function computeFitState(bounds, container, cameraMode = 'tilted') {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const rect = container.getBoundingClientRect();
  const viewportWidth = Math.max(1, rect.width);
  const viewportHeight = Math.max(1, rect.height);
  const zoomForWidth = viewportWidth / width;
  const zoomForHeight = viewportHeight / height;
  const fitPadding = (cameraMode === 'top' || cameraMode === 'topDown') ? 0.9 : 0.82;
  const zoom = THREE.MathUtils.clamp(Math.min(zoomForWidth, zoomForHeight) * fitPadding, 0.1, 1.45);
  return {
    position: cameraPositionForMode(cameraMode, centerX, centerY),
    target: new THREE.Vector3(centerX, centerY, 0),
    zoom,
  };
}

export function applyCameraState(camera, controls, state) {
  camera.zoom = state.zoom;
  camera.position.copy(state.position);
  controls.target.copy(state.target);
  camera.lookAt(state.target);
  camera.updateProjectionMatrix();
  controls.update();
}

export function fitCamera(camera, controls, bounds, container, cameraMode = 'tilted') {
  applyCameraState(camera, controls, computeFitState(bounds, container, cameraMode));
}

export function cameraFitSignature(layout, activeId, cameraMode, bounds = layout.viewBounds || layout.bounds) {
  return [
    cameraMode,
    activeId || 'none',
    layout.nodes.length,
    Math.round(bounds.minX),
    Math.round(bounds.maxX),
    Math.round(bounds.minY),
    Math.round(bounds.maxY),
  ].join(':');
}

export function restoreCameraState(camera, controls, cameraMode, activeId) {
  if (typeof window === 'undefined') return false;
  if (!activeId) return false;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CAMERA_STATE_STORAGE_KEY) || '{}');
    if (parsed.version !== CAMERA_STATE_VERSION) return false;
    const state = parsed?.[cameraMode];
    if (!isFiniteCameraState(state)) return false;
    if (state.activeId && activeId && state.activeId !== activeId) return false;
    camera.position.set(state.position.x, state.position.y, state.position.z);
    camera.zoom = THREE.MathUtils.clamp(state.zoom, controls.minZoom, controls.maxZoom);
    controls.target.set(state.target.x, state.target.y, state.target.z);
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    return true;
  } catch {
    return false;
  }
}

export function persistCameraState(camera, controls, cameraMode, activeId) {
  if (typeof window === 'undefined') return;
  if (!activeId) return;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CAMERA_STATE_STORAGE_KEY) || '{}');
    parsed.version = CAMERA_STATE_VERSION;
    parsed[cameraMode] = {
      activeId: activeId || null,
      zoom: Number(camera.zoom.toFixed(4)),
      position: vectorSnapshot(camera.position),
      target: vectorSnapshot(controls.target),
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(CAMERA_STATE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Camera persistence should never block rendering.
  }
}

function vectorSnapshot(vector) {
  return {
    x: Number(vector.x.toFixed(2)),
    y: Number(vector.y.toFixed(2)),
    z: Number(vector.z.toFixed(2)),
  };
}

function isFiniteCameraState(state) {
  return Boolean(
    state
    && Number.isFinite(state.zoom)
    && Number.isFinite(state.position?.x)
    && Number.isFinite(state.position?.y)
    && Number.isFinite(state.position?.z)
    && Number.isFinite(state.target?.x)
    && Number.isFinite(state.target?.y)
    && Number.isFinite(state.target?.z)
  );
}

function cameraPositionForMode(cameraMode, centerX, centerY) {
  switch (cameraMode) {
    case 'topDown':
      return new THREE.Vector3(centerX, centerY, 1700);
    case 'topDownSlight':
      return new THREE.Vector3(centerX, centerY - 220, 1600);
    case 'topDownTilted':
      return new THREE.Vector3(centerX, centerY - 480, 1500);
    case 'front':
      return new THREE.Vector3(centerX, centerY - 1550, 520);
    case 'frontLeft':
      return new THREE.Vector3(centerX - 780, centerY - 1380, 520);
    case 'frontRight':
      return new THREE.Vector3(centerX + 780, centerY - 1380, 520);
    case 'topLeft':
      return new THREE.Vector3(centerX - 560, centerY - 200, 1620);
    case 'topRight':
      return new THREE.Vector3(centerX + 560, centerY - 200, 1620);
    case 'isoLeft':
      return new THREE.Vector3(centerX - 980, centerY - 980, 1280);
    case 'isoRight':
      return new THREE.Vector3(centerX + 980, centerY - 980, 1280);
    // Legacy fallbacks
    case 'top':
      return new THREE.Vector3(centerX, centerY, 1700);
    case 'tilted':
    default:
      return new THREE.Vector3(centerX, centerY - 360, 1550);
  }
}
