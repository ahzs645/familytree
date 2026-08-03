import { describe, expect, it } from 'vitest';
import { layoutAncestors } from './ancestorLayout.js';

describe('ancestor sibling layout', () => {
  it('emits collateral sibling nodes at the configured reduced scale', () => {
    const tree = { person: { recordName: 'root' }, siblings: [{ recordName: 'sib' }] };
    const result = layoutAncestors(tree, 1, { nodeWidth: 180, nodeHeight: 54 }, { siblingScale: 0.4 });
    expect(result.nodes.find((node) => node.person?.recordName === 'sib')).toMatchObject({ collateral: true, scale: 0.4 });
  });
});
