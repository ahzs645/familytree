import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildKinshipReport, buildPersonEventsReport, buildStoryReport } from './builders.js';

const mockState = vi.hoisted(() => ({ db: null }));

vi.mock('../LocalDatabase.js', () => ({
  getLocalDatabase: () => mockState.db,
}));

describe('report builders', () => {
  beforeEach(() => {
    mockState.db = createMockDb([]);
  });

  it('builds a person events report with expected columns and linked family events', async () => {
    mockState.db = createMockDb([
      person('p1', 'John Doe'),
      person('p2', 'Jane Doe'),
      place('place1', 'Boston, Massachusetts'),
      family('fam1', 'p1', 'p2', 'John Doe & Jane Doe'),
      event('pe1', 'PersonEvent', { person: ref('p1', 'Person'), eventType: field('Birth'), date: field('1900-01-02'), place: ref('place1', 'Place'), description: field('Born at home') }),
      event('fe1', 'FamilyEvent', { family: ref('fam1', 'Family'), eventType: field('Marriage'), date: field('1920-03-04'), description: field('Wedding ceremony') }),
    ]);

    const report = await buildPersonEventsReport('p1');
    const table = report.blocks.find((entry) => entry.kind === 'table');

    expect(table.columns).toEqual(['Type', 'Date', 'Place', 'Description', 'Context']);
    expect(table.rows.length).toBeGreaterThanOrEqual(1);
    expect(table.rows).toContainEqual(['Birth', '1900-01-02', 'Boston, Massachusetts', 'Born at home', 'Personal event']);
    expect(table.rows).toContainEqual(['Marriage', '1920-03-04', '-', 'Wedding ceremony', 'Family with Jane Doe']);
  });

  it('builds a story report with section text and relations', async () => {
    mockState.db = createMockDb([
      person('p1', 'John Doe'),
      {
        recordName: 'story1',
        recordType: 'Story',
        fields: {
          title: field('Migration Story'),
          author: field('Family Historian'),
          text: field('Opening note.'),
        },
      },
      {
        recordName: 'section1',
        recordType: 'StorySection',
        fields: {
          story: ref('story1', 'Story'),
          title: field('Arrival'),
          text: field('They crossed the ocean.'),
          order: field(1, 'NUMBER'),
        },
      },
      {
        recordName: 'media1',
        recordType: 'MediaPicture',
        fields: { title: field('Harbor photo') },
      },
      {
        recordName: 'storyrel1',
        recordType: 'StoryRelation',
        fields: { story: ref('story1', 'Story'), target: ref('p1', 'Person'), targetType: field('Person') },
      },
      {
        recordName: 'sectionrel1',
        recordType: 'StorySectionRelation',
        fields: { storySection: ref('section1', 'StorySection'), target: ref('media1', 'MediaPicture'), targetType: field('MediaPicture') },
      },
    ]);

    const report = await buildStoryReport('story1');
    const paragraphs = report.blocks.filter((entry) => entry.kind === 'paragraph').map((entry) => entry.text);
    const relationTable = report.blocks.filter((entry) => entry.kind === 'table').at(-1);

    expect(paragraphs).toContain('They crossed the ocean.');
    expect(relationTable.columns).toEqual(['Scope', 'Target Type', 'Target', 'Record ID']);
    expect(relationTable.rows).toContainEqual(['Story', 'Person', 'John Doe', 'p1']);
    expect(relationTable.rows).toContainEqual(['Section: Arrival', 'Picture', 'Harbor photo', 'media1']);
  });

  it('handles same-person kinship paths', async () => {
    mockState.db = createMockDb([person('p1', 'John Doe')]);

    const report = await buildKinshipReport('p1', 'p1');
    const paragraph = report.blocks.find((entry) => entry.kind === 'paragraph');
    const table = report.blocks.find((entry) => entry.kind === 'table');

    expect(paragraph.text).toBe('Relationship: Same person');
    expect(table.rows).toContainEqual(['1', 'Start', 'John Doe', '-']);
  });

  it('handles kinship no-path cases without throwing', async () => {
    mockState.db = createMockDb([person('p1', 'John Doe'), person('p2', 'Mary Smith')]);

    const report = await buildKinshipReport('p1', 'p2');
    const paragraph = report.blocks.find((entry) => entry.kind === 'paragraph');
    const table = report.blocks.find((entry) => entry.kind === 'table');

    expect(paragraph.text).toBe('No relationship path found between John Doe and Mary Smith.');
    expect(table.rows).toEqual([['John Doe', 'Mary Smith', 'No path found']]);
  });
});

function createMockDb(records) {
  const byId = new Map(records.map((record) => [record.recordName, record]));
  return {
    getRecord: vi.fn(async (recordName) => byId.get(recordName) || null),
    query: vi.fn(async (recordType, options = {}) => {
      let found = records.filter((record) => record.recordType === recordType);
      if (options.referenceField && options.referenceValue) {
        found = found.filter((record) => refId(record.fields?.[options.referenceField]) === options.referenceValue);
      }
      return { records: found.slice(0, options.limit || 500), hasMore: found.length > (options.limit || 500) };
    }),
    getPersonsParents: vi.fn(async (personRecordName) => {
      const childRelations = records.filter((record) => record.recordType === 'ChildRelation' && refId(record.fields?.child) === personRecordName);
      return Promise.all(childRelations.map(async (relation) => {
        const fam = byId.get(refId(relation.fields?.family));
        return hydrateFamily(fam, byId);
      }));
    }),
    getPersonsChildrenInformation: vi.fn(async (personRecordName) => {
      const families = records.filter((record) => {
        if (record.recordType !== 'Family') return false;
        return refId(record.fields?.man) === personRecordName || refId(record.fields?.woman) === personRecordName;
      });
      return Promise.all(families.map(async (fam) => {
        const manId = refId(fam.fields?.man);
        const womanId = refId(fam.fields?.woman);
        const partnerId = manId === personRecordName ? womanId : manId;
        const children = records
          .filter((record) => record.recordType === 'ChildRelation' && refId(record.fields?.family) === fam.recordName)
          .map((relation) => byId.get(refId(relation.fields?.child)))
          .filter(Boolean);
        return { family: fam, partner: byId.get(partnerId) || null, children };
      }));
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

function family(recordName, man, woman, familyName) {
  return {
    recordName,
    recordType: 'Family',
    fields: {
      man: ref(man, 'Person'),
      woman: ref(woman, 'Person'),
      cached_familyName: field(familyName),
    },
  };
}

function place(recordName, displayName) {
  return {
    recordName,
    recordType: 'Place',
    fields: { cached_standardizedLocationString: field(displayName) },
  };
}

function event(recordName, recordType, fields) {
  return { recordName, recordType, fields };
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
