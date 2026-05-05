const DEFAULT_NODE = { width: 180, height: 54 };
const DEFAULT_SPACING = { horizontal: 24, vertical: 110, branch: 44 };
const ROOT_KEY = 'root';

export function layoutFamilyChart({
  ancestorTree,
  descendantTree,
  rootId,
  theme,
  spacing = DEFAULT_SPACING,
  collapseDuplicates = true,
  showKinships = false,
}) {
  const nodeSize = {
    width: theme?.nodeWidth || DEFAULT_NODE.width,
    height: theme?.nodeHeight || DEFAULT_NODE.height,
  };
  const sp = {
    horizontal: spacing?.horizontal ?? DEFAULT_SPACING.horizontal,
    vertical: spacing?.vertical ?? DEFAULT_SPACING.vertical,
    branch: spacing?.branch ?? DEFAULT_SPACING.branch,
  };
  const nodes = [];
  const links = [];
  const duplicateGroups = new Map();
  const seenCouples = new Map();
  const kinshipById = showKinships ? calculateKinshipLabels(ancestorTree, descendantTree, rootId) : new Map();
  const rootPerson = descendantTree?.person || ancestorTree?.person || null;

  const descendantLayout = descendantTree
    ? measureDescendant(descendantTree, {
      nodeSize,
      sp,
      collapseDuplicates,
      seenCouples,
      duplicateGroups,
      rootId,
      depth: 0,
    })
    : null;
  const ancestorLayout = ancestorTree
    ? layoutAncestorsAsCouples(ancestorTree, {
      nodeSize,
      sp,
      generations: maxAncestorDepth(ancestorTree),
    })
    : null;

  const rootOwnWidth = rootPerson ? nodeSize.width : 0;
  const rootX = ancestorLayout
    ? ancestorLayout.rootX
    : descendantLayout
      ? descendantLayout.rootX
      : 0;
  const rootY = ancestorLayout ? ancestorLayout.height + sp.vertical : 0;

  if (ancestorLayout) {
    for (const node of ancestorLayout.nodes) {
      nodes.push(withKinship(node, kinshipById));
    }
    for (const link of ancestorLayout.links) links.push(link);
    if (rootPerson) {
      links.push({
        kind: 'ancestor-root',
        d: orthogonalPath(
          ancestorLayout.rootX + nodeSize.width / 2,
          ancestorLayout.height,
          rootX + nodeSize.width / 2,
          rootY
        ),
      });
    }
  }

  if (rootPerson) {
    nodes.push(withKinship({
      id: `${ROOT_KEY}:${rootPerson.recordName}`,
      x: rootX,
      y: rootY,
      person: rootPerson,
      role: 'root',
    }, kinshipById));
  }

  if (descendantLayout) {
    const dx = rootX - descendantLayout.rootX;
    const dy = rootY - descendantLayout.rootY;
    for (const node of descendantLayout.nodes) {
      if (node.role === 'root') continue;
      nodes.push(withKinship({ ...node, x: node.x + dx, y: node.y + dy }, kinshipById));
    }
    for (const link of descendantLayout.links) {
      links.push({ ...link, d: shiftPath(link.d, dx, dy) });
    }
  }

  const extents = calculateExtents(nodes, links, nodeSize);
  const offsetX = Math.max(0, -extents.minX) + sp.branch;
  const offsetY = Math.max(0, -extents.minY) + sp.branch;

  return {
    nodes: nodes.map((node) => ({ ...node, x: node.x + offsetX, y: node.y + offsetY })),
    links: links.map((link) => ({ ...link, d: shiftPath(link.d, offsetX, offsetY) })),
    duplicateCount: [...duplicateGroups.values()].filter((group) => group.length > 1).length,
    width: extents.maxX - extents.minX + sp.branch * 2,
    height: extents.maxY - extents.minY + sp.branch * 2,
  };

  function withKinship(node, labels) {
    if (!node.person?.recordName || !labels.size) return node;
    return { ...node, kinship: labels.get(node.person.recordName) || '' };
  }
}

function measureDescendant(node, ctx) {
  const { nodeSize, sp, collapseDuplicates, seenCouples, duplicateGroups, rootId, depth } = ctx;
  const unions = node?.unions || [];
  const spouseCount = unions.length || 0;
  const ownWidth = nodeSize.width + spouseCount * (nodeSize.width + sp.horizontal);
  const measuredUnions = [];
  let childWidth = 0;
  let childCount = 0;

  unions.forEach((union, unionIndex) => {
    const coupleKey = makeCoupleKey(node.person, union.partner, union.familyRecordName);
    const duplicate = collapseDuplicates && coupleKey && seenCouples.has(coupleKey);
    if (coupleKey) {
      if (!duplicateGroups.has(coupleKey)) duplicateGroups.set(coupleKey, []);
      duplicateGroups.get(coupleKey).push({ person: node.person?.recordName, partner: union.partner?.recordName });
    }
    if (coupleKey && !seenCouples.has(coupleKey)) seenCouples.set(coupleKey, true);
    const children = duplicate ? [] : (union.children || []).map((child) => {
      const childLayout = measureDescendant(child, {
      ...ctx,
      depth: depth + 1,
      });
      return {
        ...childLayout,
        relationKind: child.relationKind || 'primary',
        relationLabel: child.relationLabel || '',
      };
    });
    const width = children.reduce((sum, child, index) => sum + child.width + (index ? sp.branch : 0), 0);
    childWidth += width + (width && childCount ? sp.branch : 0);
    childCount += width ? 1 : 0;
    measuredUnions.push({ union, unionIndex, duplicate, children, width });
  });

  const width = Math.max(ownWidth, childWidth || ownWidth);
  const layout = {
    width,
    rootX: (width - ownWidth) / 2,
    rootY: 0,
    nodes: [],
    links: [],
    person: node.person,
  };
  positionDescendant(layout, node, measuredUnions, {
    ...ctx,
    left: 0,
    top: 0,
    ownWidth,
    rootId,
  });
  return layout;
}

function positionDescendant(layout, node, measuredUnions, ctx) {
  const { nodeSize, sp, left, top, ownWidth, rootId } = ctx;
  const selfX = left + (layout.width - ownWidth) / 2;
  const selfY = top;
  const selfAnchor = centerBottom(selfX, selfY, nodeSize);
  layout.rootX = selfX;
  layout.rootY = selfY;
  layout.nodes.push({
    id: `${node.person?.recordName || 'missing'}-${top}`,
    x: selfX,
    y: selfY,
    person: node.person,
    placeholder: !node.person,
    role: node.person?.recordName === rootId ? 'root' : 'descendant',
  });

  let spouseX = selfX + nodeSize.width + sp.horizontal;
  let childCursor = left + (layout.width - measuredUnions.reduce((sum, item, index) => sum + item.width + (item.width && index ? sp.branch : 0), 0)) / 2;
  measuredUnions.forEach((item) => {
    const { union, duplicate, children } = item;
    const partner = union.partner || null;
    const partnerNode = {
      id: `partner-${union.familyRecordName || spouseX}`,
      x: spouseX,
      y: selfY,
      person: partner,
      placeholder: !partner,
      role: partner ? 'spouse' : 'placeholder-spouse',
      collapsedDuplicate: duplicate,
    };
    layout.nodes.push(partnerNode);
    const partnerCenter = center(partnerNode.x, partnerNode.y, nodeSize);
    const selfCenter = center(selfX, selfY, nodeSize);
    layout.links.push({ kind: duplicate ? 'duplicate-marriage' : 'marriage', d: `M ${selfCenter.x} ${selfCenter.y} H ${partnerCenter.x}` });

    const familyX = (selfCenter.x + partnerCenter.x) / 2;
    const familyY = selfY + nodeSize.height;
    if (duplicate) {
      const badgeY = selfY + nodeSize.height + 18;
      layout.links.push({ kind: 'duplicate-stub', d: `M ${familyX} ${familyY} V ${badgeY}` });
    } else if (children.length) {
      const childTop = top + nodeSize.height + sp.vertical;
      const anchors = [];
      children.forEach((childLayout, index) => {
        if (index) childCursor += sp.branch;
        shiftLayout(childLayout, childCursor, childTop);
        layout.nodes.push(...childLayout.nodes);
        layout.links.push(...childLayout.links);
        anchors.push({
          x: childLayout.rootX + childCursor + nodeSize.width / 2,
          y: childTop,
          relationKind: childLayout.relationKind,
          relationLabel: childLayout.relationLabel,
        });
        childCursor += childLayout.width;
      });
      const busY = top + nodeSize.height + sp.vertical / 2;
      const minX = Math.min(...anchors.map((anchor) => anchor.x));
      const maxX = Math.max(...anchors.map((anchor) => anchor.x));
      layout.links.push({ kind: 'down', d: `M ${familyX} ${familyY} V ${busY}` });
      layout.links.push({ kind: 'bus', d: `M ${minX} ${busY} H ${maxX}` });
      anchors.forEach((anchor) => layout.links.push({
        kind: anchor.relationKind === 'secondary' ? 'secondary-child' : 'child',
        label: anchor.relationLabel,
        d: `M ${anchor.x} ${busY} V ${anchor.y}`,
      }));
    }
    spouseX += nodeSize.width + sp.horizontal;
  });
}

function layoutAncestorsAsCouples(tree, ctx) {
  const { nodeSize, sp, generations } = ctx;
  const rowGap = sp.vertical;
  const colGap = nodeSize.width + sp.horizontal;
  const nodes = [];
  const links = [];
  const rootX = Math.max(0, (2 ** Math.max(0, generations - 1)) * (nodeSize.width + sp.branch) / 2);

  function visit(node, generation, slotStart, slotSize, childAnchor) {
    if (!node || generation > generations) return null;
    const y = (generations - generation) * (nodeSize.height + rowGap);
    const slotCenter = (slotStart + slotSize / 2) * (nodeSize.width + sp.branch);
    const x = generation === 0 ? rootX : slotCenter - nodeSize.width / 2;
    const personNode = {
      id: `ancestor-${generation}-${node.person?.recordName || slotStart}`,
      x,
      y,
      person: node.person,
      placeholder: !node.person,
      role: generation === 0 ? 'ancestor-root' : 'ancestor',
    };
    nodes.push(personNode);
    if (childAnchor) {
      const anchor = centerBottom(x, y, nodeSize);
      links.push({ kind: 'ancestor', d: orthogonalPath(anchor.x, anchor.y, childAnchor.x, childAnchor.y) });
    }
    if (!node.father && !node.mother) return { x: x + nodeSize.width / 2, y };
    const half = slotSize / 2 || 0.5;
    const father = visit(node.father || { person: null }, generation + 1, slotStart, half, { x: x + nodeSize.width / 2, y });
    const mother = visit(node.mother || { person: null }, generation + 1, slotStart + half, half, { x: x + nodeSize.width / 2, y });
    if (father && mother) {
      const fatherCenter = { x: father.x, y: father.y + nodeSize.height / 2 };
      const motherCenter = { x: mother.x, y: mother.y + nodeSize.height / 2 };
      links.push({ kind: 'ancestor-marriage', d: `M ${fatherCenter.x} ${fatherCenter.y} H ${motherCenter.x}` });
    }
    return { x: x + nodeSize.width / 2, y };
  }

  visit(tree, 0, 0, 2 ** Math.max(0, generations - 1), null);
  return {
    nodes: nodes.filter((node) => node.role !== 'ancestor-root'),
    links,
    rootX,
    height: generations * (nodeSize.height + rowGap),
  };
}

function calculateKinshipLabels(ancestorTree, descendantTree, rootId) {
  const graph = buildKinshipGraph(ancestorTree, descendantTree);
  const labels = new Map();
  if (!rootId || !graph.has(rootId)) return labels;
  const queue = [{ id: rootId, ups: 0, downs: 0, spouses: 0, path: [rootId] }];
  const seen = new Set([rootId]);
  labels.set(rootId, 'Self');
  while (queue.length) {
    const current = queue.shift();
    for (const edge of graph.get(current.id) || []) {
      if (seen.has(edge.id)) continue;
      const next = {
        id: edge.id,
        ups: current.ups + (edge.kind === 'parent' ? 1 : 0),
        downs: current.downs + (edge.kind === 'child' ? 1 : 0),
        spouses: current.spouses + (edge.kind === 'spouse' ? 1 : 0),
        path: [...current.path, edge.id],
      };
      seen.add(edge.id);
      labels.set(edge.id, relationshipLabel(next, graph.get(edge.id)?.person));
      queue.push(next);
    }
  }
  return labels;
}

function buildKinshipGraph(ancestorTree, descendantTree) {
  const graph = new Map();
  const addPerson = (person) => {
    if (!person?.recordName) return;
    if (!graph.has(person.recordName)) graph.set(person.recordName, []);
    graph.get(person.recordName).person = person;
  };
  const addEdge = (from, to, kind) => {
    if (!from?.recordName || !to?.recordName) return;
    addPerson(from);
    addPerson(to);
    graph.get(from.recordName).push({ id: to.recordName, kind });
  };
  const visitAncestor = (node) => {
    if (!node?.person) return;
    addPerson(node.person);
    if (node.father?.person) {
      addEdge(node.person, node.father.person, 'parent');
      addEdge(node.father.person, node.person, 'child');
    }
    if (node.mother?.person) {
      addEdge(node.person, node.mother.person, 'parent');
      addEdge(node.mother.person, node.person, 'child');
    }
    if (node.father?.person && node.mother?.person) {
      addEdge(node.father.person, node.mother.person, 'spouse');
      addEdge(node.mother.person, node.father.person, 'spouse');
    }
    visitAncestor(node.father);
    visitAncestor(node.mother);
  };
  const visitDescendant = (node) => {
    if (!node?.person) return;
    addPerson(node.person);
    for (const union of node.unions || []) {
      if (union.partner) {
        addEdge(node.person, union.partner, 'spouse');
        addEdge(union.partner, node.person, 'spouse');
      }
      for (const child of union.children || []) {
        if (!child?.person) continue;
        addEdge(node.person, child.person, 'child');
        addEdge(child.person, node.person, 'parent');
        if (union.partner) {
          addEdge(union.partner, child.person, 'child');
          addEdge(child.person, union.partner, 'parent');
        }
        visitDescendant(child);
      }
    }
  };
  visitAncestor(ancestorTree);
  visitDescendant(descendantTree);
  return graph;
}

function relationshipLabel({ ups, downs, spouses }, person) {
  if (spouses === 1 && ups === 0 && downs === 0) return gendered(person, 'Husband', 'Wife', 'Spouse');
  if (spouses > 0 && ups === 0 && downs === 1) return gendered(person, 'Son-in-law', 'Daughter-in-law', 'Child-in-law');
  if (spouses > 0 && ups === 1 && downs === 1) return gendered(person, 'Brother-in-law', 'Sister-in-law', 'Sibling-in-law');
  if (ups === 1 && downs === 0) return gendered(person, 'Father', 'Mother', 'Parent');
  if (ups === 0 && downs === 1) return gendered(person, 'Son', 'Daughter', 'Child');
  if (ups === 1 && downs === 1) return gendered(person, 'Brother', 'Sister', 'Sibling');
  if (ups === 2 && downs === 0) return gendered(person, 'Grandfather', 'Grandmother', 'Grandparent');
  if (ups === 0 && downs === 2) return gendered(person, 'Grandson', 'Granddaughter', 'Grandchild');
  if (ups > 2 && downs === 0) return `${'Great-'.repeat(ups - 2)}${gendered(person, 'grandfather', 'grandmother', 'grandparent').toLowerCase()}`;
  if (ups === 0 && downs > 2) return `${'Great-'.repeat(downs - 2)}${gendered(person, 'grandson', 'granddaughter', 'grandchild').toLowerCase()}`;
  if (ups === 2 && downs === 1) return gendered(person, 'Uncle', 'Aunt', 'Aunt/Uncle');
  if (ups === 1 && downs === 2) return gendered(person, 'Nephew', 'Niece', 'Niece/Nephew');
  if (ups >= 2 && downs >= 2) {
    const degree = Math.min(ups, downs) - 1;
    const removed = Math.abs(ups - downs);
    return `${ordinal(degree)} Cousin${removed ? ` ${removed}x removed` : ''}`;
  }
  return `Relative (${ups} up / ${downs} down${spouses ? ` / ${spouses} spouse` : ''})`;
}

function gendered(person, male, female, fallback) {
  if (person?.gender === 0 || person?.gender === 'male') return male;
  if (person?.gender === 1 || person?.gender === 'female') return female;
  return fallback;
}

function ordinal(value) {
  const n = Number(value) || 0;
  const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

function makeCoupleKey(person, partner, familyRecordName) {
  const ids = [person?.recordName, partner?.recordName].filter(Boolean).sort();
  return ids.length >= 2 ? ids.join('+') : familyRecordName || ids[0] || '';
}

function maxAncestorDepth(tree) {
  if (!tree) return 0;
  return Math.max(maxAncestorDepth(tree.father), maxAncestorDepth(tree.mother)) + 1;
}

function center(x, y, nodeSize) {
  return { x: x + nodeSize.width / 2, y: y + nodeSize.height / 2 };
}

function centerBottom(x, y, nodeSize) {
  return { x: x + nodeSize.width / 2, y: y + nodeSize.height };
}

function orthogonalPath(x1, y1, x2, y2) {
  const midY = y1 + (y2 - y1) / 2;
  return `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
}

function shiftLayout(layout, dx, dy) {
  layout.nodes = layout.nodes.map((node) => ({ ...node, x: node.x + dx, y: node.y + dy }));
  layout.links = layout.links.map((link) => ({ ...link, d: shiftPath(link.d, dx, dy) }));
}

function shiftPath(path, dx, dy) {
  return String(path || '').replace(/([MLHV])\s*(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g, (match, command, x, y) => {
    if (command === 'H') return `H ${Number(x) + dx}`;
    if (command === 'V') return `V ${Number(x) + dy}`;
    return `${command} ${Number(x) + dx} ${Number(y) + dy}`;
  });
}

function calculateExtents(nodes, links, nodeSize) {
  const xs = [];
  const ys = [];
  nodes.forEach((node) => {
    xs.push(node.x, node.x + nodeSize.width);
    ys.push(node.y, node.y + nodeSize.height + (node.kinship ? 18 : 0));
  });
  links.forEach((link) => {
    const values = [...String(link.d || '').matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    for (let i = 0; i < values.length; i += 2) {
      xs.push(values[i]);
      if (values[i + 1] !== undefined) ys.push(values[i + 1]);
    }
  });
  return {
    minX: Math.min(0, ...xs),
    minY: Math.min(0, ...ys),
    maxX: Math.max(nodeSize.width, ...xs),
    maxY: Math.max(nodeSize.height, ...ys),
  };
}
