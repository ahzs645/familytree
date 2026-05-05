import { describe, expect, it } from 'vitest';
import { buildSunTreeLayout } from './sunTreeLayout.js';
import { Gender } from '../../models/index.js';

function person(recordName, fullName, gender = Gender.UnknownGender) {
  return { recordName, fullName, gender };
}

describe('buildSunTreeLayout', () => {
  it('places the root in the center and descendants on rings', () => {
    const tree = {
      person: person('p1', 'Root Person', Gender.Male),
      unions: [
        {
          partner: person('p2', 'Partner Person', Gender.Female),
          children: [
            { person: person('p3', 'Child One'), unions: [] },
            { person: person('p4', 'Child Two'), unions: [] },
          ],
        },
      ],
    };

    const layout = buildSunTreeLayout(tree, { generationGap: 100, nodeRadius: 20 });
    const root = layout.nodes.find((node) => node.id === 'p1');
    const partner = layout.nodes.find((node) => node.id === 'p2');
    const child = layout.nodes.find((node) => node.id === 'p3');

    expect(root).toMatchObject({ x: 0, y: 0, generation: 0, kind: 'root' });
    expect(partner.generation).toBe(0);
    expect(Math.hypot(partner.x, partner.y)).toBeGreaterThan(0);
    expect(Math.hypot(child.x, child.y)).toBeCloseTo(100, 4);
    expect(layout.links.filter((link) => link.type === 'child')).toHaveLength(4);
    expect(layout.links.filter((link) => link.type === 'partner')).toHaveLength(1);
  });

  it('returns an empty layout for missing data', () => {
    const layout = buildSunTreeLayout(null);
    expect(layout.nodes).toEqual([]);
    expect(layout.rootId).toBeNull();
  });
});
