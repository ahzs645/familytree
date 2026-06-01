/**
 * Tiny time-based tween manager for the interactive tree. The render loop
 * advances it once per frame with the elapsed delta; each tween reports a
 * normalised, eased progress to its `onUpdate`. Mirrors the camera focus
 * transitions and node build-in motion of the native MacFamilyTree viewer.
 */
export function createTweenManager() {
  const tweens = new Set();
  return {
    add(tween) {
      tween.elapsed = 0;
      tweens.add(tween);
      return tween;
    },
    cancel(tween) {
      if (tween) tweens.delete(tween);
    },
    cancelAll(list) {
      for (const tween of list || []) tweens.delete(tween);
    },
    clear() {
      tweens.clear();
    },
    update(dt) {
      if (!tweens.size) return;
      for (const tween of [...tweens]) {
        tween.elapsed += dt;
        const past = tween.elapsed - (tween.delay || 0);
        if (past < 0) continue; // still in its stagger delay
        const raw = tween.duration > 0 ? Math.min(1, past / tween.duration) : 1;
        const eased = (tween.ease || easeOutCubic)(raw);
        try {
          tween.onUpdate(eased, raw);
        } catch {
          tweens.delete(tween);
          continue;
        }
        if (raw >= 1) {
          tweens.delete(tween);
          tween.onComplete?.();
        }
      }
    },
    get active() {
      return tweens.size > 0;
    },
  };
}

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

/**
 * Animate the orthographic camera + OrbitControls target/zoom from their
 * current state to `to` ({ position, target, zoom }) over `duration` seconds.
 */
export function animateCameraTo(tweens, camera, controls, to, { duration = 0.72, onUpdate, onComplete } = {}) {
  const fromPos = camera.position.clone();
  const fromTarget = controls.target.clone();
  const fromZoom = camera.zoom;
  return tweens.add({
    duration,
    ease: easeInOutCubic,
    onUpdate: (t) => {
      camera.position.lerpVectors(fromPos, to.position, t);
      controls.target.lerpVectors(fromTarget, to.target, t);
      camera.zoom = fromZoom + (to.zoom - fromZoom) * t;
      camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
      controls.update();
      onUpdate?.();
    },
    onComplete,
  });
}
