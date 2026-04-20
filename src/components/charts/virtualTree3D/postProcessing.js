/**
 * Optional post-processing stack for the virtual-tree 3D scene.
 *
 * Currently wires EffectComposer + RenderPass + BokehPass so the scene can
 * present a depth-of-field (DoF) bokeh effect. Mac VirtualTreeConfiguration
 * exposes `CoreVirtualTree_DepthOfField` + aperture/max-blur/focus knobs;
 * those map to the BokehPass `focus`, `aperture`, and `maxblur` uniforms.
 *
 * The composer is lazily created: Scene.js only builds one when DoF is
 * enabled so users who leave DoF off pay no runtime cost.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const DOF_DEFAULTS = Object.freeze({
  enabled: false,
  focus: 720,
  aperture: 0.00015,
  maxblur: 0.012,
});

export function createComposer({ renderer, scene, camera, width, height, dof = DOF_DEFAULTS }) {
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bokehPass = new BokehPass(scene, camera, {
    focus: dof.focus ?? DOF_DEFAULTS.focus,
    aperture: dof.aperture ?? DOF_DEFAULTS.aperture,
    maxblur: dof.maxblur ?? DOF_DEFAULTS.maxblur,
    width,
    height,
  });
  bokehPass.enabled = Boolean(dof.enabled);
  composer.addPass(bokehPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return { composer, renderPass, bokehPass, outputPass };
}

export function applyDofSettings(bokehPass, dof = DOF_DEFAULTS) {
  if (!bokehPass) return;
  bokehPass.enabled = Boolean(dof.enabled);
  if (!bokehPass.uniforms) return;
  if (bokehPass.uniforms.focus) bokehPass.uniforms.focus.value = Number(dof.focus ?? DOF_DEFAULTS.focus);
  if (bokehPass.uniforms.aperture) bokehPass.uniforms.aperture.value = Number(dof.aperture ?? DOF_DEFAULTS.aperture);
  if (bokehPass.uniforms.maxblur) bokehPass.uniforms.maxblur.value = Number(dof.maxblur ?? DOF_DEFAULTS.maxblur);
}

export function disposeComposer(composerBundle) {
  if (!composerBundle) return;
  const { composer, bokehPass, outputPass } = composerBundle;
  // BokehPass holds a couple of render targets + materials that must be
  // released so texture leaks don't accrue when DoF toggles on and off.
  bokehPass?.dispose?.();
  outputPass?.dispose?.();
  composer?.dispose?.();
}
