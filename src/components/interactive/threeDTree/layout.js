import { BAND_LABEL_GUTTER, GEN_STEP, NODE_SPACING, PARTNER_OFFSET, ROOT_CARD } from './constants.js';
import { MAC_FAMILY_GRAPH_LAYOUT, macBandSplitGap } from './macTreeStyle.js';

export function buildInteractiveLayout(ancestorTree, descendantTree, activeId, familyGraph = null, options = {}) {
  if (familyGraph?.nodes?.length) return buildFamilyGraphLayout(familyGraph, activeId);

  const maxAncestorGenerations = Number.isFinite(options.ancestorGenerations) ? Math.max(1, options.ancestorGenerations) : 4;
  const maxDescendantGenerations = Number.isFinite(options.descendantGenerations) ? Math.max(1, options.descendantGenerations) : 6;
  const childSortingMode = options.childSortingMode || 'byBirthAsc';

  const sortChildren = (children) => {
    if (!children?.length) return children || [];
    const list = [...children];
    if (childSortingMode === 'byName') {
      list.sort((a, b) => String(a?.person?.fullName || '').localeCompare(String(b?.person?.fullName || '')));
    } else if (childSortingMode === 'byBirthDesc') {
      list.sort((a, b) => parseBirthYear(b?.person) - parseBirthYear(a?.person));
    } else if (childSortingMode === 'byBirthAsc') {
      list.sort((a, b) => parseBirthYear(a?.person) - parseBirthYear(b?.person));
    }
    return list;
  };

  const nodes = new Map();
  const links = [];
  const root = ancestorTree?.person || descendantTree?.person || null;
  const rootId = activeId || root?.recordName || null;

  const addNode = (person, generation, x, role) => {
    if (!person?.recordName) return null;
    const existing = nodes.get(person.recordName);
    const featured = person.recordName === rootId;
    const candidate = {
      id: person.recordName,
      person,
      generation,
      x,
      y: -generation * GEN_STEP,
      z: featured ? 52 : 22 + Math.min(Math.abs(generation) * 3, 18),
      role,
      featured,
    };
    if (!existing) {
      nodes.set(person.recordName, candidate);
      return candidate;
    }
    if (featured || Math.abs(generation) < Math.abs(existing.generation)) {
      nodes.set(person.recordName, { ...existing, ...candidate, role: mergeRole(existing.role, role) });
    } else {
      existing.role = mergeRole(existing.role, role);
    }
    return nodes.get(person.recordName);
  };

  const addLink = (from, to, type) => {
    if (!from || !to || from === to) return;
    const key = `${from}:${to}:${type}`;
    if (links.some((link) => link.key === key)) return;
    links.push({ key, from, to, type });
  };

  if (ancestorTree) {
    const visitAncestor = (node, generation, slot, childId) => {
      if (!node?.person) return;
      const total = 2 ** generation;
      const spacing = NODE_SPACING + generation * 38;
      const x = generation === 0 ? 0 : (slot - (total - 1) / 2) * spacing;
      addNode(node.person, -generation, x, generation === 0 ? 'root' : 'ancestor');
      if (childId) addLink(node.person.recordName, childId, 'ancestor');
      if (generation >= maxAncestorGenerations) return;
      visitAncestor(node.father, generation + 1, slot * 2, node.person.recordName);
      visitAncestor(node.mother, generation + 1, slot * 2 + 1, node.person.recordName);
    };
    visitAncestor(ancestorTree, 0, 0, null);
  }

  if (descendantTree) {
    const measure = (node) => {
      if (!node) return 1;
      const childWidths = (node.unions || []).flatMap((union) => union.children || []).map(measure);
      if (childWidths.length === 0) return 1;
      return Math.max(1, childWidths.reduce((sum, width) => sum + width, 0));
    };

    const placeDescendant = (node, generation, centerX, parentId = null) => {
      if (!node?.person) return;
      if (generation > maxDescendantGenerations) return;
      addNode(node.person, generation, centerX, generation === 0 ? 'root' : 'descendant');
      if (parentId) addLink(parentId, node.person.recordName, 'descendant');

      const unions = node.unions || [];
      if (generation === 0) unions.forEach((union, index) => {
        if (union.partner?.recordName) {
          const side = index % 2 === 0 ? 1 : -1;
          const baseOffset = generation === 0 ? ROOT_CARD.w / 2 + 172 : PARTNER_OFFSET;
          const offset = side * (baseOffset + Math.floor(index / 2) * 105);
          addNode(union.partner, generation, centerX + offset, 'partner');
          addLink(node.person.recordName, union.partner.recordName, 'partner');
        }
      });

      const children = sortChildren(unions.flatMap((union) => union.children || []));
      if (children.length === 0) return;
      const totalWidth = children.reduce((sum, child) => sum + measure(child), 0);
      let cursor = centerX - ((totalWidth - 1) * NODE_SPACING) / 2;
      for (const child of children) {
        const childWidth = measure(child);
        const childCenter = cursor + ((childWidth - 1) * NODE_SPACING) / 2;
        placeDescendant(child, generation + 1, childCenter, node.person.recordName);
        cursor += childWidth * NODE_SPACING;
      }
    };

    placeDescendant(descendantTree, 0, 0, null);
  }

  const allNodes = [...nodes.values()].sort((a, b) => a.generation - b.generation || a.x - b.x);
  const rootNode = allNodes.find((node) => node.featured) || allNodes.find((node) => node.generation === 0);
  const rootX = rootNode?.x || 0;
  const nodeList = allNodes.filter((node) => (
    node.generation >= -2 &&
    node.generation <= 1 &&
    Math.abs(node.x - rootX) <= 1180
  ));
  const visibleIds = new Set(nodeList.map((node) => node.id));
  const visibleLinks = links.filter((link) => visibleIds.has(link.from) && visibleIds.has(link.to));
  const bands = buildBands(nodeList, rootX);
  const bounds = boundsFor(nodeList, bands, visibleLinks);
  const viewBounds = focusBoundsFor(nodeList, bands, bounds);
  return { nodes: nodeList, links: visibleLinks, bands, bounds, viewBounds };
}

function buildFamilyGraphLayout(familyGraph, activeId) {
  const rootId = activeId || familyGraph.rootId;
  const sourceNodes = new Map();
  for (const node of familyGraph.nodes || []) {
    if (!node?.person?.recordName) continue;
    sourceNodes.set(node.person.recordName, {
      ...node,
      featured: node.person.recordName === rootId,
      role: (node.roles || []).join(' '),
    });
  }
  const familyByChild = new Map();
  const familyById = new Map((familyGraph.families || []).map((family) => [family.id, family]));
  for (const family of familyById.values()) {
    for (const childId of family.children || []) {
      if (!familyByChild.has(childId)) familyByChild.set(childId, family);
    }
  }

  const {
    generationStep: GENERATION_STEP,
    childGap: CHILD_GAP,
    rootCardWidth: ROOT_CARD_WIDTH,
    familyPadding: FAMILY_PADDING,
    blockGap: BLOCK_GAP,
    rootParentGap: ROOT_PARENT_GAP,
    maxDepth: MAX_DEPTH,
    visibleXRadius: VISIBLE_X_RADIUS,
    childBusGap: CHILD_BUS_GAP,
    parentBridgeGap: PARENT_BRIDGE_GAP,
    familyRouteSplitGap: FAMILY_ROUTE_SPLIT_GAP,
    maxFamilyHorizontalSpan: MAX_FAMILY_HORIZONTAL_SPAN,
    maxParentBridgeSpan: MAX_PARENT_BRIDGE_SPAN,
  } = MAC_FAMILY_GRAPH_LAYOUT;
  const placedById = new Map();
  const routedLinks = [];
  const blockCache = new Map();
  const rootFamily = familyById.get(familyGraph.rootFamilyId) || familyByChild.get(rootId);

  const orderFamilyChildren = (family, preferredChildId, generation, compactRoot = false) => {
    const people = (family.children || [])
      .map((id) => sourceNodes.get(id))
      .filter(Boolean);
    const ordered = orderGeneration(people, preferredChildId || rootId);
    if (compactRoot && preferredChildId) {
      const required = ordered.filter((node) => node.person.recordName === preferredChildId);
      const companion = ordered.find((node) => node.person.recordName !== preferredChildId);
      return [...required, companion].filter(Boolean);
    }
    const maxByGeneration = new Map([
      [-1, 13],
      [-2, 10],
      [-3, 8],
      [-4, 6],
    ]);
    const max = maxByGeneration.get(generation) || 8;
    const required = preferredChildId ? ordered.filter((node) => node.person.recordName === preferredChildId) : [];
    const rest = ordered.filter((node) => node.person.recordName !== preferredChildId);
    return [...required, ...rest].slice(0, max);
  };

  const measureBlock = (childId, generation, branch, depth) => {
    const family = familyByChild.get(childId);
    if (!family || depth > MAX_DEPTH) {
      return {
        id: `leaf:${childId}:${generation}`,
        family: null,
        generation,
        branch,
        preferredChildId: childId,
        children: [childId].filter((id) => sourceNodes.has(id)),
        parentBlocks: [],
        width: 260,
      };
    }
    const key = `${family.id}:${childId}:${generation}:${branch}`;
    if (blockCache.has(key)) return blockCache.get(key);
    const childNodes = orderFamilyChildren(family, childId, generation);
    const childIds = childNodes.map((node) => node.person.recordName);
    const childWidth = Math.max(320, (Math.max(childIds.length, 1) - 1) * CHILD_GAP + FAMILY_PADDING);
    const parentBlocks = (family.parents || [])
      .filter((id) => sourceNodes.has(id))
      .map((parentId, index) => measureBlock(parentId, generation - 1, branch || (index === 0 ? 'paternal' : 'maternal'), depth + 1));
    const parentWidth = parentBlocks.length > 0
      ? parentBlocks.reduce((sum, block) => sum + block.width, 0) + BLOCK_GAP * (parentBlocks.length - 1)
      : 0;
    const block = {
      id: family.id,
      family,
      generation,
      branch,
      preferredChildId: childId,
      children: childIds,
      parentBlocks,
      width: Math.max(childWidth, parentWidth, 360),
    };
    blockCache.set(key, block);
    return block;
  };

  const addNode = (personId, generation, x, familyBlockId, priority = 0) => {
    const source = sourceNodes.get(personId);
    if (!source) return null;
    const existing = placedById.get(personId);
    const next = {
      ...source,
      id: personId,
      generation,
      x,
      y: -generation * GENERATION_STEP,
      z: source.featured ? 52 : 22 + Math.min(Math.abs(generation) * 3, 18),
      familyBlockId,
      footprintWidth: source.featured ? 250 : 190,
      layoutPriority: source.featured ? 1000 : priority,
    };
    if (!existing || next.layoutPriority >= existing.layoutPriority) placedById.set(personId, next);
    return next;
  };

  const placeChildren = (block, centerX, compactRoot = false) => {
    const generation = block.generation;
    if (compactRoot) {
      const companion = block.children.find((id) => id !== rootId);
      if (companion) addNode(companion, generation, centerX - 132, block.id, 80);
      addNode(rootId, generation, centerX + 78, block.id, 900);
      return;
    }
    const preferredIndex = block.children.indexOf(block.preferredChildId);
    const centerIndex = preferredIndex >= 0 ? preferredIndex : Math.floor(block.children.length / 2);
    block.children.forEach((childId, index) => {
      addNode(childId, generation, centerX + (index - centerIndex) * CHILD_GAP, block.id, 60 - Math.abs(generation));
    });
  };

  const placeParentBlocks = (block, centerX) => {
    if (block.parentBlocks.length === 0) return;
    const totalWidth = block.parentBlocks.reduce((sum, child) => sum + child.width, 0) + BLOCK_GAP * (block.parentBlocks.length - 1);
    let cursor = centerX - totalWidth / 2;
    for (const parentBlock of block.parentBlocks) {
      const parentCenter = cursor + parentBlock.width / 2;
      placeBlock(parentBlock, parentCenter, false);
      cursor += parentBlock.width + BLOCK_GAP;
    }
  };

  const placeBlock = (block, centerX, compactRoot = false) => {
    block.x = centerX;
    block.y = -block.generation * GENERATION_STEP;
    placeChildren(block, centerX, compactRoot);
    placeParentBlocks(block, centerX);
  };

  if (rootFamily) {
    const rootChildren = orderFamilyChildren(rootFamily, rootId, 0, true).map((node) => node.person.recordName);
    const rootBlock = {
      id: rootFamily.id,
      family: rootFamily,
      generation: 0,
      branch: 'root',
      preferredChildId: rootId,
      children: rootChildren,
      parentBlocks: [],
      width: ROOT_CARD_WIDTH,
    };
    placeBlock(rootBlock, 0, true);

    const parents = (rootFamily.parents || []).filter((id) => sourceNodes.has(id));
    const fatherBlock = parents[0] ? measureBlock(parents[0], -1, 'paternal', 1) : null;
    const motherBlock = parents[1] ? measureBlock(parents[1], -1, 'maternal', 1) : null;
    if (fatherBlock && motherBlock) {
      placeBlock(fatherBlock, -ROOT_PARENT_GAP / 2, false);
      placeBlock(motherBlock, ROOT_PARENT_GAP / 2, false);
    } else if (fatherBlock) {
      placeBlock(fatherBlock, -520, false);
    } else if (motherBlock) {
      placeBlock(motherBlock, 520, false);
    }
  } else {
    addNode(rootId, 0, 0, 'root', 900);
  }

  const uniquePlaced = [...placedById.values()];
  const nodeById = new Map(uniquePlaced.map((node) => [node.id, node]));

  const addSegment = (familyId, type, emphasis, a, b, nodeIds = []) => {
    // Always draw the full segment. (A previous build split long horizontal
    // sibling buses into two end-stubs with a gap, which read as "broken"
    // connectors on a dense full tree.)
    addPolyline(familyId, type, emphasis, [a, b], nodeIds);
  };
  // Generation of the family currently being routed. Connectors inherit it so
  // the "By Generation, Light" colour mode can tint each link by the row it
  // feeds into, matching the native multi-hue look.
  let routingGeneration = 0;
  const addPolyline = (familyId, type, emphasis, points, nodeIds = []) => {
    routedLinks.push({
      key: `${familyId}:${type}:${routedLinks.length}`,
      type,
      emphasis,
      points,
      nodeIds,
      generation: routingGeneration,
    });
  };
  for (const family of familyGraph.families || []) {
    const parents = (family.parents || []).map((id) => nodeById.get(id)).filter(Boolean);
    const children = (family.children || []).map((id) => nodeById.get(id)).filter(Boolean);
    if (parents.length === 0 || children.length === 0) continue;
    const generation = children[0].generation;
    routingGeneration = generation;
    const childY = -generation * GENERATION_STEP;
    const parentY = parents[0].y;
    const direction = Math.sign(parentY - childY || 1);
    const parentAttachPoints = parents.map((parent) => ({
      node: parent,
      x: parent.x,
      y: parent.y - direction * nodeVerticalRadius(parent),
    }));
    const nearestParentAttachY = direction > 0
      ? Math.min(...parentAttachPoints.map((point) => point.y))
      : Math.max(...parentAttachPoints.map((point) => point.y));
    const preferredBridgeY = nearestParentAttachY - direction * PARENT_BRIDGE_GAP;
    const emphasis = family.id === rootFamily?.id || family.parents.some((id) => id === familyGraph.rootId);

    const childClusters = clusterFamilyChildren(children, FAMILY_ROUTE_SPLIT_GAP);
    for (const cluster of childClusters) {
      const minChildX = Math.min(...cluster.map((child) => child.x));
      const maxChildX = Math.max(...cluster.map((child) => child.x));
      const childPadding = cluster.length > 1 ? 34 : 0;
      const childLeft = minChildX - childPadding;
      const childRight = maxChildX + childPadding;
      const childAttachY = direction > 0
        ? Math.max(...cluster.map((child) => child.y + nodeVerticalRadius(child)))
        : Math.min(...cluster.map((child) => child.y - nodeVerticalRadius(child)));
      const childBusY = childAttachY + direction * CHILD_BUS_GAP;
      const clusterCenter = clusterCenterX(cluster);
      const localParentAttachPoints = compactParentPoints(
        localParentPoints(parentAttachPoints, clusterCenter, MAX_FAMILY_HORIZONTAL_SPAN),
        clusterCenter,
        MAX_PARENT_BRIDGE_SPAN
      );
      const coupleX = average(localParentAttachPoints.map((point) => point.x));
      const localNearestParentAttachY = direction > 0
        ? Math.min(...localParentAttachPoints.map((point) => point.y))
        : Math.max(...localParentAttachPoints.map((point) => point.y));
      const localPreferredBridgeY = localNearestParentAttachY - direction * PARENT_BRIDGE_GAP;
      const parentBridgeY = direction > 0
        ? Math.max(childBusY + PARENT_BRIDGE_GAP, localPreferredBridgeY)
        : Math.min(childBusY - PARENT_BRIDGE_GAP, localPreferredBridgeY);
      const clusterAnchorX = clamp(coupleX, childLeft, childRight);
      const clusterNodeIds = [...localParentAttachPoints.map((point) => point.node), ...cluster].map((node) => node.id);

      for (const point of localParentAttachPoints) {
        addSegment(family.id, 'family', emphasis, point, { x: point.x, y: parentBridgeY }, [point.node.id]);
      }
      if (localParentAttachPoints.length > 1) {
        const sortedParents = [...localParentAttachPoints].sort((a, b) => a.x - b.x);
        addSegment(
          family.id,
          'family',
          emphasis,
          { x: sortedParents[0].x, y: parentBridgeY },
          { x: sortedParents[sortedParents.length - 1].x, y: parentBridgeY },
          parents.map((parent) => parent.id)
        );
      }
      addPolyline(
        family.id,
        'family',
        emphasis,
        [
          { x: coupleX, y: parentBridgeY },
          { x: clusterAnchorX, y: parentBridgeY },
          { x: clusterAnchorX, y: childBusY },
        ],
        clusterNodeIds
      );
      addSegment(family.id, 'family', emphasis, { x: childLeft, y: childBusY }, { x: childRight, y: childBusY }, clusterNodeIds);
      for (const child of cluster) {
        addSegment(
          family.id,
          'family',
          emphasis,
          { x: child.x, y: childBusY },
          { x: child.x, y: child.y + direction * nodeVerticalRadius(child) },
          [child.id]
        );
      }
    }
  }

  const root = nodeById.get(rootId) || uniquePlaced.find((node) => node.featured);
  const rootX = root?.x || 0;
  const nodeList = uniquePlaced.filter((node) => Math.abs(node.x - rootX) <= VISIBLE_X_RADIUS && node.generation >= -4 && node.generation <= 1);
  const visibleIds = new Set(nodeList.map((node) => node.id));
  const visibleLinks = routedLinks.filter((link) => !link.nodeIds?.length || link.nodeIds.every((id) => visibleIds.has(id)));
  const visibleBands = buildBands(nodeList, rootX);
  const bounds = boundsFor(nodeList, visibleBands, visibleLinks);
  const viewBounds = focusBoundsFor(nodeList, visibleBands, bounds);
  return { nodes: nodeList, links: visibleLinks, bands: visibleBands, bounds, viewBounds };
}

function orderGeneration(group, rootId) {
  return [...group].sort((a, b) => {
    const ap = nodePriority(a, rootId);
    const bp = nodePriority(b, rootId);
    if (ap !== bp) return ap - bp;
    return (a.person.birthDate || '').localeCompare(b.person.birthDate || '') || a.person.fullName.localeCompare(b.person.fullName);
  });
}

function nodePriority(node, rootId) {
  if (node.person.recordName === rootId) return 0;
  const roles = node.roles || [];
  if (roles.includes('root')) return 0;
  if (roles.some((role) => role.includes('ancestor-parent'))) return 1;
  if (roles.some((role) => role.includes('partner-family'))) return 2;
  if (roles.some((role) => role.includes('descendant'))) return 3;
  if (roles.some((role) => role.includes('collateral'))) return 4;
  return 5;
}

function mergeRole(a, b) {
  if (!a || a === b) return b;
  if (!b) return a;
  if (a === 'root' || b === 'root') return 'root';
  return `${a} ${b}`;
}

function buildBands(nodes, rootX = 0) {
  const grouped = new Map();
  for (const node of nodes) {
    if (!grouped.has(node.generation)) grouped.set(node.generation, []);
    grouped.get(node.generation).push(node);
  }

  return [...grouped.entries()].map(([generation, group]) => {
    const segments = buildBandSegments(group, generation, rootX);
    const minX = Math.min(...segments.map((segment) => segment.x - segment.width / 2));
    const maxX = Math.max(...segments.map((segment) => segment.x + segment.width / 2));
    const centerY = group.reduce((sum, node) => sum + node.y, 0) / group.length;
    const years = yearRange(group.map((node) => node.person));
    const height = generation === 0 ? 286 : generation < 0 ? 186 : 184;
    const title =
      generation === 0
        ? 'Root Generation'
        : generation < 0
          ? `Generation ${Math.abs(generation)}`
          : `Descendant Generation ${generation}`;
    return {
      generation,
      x: (minX + maxX) / 2,
      y: centerY,
      width: maxX - minX,
      height,
      title,
      subtitle: years,
      count: group.length,
      segments,
    };
  });
}

function clusterByGap(sorted, splitGap) {
  const clusters = [];
  let current = [];
  for (const node of sorted) {
    const previous = current[current.length - 1];
    if (previous && node.x - previous.x > splitGap) {
      clusters.push(current);
      current = [];
    }
    current.push(node);
  }
  if (current.length) clusters.push(current);
  return clusters;
}

const PEDIGREE_BAND_GAP = 220;

function buildBandSegments(group, generation, rootX = 0) {
  const sorted = [...group].sort((a, b) => a.x - b.x);
  const splitGap = bandSplitGap(generation);
  const minWidth = generation === 0 ? 460 : 360;
  const padding = generation === 0 ? 340 : 250;
  // Ancestor bands are segmented by pedigree — paternal (left of the root's
  // lineage) and maternal (right) — so the band visibly splits down the middle
  // like the native viewer. Root + descendant generations stay continuous.
  const paternal = sorted.filter((node) => node.x < rootX);
  const maternal = sorted.filter((node) => node.x >= rootX);
  const sides = generation < 0 && paternal.length && maternal.length
    ? [{ side: 'paternal', nodes: paternal }, { side: 'maternal', nodes: maternal }]
    : [{ side: 'all', nodes: sorted }];
  const split = sides.length === 2;

  const segments = [];
  let isFirst = true;
  for (const { side, nodes } of sides) {
    const clusters = clusterByGap(nodes, splitGap);
    clusters.forEach((cluster, index) => {
      const minX = Math.min(...cluster.map((node) => node.x));
      const maxX = Math.max(...cluster.map((node) => node.x));
      const leftGutter = isFirst ? BAND_LABEL_GUTTER : 0;
      let left = minX - padding / 2 - leftGutter;
      let right = maxX + padding / 2;
      // Hold a clean gutter at the pedigree midline on the innermost cluster.
      if (split && side === 'paternal' && index === clusters.length - 1) {
        right = Math.min(right, rootX - PEDIGREE_BAND_GAP / 2);
        if (right - left < minWidth) left = right - minWidth; // grow outward only
      } else if (split && side === 'maternal' && index === 0) {
        left = Math.max(left, rootX + PEDIGREE_BAND_GAP / 2);
        if (right - left < minWidth) right = left + minWidth;
      } else if (right - left < minWidth) {
        const center = (left + right) / 2;
        left = center - minWidth / 2;
        right = center + minWidth / 2;
      }
      segments.push({ x: (left + right) / 2, width: right - left });
      isFirst = false;
    });
  }
  return segments;
}

export function bandSplitGap(generation) {
  return macBandSplitGap(generation);
}

function yearRange(persons) {
  const years = [];
  for (const person of persons) {
    const birth = extractYear(person?.birthDate);
    const death = extractYear(person?.deathDate);
    if (Number.isFinite(birth)) years.push(birth);
    if (Number.isFinite(death)) years.push(death);
  }
  if (years.length === 0) return '';
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(min) : `${min} - ${max}`;
}

function extractYear(value) {
  const match = String(value || '').match(/\b([12]\d{3}|20\d{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1000 && year <= 2099 ? year : null;
}

function boundsFor(nodes, bands, links = []) {
  if (nodes.length === 0) return { minX: -400, maxX: 400, minY: -260, maxY: 260 };
  const xs = nodes.flatMap((node) => [node.x - 170, node.x + 170]);
  const ys = nodes.flatMap((node) => [node.y - 120, node.y + 120]);
  for (const band of bands) {
    xs.push(band.x - band.width / 2, band.x + band.width / 2);
    ys.push(band.y - band.height / 2, band.y + band.height / 2);
    for (const segment of band.segments || []) {
      xs.push(segment.x - segment.width / 2, segment.x + segment.width / 2);
    }
  }
  for (const link of links) {
    for (const point of link.points || []) {
      xs.push(point.x - 40, point.x + 40);
      ys.push(point.y - 40, point.y + 40);
    }
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function focusBoundsFor(nodes, bands, fallback) {
  const root = nodes.find((node) => node.featured) || nodes.find((node) => node.generation === 0);
  const rootX = root?.x || 0;
  const rootY = root?.y || 0;
  const focusedNodes = nodes.filter((node) => (
    node.generation >= -4 &&
    node.generation <= 1 &&
    Math.abs(node.x - rootX) <= MAC_FAMILY_GRAPH_LAYOUT.visibleXRadius
  ));
  if (focusedNodes.length === 0) return fallback;
  const focusedGenerations = new Set(focusedNodes.map((node) => node.generation));
  const focusedBands = bands
    .filter((band) => focusedGenerations.has(band.generation))
    .map((band) => ({
      ...band,
      width: Math.min(band.width, 3600),
    }));
  const bounds = boundsFor(focusedNodes, focusedBands);
  const maxWidth = MAC_FAMILY_GRAPH_LAYOUT.maxFocusWidth;
  const maxHeight = MAC_FAMILY_GRAPH_LAYOUT.maxFocusHeight;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2 - 18;
  const width = Math.min(Math.max(bounds.maxX - bounds.minX, 900), maxWidth);
  const height = Math.min(Math.max(bounds.maxY - bounds.minY + 120, 900), maxHeight);
  return {
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: centerY - height / 2,
    maxY: centerY + height / 2,
  };
}

function nodeVerticalRadius(node) {
  return node.featured
    ? MAC_FAMILY_GRAPH_LAYOUT.featuredConnectorRadius
    : MAC_FAMILY_GRAPH_LAYOUT.regularConnectorRadius;
}

function clusterFamilyChildren(children, splitGap) {
  const sorted = [...children].sort((a, b) => a.x - b.x);
  const clusters = [];
  let current = [];
  for (const child of sorted) {
    const previous = current[current.length - 1];
    if (previous && child.x - previous.x > splitGap) {
      clusters.push(current);
      current = [];
    }
    current.push(child);
  }
  if (current.length) clusters.push(current);
  return clusters;
}

function nearestChildCluster(clusters, x) {
  return clusters.reduce((nearest, cluster) => {
    if (!nearest) return cluster;
    return Math.abs(clusterCenterX(cluster) - x) < Math.abs(clusterCenterX(nearest) - x) ? cluster : nearest;
  }, null);
}

function clusterCenterX(cluster) {
  return average(cluster.map((child) => child.x));
}

function localParentPoints(parentAttachPoints, x, maxDistance) {
  const local = parentAttachPoints.filter((point) => Math.abs(point.x - x) <= maxDistance);
  if (local.length) return local;
  return [parentAttachPoints.reduce((nearest, point) => (
    !nearest || Math.abs(point.x - x) < Math.abs(nearest.x - x) ? point : nearest
  ), null)].filter(Boolean);
}

function compactParentPoints(parentAttachPoints, x, maxSpan) {
  if (parentAttachPoints.length <= 1) return parentAttachPoints;
  const span = Math.max(...parentAttachPoints.map((point) => point.x)) - Math.min(...parentAttachPoints.map((point) => point.x));
  if (span <= maxSpan) return parentAttachPoints;
  return [parentAttachPoints.reduce((nearest, point) => (
    !nearest || Math.abs(point.x - x) < Math.abs(nearest.x - x) ? point : nearest
  ), null)].filter(Boolean);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseBirthYear(person) {
  const year = extractYear(person?.birthDate);
  return Number.isFinite(year) ? year : Number.MAX_SAFE_INTEGER;
}
