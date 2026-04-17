/**
 * Family Quiz — generates simple multiple-choice questions about persons in
 * the tree. "Who are X's parents?", "When was Y born?".
 */
import React, { useEffect, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refToRecordName } from '../lib/recordRef.js';
import { personSummary } from '../models/index.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function buildQuestions(n = 10) {
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  if (persons.length < 4) return [];
  const personById = new Map(persons.map((p) => [p.recordName, p]));
  const families = (await db.query('Family', { limit: 100000 })).records;
  const childRels = (await db.query('ChildRelation', { limit: 100000 })).records;

  const childFamily = new Map();
  for (const cr of childRels) {
    const c = refToRecordName(cr.fields?.child?.value);
    const f = refToRecordName(cr.fields?.family?.value);
    if (c && f) childFamily.set(c, f);
  }
  const familyById = new Map(families.map((f) => [f.recordName, f]));

  const questions = [];
  for (let i = 0; i < n * 4 && questions.length < n; i++) {
    const focus = persons[Math.floor(Math.random() * persons.length)];
    const f = focus.fields || {};
    const sum = personSummary(focus);

    const r = Math.random();
    if (r < 0.4 && f.cached_birthDate?.value) {
      const yearMatch = String(f.cached_birthDate.value).match(/(\d{4})/);
      if (!yearMatch) continue;
      const correct = yearMatch[1];
      const distractors = shuffle(persons)
        .map((p) => String(p.fields?.cached_birthDate?.value || '').match(/(\d{4})/)?.[1])
        .filter((y) => y && y !== correct).slice(0, 3);
      if (distractors.length < 3) continue;
      questions.push({
        prompt: `When was ${sum.fullName} born?`,
        choices: shuffle([correct, ...distractors]),
        correct,
      });
    } else if (childFamily.has(focus.recordName)) {
      const fam = familyById.get(childFamily.get(focus.recordName));
      const fatherId = refToRecordName(fam?.fields?.man?.value);
      const father = fatherId ? personById.get(fatherId) : null;
      if (!father) continue;
      const correct = personSummary(father).fullName;
      const distractors = shuffle(persons)
        .filter((p) => p.recordName !== father.recordName && p.fields?.gender?.value === 0)
        .slice(0, 3).map((p) => personSummary(p).fullName);
      if (distractors.length < 3) continue;
      questions.push({
        prompt: `Who is ${sum.fullName}'s father?`,
        choices: shuffle([correct, ...distractors]),
        correct,
      });
    }
  }
  return questions;
}

export default function Quiz() {
  const [questions, setQuestions] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const start = async () => {
    const qs = await buildQuestions(10);
    setQuestions(qs);
    setIndex(0);
    setPicked(null);
    setScore(0);
    setDone(false);
  };

  useEffect(() => { start(); }, []);

  if (!questions) return <div className="p-10 text-muted-foreground">Generating questions…</div>;
  if (questions.length === 0) {
    return <div className="p-10 text-muted-foreground">Not enough data to generate quiz questions.</div>;
  }

  if (done) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background p-10">
        <div className="text-3xl font-bold mb-2">{score} / {questions.length}</div>
        <div className="text-sm text-muted-foreground mb-6">Quiz complete.</div>
        <button onClick={start} className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-semibold">Play again</button>
      </div>
    );
  }

  const q = questions[index];
  const next = () => {
    if (picked === q.correct) setScore((s) => s + 1);
    setPicked(null);
    if (index + 1 >= questions.length) setDone(true);
    else setIndex((i) => i + 1);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center bg-background p-6">
      <div className="max-w-md w-full">
        <div className="text-xs text-muted-foreground mb-3">Question {index + 1} / {questions.length} · Score {score}</div>
        <div className="text-xl font-semibold mb-5">{q.prompt}</div>
        <div className="space-y-2">
          {q.choices.map((c) => {
            const isPicked = picked === c;
            const isCorrect = picked && c === q.correct;
            const isWrong = isPicked && c !== q.correct;
            return (
              <button key={c} disabled={!!picked} onClick={() => setPicked(c)}
                className={`w-full text-left p-3 rounded-md border transition-colors ${
                  isCorrect ? 'border-emerald-500 bg-emerald-500/10' :
                  isWrong ? 'border-destructive bg-destructive/10' :
                  isPicked ? 'border-primary bg-primary/10' :
                  'border-border bg-card hover:bg-secondary/40'
                }`}>
                {c}
              </button>
            );
          })}
        </div>
        <button disabled={!picked} onClick={next}
          className="mt-5 w-full bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
          {index + 1 >= questions.length ? 'Finish' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
