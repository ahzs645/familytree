/**
 * 2D chart coloring modes. MFT's `_Common_ColoringMode` exposes a full list of
 * aesthetic colorings (by generation, pedigree, gender, year, age, alternating,
 * uniform, …). The web port previously only colored by gender. This computes a
 * per-person `{ fill, stroke }` override that PersonNode already accepts, so no
 * per-chart changes are needed — ChartsApp threads it through `colorForPerson`.
 *
 * Modes that need layout context (generation / pedigree side / alternating)
 * read a precomputed index built by walking the ancestor + descendant trees;
 * the person-only modes (gender / birth year / age / uniform) are computed
 * directly from the person summary so they also work on non-tree charts.
 */

const CURRENT_YEAR = new Date().getFullYear();

export const CHART_COLORING_MODES = [
  { id: 'gender', label: 'By Gender' },
  { id: 'generation', label: 'By Generation' },
  { id: 'pedigree', label: 'By Pedigree (paternal / maternal)' },
  { id: 'birthYear', label: 'By Birth Year' },
  { id: 'ageAtDeath', label: 'By Age at Death' },
  { id: 'alternating', label: 'Alternating Generations' },
  { id: 'uniform', label: 'Uniform' },
];

const COLORING_MODE_IDS = new Set(CHART_COLORING_MODES.map((mode) => mode.id));

export function isChartColoringMode(value) {
  return COLORING_MODE_IDS.has(value);
}

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function hsl(h, s, l) {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

// Cool pink→lavender→blue ramp (matches the pedigree gradient used elsewhere).
function rampColor(t) {
  const hue = 330 - clamp01(t) * 90; // 330 (pink) → 240 (blue)
  return { fill: hsl(hue, 55, 88), stroke: hsl(hue, 48, 52) };
}

function yearOf(dateValue) {
  const match = String(dateValue || '').match(/-?\d{3,4}/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Walk the ancestor (father/mother) and descendant (unions[].children) trees
 * and record each person's generation (signed: ancestors positive, descendants
 * negative, root 0) and pedigree side (paternal / maternal / descendant / root).
 */
export function buildGenerationIndex({ ancestorTree, descendantTree } = {}) {
  const byId = new Map();
  let minGen = 0;
  let maxGen = 0;
  const put = (person, generation, side) => {
    if (!person?.recordName) return;
    const prev = byId.get(person.recordName);
    if (!prev || Math.abs(generation) < Math.abs(prev.generation)) byId.set(person.recordName, { generation, side });
    if (generation < minGen) minGen = generation;
    if (generation > maxGen) maxGen = generation;
  };
  const walkAncestors = (node, side) => {
    if (!node) return;
    const gen = node.generation || 0;
    put(node.person, gen, side);
    walkAncestors(node.father, gen === 0 ? 'paternal' : side);
    walkAncestors(node.mother, gen === 0 ? 'maternal' : side);
  };
  const walkDescendants = (node) => {
    if (!node) return;
    const gen = -(node.generation || 0);
    put(node.person, gen, 'descendant');
    for (const union of node.unions || []) {
      put(union.partner, gen, 'descendant');
      for (const child of union.children || []) walkDescendants(child);
    }
  };
  if (ancestorTree) walkAncestors(ancestorTree, 'root');
  if (descendantTree) walkDescendants(descendantTree);
  return { byId, minGen, maxGen };
}

/**
 * Resolve the `{ fill, stroke }` override for a person under the active mode.
 * Returns null to fall back to the theme's gender colors.
 */
export function chartColorForPerson(mode, person, generationIndex) {
  if (!person?.recordName || !mode || mode === 'gender') return null;
  if (mode === 'uniform') return { fill: 'hsl(210 60% 90%)', stroke: 'hsl(210 50% 55%)' };
  if (mode === 'birthYear') {
    const year = yearOf(person.birthDate);
    if (year == null) return null;
    return rampColor((year - 1500) / (CURRENT_YEAR - 1500));
  }
  if (mode === 'ageAtDeath') {
    const born = yearOf(person.birthDate);
    const died = yearOf(person.deathDate);
    if (born == null || died == null) return null;
    return rampColor((died - born) / 100);
  }
  const info = generationIndex?.byId?.get(person.recordName);
  if (!info) return null;
  if (mode === 'pedigree') {
    if (info.side === 'paternal') return { fill: 'hsl(212 60% 88%)', stroke: 'hsl(212 55% 52%)' };
    if (info.side === 'maternal') return { fill: 'hsl(340 60% 90%)', stroke: 'hsl(340 55% 56%)' };
    return { fill: 'hsl(48 60% 88%)', stroke: 'hsl(42 60% 50%)' };
  }
  if (mode === 'alternating') {
    const even = ((info.generation % 2) + 2) % 2 === 0;
    return even
      ? { fill: 'hsl(210 30% 92%)', stroke: 'hsl(210 25% 60%)' }
      : { fill: 'hsl(210 12% 84%)', stroke: 'hsl(210 12% 52%)' };
  }
  // generation
  const span = (generationIndex.maxGen - generationIndex.minGen) || 1;
  return rampColor((info.generation - generationIndex.minGen) / span);
}
