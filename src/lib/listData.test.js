import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadDistinctivePersonRows,
  loadLdsOrdinanceRows,
  loadPersonAnalysisRows,
} from './listData.js';

const mockState = vi.hoisted(() => ({ db: null }));

vi.mock('./LocalDatabase.js', () => ({
  getLocalDatabase: () => mockState.db,
}));

describe('list data helpers', () => {
  beforeEach(() => {
    mockState.db = createMockDb([]);
  });

  it('detects distinctive markers and rule-based person signals', async () => {
    mockState.db = createMockDb([
      person('p1', 'Ada Lovelace', { distinctivePerson: field(true), isBookmarked: field(true), thumbnailFileIdentifier: field('thumb') }),
      person('p2', 'No', { firstName: field('No'), lastName: field(''), cached_birthDate: field('1900') }),
    ]);

    const rows = await loadDistinctivePersonRows();
    const ada = rows.find((row) => row.id === 'p1');
    const noSurname = rows.find((row) => row.id === 'p2');

    expect(ada.markerField).toBe('distinctivePerson');
    expect(ada.tags).toEqual(expect.arrayContaining(['Marked: distinctivePerson', 'Bookmarked', 'Has photo']));
    expect(noSurname.tags).toContain('Missing surname');
  });

  it('builds person analysis metrics for missing dates and duplicate risks', async () => {
    mockState.db = createMockDb([
      person('p1', 'Sam Reed', { cached_birthDate: field('1900') }),
      person('p2', 'Sam Reed', { cached_birthDate: field('1900') }),
      person('p3', 'Alex Stone'),
      family('fam1', 'p1', 'missing-person'),
      childRelation('cr1', 'missing-family', 'p3'),
    ]);

    const rows = await loadPersonAnalysisRows();
    const sam = rows.find((row) => row.personId === 'p1');
    const alex = rows.find((row) => row.personId === 'p3');

    expect(sam.duplicateRisk).toBe('High');
    expect(sam.missingDates).toContain('Death');
    expect(sam.orphanedRelationships).toBeGreaterThan(0);
    expect(alex.relationshipIssues).toContain('Child relation cr1 references a missing family');
  });

  it('gates LDS ordinances when no LDS-like schema exists', async () => {
    mockState.db = createMockDb([person('p1', 'Jane Doe')]);

    const result = await loadLdsOrdinanceRows();

    expect(result.schemaPresent).toBe(false);
    expect(result.rows).toEqual([]);
  });

  it('lists LDS ordinance-like rows when schema fields are present', async () => {
    mockState.db = createMockDb([
      person('p1', 'Jane Doe'),
      {
        recordName: 'ord1',
        recordType: 'Ordinance',
        fields: {
          person: ref('p1', 'Person'),
          ordinanceType: field('Endowment'),
          templeName: field('Salt Lake Temple'),
          completedDate: field('1901-02-03'),
          status: field('Complete'),
        },
      },
    ]);

    const result = await loadLdsOrdinanceRows();

    expect(result.schemaPresent).toBe(true);
    expect(result.detectedSchema).toContain('Ordinance');
    expect(result.rows).toContainEqual(expect.objectContaining({
      ownerId: 'p1',
      ownerName: 'Jane Doe',
      ordinance: 'Endowment',
      temple: 'Salt Lake Temple',
      status: 'Complete',
    }));
  });
});

function createMockDb(records) {
  return {
    getAllRecords: vi.fn(async () => records),
    query: vi.fn(async (recordType, options = {}) => {
      let found = records.filter((record) => record.recordType === recordType);
      if (options.referenceField && options.referenceValue) {
        found = found.filter((record) => readRefId(record.fields?.[options.referenceField]) === options.referenceValue);
      }
      return { records: found.slice(0, options.limit || 500), hasMore: found.length > (options.limit || 500) };
    }),
  };
}

function person(recordName, fullName, extraFields = {}) {
  const [firstName = '', lastName = ''] = fullName.split(/\s+/, 2);
  return {
    recordName,
    recordType: 'Person',
    fields: {
      firstName: field(firstName),
      lastName: field(lastName),
      cached_fullName: field(fullName),
      ...extraFields,
    },
  };
}

function family(recordName, man, woman) {
  return {
    recordName,
    recordType: 'Family',
    fields: {
      man: ref(man, 'Person'),
      woman: ref(woman, 'Person'),
    },
  };
}

function childRelation(recordName, familyId, childId) {
  return {
    recordName,
    recordType: 'ChildRelation',
    fields: {
      family: ref(familyId, 'Family'),
      child: ref(childId, 'Person'),
    },
  };
}

function field(value, type = 'STRING') {
  return { value, type };
}

function ref(recordName, recordType) {
  return { value: `${recordName}---${recordType}`, type: 'REFERENCE' };
}

function readRefId(input) {
  const value = input?.value ?? input;
  if (typeof value !== 'string') return null;
  return value.includes('---') ? value.slice(0, value.indexOf('---')) : value;
}
