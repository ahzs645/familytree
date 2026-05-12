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

function shouldDrawAvatar(viewerOptions) {
  return (viewerOptions?.personImageStyle || 'round') !== 'none';
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

export function makePersonNode(node, palette, personStyle, hovered = false, viewerOptions = {}) {
  const group = new THREE.Group();
  group.position.set(node.x, node.y, node.z);
  group.userData.person = node.person;
  group.userData.node = node;

  const shadow = makeSoftShadow(
    palette,
    MAC_FAMILY_GRAPH_LAYOUT.regularShadowWidth,
    MAC_FAMILY_GRAPH_LAYOUT.regularShadowHeight,
    0.17
  );
  shadow.position.set(13, -13, -20);
  shadow.renderOrder = 2;
  group.add(shadow);

  if (shouldDrawAvatar(viewerOptions)) {
    const model = makeMacPersonModel(node, palette, false, personStyle, viewerOptions);
    model.position.set(0, 12, 6);
    group.add(model);
  }

  if (hasMoreRelatives(node)) group.add(makeFurtherRelativesMarker(node, palette, false));
  if (hasStatusBadges(node)) group.add(makeStatusBadges(node, false));
  if (viewerOptions?.highlightLivingPersons && isLivingPerson(node?.person)) {
    group.add(makeLivingHalo(palette, false));
  }
  if (hovered) group.add(makeSelectionMark(false, palette, 'hover'));

  if (viewerOptions?.displayLabels !== false) {
    const label = makePlaneFromTexture(
      makePersonLabelTexture(node.person, palette, viewerOptions),
      MAC_FAMILY_GRAPH_LAYOUT.regularLabelWidth,
      MAC_FAMILY_GRAPH_LAYOUT.regularLabelHeight
    );
    label.position.set(0, -59, 16);
    group.add(label);
  }

  return group;
}

export function makeFeaturedNode(node, palette, personStyle, hovered = false, viewerOptions = {}) {
  const group = new THREE.Group();
  group.position.set(node.x, node.y, node.z);
  group.userData.person = node.person;
  group.userData.node = node;

  const shadow = makeSoftShadow(
    palette,
    ROOT_CARD.w * MAC_FAMILY_GRAPH_LAYOUT.featuredShadowScale,
    ROOT_CARD.h * 0.96,
    0.21
  );
  shadow.position.set(17, -24, -20);
  shadow.renderOrder = 2;
  group.add(shadow);

  const card = makePlaneFromTexture(makeFeaturedTexture(node.person, palette, viewerOptions), ROOT_CARD.w, ROOT_CARD.h);
  card.position.set(0, 0, 0);
  card.renderOrder = 3;
  group.add(card);

  group.add(makeRootMark(palette));
  if (viewerOptions?.highlightLivingPersons && isLivingPerson(node?.person)) {
    group.add(makeLivingHalo(palette, true));
  }
  if (hovered) group.add(makeSelectionMark(true, palette, 'hover'));

  if (shouldDrawAvatar(viewerOptions)) {
    const model = makeMacPersonModel(node, palette, true, personStyle, viewerOptions);
    model.position.set(0, 60, 28);
    group.add(model);
  }

  if (hasMoreRelatives(node)) group.add(makeFurtherRelativesMarker(node, palette, true));
  if (hasStatusBadges(node)) group.add(makeStatusBadges(node, true));

  return group;
}

function makeMacPersonModel(node, palette, featured, personStyle, viewerOptions = {}) {
  const person = node?.person || node;
  const referenceModel = makeReferencePersonModel(node, palette, featured, personStyle);
  if (referenceModel) return referenceModel;

  const group = new THREE.Group();
  const colors = colorsForNode(node, palette, viewerOptions?.personColoringMode || 'byGender');
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
  return (node?.more?.relatives || 0) > 0;
}

function makeFurtherRelativesMarker(node, palette, featured) {
  const count = Math.min(99, node.more?.relatives || 0);
  const texture = makeCanvasTexture(180, 92, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 7;
    roundedRect(ctx, 14, 12, w - 28, h - 24, 26);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    ctx.strokeStyle = palette.descendantLine;
    ctx.stroke();
    ctx.fillStyle = palette.descendantLine;
    ctx.font = '900 36px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${count}`, w / 2, h / 2 + 1);
  });
  const width = featured ? 82 : 66;
  const height = featured ? 43 : 34;
  const marker = makePlaneFromTexture(texture, width, height);
  marker.position.set(featured ? ROOT_CARD.w * 0.34 : 58, featured ? -ROOT_CARD.h * 0.35 : -20, featured ? 46 : 36);
  marker.renderOrder = 20;
  marker.material.depthTest = false;
  return marker;
}

function hasStatusBadges(node) {
  return Boolean(node?.status?.familySearch || ['High', 'Medium'].includes(node?.status?.duplicateRisk));
}

function makeStatusBadges(node, featured) {
  const badges = [];
  if (node.status?.familySearch) badges.push({ label: 'FS', fill: '#2563eb', stroke: '#174ea6' });
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

function makeRootMark(palette) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ROOT_CARD.w * 0.38, 4.5, 10, 96),
    new THREE.MeshBasicMaterial({ color: palette.male, transparent: true, opacity: 0.92, depthWrite: false })
  );
  ring.position.set(0, 0, 31);
  ring.renderOrder = 11;
  group.add(ring);

  const inner = new THREE.Mesh(
    new THREE.TorusGeometry(ROOT_CARD.w * 0.33, 2.4, 8, 96),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.65, depthWrite: false })
  );
  inner.position.set(0, 0, 32);
  inner.renderOrder = 12;
  group.add(inner);
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

function makePersonLabelTexture(person, palette, viewerOptions = {}) {
  return makeCanvasTexture(420, 170, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(255,255,255,0)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = person?.fullName || 'Unknown';
    const rtl = isRtlText(name);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.fillStyle = '#17191d';
    ctx.font = `${rtl ? 850 : 780} ${rtl ? 28 : 25}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    for (const [line, y] of wrapMeasuredText(ctx, name, 366, 2).map((line, index) => [line, 48 + index * 29])) {
      ctx.fillText(line, w / 2, y);
    }
    const life = buildLifeLabel(person, viewerOptions);
    if (life) {
      ctx.direction = 'ltr';
      ctx.fillStyle = '#747b86';
      ctx.font = '700 19px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(life, w / 2, 134);
    }
  });
}

function makeFeaturedTexture(person, palette, viewerOptions = {}) {
  return makeCanvasTexture(560, 560, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const radius = w * 0.38;

    ctx.clearRect(0, 0, w, h);
    ctx.shadowColor = 'rgba(41,74,106,0.18)';
    ctx.shadowBlur = 38;
    ctx.shadowOffsetY = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(226, 247, 255, 0.96)';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 8, 0, Math.PI * 2);
    ctx.lineCap = 'round';
    ctx.setLineDash([1, 22]);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(80, 145, 196, 0.58)';
    ctx.stroke();
    ctx.setLineDash([]);

    const glow = ctx.createRadialGradient(cx - 42, cy - 70, 8, cx, cy, radius);
    glow.addColorStop(0, 'rgba(255,255,255,0.62)');
    glow.addColorStop(0.7, 'rgba(111, 195, 255, 0.08)');
    glow.addColorStop(1, 'rgba(58, 142, 216, 0.16)');
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 18, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(78, 166, 214, 0.34)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const name = person?.fullName || 'Unknown';
    const rtl = isRtlText(name);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.fillStyle = '#17191d';
    ctx.font = `${rtl ? 850 : 800} ${rtl ? 34 : 31}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
    const nameLines = wrapMeasuredText(ctx, name, 370, 2);
    const firstNameY = nameLines.length === 1 ? 344 : 326;
    nameLines.forEach((line, index) => ctx.fillText(line, cx, firstNameY + index * 35));

    const life = buildLifeLabel(person, viewerOptions);
    if (life) {
      ctx.direction = 'ltr';
      ctx.fillStyle = '#747b86';
      ctx.font = '700 25px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.fillText(life, cx, 428);
    }
  });
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
