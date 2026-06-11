import * as THREE from 'three';
import { CAMERA_STATE_STORAGE_KEY, CAMERA_STATE_VERSION } from './constants.js';

// Native camera presets, extracted from MacFamilyTree 11's
// InteractiveTreeView3DViewer (Camera category, updateForChangedCameraPropertiesAnimated:).
// Every preset uses an orthographic projection with SCNNode euler angles
// (pitch below horizon = elevation here, yaw around the up axis; negative yaw
// puts the camera on the viewer's left). The native default mode is 1
// ("Top Down, slightly tilted", pitch -63°).
const MODE_ANGLES = {
  topDown: { elevation: 89.82, yaw: 0 },
  topDownSlight: { elevation: 63, yaw: 0 },
  topDownTilted: { elevation: 49.5, yaw: 0 },
  front: { elevation: 31.5, yaw: 0 },
  frontLeft: { elevation: 31.5, yaw: -13.5 },
  frontRight: { elevation: 31.5, yaw: 13.5 },
  topLeft: { elevation: 45, yaw: -13.5 },
  topRight: { elevation: 45, yaw: 13.5 },
  isoLeft: { elevation: 36, yaw: -45 },
  isoRight: { elevation: 36, yaw: 45 },
  // Legacy ids kept for persisted camera state
  top: { elevation: 89.82, yaw: 0 },
  tilted: { elevation: 49.5, yaw: 0 },
};

export const CAMERA_DISTANCE = 1700;

export function cameraAnglesForMode(cameraMode) {
  return MODE_ANGLES[cameraMode] || MODE_ANGLES.topDownSlight;
}

export function computeFitState(bounds, container, cameraMode = 'topDownSlight') {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const rect = container.getBoundingClientRect();
  const viewportWidth = Math.max(1, rect.width);
  const viewportHeight = Math.max(1, rect.height);
  // Project the ground rectangle through the preset's yaw/elevation so the
  // fit is exact for tilted modes: yaw mixes width/depth on the screen's x
  // axis, elevation foreshortens the depth axis vertically.
  const { elevation, yaw } = cameraAnglesForMode(cameraMode);
  const el = THREE.MathUtils.degToRad(elevation);
  const ya = Math.abs(THREE.MathUtils.degToRad(yaw));
  const projectedWidth = width * Math.cos(ya) + height * Math.sin(ya);
  const projectedHeight = (width * Math.sin(ya) + height * Math.cos(ya)) * Math.sin(el);
  const zoomForWidth = viewportWidth / projectedWidth;
  const zoomForHeight = viewportHeight / projectedHeight;
  const zoom = THREE.MathUtils.clamp(Math.min(zoomForWidth, zoomForHeight) * 0.9, 0.1, 1.45);
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

// Native: position = focus + R(pitch)·R(yaw)·(0, 0, distance) in SceneKit's
// Y-up frame. Mapped into our Z-up scene (camera approaches from -Y, the
// root generation's side) that offset is:
//   x = d·sin(yaw),  y = -d·cos(el)·cos(yaw),  z = d·sin(el)·cos(yaw)
function cameraPositionForMode(cameraMode, centerX, centerY) {
  const { elevation, yaw } = cameraAnglesForMode(cameraMode);
  const el = THREE.MathUtils.degToRad(elevation);
  const ya = THREE.MathUtils.degToRad(yaw);
  return new THREE.Vector3(
    centerX + CAMERA_DISTANCE * Math.sin(ya),
    centerY - CAMERA_DISTANCE * Math.cos(el) * Math.cos(ya),
    CAMERA_DISTANCE * Math.sin(el) * Math.cos(ya),
  );
}
