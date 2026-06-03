import { BAND_LABEL_GUTTER, GEN_STEP, NODE_SPACING, PARTNER_OFFSET, ROOT_CARD } from './constants.js';
import { MAC_FAMILY_GRAPH_LAYOUT, macBandSplitGap } from './macTreeStyle.js';

export function buildInteractiveLayout(ancestorTree, descendantTree, activeId, familyGraph = null, options = {}) {
  if (familyGraph?.nodes?.length) return finalizeLayout(buildFamilyGraphLayout(familyGraph, activeId, options), options);

  const maxAncestorGenerations = Number.isFinite(options.ancestorGenerations) ? Math.max(1, options.ancestorGenerations) : 4;
  const maxDescendantGenerations = Number.isFinite(options.descendantGenerations) ? Math.max(1, options.descendantGenerations) : 6;
  const childSortingMode = options.childSortingMode || 'byBirthAsc';
  const pcFactor = Number.isFinite(options.parentsChildrenSpacing) ? options.parentsChildrenSpacing : 1;
  const partnerFactor = Number.isFinite(options.partnerSpacing) ? options.partnerSpacing : 1;
  const branchFactor = Number.isFinite(options.branchSpacing) ? options.branchSpacing : 1;
  const genStep = GEN_STEP * pcFactor;
  const nodeSpacing = NODE_SPACING * branchFactor;
  const partnerOffset = PARTNER_OFFSET * partnerFactor;

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
      y: -generation * genStep,
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
      const spacing = nodeSpacing + generation * 38;
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
          const baseOffset = generation === 0 ? ROOT_CARD.w / 2 + 172 : partnerOffset;
          const offset = side * (baseOffset + Math.floor(index / 2) * 105);
          addNode(union.partner, generation, centerX + offset, 'partner');
          addLink(node.person.recordName, union.partner.recordName, 'partner');
        }
      });

      const children = sortChildren(unions.flatMap((union) => union.children || []));
      if (children.length === 0) return;
      const totalWidth = children.reduce((sum, child) => sum + measure(child), 0);
      let cursor = centerX - ((totalWidth - 1) * nodeSpacing) / 2;
      for (const child of children) {
        const childWidth = measure(child);
        const childCenter = cursor + ((childWidth - 1) * nodeSpacing) / 2;
        placeDescendant(child, generation + 1, childCenter, node.person.recordName);
        cursor += childWidth * nodeSpacing;
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
  const bands = buildBands(nodeList, rootX, options.generationBandsSegmentByPedigree !== false);
  const bounds = boundsFor(nodeList, bands, visibleLinks);
  const viewBounds = focusBoundsFor(nodeList, bands, bounds);
  return finalizeLayout({ nodes: nodeList, links: visibleLinks, bands, bounds, viewBounds }, options);
}

// Post-process a canonical (top-down) layout: shrink distant generations, then
// reorient the whole diagram onto the requested screen axis. Both steps are
// no-ops at their default settings, so the native look is untouched.
function finalizeLayout(layout, options = {}) {
  return applyOrientation(applyMinification(layout, options), options.generationDirection || 'topToBottom');
}

function applyMinification(layout, options) {
  const aStart = Number.isFinite(options.ancestorScaleStartLevel) ? options.ancestorScaleStartLevel : 0;
  const dStart = Number.isFinite(options.descendantScaleStartLevel) ? options.descendantScaleStartLevel : 0;
  const sibMin = Number.isFinite(options.siblingMinification) ? options.siblingMinification : 0;
  const otherSibMin = Number.isFinite(options.otherSiblingMinification) ? options.otherSiblingMinification : 0;
  if (aStart <= 0 && dStart <= 0 && sibMin <= 0 && otherSibMin <= 0) return layout;
  const nodes = layout.nodes.map((node) => {
    const gen = Number(node.generation) || 0;
    let scale = 1;
    if (gen < 0 && aStart > 0 && Math.abs(gen) >= aStart) {
      scale = Math.max(0.42, 1 - (Math.abs(gen) - aStart + 1) * 0.14);
    } else if (gen > 0 && dStart > 0 && gen >= dStart) {
      scale = Math.max(0.42, 1 - (gen - dStart + 1) * 0.14);
    }
    // Collateral siblings (not the direct lineage): focused person's own
    // siblings (generation 0) vs. all other collateral relatives.
    const role = String(node.role || (node.roles || []).join(' ')).toLowerCase();
    if (!node.featured && role.includes('collateral')) {
      const factor = gen === 0 ? sibMin : otherSibMin;
      if (factor > 0) scale = Math.min(scale, Math.max(0.42, 1 - factor));
    }
    return scale === 1 ? node : { ...node, scale };
  });
  return { ...layout, nodes };
}

function orientationTransform(direction) {
  switch (direction) {
    case 'bottomToTop': return { fn: (x, y) => [x, -y], swap: false };
    case 'leftToRight': return { fn: (x, y) => [-y, x], swap: true };
    case 'rightToLeft': return { fn: (x, y) => [y, -x], swap: true };
    default: return { fn: (x, y) => [x, y], swap: false };
  }
}

function transformBoundsRect(bounds, fn) {
  const corners = [
    [bounds.minX, bounds.minY], [bounds.minX, bounds.maxY],
    [bounds.maxX, bounds.minY], [bounds.maxX, bounds.maxY],
  ].map(([x, y]) => fn(x, y));
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function transformBand(band, fn, swap) {
  const [bx, by] = fn(band.x, band.y);
  const segments = (band.segments || []).map((segment) => {
    const segX = segment.x;
    const segY = Number.isFinite(segment.y) ? segment.y : band.y;
    const [sx, sy] = fn(segX, segY);
    const alongWidth = Number.isFinite(segment.width) ? segment.width : band.width;
    const crossHeight = Number.isFinite(segment.height) ? segment.height : band.height;
    return {
      x: sx,
      y: sy,
      width: swap ? crossHeight : alongWidth,
      height: swap ? alongWidth : crossHeight,
    };
  });
  return {
    ...band,
    x: bx,
    y: by,
    width: swap ? band.height : band.width,
    height: swap ? band.width : band.height,
    segments,
  };
}

function applyOrientation(layout, direction) {
  if (!direction || direction === 'topToBottom') return layout;
  const { fn, swap } = orientationTransform(direction);
  const nodes = layout.nodes.map((node) => {
    const [x, y] = fn(node.x, node.y);
    return { ...node, x, y };
  });
  const links = layout.links.map((link) => (
    link.points
      ? { ...link, points: link.points.map((point) => { const [x, y] = fn(point.x, point.y); return { ...point, x, y }; }) }
      : link
  ));
  const bands = layout.bands.map((band) => transformBand(band, fn, swap));
  const bounds = transformBoundsRect(layout.bounds, fn);
  const viewBounds = layout.viewBounds ? transformBoundsRect(layout.viewBounds, fn) : layout.viewBounds;
  return { ...layout, nodes, links, bands, bounds, viewBounds };
}

function buildFamilyGraphLayout(familyGraph, activeId, options = {}) {
  const rootId = activeId || familyGraph.rootId;
  const pcFactor = Number.isFinite(options.parentsChildrenSpacing) ? options.parentsChildrenSpacing : 1;
  const partnerFactor = Number.isFinite(options.partnerSpacing) ? options.partnerSpacing : 1;
  const branchFactor = Number.isFinite(options.branchSpacing) ? options.branchSpacing : 1;
  const siblingGenerations = Number.isFinite(options.siblingGenerations) ? options.siblingGenerations : 4;
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
    // Beyond the configured Brother/Sister Generations depth, drop collateral
    // siblings and keep only the direct lineage person at this level.
    if (preferredChildId && Math.abs(generation) > siblingGenerations) {
      return ordered.filter((node) => node.person.recordName === preferredChildId);
    }
    // Fewer collateral siblings the deeper we go (the MFT viewer minifies and
    // limits distant brothers/sisters so the tree stays compact).
    const maxByGeneration = new Map([
      [-1, 7],
      [-2, 5],
      [-3, 4],
      [-4, 3],
    ]);
    const max = maxByGeneration.get(generation) || 4;
    const required = preferredChildId ? ordered.filter((node) => node.person.recordName === preferredChildId) : [];
    const rest = ordered.filter((node) => node.person.recordName !== preferredChildId).slice(0, Math.max(0, max - required.length));
    // Centre the in-line ancestor among the kept siblings so the direct lineage
    // forms a straight column and siblings spread symmetrically (rather than the
    // preferred child sitting at the far-left edge of a one-sided block).
    const mid = Math.floor(rest.length / 2);
    return [...rest.slice(0, mid), ...required, ...rest.slice(mid)];
  };

  // Vertical pitch between generation rows, scaled by the Parents/Children
  // Spacing control (1.0 = native default).
  const GENERATION_STEP_SCALED = GENERATION_STEP * pcFactor;
  // Horizontal couple gap, sibling pitch, and the minimum same-generation gap.
  // Partner Spacing widens couples; Branch Spacing widens siblings/lineages.
  const PARTNER_GAP = 150 * partnerFactor;
  const SIBLING_GAP = CHILD_GAP * branchFactor;
  const MIN_GEN_GAP = 124 * branchFactor;
  // Each generation up, a lineage drifts outward by this much (paternal left,
  // maternal right) — the native viewer's ancestor "bow". Large enough that the
  // paternal and maternal couples clear each other above the parents row.
  const FAN_BIAS = 190 * branchFactor;

  const addNode = (personId, generation, x, familyBlockId, priority = 0) => {
    const source = sourceNodes.get(personId);
    if (!source) return null;
    const existing = placedById.get(personId);
    const next = {
      ...source,
      id: personId,
      generation,
      x,
      y: -generation * GENERATION_STEP_SCALED,
      z: source.featured ? 52 : 22 + Math.min(Math.abs(generation) * 3, 18),
      familyBlockId,
      footprintWidth: source.featured ? 250 : 190,
      layoutPriority: source.featured ? 1000 : priority,
    };
    if (!existing || next.layoutPriority >= existing.layoutPriority) placedById.set(personId, next);
    return next;
  };

  // Place a person's siblings (other children of `family`). `side` < 0 fans them
  // left, > 0 fans them right, 0 alternates — so on the paternal side aunts/uncles
  // spread left and on the maternal side they spread right, keeping the couple
  // clear in the middle.
  const placeSiblings = (family, focalId, focalX, generation, side) => {
    const siblingIds = orderFamilyChildren(family, focalId, generation)
      .map((node) => node.person.recordName)
      .filter((id) => id !== focalId);
    const priority = 40 - Math.abs(generation);
    if (side < 0) {
      let x = focalX;
      for (const id of siblingIds) { x -= SIBLING_GAP; addNode(id, generation, x, family.id, priority); }
    } else if (side > 0) {
      let x = focalX;
      for (const id of siblingIds) { x += SIBLING_GAP; addNode(id, generation, x, family.id, priority); }
    } else {
      let leftX = focalX;
      let rightX = focalX;
      siblingIds.forEach((id, index) => {
        if (index % 2 === 0) { rightX += SIBLING_GAP; addNode(id, generation, rightX, family.id, priority); }
        else { leftX -= SIBLING_GAP; addNode(id, generation, leftX, family.id, priority); }
      });
    }
  };

  // Walk up from a placed person, fanning ancestors outward like the native
  // viewer's pedigree "bow": each couple is partner-spaced, and a lineage drifts
  // FAN_BIAS further from centre every generation (paternal left, maternal right)
  // so the two halves never collide. The root's own parents stay centred above it
  // (side 0) → one continuous parents band. Generations live on separate Y bands,
  // so columns may overlap across generations; only same-generation overlap is
  // resolved afterward.
  const placeAncestors = (personId, personX, generation, depth, side) => {
    if (depth > MAX_DEPTH) return;
    const family = familyByChild.get(personId);
    if (!family) return;
    const parents = (family.parents || []).filter((id) => sourceNodes.has(id));
    if (parents.length === 0) return;
    const parentGen = generation - 1;
    const coupleCenter = personX + side * FAN_BIAS;
    const fatherX = parents.length > 1 ? coupleCenter - PARTNER_GAP / 2 : coupleCenter;
    const motherX = parents.length > 1 ? coupleCenter + PARTNER_GAP / 2 : coupleCenter;
    parents.forEach((parentId, index) => {
      const px = index === 0 ? fatherX : motherX;
      // Once on a side, stay on it; at the root the first split sends the father
      // lineage left and the mother lineage right.
      const childSide = side !== 0 ? side : (index === 0 ? -1 : 1);
      const parentFamily = familyByChild.get(parentId);
      // Tag the ancestor with the family that groups them with their siblings
      // (their own parents' family) so each couple's children share one holder.
      const holderId = parentFamily?.id || `solo:${parentId}`;
      addNode(parentId, parentGen, px, holderId, 70 - Math.abs(parentGen));
      if (parentFamily) placeSiblings(parentFamily, parentId, px, parentGen, childSide);
      placeAncestors(parentId, px, parentGen, depth + 1, childSide);
    });
  };

  if (rootFamily) {
    // Root + a companion sibling (compact root), then fan the ancestors up.
    const rootChildren = orderFamilyChildren(rootFamily, rootId, 0, true).map((node) => node.person.recordName);
    const companion = rootChildren.find((id) => id !== rootId);
    if (companion) addNode(companion, 0, -132, rootFamily.id, 80);
    addNode(rootId, 0, 78, rootFamily.id, 900);
    placeAncestors(rootId, 78, 0, 1, 0);
  } else {
    addNode(rootId, 0, 0, 'root', 900);
  }

  // Resolve overlap WITHIN each generation row only (separate Y bands let
  // lineages overlap across generations). Push apart preserving order, then
  // recentre the row on its natural midpoint so it doesn't drift sideways.
  const rowsByGeneration = new Map();
  for (const node of placedById.values()) {
    if (!rowsByGeneration.has(node.generation)) rowsByGeneration.set(node.generation, []);
    rowsByGeneration.get(node.generation).push(node);
  }
  for (const row of rowsByGeneration.values()) {
    if (row.length < 2) continue;
    row.sort((a, b) => a.x - b.x);
    const meanBefore = row.reduce((sum, node) => sum + node.x, 0) / row.length;
    for (let i = 1; i < row.length; i += 1) {
      const minX = row[i - 1].x + MIN_GEN_GAP;
      if (row[i].x < minX) row[i].x = minX;
    }
    // "Adjust Parent Positions for better space usage": recentre each pushed-apart
    // row on its natural midpoint so it doesn't drift sideways. When off, the row
    // keeps the raw pedigree-fan positions (only overlap is resolved).
    if (options.adjustParentPositions !== false) {
      const meanAfter = row.reduce((sum, node) => sum + node.x, 0) / row.length;
      const shift = meanBefore - meanAfter;
      for (const node of row) node.x += shift;
    }
  }

  const uniquePlaced = [...placedById.values()];
  const nodeById = new Map(uniquePlaced.map((node) => [node.id, node]));

  // Decide visibility up front so connectors are only routed between nodes that
  // actually render — a connector can never run toward a clipped, off-screen
  // node ("line going nowhere").
  const root = nodeById.get(rootId) || uniquePlaced.find((node) => node.featured);
  const rootX = root?.x || 0;
  const nodeList = uniquePlaced.filter((node) => Math.abs(node.x - rootX) <= VISIBLE_X_RADIUS && node.generation >= -4 && node.generation <= 1);
  const visibleIds = new Set(nodeList.map((node) => node.id));

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
    const parents = (family.parents || []).map((id) => nodeById.get(id)).filter((node) => node && visibleIds.has(node.id));
    const children = (family.children || []).map((id) => nodeById.get(id)).filter((node) => node && visibleIds.has(node.id));
    if (parents.length === 0 || children.length === 0) continue;
    const generation = children[0].generation;
    routingGeneration = generation;
    const childY = -generation * GENERATION_STEP_SCALED;
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

    // ONE connector assembly per family (no per-cluster fragmentation, which
    // produced forked/duplicate trunks). MFT's model: couple bar -> single
    // trunk -> one U-shaped sibling bus -> a drop to each child's top edge.
    const sortedChildren = [...children].sort((a, b) => a.x - b.x);
    const minChildX = Math.min(...sortedChildren.map((child) => child.x));
    const maxChildX = Math.max(...sortedChildren.map((child) => child.x));
    const childAttachY = direction > 0
      ? Math.max(...sortedChildren.map((child) => child.y + nodeVerticalRadius(child)))
      : Math.min(...sortedChildren.map((child) => child.y - nodeVerticalRadius(child)));
    const childBusY = childAttachY + direction * CHILD_BUS_GAP;
    const coupleX = average(parentAttachPoints.map((point) => point.x));
    const anchorX = clamp(coupleX, minChildX, maxChildX);
    const parentBridgeY = direction > 0
      ? Math.max(childBusY + PARENT_BRIDGE_GAP, preferredBridgeY)
      : Math.min(childBusY - PARENT_BRIDGE_GAP, preferredBridgeY);
    const parentIds = parentAttachPoints.map((point) => point.node.id);

    // 1) each parent drops to the couple-bar line
    for (const point of parentAttachPoints) {
      addSegment(family.id, 'family', emphasis, point, { x: point.x, y: parentBridgeY }, [point.node.id]);
    }
    // 2) couple bar joining the parents (only when both are present)
    if (parentAttachPoints.length > 1) {
      const xs = parentAttachPoints.map((point) => point.x);
      addSegment(family.id, 'family', emphasis,
        { x: Math.min(...xs), y: parentBridgeY }, { x: Math.max(...xs), y: parentBridgeY }, parentIds);
    }
    // 3) single trunk: couple midpoint -> anchor over the children -> sibling bus
    addPolyline(family.id, 'family', emphasis, [
      { x: coupleX, y: parentBridgeY },
      { x: anchorX, y: parentBridgeY },
      { x: anchorX, y: childBusY },
    ], parentIds);
    // 4) U-shaped sibling bus: a single rounded path rises from the first child,
    //    runs across at the bus line, and drops to the last child — its two
    //    corners round off (radius 28) for the native viewer's soft curves.
    //    Middle children drop straight into the bus.
    const childTopOf = (child) => child.y + direction * nodeVerticalRadius(child);
    if (sortedChildren.length === 1) {
      const only = sortedChildren[0];
      addSegment(family.id, 'family', emphasis,
        { x: only.x, y: childBusY }, { x: only.x, y: childTopOf(only) }, [only.id]);
    } else {
      const first = sortedChildren[0];
      const last = sortedChildren[sortedChildren.length - 1];
      addPolyline(family.id, 'family', emphasis, [
        { x: first.x, y: childTopOf(first) },
        { x: first.x, y: childBusY },
        { x: last.x, y: childBusY },
        { x: last.x, y: childTopOf(last) },
      ], sortedChildren.map((child) => child.id));
      for (let i = 1; i < sortedChildren.length - 1; i += 1) {
        const child = sortedChildren[i];
        addSegment(family.id, 'family', emphasis,
          { x: child.x, y: childBusY }, { x: child.x, y: childTopOf(child) }, [child.id]);
      }
    }
  }

  // All routed links already reference only visible nodes (filtered above).
  const visibleLinks = routedLinks;
  const visibleBands = buildBands(nodeList, rootX, options.generationBandsSegmentByPedigree !== false);
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

function buildBands(nodes, rootX = 0, segmentByPedigree = true) {
  const grouped = new Map();
  for (const node of nodes) {
    if (!grouped.has(node.generation)) grouped.set(node.generation, []);
    grouped.get(node.generation).push(node);
  }

  return [...grouped.entries()].map(([generation, group]) => {
    const segments = buildBandSegments(group, generation, rootX, segmentByPedigree);
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

function buildBandSegments(group, generation, rootX = 0, segmentByPedigree = true) {
  const sorted = [...group].sort((a, b) => a.x - b.x);
  const minWidth = generation === 0 ? 460 : 280;
  const padding = generation === 0 ? 340 : 150;
  // Root (0) and the focused person's parents (-1) are ONE continuous band.
  // From the grandparents up (gen <= -2) each couple's children-group gets its
  // own holder box (keyed by familyBlockId) — the native viewer's nested
  // per-pedigree-group holders, rather than one long band per generation. The
  // "Segment Bands by Pedigree" toggle collapses that back to one band per row.
  let groups;
  if (generation <= -2 && segmentByPedigree) {
    const byHolder = new Map();
    for (const node of sorted) {
      const key = node.familyBlockId || `solo:${node.id}`;
      if (!byHolder.has(key)) byHolder.set(key, []);
      byHolder.get(key).push(node);
    }
    groups = [...byHolder.values()].sort(
      (a, b) => Math.min(...a.map((n) => n.x)) - Math.min(...b.map((n) => n.x))
    );
  } else {
    groups = [sorted];
  }

  const segments = [];
  let isFirst = true;
  for (const holder of groups) {
    const lo = Math.min(...holder.map((node) => node.x));
    const hi = Math.max(...holder.map((node) => node.x));
    const leftGutter = isFirst ? BAND_LABEL_GUTTER : 0;
    let left = lo - padding / 2 - leftGutter;
    let right = hi + padding / 2;
    if (right - left < minWidth) {
      const center = (left + right) / 2;
      left = center - minWidth / 2;
      right = center + minWidth / 2;
    }
    segments.push({ x: (left + right) / 2, width: right - left });
    isFirst = false;
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
