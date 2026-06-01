import * as THREE from 'three';
import { applyCameraState, computeFitState, persistCameraState } from './camera.js';
import { animateCameraTo } from './animation.js';

export function createCameraActions({
  activeId,
  camera,
  container,
  controls,
  getBounds,
  setZoomPercent,
  viewerOptions,
  tweens = null,
  cameraTweenRef = null,
}) {
  const persist = () => {
    persistCameraState(camera, controls, viewerOptions.cameraMode, activeId);
  };
  const updateZoom = () => {
    setZoomPercent(Math.round(camera.zoom * 100));
    persist();
  };
  const animationsEnabled = tweens && viewerOptions?.animationDuration !== 0;
  const duration = 0.6 * (Number.isFinite(viewerOptions?.animationDuration) ? viewerOptions.animationDuration || 1 : 1);

  return {
    fit(bounds = getBounds()) {
      const target = computeFitState(bounds, container, viewerOptions.cameraMode);
      if (animationsEnabled) {
        if (cameraTweenRef?.current) tweens.cancel(cameraTweenRef.current);
        const tween = animateCameraTo(tweens, camera, controls, target, {
          duration,
          onUpdate: () => setZoomPercent(Math.round(camera.zoom * 100)),
          onComplete: persist,
        });
        if (cameraTweenRef) cameraTweenRef.current = tween;
      } else {
        applyCameraState(camera, controls, target);
        updateZoom();
      }
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
