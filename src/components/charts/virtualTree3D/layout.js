/**
 * Pure layout for the Mac-style Virtual Tree 3D renderer.
 *
 * The Mac app keeps this responsibility in VirtualTreeBuilder and related
 * tree-object classes. On the web side we keep it serializable: chart data
 * comes in as nodes + connections, and this module turns that into stable
 * Three.js coordinates plus generation-band metadata.
 */

const DEFAULT_OPTIONS = {
  hSpacing: 24,
  vSpacing: 110,
  orientation: 'vertical',
};

const BASE_SIBLING_SPACING = 92;
const BASE_GENERATION_SPACING = 148;
const PARTNER_NUDGE = 24;

function numericGeneration(node) {
  const generation = Number.isFinite(node?.generation) ? node.generation : node?.depth;
  return Number.isFinite(generation) ? generation : 0;
}

function nodeSortKey(node) {
  const roleWeight = node.role === 'root' ? -3 : node.role === 'partner' ? -2 : 0;
  return `${roleWeight}:${node.name || ''}:${node.id || ''}`;
}

function boundsFor(positioned) {
  if (!positioned.length) {
    return { minX: -200, minY: -160, minZ: -80, maxX: 200, maxY: 160, maxZ: 120, width: 400, height: 320, depth: 200 };
  }
  const seed = positioned[0];
  const bounds = positioned.reduce((acc, node) => ({
    minX: Math.min(acc.minX, node.x),
    minY: Math.min(acc.minY, node.y),
    minZ: Math.min(acc.minZ, node.z),
    maxX: Math.max(acc.maxX, node.x),
    maxY: Math.max(acc.maxY, node.y),
    maxZ: Math.max(acc.maxZ, node.z),
  }), { minX: seed.x, minY: seed.y, minZ: seed.z, maxX: seed.x, maxY: seed.y, maxZ: seed.z });
  return {
    ...bounds,
    width: Math.max(1, bounds.maxX - bounds.minX),
    height: Math.max(1, bounds.maxY - bounds.minY),
    depth: Math.max(1, bounds.maxZ - bounds.minZ),
  };
}

function buildBands(positioned, bounds, orientation) {
  const generations = new Map();
  for (const node of positioned) {
    if (!generations.has(node.generation)) generations.set(node.generation, []);
    generations.get(node.generation).push(node);
  }
  return [...generations.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([generation, nodes]) => {
      const title = generation === 0
        ? 'Root Generation'
        : generation < 0
          ? `${Math.abs(generation)} ${Math.abs(generation) === 1 ? 'Generation' : 'Generations'} Back`
          : `${generation} ${generation === 1 ? 'Generation' : 'Generations'} Forward`;
      const minX = Math.min(...nodes.map((node) => node.x));
      const maxX = Math.max(...nodes.map((node) => node.x));
      const minY = Math.min(...nodes.map((node) => node.y));
      const maxY = Math.max(...nodes.map((node) => node.y));
      return {
        generation,
        title,
        count: nodes.length,
        x: orientation === 'horizontal' ? minX - 70 : (bounds.minX + bounds.maxX) / 2,
        y: orientation === 'horizontal' ? (bounds.minY + bounds.maxY) / 2 : minY - 70,
        width: orientation === 'horizontal' ? Math.max(120, maxX - minX + 140) : bounds.width + 260,
        height: orientation === 'horizontal' ? bounds.height + 220 : Math.max(120, maxY - minY + 140),
      };
    });
}

export function layoutVirtualTree3D(nodes = [], connections = [], options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const orientation = settings.orientation === 'horizontal' ? 'horizontal' : 'vertical';
  const siblingSpacing = BASE_SIBLING_SPACING + Math.max(0, Number(settings.hSpacing) || 0) * 2.4;
  const generationSpacing = BASE_GENERATION_SPACING + Math.max(0, Number(settings.vSpacing) || 0);

  const byGeneration = new Map();
  for (const node of nodes) {
    const generation = numericGeneration(node);
    if (!byGeneration.has(generation)) byGeneration.set(generation, []);
    byGeneration.get(generation).push(node);
  }

  const positioned = [];
  for (const [generation, peers] of byGeneration) {
    const ordered = [...peers].sort((a, b) => nodeSortKey(a).localeCompare(nodeSortKey(b)));
    const offset = -(ordered.length - 1) * siblingSpacing / 2;
    ordered.forEach((node, index) => {
      const peer = offset + index * siblingSpacing;
      const partnerOffset = node.role === 'partner' ? PARTNER_NUDGE : 0;
      const generationAxis = generation * generationSpacing;
      const x = orientation === 'horizontal' ? generationAxis : peer + partnerOffset;
      const y = orientation === 'horizontal' ? -peer + partnerOffset : -generationAxis;
      positioned.push({
        ...node,
        generation,
        x,
        y,
        z: node.role === 'root' ? 42 : 14 + Math.min(Math.abs(generation) * 8, 56),
      });
    });
  }

  const byId = new Map(positioned.map((node) => [node.id, node]));
  const visibleConnections = connections.filter((connection) => byId.has(connection.fromId) && byId.has(connection.toId));
  const bounds = boundsFor(positioned);
  const bands = buildBands(positioned, bounds, orientation);

  return {
    nodes: positioned,
    connections: visibleConnections,
    bands,
    bounds,
    byId,
    orientation,
  };
}
