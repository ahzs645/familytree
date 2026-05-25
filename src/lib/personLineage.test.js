import { describe, expect, it } from 'vitest';
import { buildArabicPatrilinealTail, buildPersonLineage, comparePersonSearchResults, matchesPersonLineageSearch } from './personLineage.js';
import { Gender } from '../models/index.js';

describe('person lineage search', () => {
  it('builds searchable Arabic father/grandfather/mother chains', () => {
    const people = [
      person('grandfather', 'رعد الجليل', 'رعد', 'الجليل'),
      person('father', 'أحمد رعد الجليل', 'أحمد', 'الجليل'),
      person('mother', 'فاطمة الهاشمي', 'فاطمة', 'الهاشمي'),
      person('child', 'يوسف أحمد الجليل', 'يوسف', 'الجليل'),
      person('other', 'يوسف خالد الجليل', 'يوسف', 'الجليل'),
    ];
    const families = [
      family('fam1', 'grandfather', null),
      family('fam2', 'father', 'mother'),
    ];
    const childRelations = [
      childRelation('cr1', 'fam1', 'father'),
      childRelation('cr2', 'fam2', 'child'),
    ];

    const lineage = buildPersonLineage(people, families, childRelations);
    const child = { recordName: 'child', fullName: 'يوسف أحمد الجليل', ...lineage.get('child') };
    const other = { recordName: 'other', fullName: 'يوسف خالد الجليل', ...lineage.get('other') };

    expect(lineage.get('child').arabicPatrilinealName).toBe('يوسف بن أحمد بن رعد');
    expect(lineage.get('child').arabicPatrilinealTail).toBe('بن أحمد بن رعد');
    expect(matchesPersonLineageSearch(child, 'يوسف احمد رعد')).toBe(true);
    expect(comparePersonSearchResults(child, other, 'يوسف احمد رعد')).toBeLessThan(0);
  });

  it('uses بنت for female children and then بن for the father line', () => {
    const people = [
      person('grandfather', 'رعد الجليل', 'رعد', 'الجليل', Gender.Male),
      person('father', 'أحمد رعد الجليل', 'أحمد', 'الجليل', Gender.Male),
      person('daughter', 'فاطمة أحمد الجليل', 'فاطمة', 'الجليل', Gender.Female),
    ];
    const families = [
      family('fam1', 'grandfather', null),
      family('fam2', 'father', null),
    ];
    const childRelations = [
      childRelation('cr1', 'fam1', 'father'),
      childRelation('cr2', 'fam2', 'daughter'),
    ];

    const lineage = buildPersonLineage(people, families, childRelations);
    expect(lineage.get('daughter').arabicPatrilinealName).toBe('فاطمة بنت أحمد بن رعد');
  });

  it('names a person with no given name after their father (ابن/بنت)', () => {
    const people = [
      person('grandfather', 'رعد الجليل', 'رعد', 'الجليل', Gender.Male),
      person('father', 'أحمد رعد الجليل', 'أحمد', 'الجليل', Gender.Male),
      namelessPerson('son', Gender.Male),
      namelessPerson('daughter', Gender.Female),
    ];
    const families = [
      family('fam1', 'grandfather', null),
      family('fam2', 'father', null),
    ];
    const childRelations = [
      childRelation('cr1', 'fam1', 'father'),
      childRelation('cr2', 'fam2', 'son'),
      childRelation('cr3', 'fam2', 'daughter'),
    ];

    const lineage = buildPersonLineage(people, families, childRelations);
    // No leaked "No" token, and a real "son/daughter of <father>" identifier.
    expect(lineage.get('son').arabicPatrilinealName).toBe('ابن أحمد بن رعد');
    expect(lineage.get('daughter').arabicPatrilinealName).toBe('بنت أحمد بن رعد');
  });

  it('leaves a truly rootless nameless person without a patrilineal name', () => {
    const lineage = buildPersonLineage([namelessPerson('orphan', Gender.Male)], [], []);
    expect(lineage.get('orphan').arabicPatrilinealName).toBe('');
  });

  it('formats compact Arabic lineage without repeating the person name', () => {
    expect(buildArabicPatrilinealTail('احمد بن رعد بن جليل بن ابراهيم', 'احمد')).toBe('بن رعد بن جليل بن ابراهيم');
    expect(buildArabicPatrilinealTail('احمد بن رعد', 'يوسف')).toBe('احمد بن رعد');
    expect(buildArabicPatrilinealTail('', 'احمد')).toBe('');
  });
});

function person(recordName, fullName, firstName, lastName, gender = Gender.Male) {
  return {
    recordName,
    recordType: 'Person',
    fields: {
      cached_fullName: field(fullName),
      firstName: field(firstName),
      lastName: field(lastName),
      gender: field(gender, 'NUMBER'),
    },
  };
}

function namelessPerson(recordName, gender = Gender.Male) {
  return {
    recordName,
    recordType: 'Person',
    fields: {
      gender: field(gender, 'NUMBER'),
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
