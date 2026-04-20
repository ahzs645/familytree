/**
 * Lighting rig for the virtual-tree 3D scene.
 *
 * Three-light setup approximating the Mac renderer's cinematic feel:
 *   - ambient for baseline fill so meshes aren't pure black when back-lit
 *   - key directional light (casts shadows) for shape definition
 *   - soft fill to prevent deep shadow banding
 *
 * Shadows are enabled with a reasonable map size — higher resolutions can
 * be added later if the scene stays still long enough to notice acne.
 */

import * as THREE from 'three';

export function installLighting(scene, renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(260, 520, 420);
  key.castShadow = true;
  key.shadow.mapSize.width = 1024;
  key.shadow.mapSize.height = 1024;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 4000;
  key.shadow.camera.left = -1200;
  key.shadow.camera.right = 1200;
  key.shadow.camera.top = 1200;
  key.shadow.camera.bottom = -1200;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fb8ff, 0.35);
  fill.position.set(-280, -120, 320);
  scene.add(fill);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x0b0f1a, 0.25);
  scene.add(hemi);
}

export function makeGroundShadowReceiver(yPosition = -40) {
  const geometry = new THREE.PlaneGeometry(4000, 4000);
  const material = new THREE.ShadowMaterial({ opacity: 0.25 });
  const plane = new THREE.Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = yPosition;
  plane.receiveShadow = true;
  return plane;
}
