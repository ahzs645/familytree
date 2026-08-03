import { describe, expect, it } from 'vitest';
import { buildCompleteTreeModel, layoutCompleteTree } from './completeTreeBuilder.js';

const person = (id, firstName = id) => ({ recordName: id, recordType: 'Person', fields: { firstName: { value: firstName } } });
const ref = (recordName) => ({ recordName });

describe('complete tree builder', () => {
  it('retains connected, disconnected, and isolated persons as separate components', () => {
    const model = buildCompleteTreeModel({
      persons: [person('p1'), person('p2'), person('c1'), person('p3'), person('p4'), person('solo')],
      families: [
        { recordName: 'f1', fields: { man: { value: ref('p1') }, woman: { value: ref('p2') } } },
        { recordName: 'f2', fields: { man: { value: ref('p3') }, woman: { value: ref('p4') } } },
      ],
      childRelations: [{ recordName: 'r1', fields: { family: { value: ref('f1') }, child: { value: ref('c1') } } }],
    });
    expect(model.nodes.map((node) => node.id)).toEqual(['p1', 'p2', 'c1', 'p3', 'p4', 'solo']);
    expect(model.components.map((component) => component.nodeIds.sort())).toEqual([
      ['c1', 'p1', 'p2'], ['p3', 'p4'], ['solo'],
    ]);
    expect(model.nodes.find((node) => node.id === 'c1').generation).toBe(1);
  });

  it('top- and center-aligns separated subtree blocks', () => {
    const model = {
      nodes: [
        { id: 'a', person: {}, generation: 0 }, { id: 'b', person: {}, generation: 0 },
        { id: 'c', person: {}, generation: 0 },
      ],
      edges: [],
      components: [
        { id: 'large', nodeIds: ['a', 'b'], edgeIds: [] },
        { id: 'small', nodeIds: ['c'], edgeIds: [] },
      ],
    };
    const theme = { nodeWidth: 180, nodeHeight: 54 };
    expect(layoutCompleteTree(model, theme, { alignment: 'top' }).nodes.find((node) => node.id === 'c').y).toBe(0);
    expect(layoutCompleteTree(model, theme, { alignment: 'center' }).nodes.find((node) => node.id === 'c').y).toBeGreaterThan(0);
  });
});
