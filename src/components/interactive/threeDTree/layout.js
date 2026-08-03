import { BAND_LABEL_GUTTER, GEN_STEP, NODE_SPACING, PARTNER_OFFSET, ROOT_CARD } from './constants.js';
import { MAC_FAMILY_GRAPH_LAYOUT, macBandSplitGap } from './macTreeStyle.js';
import { Gender } from '../../../models/index.js';

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
    // Compose with the layout's own scale hierarchy (lineage large / siblings small).
    let scale = Number.isFinite(node.scale) ? node.scale : 1;
    // Native reciprocal minification (decompiled buildAncestors/buildPartners):
    // ancestors at depth a >= start scale by 1/(a - start + 2), i.e. with the
    // default start 3: 1, 1, 0.5, 0.333…; descendants likewise from level 2.
    if (gen < 0 && aStart > 0 && Math.abs(gen) >= aStart) {
      scale = scale / (Math.abs(gen) - aStart + 2);
    } else if (gen > 0 && dStart > 0 && gen >= dStart) {
      scale = scale / (gen - dStart + 2);
    }
    // Collateral siblings (not the direct lineage): focused person's own
    // siblings (generation 0) vs. all other collateral relatives. The family
    // graph path tags lineage membership explicitly (`lineage: false` =
    // collateral); the simple tree path only carries role strings.
    const role = String(node.role || (node.roles || []).join(' ')).toLowerCase();
    const collateral = !node.featured && (node.lineage === false || role.includes('collateral'));
    if (collateral) {
      // Collateral base scale is already the native 0.5 × lineage (decompiled
      // TreeBuilder auxiliary-sibling factor); the option shrinks further.
      const factor = gen === 0 ? sibMin : otherSibMin;
      if (factor > 0) scale = Math.max(0.35, scale * (1 - factor * 0.5));
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
    // Bands run along X by default; the L→R / R→L orientations turn them into
    // vertical columns — label placement keys off this.
    axis: swap ? 'vertical' : 'horizontal',
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
  const familiesByParent = new Map();
  for (const family of familyById.values()) {
    for (const childId of family.children || []) {
      if (!familyByChild.has(childId)) familyByChild.set(childId, family);
    }
    for (const parentId of family.parents || []) {
      if (!familiesByParent.has(parentId)) familiesByParent.set(parentId, []);
      familiesByParent.get(parentId).push(family);
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
    coupleBarDrop: COUPLE_BAR_DROP,
  } = MAC_FAMILY_GRAPH_LAYOUT;
  const placedById = new Map();
  const routedLinks = [];
  const blockCache = new Map();
  // Per ancestor family, which child continues the displayed lineage up the tree.
  // Its gender drives the native viewer's red (husband-line) / green (wife-line)
  // ancestor connector colours.
  const lineageChildId = new Map();
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
  // Native rows COMPRESS as their content minifies: the contour extents
  // (H/2+B / H/2+T) all scale with the row's minification, so both the pitch
  // between rows and the band tray depth follow the row scale. Mirror the
  // applyMinification schedule so figures and trays shrink together.
  const aStartRow = Number.isFinite(options.ancestorScaleStartLevel) ? options.ancestorScaleStartLevel : 0;
  const dStartRow = Number.isFinite(options.descendantScaleStartLevel) ? options.descendantScaleStartLevel : 0;
  const rowScale = (generation) => {
    const gen = Math.trunc(Number(generation) || 0);
    if (gen < 0 && aStartRow > 0 && Math.abs(gen) >= aStartRow) return 1 / (Math.abs(gen) - aStartRow + 2);
    if (gen > 0 && dStartRow > 0 && gen >= dStartRow) return 1 / (gen - dStartRow + 2);
    return 1;
  };
  const rowYCache = new Map([[0, 0]]);
  const rowY = (generation) => {
    const gen = Math.trunc(Number(generation) || 0);
    if (rowYCache.has(gen)) return rowYCache.get(gen);
    const towardZero = gen > 0 ? gen - 1 : gen + 1;
    const base = rowY(towardZero);
    const pitch = GENERATION_STEP_SCALED * (rowScale(gen) + rowScale(towardZero)) / 2;
    const y = gen > 0 ? base - pitch : base + pitch;
    rowYCache.set(gen, y);
    return y;
  };
  // Horizontal couple gap, sibling pitch, and the minimum same-generation gap.
  // Partner Spacing widens couples; Branch Spacing widens siblings/lineages.
  // Native ordinary contour pitch ≈ 126 web units (2.175 native × 58).
  const PARTNER_GAP = 127 * partnerFactor;
  const SIBLING_GAP = CHILD_GAP * branchFactor;
  const MIN_GEN_GAP = 124 * branchFactor;

  const addNode = (personId, generation, x, familyBlockId, priority = 0, extra = null) => {
    const source = sourceNodes.get(personId);
    if (!source) return null;
    const existing = placedById.get(personId);
    const next = {
      ...source,
      ...extra,
      id: personId,
      generation,
      x,
      y: rowY(generation),
      z: source.featured ? 52 : 22 + Math.min(Math.abs(generation) * 3, 18),
      familyBlockId,
      footprintWidth: source.featured ? 250 : 190,
      layoutPriority: source.featured ? 1000 : priority,
    };
    if (!existing || next.layoutPriority >= existing.layoutPriority) placedById.set(personId, next);
    return next;
  };

  // --- Contour-packed ancestor branches (native subtree-set collision model) ---
  // A "branch" is a person (the apex), their kept siblings beside them, and
  // their whole ancestor fan above — positioned RELATIVE to the apex at dx 0.
  // Sibling branches (father's vs mother's) are slid apart only as far as their
  // per-generation row extents require — the web equivalent of the native
  // collideLeftSetOfInfos:withRightSetOfInfos:ReturnXDeltaRequired: +
  // moveSetOfInfos:byDelta: pass. Because a couple is always centred above its
  // lineage child (widening symmetrically only when its two ancestor fans
  // collide), connectors run near-vertical and holder boxes never overlap.

  // Required offset between a left and right branch so every shared generation
  // row keeps at least MIN_GEN_GAP centre-to-centre clearance.
  const requiredSeparation = (left, right) => {
    let sep = -Infinity;
    for (const [gen, l] of left.extents) {
      const r = right.extents.get(gen);
      if (r) sep = Math.max(sep, l.max - r.min + MIN_GEN_GAP);
    }
    return sep;
  };

  const mergeBranch = (nodes, extents, branch, offset) => {
    for (const node of branch.nodes) nodes.push({ ...node, dx: node.dx + offset });
    for (const [gen, ext] of branch.extents) {
      const current = extents.get(gen);
      if (!current) extents.set(gen, { min: ext.min + offset, max: ext.max + offset });
      else {
        current.min = Math.min(current.min, ext.min + offset);
        current.max = Math.max(current.max, ext.max + offset);
      }
    }
  };

  // `side` < 0 spreads siblings left of the apex (paternal half), > 0 right
  // (maternal half), 0 alternates — keeping each couple clear in the middle.
  const buildBranch = (personId, generation, depth, side, includeSiblings = true, descentFamilyId = null) => {
    const family = familyByChild.get(personId);
    // Tag with the family that groups the person with their siblings (their own
    // parents' family) so each couple's children share one holder box.
    const holderId = family?.id || `solo:${personId}`;
    // Native local groups (decompiled assignLocalGroupIdentifiers...): the
    // OPPOSITE parent/partner inherits the current person's group — a couple
    // always shares ONE slab (قاسم/زينب/علي together in the reference), keyed
    // here by the union that continues the lineage downward.
    const coupleHolder = descentFamilyId ? `couple:${descentFamilyId}` : holderId;
    // The branch apex IS the direct-lineage ancestor — the native viewer renders
    // it featured-sized while collateral siblings are minified small.
    const nodes = [{ id: personId, gen: generation, dx: 0, holderId: coupleHolder, priority: 70 - Math.abs(generation), lineage: true }];
    const extents = new Map([[generation, { min: 0, max: 0 }]]);
    if (!family) return { nodes, extents };
    // personId is the lineage child of its own parents' family.
    lineageChildId.set(family.id, personId);
    // Native merges HALF-SIBLINGS (children of the parents' other unions) into
    // the same sibling row cluster, ordered together with the full siblings —
    // the reference shows صبرية، فوزية left of the lineage child سامي on one
    // slab. Collect them from every other family of either parent.
    const halfSiblingIds = [];
    if (includeSiblings) {
      for (const parentId of family.parents || []) {
        for (const other of familiesByParent.get(parentId) || []) {
          if (other.id === family.id) continue;
          for (const childId of other.children || []) {
            if (!sourceNodes.has(childId)) continue;
            if (childId === personId) continue;
            if ((family.children || []).includes(childId)) continue;
            if (!halfSiblingIds.includes(childId)) halfSiblingIds.push(childId);
          }
        }
      }
    }
    const siblingFamily = halfSiblingIds.length
      ? { ...family, children: [...(family.children || []), ...halfSiblingIds] }
      : family;
    const siblingIds = (includeSiblings ? orderFamilyChildren(siblingFamily, personId, generation) : [])
      .map((node) => node.person.recordName)
      .filter((id) => id !== personId);
    const siblingPriority = 40 - Math.abs(generation);
    // Collateral siblings render minified, so they pack tighter than full-size
    // figures (matches the native viewer's dense sibling rows).
    const siblingGap = SIBLING_GAP * 0.8;
    const rowExtent = extents.get(generation);
    // --- Other unions FIRST, directly beside the apex (native order) ---
    // Native shows every union of a direct-line ancestor in-band: the
    // step-spouse stands full-size IMMEDIATELY beside the ancestor (علي beside
    // زينب in the reference — nobody in between, so the couple bar stays
    // short and its ⚭/D icon sits in their gap), with that union's children
    // (half-siblings, minified) directly below the pair on the SAME slab as
    // their lineage half-sibling. Ordinary siblings then fan out beyond.
    const outward = side || 1;
    let unionEdge = 0; // furthest apex-row slot claimed by union clusters
    if (personId !== rootId) {
      for (const other of familiesByParent.get(personId) || []) {
        // Skip the union that continues the displayed lineage downward (its
        // couple bar + drops are routed from the child generation's branch).
        if (lineageChildId.has(other.id)) continue;
        const spouseId = (other.parents || []).find((id) => id !== personId && sourceNodes.has(id));
        const unionChildren = (other.children || []).filter((id) => sourceNodes.has(id) && id !== personId);
        if (!spouseId && unionChildren.length === 0) continue;
        let spouseDx = unionEdge;
        if (spouseId && !nodes.some((node) => node.id === spouseId && node.gen === generation)) {
          spouseDx = unionEdge + outward * 118;
          nodes.push({
            id: spouseId, gen: generation, dx: spouseDx, holderId: coupleHolder,
            priority: 45 - Math.abs(generation), lineage: false, scaleOverride: 1,
          });
          rowExtent.min = Math.min(rowExtent.min, spouseDx);
          rowExtent.max = Math.max(rowExtent.max, spouseDx);
          unionEdge = spouseDx;
        }
        // The union's children (half-siblings of the lineage child) are NOT
        // placed here — they merge into the child row's sibling cluster in
        // the child branch (native order: sorted together with full siblings).
      }
    }
    // --- Ordinary siblings fan out beyond any union clusters ---
    const placeSibling = (id, dx) => {
      nodes.push({ id, gen: generation, dx, holderId: family.id, priority: siblingPriority, lineage: false });
      rowExtent.min = Math.min(rowExtent.min, dx);
      rowExtent.max = Math.max(rowExtent.max, dx);
    };
    if (side < 0) {
      let x = Math.min(0, unionEdge);
      for (const id of [...siblingIds].reverse()) { x -= siblingGap; placeSibling(id, x); }
    } else if (side > 0) {
      let x = Math.max(0, unionEdge);
      for (const id of [...siblingIds].reverse()) { x += siblingGap; placeSibling(id, x); }
    } else {
      let leftX = Math.min(0, unionEdge);
      let rightX = Math.max(0, unionEdge);
      siblingIds.forEach((id, index) => {
        if (index % 2 === 0) { rightX += siblingGap; placeSibling(id, rightX); }
        else { leftX -= siblingGap; placeSibling(id, leftX); }
      });
    }
    if (depth > MAX_DEPTH) return { nodes, extents };
    const parents = (family.parents || []).filter((id) => sourceNodes.has(id)).slice(0, 2);
    if (parents.length === 1) {
      // A single parent sits directly above the apex.
      const parentBranch = buildBranch(parents[0], generation - 1, depth + 1, side || -1, true, family.id);
      mergeBranch(nodes, extents, parentBranch, 0);
    } else if (parents.length === 2) {
      // Spouses FACE each other like the native viewer: the father's siblings
      // always fan left of him and the mother's right of her, so the couple
      // stands adjacent in the middle and their union bar stays short (instead
      // of slicing across a whole sibling holder).
      const fatherBranch = buildBranch(parents[0], generation - 1, depth + 1, -1, true, family.id);
      const motherBranch = buildBranch(parents[1], generation - 1, depth + 1, 1, true, family.id);
      const separation = Math.max(PARTNER_GAP, requiredSeparation(fatherBranch, motherBranch));
      mergeBranch(nodes, extents, fatherBranch, -separation / 2);
      mergeBranch(nodes, extents, motherBranch, separation / 2);
    }
    return { nodes, extents };
  };

  if (rootFamily) {
    // Root + a companion sibling (compact root), then the contour-packed
    // ancestor fan above. The branch is built with the root as apex but the
    // root + companion themselves are pinned to the classic compact positions.
    const rootX = 78;
    lineageChildId.set(rootFamily.id, rootId);
    const rootChildren = orderFamilyChildren(rootFamily, rootId, 0, true).map((node) => node.person.recordName);
    const companion = rootChildren.find((id) => id !== rootId);
    if (companion) addNode(companion, 0, -132, rootFamily.id, 80, { lineage: false, scale: 0.5 });
    addNode(rootId, 0, rootX, rootFamily.id, 900);
    // The root + companion are pinned above; the branch skips apex siblings so
    // only the ancestor fan is emitted from it. Native scales (decompiled
    // TreeBuilder): direct-line persons stay at 1.0 — there is NO featured
    // enlargement — and auxiliary siblings are 0.5 × their lineage scale,
    // which is what produces the big-couple/small-sibling hierarchy.
    const branch = buildBranch(rootId, 0, 1, 0, false);
    for (const node of branch.nodes) {
      if (node.gen === 0) continue;
      addNode(node.id, node.gen, rootX + node.dx, node.holderId, node.priority, {
        lineage: node.lineage,
        scale: node.scaleOverride ?? (node.lineage ? 1 : 0.5),
      });
    }
  } else {
    addNode(rootId, 0, 0, 'root', 900);
  }

  // Safety net: resolve any residual same-row overlap (e.g. pedigree-collapse
  // duplicates collapsing into one node). Push apart preserving order, then
  // optionally recentre the row on its natural midpoint ("Adjust Parent
  // Positions for better space usage"). With contour-packed branches this is
  // normally a no-op.
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
  // --- Native contour row pitch (decompiled builder geometry pass) ----------
  // Row separation is MEASURED from content, not a fixed step:
  //   pitch = max(H/2 + B) of the upper row + max(H/2 + T) of the lower row,
  // with H = (hInfo + 0.7)·m native units (the person slot including its text
  // plane), B = m·(0.1 + 0.4·parentsChildrenFactor), T = 0.25 (unscaled), all
  // multiplied by the node's effective minification. hInfo mirrors the native
  // heightOfPersonInformation row budget (name ≤2 lines + ☆/† date rows).
  {
    const U = 58;
    const effScale = (node) => (Number.isFinite(node.scale) ? node.scale : 1) * rowScale(node.generation);
    const rowsByGen = new Map();
    for (const node of nodeList) {
      if (!rowsByGen.has(node.generation)) rowsByGen.set(node.generation, []);
      rowsByGen.get(node.generation).push(node);
    }
    const downOf = new Map();
    const upOf = new Map();
    for (const [gen, members] of rowsByGen) {
      let down = 0;
      let up = 0;
      for (const node of members) {
        // Our rendered content extents around the node anchor: the figure
        // rises ~40·s above it, the name/☆/† label block hangs ~95·s below
        // (the root medallion is its own 150/150 disc). The native contour
        // adds B = m·(0.1 + 0.4·pc) below and T = 0.25 above, unscaled shape.
        const scale = effScale(node);
        // Figure: seated +12 above the anchor, bust ~62·s tall on top of that.
        // Labels: name + ☆/† rows hang ~104·s below. Measured from the render.
        const top = node.featured ? 150 : 12 + 84 * scale;
        const bottom = node.featured ? 150 : 92 * scale;
        node.contentTop = top;
        node.contentBottom = bottom;
        down = Math.max(down, bottom + U * scale * (0.1 + 0.4 * pcFactor));
        up = Math.max(up, top + 0.25 * U);
      }
      downOf.set(gen, down);
      upOf.set(gen, up);
    }
    const yByGen = new Map([[0, 0]]);
    for (let gen = -1; rowsByGen.has(gen); gen -= 1) {
      yByGen.set(gen, (yByGen.get(gen + 1) ?? 0) + downOf.get(gen) + upOf.get(gen + 1));
    }
    for (let gen = 1; rowsByGen.has(gen); gen += 1) {
      yByGen.set(gen, (yByGen.get(gen - 1) ?? 0) - (downOf.get(gen - 1) + upOf.get(gen)));
    }
    for (const node of nodeList) {
      if (yByGen.has(node.generation)) node.y = yByGen.get(node.generation);
    }
  }
  const visibleIds = new Set(nodeList.map((node) => node.id));

  const addSegment = (familyId, type, emphasis, a, b, nodeIds = []) => {
    // Always draw the full segment. (A previous build split long horizontal
    // sibling buses into two end-stubs with a gap, which read as "broken"
    // connectors on a dense full tree.)
    addPolyline(familyId, type, emphasis, [a, b], nodeIds);
  };
  // Generation of the family currently being routed. Connectors inherit it so
  // the "By Generation, Light" colour mode can tint each link by the row it
  // feeds into, matching the native multi-hue look. `routingColorClass` carries
  // the native lineage hue (root=purple, descend=magenta, paternal=red husband
  // line, maternal=green wife line) for the "By Lineage" colour mode.
  let routingGeneration = 0;
  let routingColorClass = 'descend';
  // Native adds the union's relation order into the colour level (a second
  // marriage of the same person draws the NEXT wheel hue — olive next to
  // maroon in the reference), so links carry it alongside the generation.
  let routingRelationOrder = 0;
  let routingChildOrder = 0;
  const addPolyline = (familyId, type, emphasis, points, nodeIds = []) => {
    routedLinks.push({
      key: `${familyId}:${type}:${routedLinks.length}`,
      familyId,
      type,
      emphasis,
      points,
      nodeIds,
      generation: routingGeneration,
      relationOrder: routingRelationOrder,
      childOrder: routingChildOrder,
      colorClass: routingColorClass,
    });
  };
  // Native parentsRelationOrder: each ADDITIONAL union of the same person
  // shifts its couple bar one lane toward the parents (-0.1 native × order,
  // ≈ 7.3 web units, orders ≤ 5 only) so remarriage bars don't overlap.
  const unionCountByPerson = new Map();
  // Total displayed unions per person (used for the native attach-point rule:
  // when one parent has further unions, the child trunk hangs under the OTHER
  // parent instead of the couple midpoint — decompiled
  // setAttachPointForChildrenConnection: in the ancestors builder).
  const totalUnionsByPerson = new Map();
  for (const family of familyGraph.families || []) {
    const parents = (family.parents || []).filter((id) => visibleIds.has(id));
    const children = (family.children || []).filter((id) => visibleIds.has(id));
    if (parents.length === 0 || children.length === 0) continue;
    for (const parentId of parents) {
      totalUnionsByPerson.set(parentId, (totalUnionsByPerson.get(parentId) || 0) + 1);
    }
  }
  // Native childRelationOrder (decompiled buildAncestorsIfNecessary..., the
  // cinc at 0xc1d0): a running count of this parent's PRIOR families that
  // displayed at least one visible child. It feeds the child-bus lane (δc)
  // and, together with parentsRelationOrder, the connection colour level.
  const childOrderByPerson = new Map();
  for (const family of familyGraph.families || []) {
    const parents = (family.parents || []).map((id) => nodeById.get(id)).filter((node) => node && visibleIds.has(node.id));
    const children = (family.children || []).map((id) => nodeById.get(id)).filter((node) => node && visibleIds.has(node.id));
    if (parents.length === 0 || children.length === 0) continue;
    const unionOrder = Math.max(...parents.map((parent) => unionCountByPerson.get(parent.id) || 0));
    const childOrder = Math.max(...parents.map((parent) => childOrderByPerson.get(parent.id) || 0));
    for (const parent of parents) {
      unionCountByPerson.set(parent.id, (unionCountByPerson.get(parent.id) || 0) + 1);
      if (children.length > 0) childOrderByPerson.set(parent.id, (childOrderByPerson.get(parent.id) || 0) + 1);
    }
    routingRelationOrder = unionOrder;
    routingChildOrder = childOrder;
    const generation = children[0].generation;
    routingGeneration = generation;
    // Native lineage colouring: root's family (children at gen 0) draws purple;
    // ancestor families two-or-more generations up (children at gen <= -2) draw
    // red when the lineage child is male (husband line) and green when female
    // (wife line); everything else (the magenta descendant flow) is "descend".
    const lineageChild = lineageChildId.get(family.id);
    const lineageGender = lineageChild ? sourceNodes.get(lineageChild)?.person?.gender : null;
    if (generation === 0) routingColorClass = 'root';
    else if (generation <= -2) routingColorClass = lineageGender === Gender.Female ? 'maternal' : 'paternal';
    else routingColorClass = 'descend';
    const childY = rowY(generation);
    const parentY = parents[0].y;
    const direction = Math.sign(parentY - childY || 1);
    const emphasis = family.id === rootFamily?.id || family.parents.some((id) => id === familyGraph.rootId);

    // ONE connector assembly per family — the native FamilyConnectionObject
    // model, decompiled (docs/mft-decompile-reports + routing pass):
    //  · couple bar runs between the spouses' FACING slot edges at their
    //    center line (through the bodies), rings icon at the gap center Gx;
    //  · one straight trunk at Gx from the bar down to the sibling crossbar
    //    (no dogleg — the crossbar expands to include Gx instead);
    //  · the crossbar sits at the MIDPOINT of the free gutter between the
    //    parents' child-facing slot edge and the nearest child's parent-facing
    //    slot edge (no fixed clearance constant);
    //  · EVERY visible child gets a drop from the crossbar to its slot edge;
    //    only the two outer drops bend (rounded corner), middle drops T-join.
    // Slot = the native 1×1 allocated rect: half-extent 29 web units × scale.
    const slotHalf = (node) => 29 * (Number.isFinite(node.scale) ? node.scale : 1);
    const sortedChildren = [...children].sort((a, b) => a.x - b.x);
    const edgeOf = (child) => child.y + direction * (child.featured ? nodeVerticalRadius(child) : slotHalf(child));
    const parentFarEdge = direction > 0
      ? Math.min(...parents.map((parent) => parent.y - slotHalf(parent)))
      : Math.max(...parents.map((parent) => parent.y + slotHalf(parent)));
    const childNearEdge = direction > 0
      ? Math.max(...sortedChildren.map(edgeOf))
      : Math.min(...sortedChildren.map(edgeOf));
    const childBusY = (parentFarEdge + childNearEdge) / 2;
    const laneOffset = unionOrder <= 5
      ? direction * 7.3 * unionOrder * Math.min(...parents.map((parent) => Number.isFinite(parent.scale) ? parent.scale : 1))
      : 0;
    const coupleBarY = average(parents.map((parent) => parent.y)) + laneOffset;
    const parentIds = parents.map((parent) => parent.id);

    let trunkTop;
    if (parents.length > 1) {
      // Couple bar between facing slot edges; ⚭ marker at the gap center.
      const sortedParents = [...parents].sort((a, b) => a.x - b.x);
      const leftEdge = sortedParents[0].x + slotHalf(sortedParents[0]);
      const rightEdge = sortedParents[sortedParents.length - 1].x - slotHalf(sortedParents[sortedParents.length - 1]);
      const gapCenter = (leftEdge + rightEdge) / 2;
      addSegment(family.id, 'family', emphasis,
        { x: Math.min(...sortedParents.map((p) => p.x)), y: coupleBarY },
        { x: Math.max(...sortedParents.map((p) => p.x)), y: coupleBarY }, parentIds);
      const coupleBar = routedLinks[routedLinks.length - 1];
      if (coupleBar) coupleBar.coupleMark = { x: gapCenter, y: coupleBarY };
      // Native attach point: midpoint of the couple bar UNLESS one parent has
      // further displayed unions — then the trunk hangs under the other
      // (single-union) parent, keeping the busy parent's side clear for the
      // next union's bar (the reference shows the red trunk under قاسم).
      const unionsOf = (parent) => totalUnionsByPerson.get(parent.id) || 1;
      const busyParents = sortedParents.filter((parent) => unionsOf(parent) > 1);
      if (busyParents.length === 1 && sortedParents.length === 2) {
        const calm = sortedParents.find((parent) => unionsOf(parent) <= 1);
        trunkTop = { x: calm.x, y: coupleBarY };
      } else {
        trunkTop = { x: gapCenter, y: coupleBarY };
      }
    } else {
      // Single parent: the trunk starts at the figure's child-facing edge.
      trunkTop = { x: parents[0].x, y: parents[0].y - direction * slotHalf(parents[0]) };
    }
    // Native child-lane offset δc: each additional union's crossbar shifts one
    // lane TOWARD the children (0.1 native units × order) so two families'
    // buses on the same gutter never overlap — the red/green lanes of the
    // reference remarriage close-up.
    const laneShift = childOrder > 0
      ? -direction * 5.8 * (childOrder % 7) * Math.min(...parents.map((parent) => Number.isFinite(parent.scale) ? parent.scale : 1))
      : 0;
    const busLaneY = childBusY + laneShift;

    if (sortedChildren.length === 1) {
      const only = sortedChildren[0];
      if (Math.abs(only.x - trunkTop.x) <= 1) {
        // Single aligned child: straight trunk continuing into the drop.
        addSegment(family.id, 'family', emphasis,
          trunkTop, { x: trunkTop.x, y: busLaneY }, parentIds);
        addSegment(family.id, 'family', emphasis,
          { x: only.x, y: busLaneY }, { x: only.x, y: edgeOf(only) - direction * 1.6 }, [only.id]);
      } else {
        // Single offset child: ONE rounded path — trunk down, lane across,
        // drop into the child (the big curved corners of the reference's
        // remarriage routing).
        addPolyline(family.id, 'family', emphasis, [
          trunkTop,
          { x: trunkTop.x, y: busLaneY },
          { x: only.x, y: busLaneY },
          { x: only.x, y: edgeOf(only) - direction * 1.6 },
        ], [...parentIds, only.id]);
      }
    } else {
      // Straight trunk at Gx down to the crossbar lane.
      addSegment(family.id, 'family', emphasis,
        trunkTop, { x: trunkTop.x, y: busLaneY }, parentIds);
      const first = sortedChildren[0];
      const last = sortedChildren[sortedChildren.length - 1];
      // Outer drops + crossbar as one rounded U (native bends only these two
      // corners, capped at ~22 web units by the renderer).
      addPolyline(family.id, 'family', emphasis, [
        { x: first.x, y: edgeOf(first) - direction * 1.6 },
        { x: first.x, y: busLaneY },
        { x: last.x, y: busLaneY },
        { x: last.x, y: edgeOf(last) - direction * 1.6 },
      ], sortedChildren.map((child) => child.id));
      // Crossbar expansion so the trunk always lands on it (native enlarges
      // the crossbar extent to include Gx instead of dog-legging the trunk).
      const busMinX = Math.min(first.x, last.x);
      const busMaxX = Math.max(first.x, last.x);
      if (trunkTop.x < busMinX - 1 || trunkTop.x > busMaxX + 1) {
        const nearest = trunkTop.x < busMinX ? busMinX : busMaxX;
        addSegment(family.id, 'family', emphasis,
          { x: trunkTop.x, y: busLaneY }, { x: nearest, y: busLaneY }, parentIds);
      }
      // Middle children: straight T-join drops, one per visible child.
      for (let i = 1; i < sortedChildren.length - 1; i += 1) {
        const child = sortedChildren[i];
        addSegment(family.id, 'family', emphasis,
          { x: child.x, y: busLaneY }, { x: child.x, y: edgeOf(child) - direction * 1.6 }, [child.id]);
      }
    }
  }

  // All routed links already reference only visible nodes (filtered above).
  const visibleLinks = routedLinks;
  const visibleBands = buildBands(nodeList, rootX, options.generationBandsSegmentByPedigree !== false, rowScale);
  const bounds = boundsFor(nodeList, visibleBands, visibleLinks);
  const viewBounds = focusBoundsFor(nodeList, visibleBands, bounds);
  return { nodes: nodeList, links: visibleLinks, bands: visibleBands, bounds, viewBounds };
}

function orderGeneration(group, rootId) {
  return [...group].sort((a, b) => {
    const ap = nodePriority(a, rootId);
    const bp = nodePriority(b, rootId);
    if (ap !== bp) return ap - bp;
    // Native effective default child sort (decompiled allChildRelationDictionaries
    // mode 0): NAME ascending, birth date DESCENDING as the tiebreak.
    return a.person.fullName.localeCompare(b.person.fullName)
      || (b.person.birthDate || '').localeCompare(a.person.birthDate || '');
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

function buildBands(nodes, rootX = 0, segmentByPedigree = true, rowScale = () => 1) {
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
    // Tray hugs the row's measured content: figure tops above the anchors,
    // label blocks below — and shifts its centre down accordingly so nothing
    // hangs off the slab.
    const maxTop = Math.max(...group.map((node) => node.contentTop ?? 40));
    const maxBottom = Math.max(...group.map((node) => node.contentBottom ?? 93));
    const height = generation === 0 ? 286 : Math.max(64, maxTop + maxBottom + 18);
    const title =
      generation === 0
        ? 'Root Generation'
        : generation < 0
          ? `Generation ${Math.abs(generation)}`
          : `Descendant Generation ${generation}`;
    // Content hangs BELOW the anchors (labels) more than above (figure tops),
    // so the tray centre sits below the row's anchor line by half the
    // difference — keeps figures and labels inside the slab.
    const bandY = generation === 0
      ? centerY
      : centerY - ((Math.max(...group.map((node) => node.contentBottom ?? 93))
        - Math.max(...group.map((node) => node.contentTop ?? 40))) / 2);
    return {
      generation,
      x: (minX + maxX) / 2,
      y: bandY,
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
  const minWidth = generation === 0 ? 460 : 150;
  const padding = generation === 0 ? 340 : 48;
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
    // Native "blood group": a local group is blood-related when ANY member is
    // on the direct line (root/ancestor/descendant). Prominent band styles
    // raise blood groups higher and desaturation applies to the others.
    const blood = holder.some((node) => node.featured || node.lineage !== false);
    segments.push({ x: (left + right) / 2, width: right - left, blood });
    isFirst = false;
  }
  // Native slabs carry ±0.2S margins around their people, so ADJACENT groups'
  // margined extents overlap and fuse into one continuous surface (the
  // reference pink slab holds صبرية/فوزية/سامي unbroken), while genuinely
  // distant blocks keep real spacing. Merge close neighbours outright.
  const merged = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    if (previous) {
      const gap = (segment.x - segment.width / 2) - (previous.x + previous.width / 2);
      if (gap < 60) {
        const left = previous.x - previous.width / 2;
        const right = segment.x + segment.width / 2;
        previous.x = (left + right) / 2;
        previous.width = right - left;
        previous.blood = previous.blood || segment.blood;
        continue;
      }
    }
    merged.push(segment);
  }
  return merged;
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
  if (node.featured) return MAC_FAMILY_GRAPH_LAYOUT.featuredConnectorRadius;
  // Scaled (minified or lineage-enlarged) figures attach connectors at their
  // scaled extent so drops meet the head instead of over/undershooting.
  const scale = Number.isFinite(node.scale) ? node.scale : 1;
  return MAC_FAMILY_GRAPH_LAYOUT.regularConnectorRadius * scale;
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
