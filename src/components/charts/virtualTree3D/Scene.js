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
import { installLighting, makeGroundShadowReceiver } from './lighting.js';
import { applyRelationshipPathHighlight } from './relationshipPath.js';
import { createComposer, applyDofSettings, disposeComposer, DOF_DEFAULTS } from './postProcessing.js';

const DEPTH_SPACING = 140;
const SIBLING_SPACING = 110;

function layoutNodes(nodes = []) {
  const byDepth = new Map();
  for (const node of nodes) {
    const depth = Number.isFinite(node.depth) ? node.depth : 0;
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth).push(node);
  }
  const positioned = new Map();
  for (const [depth, peers] of byDepth) {
    const offsetX = -(peers.length - 1) * SIBLING_SPACING / 2;
    peers.forEach((node, index) => {
      const zNudge = (index % 2 === 0) ? -8 : 8;
      positioned.set(node.id, {
        id: node.id,
        name: node.name,
        gender: node.gender,
        role: node.role,
        depth,
        x: offsetX + index * SIBLING_SPACING,
        y: -depth * DEPTH_SPACING,
        z: zNudge,
      });
    });
  }
  return positioned;
}

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

  setData({ nodes = [], connections = [] }, { symbolMode = 'sphere', colorMode = 'gender', photosById = new Map() } = {}) {
    this._clearObjects();

    const positioned = layoutNodes(nodes);
    for (const node of positioned.values()) {
      const photoUrl = photosById.get(node.id) || null;
      const person = new PersonObject(node, { symbolMode, colorMode, photoUrl });
      this.personObjects.set(node.id, person);
      this.scene.add(person.group);
    }

    for (const conn of connections) {
      const from = positioned.get(conn.fromId);
      const to = positioned.get(conn.toId);
      if (!from || !to) continue;
      const connection = new ConnectionObject(conn, from, to);
      this.connectionObjects.push(connection);
      this.scene.add(connection.line);
    }

    this.familyObjects = buildFamilyObjects(connections, positioned);
    for (const fam of this.familyObjects) this.scene.add(fam.marker);
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
