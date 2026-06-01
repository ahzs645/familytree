/**
 * Family Quiz - MacFamilyTree-style multiple-choice questions generated from
 * the active local tree.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refToRecordName } from '../lib/recordRef.js';
import { personSummary, placeSummary } from '../models/index.js';

const QUESTION_COUNT = 12;
const CHOICE_COUNT = 4;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

function yearFrom(value) {
  return String(value || '').match(/\b(\d{4})\b/)?.[1] || '';
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

function makeQuestion({ id, type, prompt, correct, distractors }) {
  const options = uniqueValues([correct, ...shuffle(distractors)]).slice(0, CHOICE_COUNT);
  if (!correct || options.length < CHOICE_COUNT) return null;
  return {
    id,
    type,
    prompt,
    correct: normalizeAnswer(correct),
    choices: shuffle(options),
  };
}

function choicePool(records, reader, exclude) {
  const excluded = normalizeAnswer(exclude).toLocaleLowerCase();
  return uniqueValues(records.map(reader)).filter((value) => value.toLocaleLowerCase() !== excluded);
}

function placeName(placeId, placeById) {
  const summary = placeSummary(placeById.get(placeId));
  return summary?.displayName || summary?.name || '';
}

async function buildQuestions(n = QUESTION_COUNT) {
  const db = getLocalDatabase();
  const [personResult, familyResult, childRelResult, placeResult] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('Place', { limit: 100000 }),
  ]);

  const persons = personResult.records;
  if (persons.length < CHOICE_COUNT) return [];

  const families = familyResult.records;
  const childRels = childRelResult.records;
  const personById = new Map(persons.map((p) => [p.recordName, p]));
  const placeById = new Map(placeResult.records.map((p) => [p.recordName, p]));
  const childFamily = new Map();
  const childrenByFamily = new Map();

  for (const rel of childRels) {
    const childId = refToRecordName(rel.fields?.child?.value);
    const familyId = refToRecordName(rel.fields?.family?.value);
    if (!childId || !familyId) continue;
    childFamily.set(childId, familyId);
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push(childId);
  }

  const yearDistractors = choicePool(persons, (p) => yearFrom(fieldValue(p, 'cached_birthDate', 'birthDate', 'cached_deathDate', 'deathDate')));
  const birthPlaceDistractors = choicePool(persons, (p) => placeName(refToRecordName(p.fields?.birthPlace?.value), placeById));
  const deathPlaceDistractors = choicePool(persons, (p) => placeName(refToRecordName(p.fields?.deathPlace?.value), placeById));
  const marriageDateDistractors = choicePool(families, (f) => fieldValue(f, 'cached_marriageDate', 'marriageDate'));
  const ageDistractors = uniqueValues(persons.map(ageAtDeath)).filter((age) => Number(age) >= 0);
  const childCountDistractors = uniqueValues(families.map((f) => childLabel(childrenByFamily.get(f.recordName)?.length || 0)));

  const candidates = [];

  for (const person of persons) {
    const name = personName(person);
    const birthDate = fieldValue(person, 'cached_birthDate', 'birthDate');
    const birthYear = yearFrom(birthDate);
    const deathDate = fieldValue(person, 'cached_deathDate', 'deathDate');
    const deathYear = yearFrom(deathDate);
    const birthPlace = placeName(refToRecordName(person.fields?.birthPlace?.value), placeById);
    const deathPlace = placeName(refToRecordName(person.fields?.deathPlace?.value), placeById);
    const deathAge = ageAtDeath(person);

    candidates.push(
      makeQuestion({
        id: `birth-date-${person.recordName}`,
        type: 'Birth date',
        prompt: `When was '${name}' born?`,
        correct: birthYear || birthDate,
        distractors: birthYear ? yearDistractors : choicePool(persons, (p) => fieldValue(p, 'cached_birthDate', 'birthDate'), birthDate),
      }),
      makeQuestion({
        id: `birth-place-${person.recordName}`,
        type: 'Birth place',
        prompt: `Where was '${name}' born?`,
        correct: birthPlace,
        distractors: birthPlaceDistractors,
      }),
      makeQuestion({
        id: `death-date-${person.recordName}`,
        type: 'Death date',
        prompt: `When did '${name}' die?`,
        correct: deathYear || deathDate,
        distractors: deathYear ? yearDistractors : choicePool(persons, (p) => fieldValue(p, 'cached_deathDate', 'deathDate'), deathDate),
      }),
      makeQuestion({
        id: `death-place-${person.recordName}`,
        type: 'Death place',
        prompt: `Where did '${name}' die?`,
        correct: deathPlace,
        distractors: deathPlaceDistractors,
      }),
      makeQuestion({
        id: `age-${person.recordName}`,
        type: 'Age',
        prompt: `How old was '${name}' when ${deathPronoun(person)} died?`,
        correct: deathAge ? `${deathAge} ${deathAge === '1' ? 'Year' : 'Years'}` : '',
        distractors: ageDistractors.map((age) => `${age} ${age === '1' ? 'Year' : 'Years'}`),
      })
    );

    const family = families.find((f) => f.recordName === childFamily.get(person.recordName));
    const fatherId = refToRecordName(family?.fields?.man?.value);
    const motherId = refToRecordName(family?.fields?.woman?.value);
    const father = fatherId ? personById.get(fatherId) : null;
    const mother = motherId ? personById.get(motherId) : null;
    if (father) {
      candidates.push(makeQuestion({
        id: `father-${person.recordName}`,
        type: 'Parents',
        prompt: `Who is ${possessive(name)} father?`,
        correct: personName(father),
        distractors: choicePool(persons.filter((p) => personGender(p) === 0), personName, personName(father)),
      }));
    }
    if (mother) {
      candidates.push(makeQuestion({
        id: `mother-${person.recordName}`,
        type: 'Parents',
        prompt: `Who is ${possessive(name)} mother?`,
        correct: personName(mother),
        distractors: choicePool(persons.filter((p) => personGender(p) === 1), personName, personName(mother)),
      }));
    }
  }

  for (const family of families) {
    const man = personById.get(refToRecordName(family.fields?.man?.value));
    const woman = personById.get(refToRecordName(family.fields?.woman?.value));
    if (!man || !woman) continue;
    const manName = personName(man);
    const womanName = personName(woman);
    const marriageDate = fieldValue(family, 'cached_marriageDate', 'marriageDate');
    const childCount = childrenByFamily.get(family.recordName)?.length || 0;

    candidates.push(
      makeQuestion({
        id: `marriage-${family.recordName}`,
        type: 'Marriage',
        prompt: `When did '${manName}' and '${womanName}' marry?`,
        correct: yearFrom(marriageDate) || marriageDate,
        distractors: yearFrom(marriageDate) ? yearDistractors : marriageDateDistractors,
      }),
      makeQuestion({
        id: `children-${family.recordName}`,
        type: 'Children',
        prompt: `How many children did '${manName}' and '${womanName}' have?`,
        correct: childLabel(childCount),
        distractors: childCountDistractors,
      })
    );
  }

  return shuffle(candidates.filter(Boolean)).slice(0, n);
}

export default function Quiz() {
  const [questions, setQuestions] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [error, setError] = useState('');

  const start = async () => {
    setQuestions(null);
    setError('');
    setIndex(0);
    setPicked(null);
    setAnswers([]);
    try {
      setQuestions(await buildQuestions(QUESTION_COUNT));
    } catch (err) {
      console.error(err);
      setError('The quiz could not be generated from the current tree.');
      setQuestions([]);
    }
  };

  useEffect(() => { start(); }, []);

  const done = questions && questions.length > 0 && answers.length === questions.length;
  const score = useMemo(() => answers.filter((answer) => answer.correct).length, [answers]);

  if (!questions) {
    return (
      <div className="h-full bg-background p-8">
        <div className="mx-auto flex h-full max-w-3xl items-center justify-center text-sm text-muted-foreground">
          Generating questions...
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="h-full bg-background p-8">
        <div className="mx-auto flex h-full max-w-2xl items-center justify-center">
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <HelpCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Family Quiz</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || 'Not enough data has been entered to start the Family Quiz. Add additional persons and families to get more questions.'}
            </p>
            <button onClick={start} className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const percent = Math.round((score / questions.length) * 100);
    return (
      <div className="h-full overflow-auto bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 rounded-lg border border-border bg-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Trophy className="h-4 w-4" />
                  Quiz complete
                </div>
                <h1 className="text-3xl font-bold">{score} / {questions.length}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{percent}% correct</p>
              </div>
              <button onClick={start} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                <RotateCcw className="h-4 w-4" />
                Play again
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {answers.map((answer, answerIndex) => (
              <div key={answer.question.id} className="rounded-md border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  {answer.correct ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" /> : <XCircle className="mt-0.5 h-5 w-5 text-destructive" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-muted-foreground">Question {answerIndex + 1} · {answer.question.type}</div>
                    <div className="mt-1 text-sm font-semibold">{answer.question.prompt}</div>
                    <div className="mt-2 text-sm text-muted-foreground">
                      Your answer: <span className={answer.correct ? 'text-emerald-600' : 'text-destructive'}>{answer.picked}</span>
                      {!answer.correct ? <> · Correct: <span className="text-foreground">{answer.question.correct}</span></> : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const progress = ((index + (picked ? 1 : 0)) / questions.length) * 100;
  const choose = (choice) => {
    if (picked) return;
    setPicked(choice);
  };
  const next = () => {
    if (!picked) return;
    setAnswers((state) => [...state, { question: q, picked, correct: picked === q.correct }]);
    setPicked(null);
    if (index + 1 < questions.length) setIndex((i) => i + 1);
  };

  return (
    <div className="h-full overflow-auto bg-background p-4 sm:p-6">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span>Family Quiz</span>
          <span>Question {index + 1} / {questions.length} · Score {score}</span>
        </div>
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-3 inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {q.type}
          </div>
          <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{q.prompt}</h1>

          <div className="mt-6 grid gap-2">
            {q.choices.map((choice) => {
              const isPicked = picked === choice;
              const isCorrect = picked && choice === q.correct;
              const isWrong = isPicked && choice !== q.correct;
              return (
                <button
                  key={choice}
                  disabled={!!picked}
                  onClick={() => choose(choice)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-md border px-3 py-3 text-left text-sm transition-colors ${
                    isCorrect ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700' :
                    isWrong ? 'border-destructive bg-destructive/10 text-destructive' :
                    'border-border bg-background hover:bg-secondary/50'
                  }`}
                >
                  <span className="min-w-0 break-words">{choice}</span>
                  {isCorrect ? <CheckCircle2 className="ml-3 h-4 w-4 shrink-0" /> : null}
                  {isWrong ? <XCircle className="ml-3 h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>

          <button
            disabled={!picked}
            onClick={next}
            className="mt-5 w-full rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {index + 1 >= questions.length ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
