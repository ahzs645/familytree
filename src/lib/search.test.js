import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSearchIndex, querySearchIndex, runGenealogyAdvancedSearch } from './search.js';

const mockState = vi.hoisted(() => ({ db: null }));

vi.mock('./LocalDatabase.js', () => ({
  getLocalDatabase: () => mockState.db,
}));

describe('offline search index', () => {
  beforeEach(() => {
    mockState.db = null;
  });

  it('indexes nested record field values and intersects query tokens', () => {
    const index = createSearchIndex([
      {
        recordName: 'p1',
        recordType: 'Person',
        fields: {
          cached_fullName: { value: 'Jane Maria Doe' },
          notes: { value: [{ text: 'Baptized in Glasgow' }] },
        },
      },
      {
        recordName: 'p2',
        recordType: 'Person',
        fields: {
          cached_fullName: { value: 'John Doe' },
          notes: { value: [{ text: 'Moved to London' }] },
        },
      },
    ]);

    expect([...querySearchIndex(index, 'jane glasgow')]).toEqual(['p1']);
    expect([...querySearchIndex(index, 'doe')].sort()).toEqual(['p1', 'p2']);
  });

  it('folds accents for token search', () => {
    const index = createSearchIndex([
      { recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'José Núñez' } } },
    ]);

    expect([...querySearchIndex(index, 'Jose Nunez')]).toEqual(['p1']);
  });

  it('indexes Arabic names under English romanized variants', () => {
    const index = createSearchIndex([
      { recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'أحمد رعد الجليل' } } },
      { recordName: 'p2', recordType: 'Person', fields: { cached_fullName: { value: 'فاطمة الهاشمي' } } },
      { recordName: 'p3', recordType: 'Person', fields: { cached_fullName: { value: 'محمد عبد الله الهاشمي' } } },
      { recordName: 'p4', recordType: 'Person', fields: { cached_fullName: { value: 'علي حسين خالد' } } },
    ]);

    expect([...querySearchIndex(index, 'Ahmad raad jalil')]).toEqual(['p1']);
    expect([...querySearchIndex(index, 'Ahmed Raad Jalil')]).toEqual(['p1']);
    expect([...querySearchIndex(index, 'Mohamed Abdul Allah Hashemi')]).toEqual(['p3']);
    expect([...querySearchIndex(index, '3li Hussain Khaled')]).toEqual(['p4']);
  });
});

describe('runGenealogyAdvancedSearch', () => {
  it('matches GeneWeb-style person criteria across names, events, places, and facts', async () => {
    mockState.db = {
      getAllRecords: vi.fn(async () => [
        person('p1', 'Jane', 'Doe', 1),
        person('p2', 'John', 'Doe', 0),
        place('pl1', 'Glasgow, Scotland'),
        event('e1', 'p1', 'Birth', '15 MAY 1900', 'pl1'),
        event('e2', 'p2', 'Birth', '15 MAY 1900', null, 'London'),
        fact('f1', 'p1', 'Occupation', 'Teacher'),
        family('fam1', 'p1', 'p2'),
        familyEvent('fe1', 'fam1', 'Marriage', '1920', 'Glasgow'),
      ]),
    };

    const result = await runGenealogyAdvancedSearch({
      matchMode: 'all',
      firstName: 'Jane',
      exactFirstName: true,
      surname: 'Doe',
      gender: '1',
      occupation: 'teacher',
      birthPlace: 'Glasgow',
      birthBefore: '1910',
      marriagePlace: 'Glasgow',
    });

    expect(result.records.map((record) => record.recordName)).toEqual(['p1']);
  });
});

function person(recordName, firstName, lastName, gender) {
  return {
    recordName,
    recordType: 'Person',
    fields: {
      firstName: field(firstName),
      lastName: field(lastName),
      cached_fullName: field(`${firstName} ${lastName}`),
      gender: field(gender, 'INT64'),
    },
  };
}

function event(recordName, personId, conclusionType, date, placeId = null, placeName = '') {
  return {
    recordName,
    recordType: 'PersonEvent',
    fields: {
      person: ref(personId, 'Person'),
      conclusionType: field(conclusionType),
      date: field(date),
      ...(placeId ? { place: ref(placeId, 'Place') } : {}),
      ...(placeName ? { placeName: field(placeName) } : {}),
    },
  };
}

function familyEvent(recordName, familyId, conclusionType, date, placeName) {
  return {
    recordName,
    recordType: 'FamilyEvent',
    fields: {
      family: ref(familyId, 'Family'),
      conclusionType: field(conclusionType),
      date: field(date),
      placeName: field(placeName),
    },
  };
}

function fact(recordName, personId, type, value) {
  return {
    recordName,
    recordType: 'PersonFact',
    fields: {
      person: ref(personId, 'Person'),
      type: field(type),
      value: field(value),
    },
  };
}

function family(recordName, manId, womanId) {
  return {
    recordName,
    recordType: 'Family',
    fields: {
      man: ref(manId, 'Person'),
      woman: ref(womanId, 'Person'),
    },
  };
}

function place(recordName, name) {
  return {
    recordName,
    recordType: 'Place',
    fields: {
      placeName: field(name),
      cached_standardizedLocationString: field(name),
    },
  };
}

function field(value, type = 'STRING') {
  return { value, type };
}

function ref(recordName, recordType) {
  return { value: `${recordName}---${recordType}`, type: 'REFERENCE' };
}
