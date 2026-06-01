import { describe, expect, it } from 'vitest';
import {
  buildQuizQuestionsFromRecords,
  normalizeQuizSettings,
  quizDateAnswer,
  readQuizStats,
  writeQuizStats,
} from './quizQuestions.js';

function field(value) {
  return { value, type: 'STRING' };
}

function ref(recordName, recordType) {
  return { value: `${recordName}---${recordType}`, type: 'REFERENCE' };
}

function person(id, firstName, lastName, gender, birthDate, deathDate, birthPlace, deathPlace, thumbnail = '') {
  return {
    recordName: id,
    recordType: 'Person',
    fields: {
      firstName: field(firstName),
      lastName: field(lastName),
      cached_fullName: field(`${firstName} ${lastName}`),
      gender: { value: gender, type: 'INT64' },
      ...(birthDate ? { cached_birthDate: field(birthDate) } : {}),
      ...(deathDate ? { cached_deathDate: field(deathDate) } : {}),
      ...(birthPlace ? { birthPlace: ref(birthPlace, 'Place') } : {}),
      ...(deathPlace ? { deathPlace: ref(deathPlace, 'Place') } : {}),
      ...(thumbnail ? { thumbnailFileIdentifier: field(thumbnail) } : {}),
    },
  };
}

function place(id, name) {
  return { recordName: id, recordType: 'Place', fields: { placeName: field(name), cached_normallocationString: field(name) } };
}

function family(id, man, woman, marriageDate) {
  return {
    recordName: id,
    recordType: 'Family',
    fields: {
      man: ref(man, 'Person'),
      woman: ref(woman, 'Person'),
      cached_marriageDate: field(marriageDate),
    },
  };
}

function childRelation(id, familyId, childId) {
  return {
    recordName: id,
    recordType: 'ChildRelation',
    fields: {
      family: ref(familyId, 'Family'),
      child: ref(childId, 'Person'),
    },
  };
}

function fixture() {
  return {
    persons: [
      person('p1', 'John', 'River', 0, 'ABT 1 JAN 1940', '2000-05-03', 'pl1', 'pl2', 'john.png'),
      person('p2', 'Mary', 'Stone', 1, '1942', '2010', 'pl2', 'pl3', 'mary.png'),
      person('p3', 'Alex', 'River', 0, '1968-07', '', 'pl3', '', 'alex.png'),
      person('p4', 'Nora', 'Hill', 1, '1970', '', 'pl4', '', 'nora.png'),
      person('p5', 'Omar', 'Vale', 0, '1935', '1988', 'pl5', 'pl1'),
      person('p6', 'Lina', 'Vale', 1, '1936', '1999', 'pl1', 'pl5'),
      person('p7', 'Sam', 'North', 0, '1931', '1992', 'pl2', 'pl4'),
      person('p8', 'Eva', 'West', 1, '1933', '1994', 'pl3', 'pl2'),
      person('p9', 'Paul', 'Lake', 0, '1934', '1991', 'pl4', 'pl3'),
      person('p10', 'Rina', 'Lake', 1, '1937', '2001', 'pl5', 'pl4'),
      person('p11', 'Hadi', 'Oak', 0, '1980', '', 'pl1', ''),
      person('p12', 'Maya', 'Oak', 1, '1982', '', 'pl2', ''),
      person('p13', 'Tariq', 'Oak', 0, '1984', '', 'pl3', ''),
    ],
    places: [
      place('pl1', 'Vancouver, Canada'),
      place('pl2', 'Seattle, United States'),
      place('pl3', 'Portland, United States'),
      place('pl4', 'Victoria, Canada'),
      place('pl5', 'Calgary, Canada'),
    ],
    families: [
      family('f1', 'p1', 'p2', '1965-06-12'),
      family('f2', 'p5', 'p6', '1958'),
      family('f3', 'p7', 'p8', '1960'),
      family('f4', 'p9', 'p10', '1962'),
      family('f5', 'p11', 'p12', '2005'),
    ],
    childRelations: [
      childRelation('cr1', 'f1', 'p3'),
      childRelation('cr2', 'f1', 'p4'),
      childRelation('cr3', 'f2', 'p1'),
      childRelation('cr4', 'f2', 'p2'),
      childRelation('cr5', 'f3', 'p11'),
      childRelation('cr6', 'f4', 'p11'),
      childRelation('cr7', 'f4', 'p12'),
      childRelation('cr8', 'f4', 'p13'),
    ],
  };
}

describe('quizQuestions', () => {
  it('formats partial and qualified dates by difficulty', () => {
    expect(quizDateAnswer('ABT 1 JAN 1940', 'easy')).toBe('1940');
    expect(quizDateAnswer('ABT 1 JAN 1940', 'normal')).toContain('about');
    expect(quizDateAnswer('1968-07', 'normal')).toContain('1968');
  });

  it('builds MacFamilyTree-style question categories with answer choices', () => {
    const result = buildQuizQuestionsFromRecords(fixture(), {
      questionCount: 40,
      difficulty: 'normal',
      categories: ['birthDate', 'birthPlace', 'deathDate', 'deathPlace', 'age', 'parents', 'marriage', 'children'],
      random: () => 0.4,
    });

    expect(result.available).toBeGreaterThan(8);
    expect(result.counts.parents).toBeGreaterThan(0);
    expect(result.counts.children).toBeGreaterThan(0);
    expect(result.questions.every((question) => question.choices.length === 4)).toBe(true);
    expect(result.questions.some((question) => question.prompt.includes('How many children'))).toBe(true);
    expect(result.questions.some((question) => question.choiceMeta?.['John River']?.thumbnail === 'john.png')).toBe(true);

    const marriageResult = buildQuizQuestionsFromRecords({ ...fixture(), childRelations: [] }, {
      questionCount: 10,
      difficulty: 'normal',
      categories: ['marriage'],
      random: () => 0.4,
    });
    expect(marriageResult.questions.some((question) => question.category === 'marriage')).toBe(true);
  });

  it('honors enabled categories and normalized settings', () => {
    const settings = normalizeQuizSettings({ questionCount: 2, difficulty: 'unknown', categories: ['parents', 'bogus'] });
    expect(settings.questionCount).toBe(3);
    expect(settings.difficulty).toBe('normal');
    expect(settings.categories).toEqual(['parents']);

    const result = buildQuizQuestionsFromRecords(fixture(), { ...settings, random: () => 0.2 });
    expect(result.questions.length).toBeLessThanOrEqual(3);
    expect(result.questions.every((question) => question.category === 'parents')).toBe(true);
  });

  it('persists last and best score', () => {
    const store = new Map();
    const storage = {
      getItem: (key) => store.get(key),
      setItem: (key, value) => store.set(key, value),
    };

    expect(readQuizStats(storage).bestTotal).toBe(0);
    expect(writeQuizStats(3, 5, storage)).toMatchObject({ lastScore: 3, lastTotal: 5, bestScore: 3, bestTotal: 5 });
    expect(writeQuizStats(1, 5, storage)).toMatchObject({ lastScore: 1, lastTotal: 5, bestScore: 3, bestTotal: 5 });
    expect(writeQuizStats(4, 5, storage)).toMatchObject({ lastScore: 4, lastTotal: 5, bestScore: 4, bestTotal: 5 });
  });
});
