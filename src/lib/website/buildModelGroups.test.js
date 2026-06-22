import { describe, expect, it } from 'vitest';
import { normalizeWebsiteOptions } from '../websiteOptions.js';
import { buildPublishModel } from './buildModel.js';

function field(value, type = 'STRING') {
  return { value, type };
}

function person(recordName, firstName, lastName, extra = {}) {
  return {
    recordName,
    recordType: 'Person',
    fields: {
      firstName: field(firstName),
      lastName: field(lastName),
      cached_fullName: field([firstName, lastName].filter(Boolean).join(' ')),
      ...extra,
    },
  };
}

function ref(recordName, recordType) {
  return { value: `${recordName}---${recordType}`, type: 'REFERENCE' };
}

function snapshot(overrides = {}) {
  return {
    persons: [],
    families: [],
    places: [],
    sources: [],
    media: [],
    stories: [],
    childRels: [],
    personEvents: [],
    familyEvents: [],
    sourceRelations: [],
    mediaRelations: [],
    storyRelations: [],
    storySections: [],
    dnaResults: [],
    personGroups: [],
    personGroupRelations: [],
    savedCharts: [],
    assets: [],
    ...overrides,
  };
}

describe('website publish model — groups, charts, bookmarks, start person', () => {
  it('builds person groups with their published members and cross-links', () => {
    const ada = person('p-1', 'Ada', 'Lovelace');
    const byron = person('p-2', 'Byron', 'Lovelace');
    const options = normalizeWebsiteOptions();
    const model = buildPublishModel(snapshot({
      persons: [ada, byron],
      personGroups: [{ recordName: 'g-1', recordType: 'PersonGroup', fields: { name: field('Poets') } }],
      personGroupRelations: [
        { recordName: 'pgr-1', recordType: 'PersonGroupRelation', fields: { personGroup: ref('g-1', 'PersonGroup'), person: ref('p-1', 'Person') } },
        { recordName: 'pgr-2', recordType: 'PersonGroupRelation', fields: { personGroup: ref('g-1', 'PersonGroup'), person: ref('p-2', 'Person') } },
      ],
    }), options);

    expect(model.personGroups.map((g) => g.recordName)).toEqual(['g-1']);
    expect(model.groupMembersByGroup.get('g-1').map((p) => p.recordName)).toEqual(['p-1', 'p-2']);
    expect(model.groupsByPerson.get('p-1').map((g) => g.recordName)).toEqual(['g-1']);
    expect(model.pathById.get('g-1')).toMatch(/^groups\//);
  });

  it('drops groups with no published members', () => {
    const options = normalizeWebsiteOptions();
    const model = buildPublishModel(snapshot({
      persons: [person('p-1', 'Ada', 'Lovelace')],
      personGroups: [{ recordName: 'g-empty', recordType: 'PersonGroup', fields: { name: field('Empty') } }],
      personGroupRelations: [],
    }), options);
    expect(model.personGroups).toEqual([]);
  });

  it('collects saved charts and assigns chart paths', () => {
    const options = normalizeWebsiteOptions();
    const model = buildPublishModel(snapshot({
      persons: [person('p-1', 'Ada', 'Lovelace')],
      savedCharts: [{ recordName: 'sc-1', recordType: 'SavedChart', fields: { title: field('Ancestors of Ada') } }],
    }), options);
    expect(model.savedCharts.map((c) => c.recordName)).toEqual(['sc-1']);
    expect(model.pathById.get('sc-1')).toMatch(/^charts\//);
  });

  it('surfaces bookmarked people and a published start person', () => {
    const ada = person('p-1', 'Ada', 'Lovelace', { isBookmarked: field(true, 'BOOLEAN') });
    const byron = person('p-2', 'Byron', 'Lovelace');
    const options = normalizeWebsiteOptions({ startPersonId: 'p-2' });
    const model = buildPublishModel(snapshot({ persons: [ada, byron] }), options);
    expect(model.bookmarkedPersons.map((p) => p.recordName)).toEqual(['p-1']);
    expect(model.startPerson?.recordName).toBe('p-2');
  });

  it('omits bookmarks when includeBookmarks is off and start person when unpublished', () => {
    const ada = person('p-1', 'Ada', 'Lovelace', { isBookmarked: field(true, 'BOOLEAN') });
    const options = normalizeWebsiteOptions({ includeBookmarks: false, startPersonId: 'missing' });
    const model = buildPublishModel(snapshot({ persons: [ada] }), options);
    expect(model.bookmarkedPersons).toEqual([]);
    expect(model.startPerson).toBeNull();
  });
});
