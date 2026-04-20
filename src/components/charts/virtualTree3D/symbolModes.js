/**
 * Symbol modes for virtual-tree persons.
 *
 * Matches Mac VirtualTreePersonObject symbol options: sphere/rounded
 * (rounded box)/circle (flat disc)/photo. Each factory returns a ready-built
 * THREE.Mesh — the caller positions and adds it to the scene.
 *
 * Materials are created per mesh so callers can freely swap color without
 * mutating a shared singleton.
 */

import * as THREE from 'three';

export const SYMBOL_MODES = ['sphere', 'rounded', 'circle', 'photo'];

const SIZE = 44;

let sharedSphereGeometry = null;
let sharedRoundedGeometry = null;
let sharedCircleGeometry = null;
let sharedPhotoGeometry = null;

function getSphereGeometry() {
  if (!sharedSphereGeometry) sharedSphereGeometry = new THREE.SphereGeometry(SIZE / 2, 24, 16);
  return sharedSphereGeometry;
}

function getRoundedGeometry() {
  if (!sharedRoundedGeometry) {
    // RoundedBox isn't in the core three package; approximate with BoxGeometry
    // and a small chamfer via segments. It still reads as a soft box at
    // orbit distances.
    sharedRoundedGeometry = new THREE.BoxGeometry(SIZE, SIZE, SIZE * 0.6, 2, 2, 2);
  }
  return sharedRoundedGeometry;
}

function getCircleGeometry() {
  if (!sharedCircleGeometry) sharedCircleGeometry = new THREE.CircleGeometry(SIZE / 2, 32);
  return sharedCircleGeometry;
}

function getPhotoGeometry() {
  if (!sharedPhotoGeometry) sharedPhotoGeometry = new THREE.PlaneGeometry(SIZE, SIZE);
  return sharedPhotoGeometry;
}

function makeMesh(geometry, color, { flat = false } = {}) {
  const material = flat
    ? new THREE.MeshBasicMaterial({ color })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = !flat;
  mesh.receiveShadow = !flat;
  return mesh;
}

function makePhotoMesh(color, photoUrl) {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
  const mesh = new THREE.Mesh(getPhotoGeometry(), material);
  if (photoUrl) {
    new THREE.TextureLoader().load(photoUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
      material.needsUpdate = true;
    });
  } else {
    // No photo URL — tint the placeholder plane with the color so the mesh
    // still reads as a distinct person instead of a blank rectangle.
    material.color.setHex(color);
  }
  mesh.userData.__isPhoto = true;
  return mesh;
}

/**
 * Build a mesh for a person using the selected symbol mode.
 *
 * @param {string} mode   — one of SYMBOL_MODES
 * @param {number} color  — hex color
 * @param {object} opts   — { photoUrl } for photo mode
 */
export function createPersonMesh(mode, color, opts = {}) {
  switch (mode) {
    case 'rounded':
      return makeMesh(getRoundedGeometry(), color);
    case 'circle':
      return makeMesh(getCircleGeometry(), color, { flat: true });
    case 'photo':
      return makePhotoMesh(color, opts.photoUrl);
    case 'sphere':
    default:
      return makeMesh(getSphereGeometry(), color);
  }
}

export const SYMBOL_SIZE = SIZE;
