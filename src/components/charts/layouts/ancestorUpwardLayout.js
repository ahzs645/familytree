/**
 * Upward-growing ancestor layout: proband at bottom center, ancestors stacked
 * above with father-line on the left and mother-line on the right. Used by the
 * Hourglass and Symmetrical tree charts.
 */

const VERTICAL_GAP = 60;
const SIBLING_GAP = 24;

export function layoutAncestorsUpward(tree, generations, theme) {
  const slotsAtTop = Math.pow(2, Math.max(0, generations - 1));
  const slotWidth = theme.nodeWidth + SIBLING_GAP;
  const rowHeight = theme.nodeHeight + VERTICAL_GAP;
  const totalWidth = slotsAtTop * slotWidth;
  const totalHeight = generations * rowHeight;
  const nodes = [];
  const links = [];

  function place(node, gen, slotStart, slotSize) {
    const rowY = (generations - 1 - gen) * rowHeight;
    const centerX = (slotStart + slotSize / 2) * slotWidth;
    const x = centerX - theme.nodeWidth / 2;
    const y = rowY;
    const id = `anc-${gen}-${slotStart}`;
    nodes.push({ id, x, y, centerX, person: node?.person || null, placeholder: !node?.person });
    if (gen + 1 >= generations) return { id, x, y, centerX };
    const half = slotSize / 2;
    const father = place(node?.father || null, gen + 1, slotStart, half);
    const mother = place(node?.mother || null, gen + 1, slotStart + half, half);
    const childTopY = y;
    const parentBottomY = father.y + theme.nodeHeight;
    const midY = (childTopY + parentBottomY) / 2;
    links.push({ d: `M ${centerX} ${childTopY} V ${midY}` });
    links.push({ d: `M ${father.centerX} ${parentBottomY} V ${midY}` });
    links.push({ d: `M ${mother.centerX} ${parentBottomY} V ${midY}` });
    links.push({ d: `M ${father.centerX} ${midY} H ${mother.centerX}` });
    return { id, x, y, centerX };
  }

  place(tree, 0, 0, slotsAtTop);
  const probandX = totalWidth / 2;
  const probandY = (generations - 1) * rowHeight;
  return { nodes, links, width: totalWidth, height: totalHeight, probandX, probandY };
}
