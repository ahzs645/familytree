/**
 * Pure layout function for the Ancestor chart.
 * Given a nested ancestor tree, produces { nodes[], links[], width, height }.
 */
const COL_GAP = 40;
const ROW_HEIGHT = 70;

export function layoutAncestors(tree, generations, theme) {
  const slotsAtBottom = Math.pow(2, generations - 1);
  const totalHeight = slotsAtBottom * ROW_HEIGHT;
  const colWidth = theme.nodeWidth + COL_GAP;
  const totalWidth = generations * colWidth;
  const nodes = [];
  const links = [];

  function place(node, gen, slotStart, slotSize) {
    const x = gen * colWidth;
    const y = (slotStart + slotSize / 2) * ROW_HEIGHT - theme.nodeHeight / 2;
    const id = `${gen}-${slotStart}`;
    nodes.push({ id, x, y, person: node?.person || null, placeholder: !node?.person });
    if (gen + 1 >= generations) return { id, x, y };

    const half = slotSize / 2;
    const father = place(node?.father || null, gen + 1, slotStart, half);
    const mother = place(node?.mother || null, gen + 1, slotStart + half, half);

    links.push({
      from: { x: x + theme.nodeWidth, y: y + theme.nodeHeight / 2 },
      toFather: { x: father.x, y: father.y + theme.nodeHeight / 2 },
      toMother: { x: mother.x, y: mother.y + theme.nodeHeight / 2 },
    });
    return { id, x, y };
  }

  place(tree, 0, 0, slotsAtBottom);
  return { nodes, links, width: totalWidth, height: totalHeight };
}
