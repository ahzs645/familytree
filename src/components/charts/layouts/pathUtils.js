/**
 * translateSvgPath — offset an SVG path string by (dx, dy).
 *
 * Handles the absolute M/H/V commands emitted by the descendant layout, used
 * when an ancestor and descendant subtree are stitched together and one half
 * has to be shifted to align on the proband.
 */
export function translateSvgPath(d, dx, dy) {
  return d
    .replace(/M ([\d.]+) ([\d.]+)/g, (_, x, y) => `M ${parseFloat(x) + dx} ${parseFloat(y) + dy}`)
    .replace(/H ([\d.]+)/g, (_, x) => `H ${parseFloat(x) + dx}`)
    .replace(/V ([\d.]+)/g, (_, y) => `V ${parseFloat(y) + dy}`);
}
