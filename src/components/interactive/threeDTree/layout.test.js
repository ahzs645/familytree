import { describe, expect, it } from 'vitest';
import { Gender } from '../../../models/index.js';
import { GEN_STEP, ROOT_CARD } from './constants.js';
import { bandSplitGap, buildInteractiveLayout } from './layout.js';

function person(recordName, fullName = recordName, extra = {}) {
  return {
    birthDate: '',
    deathDate: '',
    fullName,
    gender: Gender.UnknownGender,
    recordName,
    ...extra,
  };
}

function nodeById(layout) {
  return new Map(layout.nodes.map((node) => [node.id, node]));
}

describe('buildInteractiveLayout', () => {
  it('merges ancestor and descendant trees around one featured root', () => {
    const root = person('root', 'Root Person', { birthDate: '1900' });
    const ancestorTree = {
      person: root,
      father: {
        person: person('father', 'Father Person', { birthDate: '1870' }),
        father: { person: person('grandfather', 'Grandfather Person', { birthDate: '1840' }) },
        mother: { person: person('grandmother', 'Grandmother Person', { birthDate: '1845' }) },
      },
      mother: { person: person('mother', 'Mother Person', { birthDate: '1872' }) },
    };
    const descendantTree = {
      person: root,
      unions: [{
        partner: person('partner', 'Partner Person'),
        children: [
          { person: person('child-a', 'Child A') },
          { person: person('child-b', 'Child B') },
        ],
      }],
    };

    const layout = buildInteractiveLayout(ancestorTree, descendantTree, 'root');
    const nodes = nodeById(layout);

    expect(layout.nodes.filter((node) => node.id === 'root')).toHaveLength(1);
    expect(nodes.get('root')).toMatchObject({ featured: true, generation: 0, role: 'root' });
    expect(nodes.get('father')).toMatchObject({ generation: -1, y: GEN_STEP });
    expect(nodes.get('mother')).toMatchObject({ generation: -1, y: GEN_STEP });
    expect(nodes.get('grandfather')).toMatchObject({ generation: -2, y: GEN_STEP * 2 });
    expect(nodes.get('child-a')).toMatchObject({ generation: 1, y: -GEN_STEP });
    expect(nodes.get('child-b')).toMatchObject({ generation: 1, y: -GEN_STEP });
    expect(nodes.get('partner')).toMatchObject({ generation: 0, role: 'partner' });
    expect(layout.links).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'father', to: 'root', type: 'ancestor' }),
      expect.objectContaining({ from: 'root', to: 'partner', type: 'partner' }),
      expect.objectContaining({ from: 'root', to: 'child-a', type: 'descendant' }),
    ]));
    expect(layout.bands.map((band) => band.generation).sort((a, b) => a - b)).toEqual([-2, -1, 0, 1]);
    expect(layout.bounds.minX).toBeLessThan(layout.bounds.maxX);
    expect(layout.viewBounds.minY).toBeLessThan(layout.viewBounds.maxY);
  });

  it('limits the classic tree to nearby generations and visible links', () => {
    const ancestorTree = {
      person: person('root'),
      father: {
        person: person('father'),
        father: {
          person: person('grandfather'),
          father: { person: person('great-grandfather') },
        },
      },
    };

    const layout = buildInteractiveLayout(ancestorTree, null, 'root');

    expect(layout.nodes.map((node) => node.id)).toEqual(expect.arrayContaining(['root', 'father', 'grandfather']));
    expect(layout.nodes.map((node) => node.id)).not.toContain('great-grandfather');
    expect(layout.links).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'father', to: 'root' }),
      expect.objectContaining({ from: 'grandfather', to: 'father' }),
    ]));
    expect(layout.links.some((link) => link.from === 'great-grandfather' || link.to === 'great-grandfather')).toBe(false);
  });

  it('builds compact family-graph blocks with routed family links', () => {
    const familyGraph = {
      rootId: 'root',
      rootFamilyId: 'root-family',
      nodes: [
        graphNode('root', ['root']),
        graphNode('sibling', ['collateral']),
        graphNode('father', ['ancestor-parent']),
        graphNode('mother', ['ancestor-parent']),
      ],
      families: [
        { id: 'root-family', parents: ['father', 'mother'], children: ['root', 'sibling'] },
      ],
    };

    const layout = buildInteractiveLayout(null, null, 'root', familyGraph);
    const nodes = nodeById(layout);

    expect(nodes.get('root')).toMatchObject({
      familyBlockId: 'root-family',
      featured: true,
      generation: 0,
      x: 78,
    });
    expect(nodes.get('sibling')).toMatchObject({
      familyBlockId: 'root-family',
      generation: 0,
      x: -132,
    });
    expect(nodes.get('father')).toMatchObject({ generation: -1 });
    expect(nodes.get('mother')).toMatchObject({ generation: -1 });
    // One assembly per family with per-segment scoped nodeIds (couple bar /
    // trunk / sibling bus / per-child drops). The assembly collectively
    // connects the couple to every child, and all segments are emphasised.
    const familyLinks = layout.links.filter((link) => link.type === 'family');
    expect(familyLinks.length).toBeGreaterThan(0);
    expect(familyLinks.every((link) => link.emphasis === true)).toBe(true);
    expect(familyLinks.every((link) => (link.points?.length || 0) >= 2)).toBe(true);
    const connectedIds = new Set(familyLinks.flatMap((link) => link.nodeIds || []));
    for (const id of ['father', 'mother', 'root', 'sibling']) {
      expect([...connectedIds]).toContain(id);
    }
    // The couple's trunk references both parents together.
    expect(familyLinks.some((link) => {
      const ids = link.nodeIds || [];
      return ids.includes('father') && ids.includes('mother');
    })).toBe(true);
    // The sibling bus runs at the small figures' head level: above the row
    // baseline but BELOW the featured medallion's top (it passes behind it,
    // like the native viewer), instead of riding along the band edge.
    const rootLink = familyLinks.find((link) => (link.nodeIds || []).includes('root'));
    expect(rootLink).toBeTruthy();
    const busY = Math.max(...rootLink.points.map((point) => point.y));
    expect(busY).toBeGreaterThan(nodes.get('root').y + 20);
    expect(busY).toBeLessThan(nodes.get('root').y + 96);
    // The trunk (the segment owned by both parents) crosses the gutter from the
    // couple bar down to the children's bus level.
    const trunk = familyLinks.find((link) => {
      const ids = link.nodeIds || [];
      return ids.includes('father') && ids.includes('mother') && (link.points?.length || 0) >= 3;
    });
    expect(trunk).toBeTruthy();
    expect(Math.max(...trunk.points.map((point) => point.y))).toBeGreaterThan(nodes.get('root').y + 150);
    expect(Math.min(...trunk.points.map((point) => point.y))).toBeLessThan(nodes.get('root').y + 96);
    expect(layout.bands.find((band) => band.generation === 0)).toMatchObject({
      count: 2,
      title: 'Root Generation',
    });
  });

  it('uses finite split gaps for near-ancestor family band clustering', () => {
    expect(bandSplitGap(0)).toBe(Infinity);
    expect(bandSplitGap(-1)).toBe(980);
    expect(bandSplitGap(-2)).toBe(760);
  });
});

function graphNode(recordName, roles = []) {
  return {
    person: person(recordName),
    roles,
    status: {},
  };
}
