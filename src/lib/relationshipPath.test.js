import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findRelationshipPath, findRelationshipPaths } from './relationshipPath.js';

const mockState = vi.hoisted(() => ({ db: null }));

vi.mock('./LocalDatabase.js', () => ({
  getLocalDatabase: () => mockState.db,
}));

describe('relationship path discovery', () => {
  beforeEach(() => {
    mockState.db = createMockDb([]);
  });

  it('keeps the single-path API compatible for direct parent paths', async () => {
    mockState.db = createMockDb([
      person('parent', 'Pat Parent'),
      person('child', 'Casey Child'),
      family('fam1', 'parent', null),
      childRelation('cr1', 'fam1', 'child'),
    ]);

    const path = await findRelationshipPath('child', 'parent');

    expect(path.label).toBe('Parent');
    expect(path.steps.map((step) => step.recordName)).toEqual(['child', 'parent']);
    expect(path.edgeCounts).toEqual({ parent: 1, child: 0, spouse: 0 });
  });

  it('returns multiple selectable bloodline paths when more than one route exists', async () => {
    mockState.db = createMockDb([
      person('father', 'Frank Doe'),
      person('mother', 'Mary Doe'),
      person('a', 'Alex Doe'),
      person('b', 'Bailey Doe'),
      family('fam1', 'father', 'mother'),
      childRelation('cr1', 'fam1', 'a'),
      childRelation('cr2', 'fam1', 'b'),
    ]);

    const result = await findRelationshipPaths('a', 'b', { bloodlineOnly: true, maxPaths: 4 });

    expect(result.paths).toHaveLength(2);
    expect(result.paths.map((path) => path.steps.map((step) => step.recordName))).toEqual([
      ['a', 'father', 'b'],
      ['a', 'mother', 'b'],
    ]);
    expect(result.selectedPathId).toBe(result.paths[0].id);
  });

  it('includes spouse paths by default and removes them in bloodline-only mode', async () => {
    mockState.db = createMockDb([
      person('a', 'Alex Doe'),
      person('b', 'Blair Doe'),
      family('fam1', 'a', 'b'),
    ]);

    const withSpouse = await findRelationshipPaths('a', 'b');
    const bloodlineOnly = await findRelationshipPaths('a', 'b', { bloodlineOnly: true });

    expect(withSpouse.paths).toHaveLength(1);
    expect(withSpouse.paths[0].label).toBe('Spouse');
    expect(withSpouse.paths[0].edgeCounts.spouse).toBe(1);
    expect(bloodlineOnly.paths).toEqual([]);
    expect(bloodlineOnly.selectedPathId).toBeNull();
  });

  it('respects maxDepth to prevent runaway traversal', async () => {
    mockState.db = createMockDb([
      person('grandparent', 'Gale Elder'),
      person('parent', 'Pat Parent'),
      person('child', 'Casey Child'),
      family('fam1', 'grandparent', null),
      family('fam2', 'parent', null),
      childRelation('cr1', 'fam1', 'parent'),
      childRelation('cr2', 'fam2', 'child'),
    ]);

    const tooShallow = await findRelationshipPaths('child', 'grandparent', { maxDepth: 1 });
    const enoughDepth = await findRelationshipPaths('child', 'grandparent', { maxDepth: 2 });

    expect(tooShallow.paths).toEqual([]);
    expect(enoughDepth.paths[0].steps.map((step) => step.recordName)).toEqual(['child', 'parent', 'grandparent']);
  });
});

function createMockDb(records) {
  const byId = new Map(records.map((record) => [record.recordName, record]));
  return {
    getRecord: vi.fn(async (recordName) => byId.get(recordName) || null),
    getPersonsParents: vi.fn(async (personRecordName) => {
      const childRelations = records.filter((record) => record.recordType === 'ChildRelation' && refId(record.fields?.child) === personRecordName);
      return childRelations.map((relation) => {
        const fam = byId.get(refId(relation.fields?.family));
        return hydrateFamily(fam, byId);
      });
    }),
    getPersonsChildrenInformation: vi.fn(async (personRecordName) => {
      const families = records.filter((record) => {
        if (record.recordType !== 'Family') return false;
        return refId(record.fields?.man) === personRecordName || refId(record.fields?.woman) === personRecordName;
      });
      return families.map((fam) => {
        const manId = refId(fam.fields?.man);
        const womanId = refId(fam.fields?.woman);
        const partnerId = manId === personRecordName ? womanId : manId;
        const children = records
          .filter((record) => record.recordType === 'ChildRelation' && refId(record.fields?.family) === fam.recordName)
          .map((relation) => byId.get(refId(relation.fields?.child)))
          .filter(Boolean);
        return { family: fam, partner: byId.get(partnerId) || null, children };
      });
    }),
  };
}

function hydrateFamily(fam, byId) {
  if (!fam) return { family: null, man: null, woman: null };
  return {
    family: fam,
    man: byId.get(refId(fam.fields?.man)) || null,
    woman: byId.get(refId(fam.fields?.woman)) || null,
  };
}

function person(recordName, fullName) {
  return {
    recordName,
    recordType: 'Person',
    fields: { cached_fullName: field(fullName) },
  };
}

function family(recordName, man, woman) {
  return {
    recordName,
    recordType: 'Family',
    fields: {
      ...(man ? { man: ref(man, 'Person') } : {}),
      ...(woman ? { woman: ref(woman, 'Person') } : {}),
    },
  };
}

function childRelation(recordName, familyRecordName, childRecordName) {
  return {
    recordName,
    recordType: 'ChildRelation',
    fields: {
      family: ref(familyRecordName, 'Family'),
      child: ref(childRecordName, 'Person'),
    },
  };
}

function field(value, type = 'STRING') {
  return { value, type };
}

function ref(recordName, recordType) {
  return { value: `${recordName}---${recordType}`, type: 'REFERENCE' };
}

function refId(input) {
  const value = input?.value ?? input;
  if (typeof value !== 'string') return null;
  return value.includes('---') ? value.slice(0, value.indexOf('---')) : value;
}
