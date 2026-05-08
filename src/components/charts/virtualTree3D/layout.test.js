import { describe, expect, it } from 'vitest';
import { layoutVirtualTree3D } from './layout.js';

describe('layoutVirtualTree3D', () => {
  it('keeps ancestors and descendants on opposite sides of the root', () => {
    const layout = layoutVirtualTree3D([
      { id: 'root', name: 'Root', generation: 0, role: 'root' },
      { id: 'father', name: 'Father', generation: -1, role: 'ancestor' },
      { id: 'child', name: 'Child', generation: 1, role: 'descendant' },
    ], [
      { fromId: 'father', toId: 'root', kind: 'parent-of' },
      { fromId: 'root', toId: 'child', kind: 'parent-of' },
    ], { orientation: 'vertical', hSpacing: 20, vSpacing: 100 });

    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    expect(byId.get('father').y).toBeGreaterThan(byId.get('root').y);
    expect(byId.get('child').y).toBeLessThan(byId.get('root').y);
    expect(layout.connections).toHaveLength(2);
    expect(layout.bands.map((band) => band.generation)).toEqual([-1, 0, 1]);
  });

  it('uses the horizontal axis when requested', () => {
    const layout = layoutVirtualTree3D([
      { id: 'root', name: 'Root', generation: 0, role: 'root' },
      { id: 'child', name: 'Child', generation: 1, role: 'descendant' },
    ], [], { orientation: 'horizontal', vSpacing: 120 });

    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    expect(byId.get('child').x).toBeGreaterThan(byId.get('root').x);
    expect(layout.orientation).toBe('horizontal');
  });
});
