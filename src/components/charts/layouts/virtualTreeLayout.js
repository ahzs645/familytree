/**
 * Pure layout function for the Virtual Tree Diagram.
 *
 * A generic hierarchical tree layout that accepts a nested { person, children[] }
 * structure, plus orientation + spacing options. The descendant and tree-chart
 * data sources both convert to this shape via `normalizeToHierarchy()`.
 *
 * options: { orientation: 'vertical'|'horizontal', hSpacing, vSpacing, compact }
 */

const DEFAULTS = {
  orientation: 'vertical',
  hSpacing: 24,
  vSpacing: 110,
  compact: false,
};

/** Convert a descendant tree (unions + partners + children) into a flat hierarchy. */
export function hierarchyFromDescendants(root) {
  if (!root) return null;
  function visit(node) {
    const children = (node.unions || []).flatMap((u) => u.children.map(visit));
    return { person: node.person, children };
  }
  return visit(root);
}

/** Convert an ancestor tree into a hierarchy rooted at the proband (with father/mother as children). */
export function hierarchyFromAncestors(root) {
  if (!root) return null;
  function visit(node) {
    if (!node) return null;
    const kids = [];
    if (node.father) kids.push(visit(node.father));
    if (node.mother) kids.push(visit(node.mother));
    return { person: node.person, children: kids.filter(Boolean) };
  }
  return visit(root);
}

function subtreeSize(h, nodeSize, sp) {
  if (!h.children || h.children.length === 0) return { w: nodeSize.w, h: nodeSize.h };
  let w = 0;
  let h_ = 0;
  for (const c of h.children) {
    const s = subtreeSize(c, nodeSize, sp);
    if (sp.orientation === 'vertical') {
      w += s.w;
      h_ = Math.max(h_, s.h);
    } else {
      w = Math.max(w, s.w);
      h_ += s.h;
    }
  }
  if (sp.orientation === 'vertical') {
    w += (h.children.length - 1) * sp.hSpacing;
    return { w: Math.max(w, nodeSize.w), h: nodeSize.h + sp.vSpacing + h_ };
  } else {
    h_ += (h.children.length - 1) * sp.hSpacing;
    return { w: nodeSize.w + sp.vSpacing + w, h: Math.max(h_, nodeSize.h) };
  }
}

export function layoutVirtualTree(root, theme, options = {}) {
  if (!root) return { nodes: [], links: [], width: 0, height: 0 };
  const sp = { ...DEFAULTS, ...options };
  const nodeSize = { w: theme.nodeWidth, h: theme.nodeHeight };
  const nodes = [];
  const links = [];

  function place(h, offset) {
    const size = subtreeSize(h, nodeSize, sp);
    let x, y;
    if (sp.orientation === 'vertical') {
      x = offset.x + (size.w - nodeSize.w) / 2;
      y = offset.y;
    } else {
      x = offset.x;
      y = offset.y + (size.h - nodeSize.h) / 2;
    }
    nodes.push({ id: h.person?.recordName || Math.random().toString(36).slice(2), x, y, person: h.person, placeholder: !h.person });

    if (!h.children || h.children.length === 0) return { size, anchorX: x, anchorY: y };

    // Place children and draw links
    if (sp.orientation === 'vertical') {
      let cx = offset.x;
      const childY = y + nodeSize.h + sp.vSpacing;
      const anchors = [];
      for (const c of h.children) {
        const cs = subtreeSize(c, nodeSize, sp);
        const placed = place(c, { x: cx, y: childY });
        anchors.push({ x: placed.anchorX + nodeSize.w / 2, y: placed.anchorY });
        cx += cs.w + sp.hSpacing;
      }
      const midY = y + nodeSize.h + sp.vSpacing / 2;
      links.push({ d: `M ${x + nodeSize.w / 2} ${y + nodeSize.h} V ${midY}` });
      const minX = Math.min(...anchors.map((a) => a.x));
      const maxX = Math.max(...anchors.map((a) => a.x));
      if (anchors.length > 1) links.push({ d: `M ${minX} ${midY} H ${maxX}` });
      for (const a of anchors) links.push({ d: `M ${a.x} ${midY} V ${a.y}` });
    } else {
      let cy = offset.y;
      const childX = x + nodeSize.w + sp.vSpacing;
      const anchors = [];
      for (const c of h.children) {
        const cs = subtreeSize(c, nodeSize, sp);
        const placed = place(c, { x: childX, y: cy });
        anchors.push({ x: placed.anchorX, y: placed.anchorY + nodeSize.h / 2 });
        cy += cs.h + sp.hSpacing;
      }
      const midX = x + nodeSize.w + sp.vSpacing / 2;
      links.push({ d: `M ${x + nodeSize.w} ${y + nodeSize.h / 2} H ${midX}` });
      const minY = Math.min(...anchors.map((a) => a.y));
      const maxY = Math.max(...anchors.map((a) => a.y));
      if (anchors.length > 1) links.push({ d: `M ${midX} ${minY} V ${maxY}` });
      for (const a of anchors) links.push({ d: `M ${midX} ${a.y} H ${a.x}` });
    }

    return { size, anchorX: x, anchorY: y };
  }

  place(root, { x: 0, y: 0 });
  const size = subtreeSize(root, nodeSize, sp);
  return { nodes, links, width: size.w, height: size.h };
}
