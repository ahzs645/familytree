import { describe, expect, it } from 'vitest';
import { layoutDescendants } from './descendantLayout.js';

const theme = { nodeWidth: 180, nodeHeight: 54 };
const tree = {
  person: { recordName: 'root' },
  unions: [{ familyRecordName: 'f1', partner: { recordName: 'partner' }, children: [{ person: { recordName: 'child' }, unions: [] }] }],
};

describe('descendant partner layout options', () => {
  it('can hide partner nodes without hiding children', () => {
    const result = layoutDescendants(tree, theme, { showPartners: false });
    expect(result.nodes.map((node) => node.person.recordName)).toEqual(['root', 'child']);
    expect(result.links.some((link) => link.kind === 'marriage')).toBe(false);
  });

  it('applies partner indention to inline placement', () => {
    const inline = layoutDescendants(tree, theme, { showPartners: true, indentPartners: false });
    const indented = layoutDescendants(tree, theme, { showPartners: true, indentPartners: true, partnerIndent: 60 });
    const x = (layout) => layout.nodes.find((node) => node.person.recordName === 'partner').x;
    expect(x(indented) - x(inline)).toBe(60);
  });
});
