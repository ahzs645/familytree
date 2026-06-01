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

  it('preserves distinct source citations when page or citation text differs', () => {
    const records = [
      { recordName: 'source-a', recordType: 'Source', fields: { title: { value: 'A' } } },
      { recordName: 'source-b', recordType: 'Source', fields: { title: { value: 'B' } } },
      { recordName: 'person-1', recordType: 'Person', fields: { firstName: { value: 'Jane' } } },
      { recordName: 'sr-1', recordType: 'SourceRelation', fields: { source: { value: 'source-a---Source', type: 'REFERENCE' }, target: { value: 'person-1---Person', type: 'REFERENCE' }, page: { value: '1' }, citation: { value: 'front' } } },
      { recordName: 'sr-2', recordType: 'SourceRelation', fields: { source: { value: 'source-b---Source', type: 'REFERENCE' }, target: { value: 'person-1---Person', type: 'REFERENCE' }, page: { value: '2' }, citation: { value: 'back' } } },
    ];

    const plan = planReferenceRewrite(records, 'source-b', 'source-a', 'Source');
    const rewritten = plan.saveRecords.find((record) => record.recordName === 'sr-2');
    expect(readRef(rewritten.fields.source)).toBe('source-a');
    expect(plan.dedupedRelationCount).toBe(0);
    expect(plan.deleteRecordNames).not.toContain('sr-2');
  });
});
