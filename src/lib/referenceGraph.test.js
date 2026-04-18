import { describe, expect, it } from 'vitest';
import { planReferenceRewrite } from './referenceGraph.js';
import { readRef } from './schema.js';

describe('reference graph merge planning', () => {
  it('rewrites references and dedupes relation rows', () => {
    const records = [
      { recordName: 'person-a', recordType: 'Person', fields: { firstName: { value: 'A' } } },
      { recordName: 'person-b', recordType: 'Person', fields: { firstName: { value: 'B' } } },
      { recordName: 'family-1', recordType: 'Family', fields: { man: { value: 'person-b---Person', type: 'REFERENCE' } } },
      { recordName: 'labelrelation-1', recordType: 'LabelRelation', fields: { label: { value: 'label-1---Label', type: 'REFERENCE' }, targetPerson: { value: 'person-a---Person', type: 'REFERENCE' } } },
      { recordName: 'labelrelation-2', recordType: 'LabelRelation', fields: { label: { value: 'label-1---Label', type: 'REFERENCE' }, targetPerson: { value: 'person-b---Person', type: 'REFERENCE' }, note: { value: 'keep me' } } },
    ];

    const plan = planReferenceRewrite(records, 'person-b', 'person-a', 'Person');
    const family = plan.saveRecords.find((r) => r.recordName === 'family-1');
    expect(readRef(family.fields.man)).toBe('person-a');
    expect(plan.rewrittenReferenceCount).toBe(2);
    expect(plan.dedupedRelationCount).toBe(1);
    expect(plan.deleteRecordNames).toContain('labelrelation-2');
  });
});
