import { describe, expect, it } from 'vitest';
import { layoutHourglass } from './HourglassChart.jsx';

const theme = { nodeWidth: 180, nodeHeight: 54 };
const person = (recordName) => ({ recordName });

describe('hourglass partner ancestors', () => {
  it('adds the partner ancestor block and aligns the descendant root', () => {
    const ancestor = { person: person('root') };
    const descendants = { person: person('root'), unions: [] };
    const partner = { person: person('partner'), father: { person: person('partner-father') } };
    const result = layoutHourglass(ancestor, descendants, partner, 1, theme, { partnerAncestorGenerations: 2, alignment: 'center' });
    expect(result.nodes.some((node) => node.person?.recordName === 'partner-father')).toBe(true);
    expect(result.width).toBeGreaterThan(180);
  });
});
