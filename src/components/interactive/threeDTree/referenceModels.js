import * as THREE from 'three';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PERSON_STYLES,
  REFERENCE_MODEL_BASE,
  REFERENCE_MODEL_GENDERS,
  REFERENCE_MODEL_GROUND_ROTATION_X,
  SKIN,
} from './constants.js';
import { MAC_FAMILY_GRAPH_LAYOUT } from './macTreeStyle.js';
import { colorsForGender, colorsForNode } from './personColors.js';

const referenceModelCache = new Map();
const referenceModelPreloadPromises = new Map();

export function preloadReferenceModels(personStyle = 'simplified') {
  if (referenceModelPreloadPromises.has(personStyle)) return referenceModelPreloadPromises.get(personStyle);
  const loader = new ColladaLoader();
  const requests = referenceModelFileNames(personStyle).map((fileName) => (
    new Promise((resolve) => {
      loader.load(
        `${REFERENCE_MODEL_BASE}${fileName}`,
        (collada) => {
          referenceModelCache.set(fileName, collada.scene);
          resolve(true);
        },
        undefined,
        () => resolve(false)
      );
    })
  ));
  const promise = Promise.all(requests).then((results) => results.some(Boolean));
  referenceModelPreloadPromises.set(personStyle, promise);
  return promise;
}

function referenceModelFileNames(personStyle = 'simplified') {
  const names = [];
  const style = PERSON_STYLES.find((item) => item.id === personStyle) || PERSON_STYLES[0];
  for (const genderName of Object.values(REFERENCE_MODEL_GENDERS)) {
    names.push(`InteractiveTreePerson${genderName}${style.suffix}.dae`);
    names.push(`InteractiveTreePerson${genderName}FamilySearch.dae`);
  }
  return [...new Set(names)];
}

export function makeReferencePersonModel(node, palette, featured, personStyle = 'simplified', viewerOptions = {}) {
  const person = node?.person || node;
  const genderName = REFERENCE_MODEL_GENDERS[person?.gender] || REFERENCE_MODEL_GENDERS.unknown;
  const style = PERSON_STYLES.find((item) => item.id === personStyle) || PERSON_STYLES[0];
  const suffix = node?.status?.familySearch ? 'FamilySearch' : style.suffix;
  const fileName = `InteractiveTreePerson${genderName}${suffix}.dae`;
  const template = referenceModelCache.get(fileName);
  if (!template) return null;

  const wrapper = new THREE.Group();
  const clone = template.clone(true);
  // Honour the active person-colouring mode (byGender/byGeneration/byPedigree)
  // on the real .dae models too — previously they always reverted to gender.
  const colors = colorsForNode(node, palette, viewerOptions?.personColoringMode || 'byGender', viewerOptions);
  clone.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.geometry = smoothReferenceGeometry(child.geometry);
    if (child.material) {
      child.material = cloneAndRetintMaterial(child.material, colors, { preserveReferenceMaterial: suffix === 'FamilySearch' });
    }
  });
  wrapper.add(clone);
  clone.rotation.x = REFERENCE_MODEL_GROUND_ROTATION_X;
  clone.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(clone);
  const size = new THREE.Vector3();
  box.getSize(size);
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const targetSize = featured
    ? MAC_FAMILY_GRAPH_LAYOUT.featuredModelSize
    : MAC_FAMILY_GRAPH_LAYOUT.regularModelSize;
  const scale = targetSize / largest;
  clone.scale.setScalar(scale);
  clone.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(clone);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  clone.position.x -= scaledCenter.x;
  clone.position.y -= scaledCenter.y;
  clone.position.z -= scaledBox.min.z;
  wrapper.position.y = featured ? -8 : -10;
  wrapper.position.z = featured ? 2 : 0;
  return wrapper;
}

function smoothReferenceGeometry(geometry) {
  if (!geometry) return geometry;
  const source = mergeVertices(geometry.clone(), 0.001);
  source.deleteAttribute?.('normal');
  source.computeVertexNormals?.();
  return source;
}

function softenColor(hex, amount) {
  const color = new THREE.Color(hex);
  color.lerp(new THREE.Color('#ffffff'), Math.max(0, Math.min(1, amount)));
  return color;
}

function cloneAndRetintMaterial(material, colors, options = {}) {
  if (Array.isArray(material)) return material.map((item) => cloneAndRetintMaterial(item, colors, options));
  const clone = material.clone();
  const name = String(clone.name || '').toLowerCase();
  clone.flatShading = false;
  clone.side = THREE.DoubleSide;
  if (options.preserveReferenceMaterial) {
    clone.roughness = 0.62;
    clone.metalness = 0;
    clone.needsUpdate = true;
    return clone;
  }
  // The native flat viewer renders soft, matte pastel figures. Keep the
  // retint flat: no emissive glow (which reads as a glossy marble) and a high
  // roughness so the key light produces a gentle sheen, not a hotspot.
  if (name.includes('skin')) {
    clone.color = new THREE.Color(softenColor(SKIN, 0.12));
    clone.emissive = new THREE.Color('#000000');
    clone.emissiveIntensity = 0;
    clone.roughness = 0.82;
    clone.metalness = 0;
  } else {
    clone.color = new THREE.Color(softenColor(colors.base, 0.24));
    clone.emissive = new THREE.Color('#000000');
    clone.emissiveIntensity = 0;
    clone.roughness = 0.72;
    clone.metalness = 0;
  }
  clone.needsUpdate = true;
  return clone;
}
