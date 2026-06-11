import * as THREE from 'three';
import { lifeSpanLabel } from '../../../models/index.js';
import { yearLabel } from '../../../lib/vitalFormat.js';
import { ROOT_CARD, SKIN } from './constants.js';
import { MAC_FAMILY_GRAPH_LAYOUT } from './macTreeStyle.js';
import { makeReferencePersonModel } from './referenceModels.js';
import { colorsForGender, colorsForNode, isLivingPerson, lightenHex } from './personColors.js';
import { makeCanvasTexture, makePlaneFromTexture, roundedRect } from './threeUtils.js';

function buildLifeLabel(person, options = {}) {
  const showBirth = options.displayBirthDate !== false;
  const showDeath = options.displayDeathDate !== false;
  if (showBirth && showDeath) return lifeSpanLabel(person) || '';
  if (showBirth) {
    const year = yearLabel(person?.birthDate);
    return year ? `b. ${year}` : '';
  }
  if (showDeath) {
    const year = yearLabel(person?.deathDate);
    return year ? `d. ${year}` : '';
  }
  return '';
}

function kinshipLabelForNode(node) {
  const role = String(node?.role || '').toLowerCase();
  if (!role || role === 'root') return '';
  if (role.includes('partner')) return 'Partner';
  if (role.includes('ancestor')) {
    const gen = Math.abs(Number(node?.generation) || 0);
    if (gen === 1) return 'Parent';
    if (gen === 2) return 'Grandparent';
    return `${gen}× Great-grandparent`;
  }
  if (role.includes('descendant') || role.includes('child')) {
    const gen = Math.abs(Number(node?.generation) || 0);
    if (gen === 1) return 'Child';
    if (gen === 2) return 'Grandchild';
    return `${gen}× Great-grandchild`;
  }
  if (role.includes('matern')) return 'Maternal';
  if (role.includes('patern')) return 'Paternal';
  return role.replace(/^\w/, (ch) => ch.toUpperCase());
}

function buildIconRow(person, options = {}) {
  const icons = [];
  if (options.displayNotesIcon && hasNotes(person)) icons.push('📝');
  if (options.displayMediaIcon && hasMedia(person)) icons.push('🖼');
  return icons.join(' ');
}

function hasNotes(person) {
  if (!person) return false;
  if (typeof person.hasNotes === 'boolean') return person.hasNotes;
  if (typeof person.notes === 'string') return person.notes.trim().length > 0;
  if (Array.isArray(person.notes)) return person.notes.length > 0;
  return false;
}

function hasMedia(person) {
  if (!person) return false;
  if (typeof person.hasMedia === 'boolean') return person.hasMedia;
  if (person.thumbnail) return true;
  if (Array.isArray(person.media)) return person.media.length > 0;
  return false;
}

function personGroupLabel(person, options = {}) {
  if (!options.displayPersonGroups) return '';
  const group = person?.personGroup || person?.personGroupName || '';
  return typeof group === 'string' ? group : (group?.name || '');
}

function shouldDrawAvatar(viewerOptions) {
  return (viewerOptions?.personImageStyle || 'round') !== 'none';
}

function personWidthScale(viewerOptions) {
  return Number.isFinite(viewerOptions?.personWidth) ? viewerOptions.personWidth : 1;
}

function fontScaleFor(viewerOptions) {
  return Number.isFinite(viewerOptions?.fontSize) ? viewerOptions.fontSize : 1;
}

// Box Alignment (BuilderGenerationsAlignmentHint): our boxes are uniform height,
// so the visible difference is a modest vertical seat of the figure within its
// band — leading edge sits higher, baseline a touch lower than centered.
function boxAlignmentOffset(viewerOptions) {
  switch (viewerOptions?.boxAlignment) {
    case 'leading':
    case 'leadingUniform':
      return 22;
    case 'baseline':
      return -8;
    default:
      return 0;
  }
}

// Soft-shadow offset derived from the configurable shadow angle + distance.
// Defaults (distance 18, angle 315°) reproduce the prior hand-tuned down-right
// offset; `scale` lets the featured node throw a slightly longer shadow.
function shadowOffsetFor(viewerOptions, scale = 1) {
  const distance = Number.isFinite(viewerOptions?.shadowDistance) ? viewerOptions.shadowDistance : 18;
  const angleDeg = Number.isFinite(viewerOptions?.shadowAngle) ? viewerOptions.shadowAngle : 315;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * distance * scale, y: Math.sin(rad) * distance * scale };
}

// Gold ring for the "Ordinances: By Color" display mode.
function makeOrdinanceRing(featured) {
  const radius = featured ? ROOT_CARD.w * 0.44 : 70;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, featured ? 4 : 3, 10, 96),
    new THREE.MeshBasicMaterial({ color: '#d6ad44', transparent: true, opacity: 0.85, depthWrite: false })
  );
  ring.position.set(0, featured ? 0 : 2, featured ? 34 : 24);
  ring.renderOrder = 15;
  return ring;
}

function makeLivingHalo(palette, featured) {
  const radius = featured ? ROOT_CARD.w * 0.5 : 76;
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius, featured ? 3.4 : 2.6, 10, 96),
    new THREE.MeshBasicMaterial({
      color: '#39d97a',
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  halo.position.set(0, featured ? 0 : 2, featured ? 36 : 26);
  halo.renderOrder = 17;
  return halo;
}

export function makePersonNode(node, palette, personStyle, hovered = false, viewerOptions = {}, selected = false) {
  const group = new THREE.Group();
  const liftZ = hovered && viewerOptions?.liftPersonsOnMouseOver !== false ? 38 : 0;
  group.position.set(node.x, node.y, node.z + liftZ);
  group.userData.person = node.person;
  group.userData.node = node;
  // Minification of distant generations (Scale Ancestors/Descendants control).
  const minScale = Number.isFinite(node.scale) ? node.scale : 1;

  const shadow = makeSoftShadow(
    palette,
    MAC_FAMILY_GRAPH_LAYOUT.regularShadowWidth,
    MAC_FAMILY_GRAPH_LAYOUT.regularShadowHeight,
    0.17
  );
  const shadowOffset = shadowOffsetFor(viewerOptions, 1);
  shadow.position.set(shadowOffset.x, shadowOffset.y, -20);
  shadow.renderOrder = 2;
  group.add(shadow);

  if (shouldDrawAvatar(viewerOptions)) {
    const model = makeMacPersonModel(node, palette, false, personStyle, viewerOptions);
    model.position.set(0, 12 + boxAlignmentOffset(viewerOptions), 6);
    model.scale.multiplyScalar(minScale);
    model.scale.x *= personWidthScale(viewerOptions);
    group.add(model);
  }

  if (viewerOptions?.displayFurtherPersonsIndicators !== false && hasMoreRelatives(node)) {
    group.add(makeFurtherRelativesMarker(node, palette, false));
  }
  if (hasStatusBadges(node, viewerOptions)) group.add(makeStatusBadges(node, false, viewerOptions));
  if (viewerOptions?.highlightLivingPersons && isLivingPerson(node?.person)) {
    group.add(makeLivingHalo(palette, false));
  }
  if (node?.ordinance && viewerOptions?.ordinancesMode === 'color') group.add(makeOrdinanceRing(false));
  if (selected && !hovered) group.add(makeSelectionMark(false, palette, 'selection'));
  if (hovered) group.add(makeSelectionMark(false, palette, 'hover'));

  // Invisible low-poly proxy so pointer raycasts never touch the high-poly
  // reference model (full-model raycasts made every pointer-move ~370ms).
  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(58 * minScale, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitProxy.position.set(0, -6 * minScale, 14);
  hitProxy.userData.hitProxy = true;
  group.add(hitProxy);

  if (viewerOptions?.displayLabels !== false) {
    const fontScale = fontScaleFor(viewerOptions);
    const labelScale = (hovered && viewerOptions?.enlargeNameBadgesOnMouseOver !== false ? 1.32 : 1) * fontScale * minScale;
    const label = makePlaneFromTexture(
      makePersonLabelTexture(node.person, palette, viewerOptions, node),
      MAC_FAMILY_GRAPH_LAYOUT.regularLabelWidth * labelScale,
      MAC_FAMILY_GRAPH_LAYOUT.regularLabelHeight * labelScale
    );
    label.position.set(0, -59 - (labelScale - 1) * 14, 16);
    label.renderOrder = hovered ? 24 : 14;
    group.add(label);
  }

  return group;
}

export function makeFeaturedNode(node, palette, personStyle, hovered = false, viewerOptions = {}) {
  const group = new THREE.Group();
  const liftZ = hovered && viewerOptions?.liftPersonsOnMouseOver !== false ? 28 : 0;
  group.position.set(node.x, node.y, node.z + liftZ);
  group.userData.person = node.person;
  group.userData.node = node;

  const shadow = makeSoftShadow(
    palette,
    ROOT_CARD.w * MAC_FAMILY_GRAPH_LAYOUT.featuredShadowScale,
    ROOT_CARD.h * 0.96,
    0.21
  );
  const shadowOffset = shadowOffsetFor(viewerOptions, 1.45);
  shadow.position.set(shadowOffset.x, shadowOffset.y, -20);
  shadow.renderOrder = 2;
  group.add(shadow);

  const card = makePlaneFromTexture(makeFeaturedTexture(node.person, palette, viewerOptions, node), ROOT_CARD.w, ROOT_CARD.h);
  card.position.set(0, 0, 0);
  card.renderOrder = 3;
  group.add(card);

  if (viewerOptions?.highlightLivingPersons && isLivingPerson(node?.person)) {
    group.add(makeLivingHalo(palette, true));
  }
  if (node?.ordinance && viewerOptions?.ordinancesMode === 'color') group.add(makeOrdinanceRing(true));
  if (hovered) group.add(makeSelectionMark(true, palette, 'hover'));

  if (shouldDrawAvatar(viewerOptions)) {
    // The bust stands at the medallion's top edge, like the native root.
    const model = makeMacPersonModel(node, palette, true, personStyle, viewerOptions);
    model.position.set(0, ROOT_CARD.h * 0.34 + boxAlignmentOffset(viewerOptions), 28);
    model.scale.x *= personWidthScale(viewerOptions);
    group.add(model);
  }
  // Name + ☆ birth date are drawn inside the medallion texture; no extra label.

  if (viewerOptions?.displayFurtherPersonsIndicators !== false && hasMoreRelatives(node)) {
    group.add(makeFurtherRelativesMarker(node, palette, true));
  }
  if (hasStatusBadges(node, viewerOptions)) group.add(makeStatusBadges(node, true, viewerOptions));

  // Cheap raycast proxy covering the medallion (see makePersonNode).
  const hitProxy = new THREE.Mesh(
    new THREE.SphereGeometry(ROOT_CARD.w * 0.42, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitProxy.position.set(0, 0, 16);
  hitProxy.userData.hitProxy = true;
  group.add(hitProxy);

  return group;
}

function makeMacPersonModel(node, palette, featured, personStyle, viewerOptions = {}) {
  const person = node?.person || node;
  const referenceModel = makeReferencePersonModel(node, palette, featured, personStyle, viewerOptions);
  if (referenceModel) return referenceModel;

  const group = new THREE.Group();
  const colors = colorsForNode(node, palette, viewerOptions?.personColoringMode || 'byGender', viewerOptions);
  const scale = featured ? 1.02 : 0.78;
  group.scale.setScalar(scale);

  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: colors.deep,
    roughness: 0.46,
    metalness: 0.02,
    transparent: true,
    opacity: 0.72,
  });
  const topMaterial = new THREE.MeshStandardMaterial({
    color: colors.base,
    roughness: 0.28,
    metalness: 0.03,
    emissive: colors.base,
    emissiveIntensity: 0.08,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: SKIN,
    roughness: 0.36,
    metalness: 0,
    emissive: '#ffe0b6',
    emissiveIntensity: 0.06,
  });

  const bodyShadow = makeSoftShadow(palette, 220, 76, 0.2);
  bodyShadow.position.set(14, 4, -18);
  bodyShadow.renderOrder = 3;
  group.add(bodyShadow);

  const bottomBody = new THREE.Mesh(new THREE.SphereGeometry(54, 48, 18), bottomMaterial);
  bottomBody.scale.set(1.42, 0.42, 0.36);
  bottomBody.position.set(0, 8, -2);
  bottomBody.castShadow = true;
  bottomBody.receiveShadow = true;
  group.add(bottomBody);

  const bodyNode = new THREE.Mesh(new THREE.SphereGeometry(53, 48, 18), topMaterial);
  bodyNode.scale.set(1.28, 0.34, 0.32);
  bodyNode.position.set(-8, 18, 10);
  bodyNode.castShadow = true;
  bodyNode.receiveShadow = true;
  group.add(bodyNode);

  const sideNode = new THREE.Mesh(new THREE.SphereGeometry(27, 32, 14), topMaterial);
  sideNode.scale.set(1.05, 0.74, 0.42);
  sideNode.position.set(-56, 18, 11);
  sideNode.castShadow = true;
  group.add(sideNode);

  const frontNode = new THREE.Mesh(new THREE.SphereGeometry(31, 32, 14), topMaterial);
  frontNode.scale.set(1.05, 0.68, 0.38);
  frontNode.position.set(44, 18, 13);
  frontNode.castShadow = true;
  group.add(frontNode);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(10, 15, 22, 24), skinMaterial);
  neck.position.set(0, 45, 20);
  neck.castShadow = true;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(featured ? 29 : 25, 36, 22), skinMaterial);
  head.scale.set(0.95, 1.02, 0.9);
  head.position.set(0, 67, 28);
  head.castShadow = true;
  group.add(head);

  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(featured ? 8 : 7, 18, 10),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false })
  );
  highlight.scale.set(1.25, 0.72, 0.3);
  highlight.position.set(-10, 78, 49);
  highlight.renderOrder = 10;
  group.add(highlight);

  return group;
}

function hasMoreRelatives(node) {
  const more = node?.more;
  if (!more) return false;
  return (more.parents || 0) > 0 || (more.families || 0) > 0 || (more.relatives || 0) > 0;
}

// One small teardrop "pin" pointing `dir` (+1 up toward hidden ancestors, -1
// down toward hidden descendants/secondary families) — a rounded head tapering
// to a point in the pointed direction, tinted by the person's resolved colour.
// Mirrors the native viewer's FurtherPersonsMark: the taper aims at where the
// hidden relatives live (down = this person's own families/children).
function makeFurtherPersonsPin(node, palette, featured, dir, baseY) {
  const group = new THREE.Group();
  const color = colorsForGender(node?.person?.gender, palette).deep;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.46, metalness: 0.05 });
  const headR = featured ? 4.8 : 3.8;
  const tipLen = featured ? 12 : 9.5;
  // Rounded head sitting at the band edge…
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 18, 14), material);
  head.position.set(0, 0, 0);
  group.add(head);
  // …tapering to a point in the pointed direction (cone tip = the "arrow").
  const tip = new THREE.Mesh(new THREE.ConeGeometry(headR, tipLen, 16), material);
  // Cone apex points +Y by default; rotate π to point it down when dir < 0.
  tip.rotation.x = dir < 0 ? Math.PI : 0;
  tip.position.set(0, dir * (tipLen / 2 + headR * 0.35), 0);
  group.add(tip);
  const highlight = new THREE.Mesh(
    new THREE.SphereGeometry(featured ? 1.5 : 1.2, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })
  );
  highlight.position.set(-headR * 0.32, headR * 0.32, headR * 0.7);
  group.add(highlight);
  group.position.set(0, baseY, 12);
  group.renderOrder = 19;
  return group;
}

// Directional "further relatives available" indicator — a pin above the person
// when ancestors are hidden, and below when descendants are hidden — mirroring
// the native viewer's FurtherPersonsMark (up=parents, down=children).
function makeFurtherRelativesMarker(node, palette, featured) {
  const group = new THREE.Group();
  const more = node?.more || {};
  const topY = featured ? ROOT_CARD.h * 0.5 + 8 : 64;
  const bottomY = featured ? -ROOT_CARD.h * 0.5 - 84 : -102;
  let drew = false;
  if ((more.parents || 0) > 0) { group.add(makeFurtherPersonsPin(node, palette, featured, 1, topY)); drew = true; }
  if ((more.families || 0) > 0) { group.add(makeFurtherPersonsPin(node, palette, featured, -1, bottomY)); drew = true; }
  // Fallback for a generic "more relatives" count with no direction.
  if (!drew && (more.relatives || 0) > 0) group.add(makeFurtherPersonsPin(node, palette, featured, -1, bottomY));
  // Tag the marker so a click on any pin toggles expand-in-place for this person,
  // and add a generous transparent hit-pad so the small pin is easy to click.
  group.userData.expandFor = node?.id || node?.person?.recordName || null;
  const pad = new THREE.Mesh(
    new THREE.SphereGeometry(featured ? 22 : 18, 8, 6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  pad.position.set(0, (more.parents || 0) > 0 && (more.families || 0) === 0 ? topY : bottomY, 12);
  pad.userData.expandFor = group.userData.expandFor;
  group.add(pad);
  return group;
}

function hasStatusBadges(node, viewerOptions = {}) {
  const fs = node?.status?.familySearch && viewerOptions.displayFamilySearchIcons !== false;
  const influential = node?.status?.influential && viewerOptions.displayInfluentialIcon;
  const ordinance = node?.ordinance && viewerOptions.ordinancesMode === 'icon';
  const duplicate = ['High', 'Medium'].includes(node?.status?.duplicateRisk);
  return Boolean(fs || influential || ordinance || duplicate);
}

function makeStatusBadges(node, featured, viewerOptions = {}) {
  const badges = [];
  if (node.status?.familySearch && viewerOptions.displayFamilySearchIcons !== false) {
    badges.push({ label: 'FS', fill: '#2563eb', stroke: '#174ea6' });
  }
  if (node.status?.influential && viewerOptions.displayInfluentialIcon) {
    badges.push({ label: 'I', fill: '#7c3aed', stroke: '#5b239e' });
  }
  if (node.ordinance && viewerOptions.ordinancesMode === 'icon') {
    badges.push({ label: 'T', fill: '#c79a3a', stroke: '#8a6a1f' });
  }
  if (node.status?.duplicateRisk === 'High') badges.push({ label: 'D', fill: '#b42318', stroke: '#7a1710' });
  if (node.status?.duplicateRisk === 'Medium') badges.push({ label: 'D', fill: '#b7791f', stroke: '#7c4d12' });
  const group = new THREE.Group();
  const size = featured ? 36 : 28;
  const gap = featured ? 8 : 6;
  badges.forEach((badge, index) => {
    const texture = makeCanvasTexture(96, 96, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 36, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 7;
      ctx.strokeStyle = badge.stroke;
      ctx.stroke();
      ctx.fillStyle = badge.fill;
      ctx.font = badge.label.length > 1
        ? '900 26px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
        : '900 34px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge.label, w / 2, h / 2 + 1);
    });
    const plane = makePlaneFromTexture(texture, size, size);
    plane.position.set(index * (size + gap), 0, 0);
    plane.material.depthTest = false;
    plane.renderOrder = 21;
    group.add(plane);
  });
  group.position.set(
    featured ? -ROOT_CARD.w * 0.38 : -58,
    featured ? -ROOT_CARD.h * 0.35 : -20,
    featured ? 48 : 38
  );
  return group;
}


function makeSoftShadow(palette, width, height, opacity) {
  const texture = makeCanvasTexture(360, 180, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const color = colorToRgb(palette.shadow);
    const gradient = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.06, w * 0.5, h * 0.5, w * 0.48);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`);
    gradient.addColorStop(0.38, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.52})`);
    gradient.addColorStop(0.78, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.12})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
  const shadow = makePlaneFromTexture(texture, width, height);
  shadow.material.depthWrite = false;
  return shadow;
}

function colorToRgb(color) {
  const parsed = new THREE.Color(color);
  return {
    r: Math.round(parsed.r * 255),
    g: Math.round(parsed.g * 255),
    b: Math.round(parsed.b * 255),
  };
}

function makeSelectionMark(featured, palette, mode = 'selection') {
  const radius = featured ? ROOT_CARD.w * 0.46 : 68;
  const material = new THREE.MeshBasicMaterial({
    color: mode === 'hover' ? palette.descendantLine : palette.male,
    transparent: true,
    opacity: mode === 'hover' ? 0.72 : 0.9,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, featured ? 5 : 3.6, 8, 88), material);
  ring.position.set(0, featured ? 0 : 2, featured ? 38 : 28);
  ring.renderOrder = 16;
  return ring;
}

function cloneAndRetintMaterial(material, colors, options = {}) {
  if (Array.isArray(material)) return material.map((item) => cloneAndRetintMaterial(item, colors, options));
  const clone = material.clone();
  const name = String(clone.name || '').toLowerCase();
  clone.flatShading = false;
  clone.side = THREE.DoubleSide;
  if (options.preserveReferenceMaterial) {
    clone.roughness = 0.38;
    clone.metalness = 0.02;
    clone.needsUpdate = true;
    return clone;
  }
  if (name.includes('skin')) {
    clone.color = new THREE.Color(SKIN);
    clone.emissive = new THREE.Color('#ffe0b6');
    clone.emissiveIntensity = 0.08;
    clone.roughness = 0.42;
    clone.metalness = 0;
  } else {
    clone.color = new THREE.Color(colors.base);
    clone.emissive = new THREE.Color(colors.base);
    clone.emissiveIntensity = 0.06;
    clone.roughness = 0.36;
    clone.metalness = 0.02;
  }
  clone.needsUpdate = true;
  return clone;
}

function makePersonLabelTexture(person, palette, viewerOptions = {}, node = null) {
  return makeCanvasTexture(420, 230, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = person?.fullName || 'Unknown';
    const rtl = isRtlText(name);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.fillStyle = '#17191d';
    ctx.font = `${rtl ? 850 : 780} ${rtl ? 28 : 25}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    let cursorY = 48;
    for (const line of wrapMeasuredText(ctx, name, 366, 2)) {
      ctx.fillText(line, w / 2, cursorY);
      cursorY += 29;
    }
    cursorY = Math.max(cursorY, 96);
    const life = buildLifeLabel(person, viewerOptions);
    if (life) {
      ctx.direction = 'ltr';
      ctx.fillStyle = '#747b86';
      ctx.font = '700 19px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(life, w / 2, cursorY + 8);
      cursorY += 24;
    }
    const kinship = viewerOptions.displayKinships ? kinshipLabelForNode(node) : '';
    if (kinship) {
      ctx.direction = 'ltr';
      ctx.fillStyle = '#5c6580';
      ctx.font = '650 17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(kinship, w / 2, cursorY + 4);
      cursorY += 22;
    }
    const numbering = viewerOptions.displayNumberingSystem && node?.refNumber ? String(node.refNumber) : '';
    if (numbering) {
      ctx.direction = 'ltr';
      ctx.fillStyle = '#3f7cc0';
      ctx.font = '750 17px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(`# ${numbering}`, w / 2, cursorY + 4);
      cursorY += 22;
    }
    const eventDescription = viewerOptions.displayEventDescription && node?.eventDescription ? String(node.eventDescription) : '';
    if (eventDescription) {
      ctx.direction = isRtlText(eventDescription) ? 'rtl' : 'ltr';
      ctx.fillStyle = '#6a6f78';
      ctx.font = '600 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(fitText(ctx, eventDescription, 360), w / 2, cursorY + 4);
      cursorY += 22;
    }
    const group = personGroupLabel(person, viewerOptions);
    if (group) {
      ctx.direction = 'ltr';
      ctx.fillStyle = '#8a5cab';
      ctx.font = '700 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(`• ${group} •`, w / 2, cursorY + 4);
      cursorY += 22;
    }
    const icons = buildIconRow(person, viewerOptions);
    if (icons) {
      ctx.direction = 'ltr';
      ctx.font = '700 22px -apple-system-emoji, "Apple Color Emoji", sans-serif';
      ctx.fillText(icons, w / 2, cursorY + 6);
    }
  }, { scale: 3 });
}

function makeFeaturedTexture(person, palette, viewerOptions = {}, node = null) {
  // Native root medallion (sampled from the MFT11 reference): a WHITE disc
  // ringed by small pearl dots, with the person's name and ☆ birth date drawn
  // INSIDE the disc (the bust stands at the disc's top edge — see
  // makeFeaturedNode). No blue fill, no avatar glyph.
  return makeCanvasTexture(560, 560, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const radius = w * 0.38;

    ctx.clearRect(0, 0, w, h);
    ctx.shadowColor = 'rgba(60, 64, 88, 0.20)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetY = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(252, 252, 255, 0.97)';
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Pearl dot rim.
    const dots = 36;
    const rimRadius = radius - 16;
    ctx.fillStyle = 'rgba(148, 158, 176, 0.85)';
    for (let i = 0; i < dots; i += 1) {
      const angle = (i / dots) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * rimRadius, cy + Math.sin(angle) * rimRadius, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Name + ☆ birth date inside the disc, under the bust.
    const name = String(person?.fullName || 'Unknown');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = isRtlText(name) ? 'rtl' : 'ltr';
    ctx.fillStyle = '#23262b';
    ctx.font = '600 40px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
    const lines = wrapMeasuredText(ctx, name, radius * 1.5, 2);
    const lineHeight = 48;
    let textY = cy + 26 - ((lines.length - 1) * lineHeight) / 2;
    for (const line of lines) {
      ctx.fillText(line, cx, textY);
      textY += lineHeight;
    }
    const birth = person?.birthDate ? String(person.birthDate) : yearLabel(person?.birthDate);
    if (birth) {
      ctx.direction = 'ltr';
      ctx.fillStyle = 'rgba(96, 102, 112, 0.92)';
      ctx.font = '500 33px -apple-system, "SF Pro Text", "Segoe UI", sans-serif';
      ctx.fillText(`☆ ${birth}`, cx, textY + 8);
    }
  }, { scale: 3 });
}

function isRtlText(value) {
  return /[\u0590-\u08ff]/.test(String(value || ''));
}

function wrapMeasuredText(ctx, text, maxWidth, maxLines) {
  const value = String(text || 'Unknown').trim();
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['Unknown'];
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  const limited = lines.slice(0, maxLines);
  if (words.join(' ') !== limited.join(' ')) {
    limited[limited.length - 1] = fitText(ctx, `${limited[limited.length - 1]}...`, maxWidth);
  } else {
    limited[limited.length - 1] = fitText(ctx, limited[limited.length - 1], maxWidth);
  }
  return limited;
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let fitted = String(text || '');
  while (fitted.length > 1 && ctx.measureText(`${fitted}...`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted.replace(/\.*$/, '')}...`;
}
