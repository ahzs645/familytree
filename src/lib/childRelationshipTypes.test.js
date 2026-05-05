import { describe, expect, it } from 'vitest';
import { childRelationKind, childRelationLabel, isPrimaryChildRelation } from './childRelationshipTypes.js';

function relation(fields) {
  return {
    recordType: 'ChildRelation',
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value }])),
  };
}

describe('child relationship classification', () => {
  it('treats omitted or natural relationship metadata as primary', () => {
    expect(childRelationKind(null)).toBe('primary');
    expect(isPrimaryChildRelation(relation({ fatherRelationType: 'Natural', motherRelationType: 'Birth' }))).toBe(true);
  });

  it('treats adoptive, step, foster, and guardian metadata as secondary', () => {
    expect(childRelationKind(relation({ motherRelationType: 'Adopted' }))).toBe('secondary');
    expect(childRelationKind(relation({ childRelationType: 'Step' }))).toBe('secondary');
    expect(childRelationKind(relation({ relationshipType: 'Foster child' }))).toBe('secondary');
    expect(childRelationKind(relation({ fatherRelationType: 'Guardian' }))).toBe('secondary');
  });

  it('returns a readable label from available metadata', () => {
    expect(childRelationLabel(relation({ fatherRelationType: 'Natural', motherRelationType: 'Adopted' }))).toBe('Natural Adopted');
  });
});
