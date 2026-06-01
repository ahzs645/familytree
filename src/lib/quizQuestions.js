import { refToRecordName } from './recordRef.js';
import { formatEventDate, parseEventDate } from '../utils/formatDate.js';
import { personSummary, placeSummary } from '../models/index.js';

export const QUIZ_STORAGE_KEY = 'cloudtreeweb.familyQuiz.stats';
export const QUIZ_CATEGORY_DEFS = Object.freeze([
  { id: 'birthDate', label: 'Birth dates' },
  { id: 'birthPlace', label: 'Birth places' },
  { id: 'deathDate', label: 'Death dates' },
  { id: 'deathPlace', label: 'Death places' },
  { id: 'age', label: 'Ages' },
  { id: 'parents', label: 'Parents' },
  { id: 'marriage', label: 'Marriages' },
  { id: 'children', label: 'Children' },
]);

export const DEFAULT_QUIZ_SETTINGS = Object.freeze({
  questionCount: 12,
  difficulty: 'normal',
  categories: QUIZ_CATEGORY_DEFS.map((category) => category.id),
});

export const DIFFICULTY_OPTIONS = Object.freeze([
  { value: 'easy', label: 'Easy' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Hard' },
]);

const CHOICE_COUNT = 4;

function defaultRandom() {
  return Math.random();
}

export function normalizeQuizSettings(settings = {}) {
  const validCategories = new Set(QUIZ_CATEGORY_DEFS.map((category) => category.id));
  const categories = Array.isArray(settings.categories)
    ? settings.categories.filter((category) => validCategories.has(category))
    : DEFAULT_QUIZ_SETTINGS.categories;
  const difficulty = DIFFICULTY_OPTIONS.some((option) => option.value === settings.difficulty)
    ? settings.difficulty
    : DEFAULT_QUIZ_SETTINGS.difficulty;
  const questionCount = Math.max(3, Math.min(50, Number(settings.questionCount) || DEFAULT_QUIZ_SETTINGS.questionCount));
  return {
    questionCount,
    difficulty,
    categories: categories.length ? categories : DEFAULT_QUIZ_SETTINGS.categories,
  };
}

export function shuffle(arr, random = defaultRandom) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fieldValue(record, ...names) {
  for (const name of names) {
    const value = record?.fields?.[name]?.value;
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

export function yearFrom(value) {
  return parseEventDate(value)?.year ? String(parseEventDate(value).year) : '';
}

export function quizDateAnswer(value, difficulty = 'normal') {
  if (!value) return '';
  if (difficulty === 'easy') return yearFrom(value) || String(value);
  return formatEventDate(value);
}

function normalizeAnswer(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function uniqueValues(values) {
  const seen = new Set();
  const out = [];
  for (const value of values.map(normalizeAnswer).filter(Boolean)) {
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function personName(person) {
  return personSummary(person)?.fullName || 'No name recorded';
}

function personThumb(person) {
  return personSummary(person)?.thumbnail || '';
}

function personGender(person) {
  return Number(person?.fields?.gender?.value ?? personSummary(person)?.gender);
}

function possessive(name) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

function deathPronoun(person) {
  return personGender(person) === 1 ? 'she' : 'he';
}

function ageAtDeath(person) {
  const birthYear = Number(yearFrom(fieldValue(person, 'cached_birthDate', 'birthDate')));
  const deathYear = Number(yearFrom(fieldValue(person, 'cached_deathDate', 'deathDate')));
  if (!birthYear || !deathYear || deathYear < birthYear) return '';
  return String(deathYear - birthYear);
}

function childLabel(count) {
  return `${count} ${count === 1 ? 'Child' : 'Children'}`;
}

function placeName(placeId, placeById) {
  const summary = placeSummary(placeById.get(placeId));
  return summary?.displayName || summary?.name || '';
}

function choicePool(records, reader, exclude) {
  const excluded = normalizeAnswer(exclude).toLocaleLowerCase();
  return uniqueValues(records.map(reader)).filter((value) => value.toLocaleLowerCase() !== excluded);
}

function narrowNumberDistractors(correct, values, spread) {
  const target = Number(correct);
  if (!Number.isFinite(target)) return values;
  const close = values.filter((value) => Math.abs(Number(value) - target) <= spread);
  return close.length >= 3 ? close : values;
}

function makeQuestion({ id, category, type, prompt, correct, distractors, subject, choiceMeta = {}, difficulty, random }) {
  const pool = difficulty === 'easy' ? shuffle(distractors, random).slice(0, 6) : distractors;
  const options = uniqueValues([correct, ...shuffle(pool, random)]).slice(0, CHOICE_COUNT);
  if (!correct || options.length < CHOICE_COUNT) return null;
  return {
    id,
    category,
    type,
    prompt,
    correct: normalizeAnswer(correct),
    choices: shuffle(options, random),
    subject,
    choiceMeta,
  };
}

export function buildQuizContext({ persons = [], families = [], childRelations = [], places = [] } = {}) {
  const personById = new Map(persons.map((p) => [p.recordName, p]));
  const placeById = new Map(places.map((p) => [p.recordName, p]));
  const childFamily = new Map();
  const childrenByFamily = new Map();

  for (const rel of childRelations) {
    const childId = refToRecordName(rel.fields?.child?.value);
    const familyId = refToRecordName(rel.fields?.family?.value);
    if (!childId || !familyId) continue;
    childFamily.set(childId, familyId);
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push(childId);
  }

  return { persons, families, childRelations, places, personById, placeById, childFamily, childrenByFamily };
}

export function buildQuizQuestionsFromRecords(records, options = {}) {
  const settings = normalizeQuizSettings(options);
  const random = options.random || defaultRandom;
  const enabled = new Set(settings.categories);
  const ctx = buildQuizContext(records);
  const { persons, families, personById, placeById, childFamily, childrenByFamily } = ctx;
  if (persons.length < CHOICE_COUNT) return options._skipCounts ? { questions: [] } : { questions: [], counts: categoryCounts(ctx, settings), available: 0 };

  const dateReader = (fieldA, fieldB) => (record) => quizDateAnswer(fieldValue(record, fieldA, fieldB), settings.difficulty);
  const birthDateDistractors = choicePool(persons, dateReader('cached_birthDate', 'birthDate'));
  const deathDateDistractors = choicePool(persons, dateReader('cached_deathDate', 'deathDate'));
  const birthPlaceDistractors = choicePool(persons, (p) => placeName(refToRecordName(p.fields?.birthPlace?.value), placeById));
  const deathPlaceDistractors = choicePool(persons, (p) => placeName(refToRecordName(p.fields?.deathPlace?.value), placeById));
  const marriageDateDistractors = choicePool(families, dateReader('cached_marriageDate', 'marriageDate'));
  const ageDistractors = uniqueValues(persons.map(ageAtDeath)).filter((age) => Number(age) >= 0);
  const childCountDistractors = uniqueValues(families.map((f) => childLabel(childrenByFamily.get(f.recordName)?.length || 0)));

  const candidates = [];
  const add = (question) => { if (question && enabled.has(question.category)) candidates.push(question); };

  for (const person of persons) {
    const name = personName(person);
    const subject = { name, thumbnail: personThumb(person) };
    const birthDate = quizDateAnswer(fieldValue(person, 'cached_birthDate', 'birthDate'), settings.difficulty);
    const deathDate = quizDateAnswer(fieldValue(person, 'cached_deathDate', 'deathDate'), settings.difficulty);
    const birthPlace = placeName(refToRecordName(person.fields?.birthPlace?.value), placeById);
    const deathPlace = placeName(refToRecordName(person.fields?.deathPlace?.value), placeById);
    const deathAge = ageAtDeath(person);

    add(makeQuestion({ id: `birth-date-${person.recordName}`, category: 'birthDate', type: 'Birth date', prompt: `When was '${name}' born?`, correct: birthDate, distractors: birthDateDistractors, subject, difficulty: settings.difficulty, random }));
    add(makeQuestion({ id: `birth-place-${person.recordName}`, category: 'birthPlace', type: 'Birth place', prompt: `Where was '${name}' born?`, correct: birthPlace, distractors: birthPlaceDistractors, subject, difficulty: settings.difficulty, random }));
    add(makeQuestion({ id: `death-date-${person.recordName}`, category: 'deathDate', type: 'Death date', prompt: `When did '${name}' die?`, correct: deathDate, distractors: deathDateDistractors, subject, difficulty: settings.difficulty, random }));
    add(makeQuestion({ id: `death-place-${person.recordName}`, category: 'deathPlace', type: 'Death place', prompt: `Where did '${name}' die?`, correct: deathPlace, distractors: deathPlaceDistractors, subject, difficulty: settings.difficulty, random }));
    add(makeQuestion({
      id: `age-${person.recordName}`,
      category: 'age',
      type: 'Age',
      prompt: `How old was '${name}' when ${deathPronoun(person)} died?`,
      correct: deathAge ? `${deathAge} ${deathAge === '1' ? 'Year' : 'Years'}` : '',
      distractors: narrowNumberDistractors(deathAge, ageDistractors, settings.difficulty === 'hard' ? 10 : 25).map((age) => `${age} ${age === '1' ? 'Year' : 'Years'}`),
      subject,
      difficulty: settings.difficulty,
      random,
    }));

    const family = families.find((f) => f.recordName === childFamily.get(person.recordName));
    const father = personById.get(refToRecordName(family?.fields?.man?.value));
    const mother = personById.get(refToRecordName(family?.fields?.woman?.value));
    const choiceMeta = Object.fromEntries(persons.map((p) => [personName(p), { thumbnail: personThumb(p) }]));
    if (father) {
      add(makeQuestion({ id: `father-${person.recordName}`, category: 'parents', type: 'Parents', prompt: `Who is ${possessive(name)} father?`, correct: personName(father), distractors: choicePool(persons.filter((p) => personGender(p) === 0), personName, personName(father)), subject, choiceMeta, difficulty: settings.difficulty, random }));
    }
    if (mother) {
      add(makeQuestion({ id: `mother-${person.recordName}`, category: 'parents', type: 'Parents', prompt: `Who is ${possessive(name)} mother?`, correct: personName(mother), distractors: choicePool(persons.filter((p) => personGender(p) === 1), personName, personName(mother)), subject, choiceMeta, difficulty: settings.difficulty, random }));
    }
  }

  for (const family of families) {
    const man = personById.get(refToRecordName(family.fields?.man?.value));
    const woman = personById.get(refToRecordName(family.fields?.woman?.value));
    if (!man || !woman) continue;
    const manName = personName(man);
    const womanName = personName(woman);
    const subject = { name: `${manName} and ${womanName}` };
    const marriageDate = quizDateAnswer(fieldValue(family, 'cached_marriageDate', 'marriageDate'), settings.difficulty);
    const childCount = childrenByFamily.get(family.recordName)?.length || 0;
    add(makeQuestion({ id: `marriage-${family.recordName}`, category: 'marriage', type: 'Marriage', prompt: `When did '${manName}' and '${womanName}' marry?`, correct: marriageDate, distractors: marriageDateDistractors, subject, difficulty: settings.difficulty, random }));
    add(makeQuestion({ id: `children-${family.recordName}`, category: 'children', type: 'Children', prompt: `How many children did '${manName}' and '${womanName}' have?`, correct: childLabel(childCount), distractors: childCountDistractors, subject, difficulty: settings.difficulty, random }));
  }

  const questions = shuffle(candidates, random).slice(0, settings.questionCount);
  if (options._skipCounts) return { questions };
  return { questions, counts: categoryCounts(ctx, settings), available: candidates.length };
}

export function categoryCounts(ctx, settings = DEFAULT_QUIZ_SETTINGS) {
  const normalized = normalizeQuizSettings(settings);
  const counts = Object.fromEntries(QUIZ_CATEGORY_DEFS.map((category) => [category.id, 0]));
  const result = buildQuizQuestionsFromRecordsWithoutCounts(ctx, normalized);
  for (const question of result) counts[question.category] += 1;
  return counts;
}

function buildQuizQuestionsFromRecordsWithoutCounts(ctx, settings) {
  const result = buildQuizQuestionsFromRecords({
    persons: ctx.persons,
    families: ctx.families,
    childRelations: ctx.childRelations,
    places: ctx.places,
  }, { ...settings, questionCount: 100000, random: () => 0.5, _skipCounts: true });
  return result.questions || [];
}

export async function loadQuizData(db) {
  const [personResult, familyResult, childRelResult, placeResult] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('Place', { limit: 100000 }),
  ]);
  return {
    persons: personResult.records,
    families: familyResult.records,
    childRelations: childRelResult.records,
    places: placeResult.records,
  };
}

export async function buildQuizQuestions(db, settings = DEFAULT_QUIZ_SETTINGS) {
  return buildQuizQuestionsFromRecords(await loadQuizData(db), settings);
}

export function readQuizStats(storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(QUIZ_STORAGE_KEY)) || { bestScore: 0, bestTotal: 0, lastScore: 0, lastTotal: 0 };
  } catch {
    return { bestScore: 0, bestTotal: 0, lastScore: 0, lastTotal: 0 };
  }
}

export function writeQuizStats(score, total, storage = globalThis.localStorage) {
  const prev = readQuizStats(storage);
  const bestPct = prev.bestTotal ? prev.bestScore / prev.bestTotal : -1;
  const nextPct = total ? score / total : 0;
  const next = {
    lastScore: score,
    lastTotal: total,
    bestScore: nextPct >= bestPct ? score : prev.bestScore,
    bestTotal: nextPct >= bestPct ? total : prev.bestTotal,
  };
  storage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(next));
  return next;
}
