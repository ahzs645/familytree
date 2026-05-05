import { Gender } from '../../models/index.js';

const TWO_PI = Math.PI * 2;

export function buildSunTreeLayout(descendantTree, options = {}) {
  if (!descendantTree?.person) {
    return { rootId: null, nodes: [], links: [], rings: [], bounds: defaultBounds() };
  }

  const nodeRadius = options.nodeRadius ?? 7;
  const generationGap = options.generationGap ?? 185;
  const partnerGap = options.partnerGap ?? 24;
  const rootId = descendantTree.person.recordName;
  const people = new Map();
  const childrenByParent = new Map();
  const partnerByParent = new Map();
  const partnerIds = new Set();
  const generationById = new Map([[rootId, 0]]);

  function ensurePerson(person, generation) {
    if (!person?.recordName) return null;
    const id = person.recordName;
    if (!people.has(id)) people.set(id, person);
    const current = generationById.get(id);
    if (current == null || generation < current) generationById.set(id, generation);
    return id;
  }

  function addUnique(map, key, value) {
    if (!key || !value) return;
    if (!map.has(key)) map.set(key, []);
    const list = map.get(key);
    if (!list.includes(value)) list.push(value);
  }

  function visit(treeNode, generation) {
    const parentId = ensurePerson(treeNode.person, generation);
    if (!parentId) return;
    for (const union of treeNode.unions || []) {
      const partnerId = ensurePerson(union.partner, generation);
      if (partnerId) {
        partnerIds.add(partnerId);
        addUnique(partnerByParent, parentId, partnerId);
      }
      for (const child of union.children || []) {
        const childId = ensurePerson(child.person, generation + 1);
        if (!childId) continue;
        addUnique(childrenByParent, parentId, childId);
        if (partnerId) addUnique(childrenByParent, partnerId, childId);
        visit(child, generation + 1);
      }
    }
  }

  visit(descendantTree, 0);

  const leafWeights = new Map();
  function weight(id, seen = new Set()) {
    if (seen.has(id)) return 1;
    seen.add(id);
    const children = childrenByParent.get(id) || [];
    if (!children.length) {
      leafWeights.set(id, 1);
      return 1;
    }
    const total = children.reduce((sum, childId) => sum + weight(childId, seen), 0);
    leafWeights.set(id, Math.max(total, 1));
    return Math.max(total, 1);
  }
  weight(rootId);

  const angles = new Map();
  function assignAngles(id, start, end) {
    const children = childrenByParent.get(id) || [];
    if (!children.length) {
      angles.set(id, (start + end) / 2);
      return;
    }
    let cursor = start;
    const total = children.reduce((sum, childId) => sum + (leafWeights.get(childId) || 1), 0) || children.length;
    for (const childId of children) {
      const slice = (end - start) * ((leafWeights.get(childId) || 1) / total);
      assignAngles(childId, cursor, cursor + slice);
      cursor += slice;
    }
    const childAngles = children.map((childId) => angles.get(childId)).filter(Number.isFinite);
    angles.set(id, circularMean(childAngles));
  }
  assignAngles(rootId, -Math.PI / 2, TWO_PI - Math.PI / 2);
  angles.set(rootId, 0);

  for (const [parentId, partnerIds] of partnerByParent.entries()) {
    const base = angles.get(parentId) ?? 0;
    partnerIds.forEach((partnerId, index) => {
      const direction = index % 2 === 0 ? 1 : -1;
      const distance = Math.ceil((index + 1) / 2);
      angles.set(partnerId, base + direction * angleForArc(partnerGap * distance, radiusForGeneration(generationById.get(parentId) || 0, generationGap)));
    });
  }

  const nodes = [...people.entries()].map(([id, person]) => {
    const generation = generationById.get(id) || 0;
    const isPartner = partnerIds.has(id) && id !== rootId;
    const isPartnerOnly = isPartner && generation === 0;
    const radius = generation === 0 && isPartnerOnly ? partnerGap : radiusForGeneration(generation, generationGap);
    const angle = angles.get(id) ?? 0;
    return {
      id,
      person,
      generation,
      angle,
      x: generation === 0 && !isPartnerOnly ? 0 : Math.cos(angle) * radius,
      y: generation === 0 && !isPartnerOnly ? 0 : Math.sin(angle) * radius,
      radius: nodeRadius,
      kind: id === rootId ? 'root' : isPartner ? 'partner' : 'descendant',
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const links = [];
  for (const [parentId, childIds] of childrenByParent.entries()) {
    const parent = nodeById.get(parentId);
    if (!parent) continue;
    for (const childId of childIds) {
      const child = nodeById.get(childId);
      if (!child) continue;
      links.push({ type: 'child', from: parentId, to: childId, x1: parent.x, y1: parent.y, x2: child.x, y2: child.y });
    }
  }
  for (const [parentId, partnerIds] of partnerByParent.entries()) {
    const parent = nodeById.get(parentId);
    if (!parent) continue;
    for (const partnerId of partnerIds) {
      const partner = nodeById.get(partnerId);
      if (!partner) continue;
      links.push({ type: 'partner', from: parentId, to: partnerId, x1: parent.x, y1: parent.y, x2: partner.x, y2: partner.y });
    }
  }

  const maxGeneration = Math.max(0, ...nodes.map((node) => node.generation));
  const rings = Array.from({ length: maxGeneration + 1 }, (_, generation) => ({
    generation,
    radius: radiusForGeneration(generation, generationGap),
  })).filter((ring) => ring.generation > 0);

  return {
    rootId,
    nodes,
    links,
    rings,
    bounds: computeBounds(nodes, nodeRadius),
  };
}

function circularMean(angles) {
  if (!angles.length) return 0;
  const x = angles.reduce((sum, angle) => sum + Math.cos(angle), 0);
  const y = angles.reduce((sum, angle) => sum + Math.sin(angle), 0);
  return Math.atan2(y, x);
}

function angleForArc(length, radius) {
  return radius <= 0 ? 0 : length / radius;
}

function radiusForGeneration(generation, generationGap) {
  return generation * generationGap;
}

function computeBounds(nodes, padding) {
  if (!nodes.length) return defaultBounds();
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const labelPadding = Math.max(120, padding * 12);
  const minX = Math.min(...xs) - labelPadding;
  const maxX = Math.max(...xs) + labelPadding;
  const minY = Math.min(...ys) - labelPadding;
  const maxY = Math.max(...ys) + labelPadding;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function defaultBounds() {
  return { minX: -240, minY: -180, width: 480, height: 360 };
}

export function sunNodeClass(person, kind) {
  if (kind === 'root') return 'root';
  if (person?.gender === Gender.Male) return 'male';
  if (person?.gender === Gender.Female) return 'female';
  return 'unknown';
}
