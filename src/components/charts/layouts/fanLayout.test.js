import { describe, expect, it } from 'vitest';
import { layoutFan } from './fanLayout.js';

describe('fan layout modes', () => {
  it('uses descendants and honors the configured start angle', () => {
    const tree = {
      person: { recordName: 'root' },
      unions: [{ children: [
        { person: { recordName: 'c1' }, unions: [] },
        { person: { recordName: 'c2' }, unions: [] },
        { person: { recordName: 'c3' }, unions: [] },
      ] }],
    };
    const result = layoutFan(tree, 2, { mode: 'descendant', arcDegrees: 180, startAngle: 0 });
    expect(result.slices.filter((slice) => !slice.proband).map((slice) => slice.person.recordName)).toEqual(['c1', 'c2', 'c3']);
    expect(result.slices.find((slice) => slice.person?.recordName === 'c1').a0).toBeCloseTo(0);
  });

  it('expands very small outer descendant segments', () => {
    const children = Array.from({ length: 100 }, (_, index) => ({ person: { recordName: `c${index}` }, unions: [] }));
    const tree = { person: { recordName: 'root' }, unions: [{ children }] };
    const normal = layoutFan(tree, 2, { mode: 'descendant', arcDegrees: 180 });
    const expanded = layoutFan(tree, 2, { mode: 'descendant', arcDegrees: 180, expandSmallSlices: true });
    const span = (layout) => layout.slices.find((slice) => !slice.proband).a1 - layout.slices.find((slice) => !slice.proband).a0;
    expect(span(expanded)).toBeGreaterThan(span(normal));
  });
});
