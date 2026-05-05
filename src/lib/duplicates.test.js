import { describe, expect, it } from 'vitest';
import { duplicatePairKey, findDuplicatePersonCandidates } from './duplicates.js';

describe('duplicatePairKey', () => {
  it('is stable regardless of pair order', () => {
    const a = { recordName: 'person-b', recordType: 'Person' };
    const b = { recordName: 'person-a', recordType: 'Person' };

    expect(duplicatePairKey('Person', a, b)).toBe('Person:person-a:person-b');
    expect(duplicatePairKey('Person', b, a)).toBe('Person:person-a:person-b');
  });

  it('accepts raw record names', () => {
    expect(duplicatePairKey('Source', 's2', 's1')).toBe('Source:s1:s2');
  });
});

describe('findDuplicatePersonCandidates', () => {
  it('uses Gramps-style date, place, and parent signals for person matches', () => {
    const records = [
      person('p1', 'John', 'Smith', '1900', 0),
      person('p2', 'Jon', 'Smith', '1900', 0),
      person('father1', 'William', 'Smith', '1870', 0),
      person('father2', 'William', 'Smith', '1870', 0),
      place('birthplace', 'Salem, Essex, Massachusetts, USA'),
      event('b1', 'p1', 'Birth', '1900', 'birthplace'),
      event('b2', 'p2', 'Birth', '1900', 'birthplace'),
      family('fam1', 'father1', null),
      family('fam2', 'father2', null),
      childRelation('cr1', 'fam1', 'p1'),
      childRelation('cr2', 'fam2', 'p2'),
    ];

    const pairs = findDuplicatePersonCandidates(records, 0.82);

    const pair = pairs.find((candidate) => candidate.a.recordName === 'p1' && candidate.b.recordName === 'p2');
    expect(pair).toBeTruthy();
    expect(pair.reasons).toEqual(expect.arrayContaining([
      'Same birth year',
      'Same birth place',
      'Matching parent names',
    ]));
  });

  it('excludes ancestor and descendant pairs even when names and dates match', () => {
    const records = [
      person('parent', 'John', 'Smith', '1900', 0),
      person('child', 'John', 'Smith', '1900', 0),
      family('fam1', 'parent', null),
      childRelation('cr1', 'fam1', 'child'),
    ];

    expect(findDuplicatePersonCandidates(records, 0.1)).toEqual([]);
  });
});

function person(recordName, firstName, lastName, birthDate = '', gender = 2) {
  return {
    recordName,
    recordType: 'Person',
    fields: {
      firstName: field(firstName),
      lastName: field(lastName),
      cached_birthDate: field(birthDate),
      gender: field(gender, 'NUMBER'),
    },
  };
}

function place(recordName, label) {
  return { recordName, recordType: 'Place', fields: { placeName: field(label), cached_normallocationString: field(label) } };
}

function event(recordName, personName, conclusionType, date, placeName) {
  return {
    recordName,
    recordType: 'PersonEvent',
    fields: {
      person: ref(personName, 'Person'),
      conclusionType: field(conclusionType),
      date: field(date),
      place: ref(placeName, 'Place'),
    },
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

function childRelation(recordName, familyName, childName) {
  return {
    recordName,
    recordType: 'ChildRelation',
    fields: {
      family: ref(familyName, 'Family'),
      child: ref(childName, 'Person'),
    },
  };
}

function field(value, type = 'STRING') {
  return { value, type };
}

function ref(recordName, recordType) {
  return { value: `${recordName}---${recordType}`, type: 'REFERENCE' };
}
