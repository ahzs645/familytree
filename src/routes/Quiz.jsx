import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HelpCircle, ImageIcon, RotateCcw, Settings2, Trophy, XCircle } from 'lucide-react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import {
  DEFAULT_QUIZ_SETTINGS,
  DIFFICULTY_OPTIONS,
  QUIZ_CATEGORY_DEFS,
  buildQuizQuestions,
  normalizeQuizSettings,
  readQuizStats,
  writeQuizStats,
} from '../lib/quizQuestions.js';

const EMPTY_TEXT = 'Not enough data has been entered to start the Family Quiz. Add additional persons and families to get more questions.';

function ScoreLine({ label, score, total }) {
  if (!total) return null;
  return <span>{label}: {score} / {total}</span>;
}

function Avatar({ src, label, size = 'h-10 w-10' }) {
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-full border border-border bg-secondary`}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-4 w-4" aria-label={label || 'No image'} />
        </div>
      )}
    </div>
  );
}

function CategoryToggle({ category, enabled, count, onToggle }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm ${enabled ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'}`}>
      <span className="flex items-center gap-2">
        <input type="checkbox" className="h-4 w-4" checked={enabled} onChange={onToggle} />
        {category.label}
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </label>
  );
}

function StartScreen({ settings, setSettings, counts, stats, loading, error, onStart }) {
  const enabledAvailable = settings.categories.reduce((sum, category) => sum + (counts?.[category] || 0), 0);
  const toggleCategory = (categoryId) => {
    setSettings((state) => {
      const has = state.categories.includes(categoryId);
      const categories = has ? state.categories.filter((id) => id !== categoryId) : [...state.categories, categoryId];
      return normalizeQuizSettings({ ...state, categories });
    });
  };

  return (
    <div className="h-full overflow-auto bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              Family Quiz
            </div>
            <h1 className="text-2xl font-bold">Build a quiz from this tree</h1>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <ScoreLine label="Last" score={stats.lastScore} total={stats.lastTotal} />
            <ScoreLine label="Best" score={stats.bestScore} total={stats.bestTotal} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Categories</h2>
              <span className="text-xs text-muted-foreground">{enabledAvailable} available</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUIZ_CATEGORY_DEFS.map((category) => (
                <CategoryToggle
                  key={category.id}
                  category={category}
                  enabled={settings.categories.includes(category.id)}
                  count={counts?.[category.id] || 0}
                  onToggle={() => toggleCategory(category.id)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-semibold">Settings</h2>
            <label className="mb-4 block text-xs font-medium text-muted-foreground">
              Questions
              <input
                type="number"
                min="3"
                max="50"
                value={settings.questionCount}
                onChange={(e) => setSettings((state) => normalizeQuizSettings({ ...state, questionCount: e.target.value }))}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="mb-5 text-xs font-medium text-muted-foreground">
              Difficulty
              <div className="mt-1 grid grid-cols-3 overflow-hidden rounded-md border border-border">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSettings((state) => normalizeQuizSettings({ ...state, difficulty: option.value }))}
                    className={`px-2 py-2 text-sm ${settings.difficulty === option.value ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground hover:bg-secondary/50'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
            <button
              disabled={loading || enabledAvailable === 0}
              onClick={onStart}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Start quiz'}
            </button>
          </div>
        </div>

        {!loading && enabledAvailable === 0 ? (
          <div className="mt-4 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">{EMPTY_TEXT}</div>
        ) : null}
      </div>
    </div>
  );
}

function FinishedScreen({ answers, questions, stats, onRestart, onMissed }) {
  const score = answers.filter((answer) => answer.correct).length;
  const percent = Math.round((score / questions.length) * 100);
  const missed = answers.filter((answer) => !answer.correct);

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
              <p className="mt-1 text-sm text-muted-foreground">{percent}% correct · Best {stats.bestScore} / {stats.bestTotal}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={onRestart} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                <RotateCcw className="h-4 w-4" />
                New quiz
              </button>
              <button disabled={!missed.length} onClick={onMissed} className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Review missed
              </button>
            </div>
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

function QuestionScreen({ q, index, total, picked, score, choose, next }) {
  const progress = ((index + (picked ? 1 : 0)) / total) * 100;
  return (
    <div className="h-full overflow-auto bg-background p-4 sm:p-6">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span>Family Quiz</span>
          <span>Question {index + 1} / {total} · Score {score}</span>
        </div>
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            {q.subject?.thumbnail ? <Avatar src={q.subject.thumbnail} label={q.subject.name} /> : null}
            <div>
              <div className="mb-1 inline-flex rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">{q.type}</div>
              <h1 className="text-xl font-semibold leading-snug sm:text-2xl">{q.prompt}</h1>
            </div>
          </div>

          <div className="mt-6 grid gap-2">
            {q.choices.map((choice) => {
              const isPicked = picked === choice;
              const isCorrect = picked && choice === q.correct;
              const isWrong = isPicked && choice !== q.correct;
              const meta = q.choiceMeta?.[choice];
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
                  <span className="flex min-w-0 items-center gap-3">
                    {meta?.thumbnail ? <Avatar src={meta.thumbnail} label={choice} size="h-8 w-8" /> : null}
                    <span className="min-w-0 break-words">{choice}</span>
                  </span>
                  {isCorrect ? <CheckCircle2 className="ml-3 h-4 w-4 shrink-0" /> : null}
                  {isWrong ? <XCircle className="ml-3 h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>

          <button disabled={!picked} onClick={next} className="mt-5 w-full rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {index + 1 >= total ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Quiz() {
  const [settings, setSettings] = useState(() => normalizeQuizSettings(DEFAULT_QUIZ_SETTINGS));
  const [counts, setCounts] = useState(null);
  const [stats, setStats] = useState(() => readQuizStats());
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('start');

  useEffect(() => {
    let alive = true;
    async function loadCounts() {
      setLoading(true);
      try {
        const result = await buildQuizQuestions(getLocalDatabase(), { ...settings, questionCount: 100000 });
        if (alive) setCounts(result.counts);
      } catch (err) {
        console.error(err);
        if (alive) setError('The quiz could not inspect the current tree.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadCounts();
    return () => { alive = false; };
  }, [settings.categories, settings.difficulty]);

  const score = useMemo(() => answers.filter((answer) => answer.correct).length, [answers]);
  const done = mode === 'play' && questions.length > 0 && answers.length === questions.length;

  useEffect(() => {
    if (!done) return;
    setStats(writeQuizStats(score, questions.length));
  }, [done, questions.length, score]);

  const start = async () => {
    setLoading(true);
    setError('');
    setIndex(0);
    setPicked(null);
    setAnswers([]);
    try {
      const result = await buildQuizQuestions(getLocalDatabase(), settings);
      setCounts(result.counts);
      if (!result.questions.length) {
        setQuestions([]);
        setMode('start');
        setError(EMPTY_TEXT);
        return;
      }
      setQuestions(result.questions);
      setMode('play');
    } catch (err) {
      console.error(err);
      setError('The quiz could not be generated from the current tree.');
    } finally {
      setLoading(false);
    }
  };

  const restart = async () => {
    setMode('start');
    setQuestions([]);
    setAnswers([]);
    setIndex(0);
    setPicked(null);
    setStats(readQuizStats());
  };

  const reviewMissed = () => {
    const missed = answers.filter((answer) => !answer.correct).map((answer) => answer.question);
    if (!missed.length) return;
    setQuestions(missed);
    setAnswers([]);
    setPicked(null);
    setIndex(0);
    setMode('play');
  };

  if (mode === 'start') {
    return <StartScreen settings={settings} setSettings={setSettings} counts={counts} stats={stats} loading={loading} error={error} onStart={start} />;
  }

  if (done) {
    return <FinishedScreen answers={answers} questions={questions} stats={stats} onRestart={restart} onMissed={reviewMissed} />;
  }

  if (!questions.length) {
    return (
      <div className="h-full bg-background p-8">
        <div className="mx-auto flex h-full max-w-2xl items-center justify-center">
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <HelpCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Family Quiz</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error || EMPTY_TEXT}</p>
            <button onClick={() => setMode('start')} className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Back to settings</button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[index];
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

  return <QuestionScreen q={q} index={index} total={questions.length} picked={picked} score={score} choose={choose} next={next} />;
}
