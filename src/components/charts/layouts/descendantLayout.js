/**
 * Pure layout function for the Descendant chart.
 *
 * The descendant tree is variable-fanout: each person can have multiple unions,
 * and each union can have multiple children. We compute the subtree width
 * bottom-up, then assign x positions left-to-right.
 */
const PARTNER_GAP = 16;
const SIBLING_GAP = 24;
const GENERATION_GAP = 110;

function partnersWidth(node, theme, options) {
  const base = theme.nodeWidth;
  if (options.showPartners === false || !node.unions || node.unions.length === 0) return base;
  let width = base;
  for (const u of node.unions) {
    if (u.partner) width += PARTNER_GAP + (options.indentPartners ? options.partnerIndent : 0) + theme.nodeWidth;
  }
  return width;
}

function subtreeWidth(node, theme, options) {
  if (!node) return 0;
  const own = partnersWidth(node, theme, options);
  if (!node.unions || node.unions.length === 0) return own;
  let childWidth = 0;
  let count = 0;
  for (const u of node.unions) {
    for (const c of u.children) {
      if (count > 0) childWidth += SIBLING_GAP;
      childWidth += subtreeWidth(c, theme, options);
      count++;
    }
  }
  return Math.max(own, childWidth);
}

export function layoutDescendants(tree, theme, rawOptions = {}) {
  const options = {
    showPartners: rawOptions.showPartners !== false,
    indentPartners: Boolean(rawOptions.indentPartners),
    partnerIndent: Number.isFinite(rawOptions.partnerIndent) ? Math.max(0, rawOptions.partnerIndent) : 32,
  };
  const nodes = [];
  const links = [];

  function place(node, leftX, topY) {
    if (!node) return { width: 0, anchorX: leftX };
    const own = partnersWidth(node, theme, options);
    const totalSubtree = subtreeWidth(node, theme, options);

    // Center self+partners horizontally over the subtree
    const selfX = leftX + (totalSubtree - own) / 2;

    nodes.push({
      id: `n-${node.person?.recordName || Math.random()}`,
      x: selfX,
      y: topY,
      person: node.person,
      placeholder: !node.person,
    });

    let cursorX = selfX + theme.nodeWidth;
    const partnerNodes = [];
    for (const u of node.unions || []) {
      if (options.showPartners && u.partner) {
        cursorX += PARTNER_GAP + (options.indentPartners ? options.partnerIndent : 0);
        const px = cursorX;
        partnerNodes.push({ x: px, y: topY, partner: u.partner });
        nodes.push({
          id: `n-partner-${u.familyRecordName}`,
          x: px,
          y: topY,
          person: u.partner,
          placeholder: false,
        });
        // Marriage line
        links.push({
          kind: 'marriage',
          d: `M ${px - PARTNER_GAP} ${topY + theme.nodeHeight / 2} H ${px}`,
        });
        cursorX += theme.nodeWidth;
      }
    }

    // Place children
    let childX = leftX;
    let count = 0;
    const familyAnchor = { x: selfX + theme.nodeWidth / 2, y: topY + theme.nodeHeight };
    const childAnchors = [];
    for (const u of node.unions || []) {
      for (const c of u.children) {
        if (count > 0) childX += SIBLING_GAP;
        const w = subtreeWidth(c, theme, options);
        const childTop = topY + GENERATION_GAP;
        const placed = place(c, childX, childTop);
        childAnchors.push({ x: placed.anchorX + theme.nodeWidth / 2, y: childTop });
        childX += w;
        count++;
      }
    }
    if (childAnchors.length > 0) {
      const busY = topY + theme.nodeHeight + (GENERATION_GAP - theme.nodeHeight) / 2;
      links.push({ kind: 'down', d: `M ${familyAnchor.x} ${familyAnchor.y} V ${busY}` });
      const minX = Math.min(...childAnchors.map((a) => a.x));
      const maxX = Math.max(...childAnchors.map((a) => a.x));
      links.push({ kind: 'bus', d: `M ${minX} ${busY} H ${maxX}` });
      for (const a of childAnchors) {
        links.push({ kind: 'up', d: `M ${a.x} ${busY} V ${a.y}` });
      }
    }

    return { width: totalSubtree, anchorX: selfX };
  }

  place(tree, 0, 0);
  return { nodes, links };
}
