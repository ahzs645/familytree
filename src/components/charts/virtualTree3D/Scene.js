/**
 * Scene — owns the Three.js scene, camera, renderer, and orbit controls
 * for the virtual-tree 3D view. The React wrapper (`VirtualTree3D.jsx`)
 * mounts/unmounts one Scene per container.
 *
 * This is the coordinator that knows about PersonObject / FamilyObject /
 * ConnectionObject but nothing about React or MacFamilyTree. Swapping to
 * a different renderer would be a Scene rewrite, not a component rewrite.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PersonObject } from './PersonObject.js';
import { ConnectionObject } from './ConnectionObject.js';
import { buildFamilyObjects } from './FamilyObject.js';
import { GenerationBandObject } from './GenerationBandObject.js';
import { installLighting, makeGroundShadowReceiver } from './lighting.js';
import { applyRelationshipPathHighlight } from './relationshipPath.js';
import { createComposer, applyDofSettings, disposeComposer, DOF_DEFAULTS } from './postProcessing.js';
import { layoutVirtualTree3D } from './layout.js';

export class VirtualTree3DScene {
  constructor(container, { onPick } = {}) {
    this.container = container;
    this.onPick = onPick;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f1a);
    this.scene.fog = new THREE.Fog(0x0b0f1a, 1500, 4200);

    const { clientWidth, clientHeight } = container;
    this.camera = new THREE.PerspectiveCamera(55, Math.max(1, clientWidth / Math.max(1, clientHeight)), 1, 6000);
    this.camera.position.set(0, 240, 720);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(clientWidth, clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    installLighting(this.scene, this.renderer);
    this.ground = makeGroundShadowReceiver(-80);
    this.scene.add(this.ground);

    this.personObjects = new Map();
    this.connectionObjects = [];
    this.familyObjects = [];
    this.bandObjects = [];
    this.layout = layoutVirtualTree3D();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._onClick = this._onClick.bind(this);
    this.renderer.domElement.addEventListener('click', this._onClick);

    this._onResize = this._onResize.bind(this);
    this.resizeObserver = new ResizeObserver(this._onResize);
    this.resizeObserver.observe(container);

    this.dof = { ...DOF_DEFAULTS };
    this.composerBundle = null;

    this._animate = this._animate.bind(this);
    this._frameId = requestAnimationFrame(this._animate);
  }

  setDepthOfField(dof = {}) {
    this.dof = { ...this.dof, ...dof };
    if (this.dof.enabled && !this.composerBundle) {
      const { clientWidth, clientHeight } = this.container;
      this.composerBundle = createComposer({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        width: clientWidth || 1,
        height: clientHeight || 1,
        dof: this.dof,
      });
    } else if (this.composerBundle) {
      applyDofSettings(this.composerBundle.bokehPass, this.dof);
    }
    if (!this.dof.enabled && this.composerBundle) {
      disposeComposer(this.composerBundle);
      this.composerBundle = null;
    }
  }

  setData(
    { nodes = [], connections = [] },
    { symbolMode = 'sphere', colorMode = 'gender', photosById = new Map(), layoutOptions = {}, showGenerationBands = true } = {}
  ) {
    this._clearObjects();

    this.layout = layoutVirtualTree3D(nodes, connections, layoutOptions);
    const positioned = this.layout.byId;

    if (showGenerationBands) {
      this.bandObjects = this.layout.bands.map((band, index) => new GenerationBandObject(band, {
        index,
        orientation: this.layout.orientation,
      }));
      for (const band of this.bandObjects) this.scene.add(band.group);
    }

    for (const node of positioned.values()) {
      const photoUrl = photosById.get(node.id) || null;
      const person = new PersonObject(node, { symbolMode, colorMode, photoUrl });
      this.personObjects.set(node.id, person);
      this.scene.add(person.group);
    }

    for (const conn of this.layout.connections) {
      const from = positioned.get(conn.fromId);
      const to = positioned.get(conn.toId);
      if (!from || !to) continue;
      const connection = new ConnectionObject(conn, from, to);
      this.connectionObjects.push(connection);
      this.scene.add(connection.line);
    }

    this.familyObjects = buildFamilyObjects(this.layout.connections, positioned);
    for (const fam of this.familyObjects) this.scene.add(fam.marker);
    this.fitToContent();
  }

  setColorMode(colorMode) {
    for (const person of this.personObjects.values()) person.setColorMode(colorMode);
  }

  setRelationshipPath(pathRecordNames = []) {
    applyRelationshipPathHighlight({
      pathRecordNames,
      personObjects: this.personObjects,
      connectionObjects: this.connectionObjects,
    });
  }

  setCameraMode(mode = 'iso') {
    const { bounds } = this.layout || layoutVirtualTree3D();
    const center = new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2
    );
    const span = Math.max(bounds.width, bounds.height, bounds.depth, 300);
    const positions = {
      top: new THREE.Vector3(center.x, center.y, center.z + span * 2.1),
      front: new THREE.Vector3(center.x, center.y - span * 1.9, center.z + span * 0.72),
      left: new THREE.Vector3(center.x - span * 1.55, center.y - span * 1.25, center.z + span * 1.15),
      right: new THREE.Vector3(center.x + span * 1.55, center.y - span * 1.25, center.z + span * 1.15),
      iso: new THREE.Vector3(center.x + span * 1.2, center.y - span * 1.35, center.z + span * 1.05),
    };
    this.camera.position.copy(positions[mode] || positions.iso);
    this.controls.target.copy(center);
    this.camera.lookAt(center);
    this.controls.update();
  }

  fitToContent() {
    const { bounds } = this.layout || layoutVirtualTree3D();
    const center = new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      (bounds.minZ + bounds.maxZ) / 2
    );
    const span = Math.max(bounds.width, bounds.height, bounds.depth, 280);
    this.controls.target.copy(center);
    this.camera.near = 1;
    this.camera.far = Math.max(6000, span * 8);
    this.camera.position.set(center.x + span * 1.2, center.y - span * 1.35, center.z + span * 1.05);
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  _onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [];
    for (const person of this.personObjects.values()) targets.push(person.getClickTarget());
    const hits = this.raycaster.intersectObjects(targets);
    if (hits.length && this.onPick) this.onPick(hits[0].object.userData.id);
  }

  _onResize() {
    const { clientWidth, clientHeight } = this.container;
    if (!clientWidth || !clientHeight) return;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
    this.composerBundle?.composer?.setSize(clientWidth, clientHeight);
  }

  _animate() {
    this._frameId = requestAnimationFrame(this._animate);
    this.controls.update();
    if (this.composerBundle && this.dof.enabled) {
      this.composerBundle.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _clearObjects() {
    for (const person of this.personObjects.values()) {
      this.scene.remove(person.group);
      person.dispose();
    }
    this.personObjects.clear();

    for (const connection of this.connectionObjects) {
      this.scene.remove(connection.line);
      connection.dispose();
    }
    this.connectionObjects = [];

    for (const fam of this.familyObjects) {
      this.scene.remove(fam.marker);
      fam.dispose();
    }
    this.familyObjects = [];

    for (const band of this.bandObjects) {
      this.scene.remove(band.group);
      band.dispose();
    }
    this.bandObjects = [];
  }

  dispose() {
    cancelAnimationFrame(this._frameId);
    this._clearObjects();
    disposeComposer(this.composerBundle);
    this.composerBundle = null;
    this.renderer.domElement.removeEventListener('click', this._onClick);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
