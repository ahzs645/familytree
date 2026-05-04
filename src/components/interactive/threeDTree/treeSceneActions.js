import * as THREE from 'three';
import { fitCamera, persistCameraState } from './camera.js';

export function createCameraActions({
  activeId,
  camera,
  container,
  controls,
  getBounds,
  setZoomPercent,
  viewerOptions,
}) {
  const persist = () => {
    persistCameraState(camera, controls, viewerOptions.cameraMode, activeId);
  };
  const updateZoom = () => {
    setZoomPercent(Math.round(camera.zoom * 100));
    persist();
  };

  return {
    fit(bounds = getBounds()) {
      fitCamera(camera, controls, bounds, container, viewerOptions.cameraMode);
      updateZoom();
    },
    zoom(factor) {
      camera.zoom = THREE.MathUtils.clamp(camera.zoom / factor, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      controls.update();
      updateZoom();
    },
    zoomTo(percent) {
      camera.zoom = THREE.MathUtils.clamp(percent / 100, controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix();
      controls.update();
      updateZoom();
    },
  };
}
