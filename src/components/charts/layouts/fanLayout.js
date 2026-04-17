/**
 * Pure layout function for the Fan chart.
 *
 * Each generation g (1..N) is a ring of width `ringWidth`.
 * The ring spans `arcDegrees` total (default 180° for half-fan, 360° for full-fan)
 * divided into 2^g equal slices. Each slice represents one ancestor slot.
 *
 * The proband (g=0) is a circle in the center.
 *
 * Returns { center, slices: [{path, midAngle, midRadius, person, placeholder, gen, slot}], proband }
 */

const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;

export function layoutFan(tree, generations, options = {}) {
  const arcDegrees = options.arcDegrees ?? 270; // default ¾ fan, leaves space below proband
  const ringWidth = options.ringWidth ?? 80;
  const probandRadius = options.probandRadius ?? 60;
  const startAngle = -arcDegrees / 2 - 90; // center the fan upward (12 o'clock)
  const arcRad = arcDegrees * DEG_TO_RAD;
  const startRad = startAngle * DEG_TO_RAD;

  const slices = [];

  function visit(node, gen, slot) {
    if (!node) return;
    if (gen === 0) {
      slices.push({ proband: true, person: node.person });
    } else {
      const slotsAtGen = Math.pow(2, gen);
      const sliceArc = arcRad / slotsAtGen;
      const a0 = startRad + slot * sliceArc;
      const a1 = a0 + sliceArc;
      const r0 = probandRadius + (gen - 1) * ringWidth;
      const r1 = r0 + ringWidth;
      const midAngle = (a0 + a1) / 2;
      const midRadius = (r0 + r1) / 2;
      slices.push({
        gen,
        slot,
        path: annularSliceD(r0, r1, a0, a1),
        midAngle,
        midRadius,
        person: node.person,
        placeholder: !node.person,
      });
    }

    if (gen + 1 >= generations) return;
    const childSlot = slot * 2;
    visit(node.father, gen + 1, childSlot);
    visit(node.mother, gen + 1, childSlot + 1);
  }

  visit(tree, 0, 0);

  const totalRadius = probandRadius + (generations - 1) * ringWidth;
  const size = totalRadius * 2 + 40;
  return { slices, totalRadius, size, probandRadius };
}

function annularSliceD(r0, r1, a0, a1) {
  const x0a = Math.cos(a0) * r0;
  const y0a = Math.sin(a0) * r0;
  const x1a = Math.cos(a1) * r0;
  const y1a = Math.sin(a1) * r0;
  const x0b = Math.cos(a0) * r1;
  const y0b = Math.sin(a0) * r1;
  const x1b = Math.cos(a1) * r1;
  const y1b = Math.sin(a1) * r1;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${x0a} ${y0a}`,
    `L ${x0b} ${y0b}`,
    `A ${r1} ${r1} 0 ${large} 1 ${x1b} ${y1b}`,
    `L ${x1a} ${y1a}`,
    `A ${r0} ${r0} 0 ${large} 0 ${x0a} ${y0a}`,
    'Z',
  ].join(' ');
}
