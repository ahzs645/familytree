import { describe, expect, it } from 'vitest';
import { normalizeWebsiteOptions } from '../websiteOptions.js';
import { buildPublishModel, slugify } from './buildModel.js';

function field(value, type = 'STRING') {
  return { value, type };
}

function person(recordName, firstName, lastName) {
  return {
    recordName,
    recordType: 'Person',
    fields: {
      firstName: field(firstName),
      lastName: field(lastName),
      cached_fullName: field([firstName, lastName].filter(Boolean).join(' ')),
    },
  };
}

function snapshot(records) {
  return {
    persons: records,
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
    assets: [],
  };
}

describe('website publish model', () => {
  it('creates readable stable person paths with collision handling', () => {
    const p1 = person('person-1', 'John', 'Smith');
    const p2 = person('person-2', 'John', 'Smith');
    const options = normalizeWebsiteOptions();
    const model = buildPublishModel(snapshot([p2, p1]), options);

    expect(model.pathById.get('person-1')).toBe('people/john-smith.html');
    expect(model.pathById.get('person-2')).toBe('people/john-smith-person-2.html');
  });

  it('builds surname groups for deeper static people indexes', () => {
    const options = normalizeWebsiteOptions();
    const model = buildPublishModel(snapshot([
      person('p-1', 'Ada', 'Lovelace'),
      person('p-2', 'Mary', 'Shelley'),
      person('p-3', 'Byron', 'Lovelace'),
    ]), options);

    expect(model.personSurnameGroups.map((group) => group.surname)).toEqual(['Lovelace', 'Shelley']);
    expect(model.personSurnameGroups.find((group) => group.surname === 'Lovelace')).toMatchObject({
      slug: 'lovelace',
      records: expect.arrayContaining([
        expect.objectContaining({ recordName: 'p-1' }),
        expect.objectContaining({ recordName: 'p-3' }),
      ]),
    });
  });

  it('slugifies readable labels with a fallback', () => {
    expect(slugify('John R. Smith, Jr.')).toBe('john-r-smith-jr');
    expect(slugify('---', 'person-1')).toBe('person-1');
  });
});
