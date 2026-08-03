import { describe, expect, it } from 'vitest';
import { planGuidedContactRelationships } from './contactImport.js';

const ref = (recordName) => ({ value: { recordName }, type: 'REFERENCE' });
const entry = (recordName) => ({ record: { recordName, recordType: 'Person', fields: {} }, relations: [] });

function db(records = []) {
  return {
    query: async (type) => ({ records: records.filter((record) => record.recordType === type) }),
  };
}

describe('guided contact relationships', () => {
  it('creates a spouse family and attaches imported children to the anchor family', async () => {
    const spouse = entry('imported-spouse');
    const child = entry('imported-child');
    const plan = await planGuidedContactRelationships([spouse, child], {
      anchorPersonId: 'anchor',
      relationshipByContact: { 'imported-spouse': 'spouse', 'imported-child': 'child' },
    }, db());
    const family = plan.creates.find((record) => record.recordType === 'Family');
    const childRelation = plan.creates.find((record) => record.recordType === 'ChildRelation');
    expect([family.fields.man.value, family.fields.woman.value]).toEqual(['anchor---Person', 'imported-spouse---Person']);
    expect(childRelation.fields.family.value).toBe(`${family.recordName}---Family`);
    expect(childRelation.fields.child.value).toBe('imported-child---Person');
  });

  it('adds siblings to the anchor parent family without replacing its parents', async () => {
    const existing = [
      { recordName: 'parents', recordType: 'Family', fields: { man: ref('dad'), woman: ref('mom') } },
      { recordName: 'anchor-rel', recordType: 'ChildRelation', fields: { family: ref('parents'), child: ref('anchor') } },
    ];
    const plan = await planGuidedContactRelationships([entry('imported-sibling')], {
      anchorPersonId: 'anchor', relationshipByContact: { 'imported-sibling': 'sibling' },
    }, db(existing));
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates).toContainEqual(expect.objectContaining({
      recordType: 'ChildRelation',
      fields: expect.objectContaining({ child: expect.objectContaining({ value: 'imported-sibling---Person' }) }),
    }));
  });

  it('fills an existing parent slot for a guided mother mapping', async () => {
    const existing = [
      { recordName: 'parents', recordType: 'Family', fields: { man: ref('dad') } },
      { recordName: 'anchor-rel', recordType: 'ChildRelation', fields: { family: ref('parents'), child: ref('anchor') } },
    ];
    const plan = await planGuidedContactRelationships([entry('imported-mother')], {
      anchorPersonId: 'anchor', relationshipByContact: { 'imported-mother': 'mother' },
    }, db(existing));
    expect(plan.updates[0].fields.woman.value).toBe('imported-mother---Person');
  });
});
