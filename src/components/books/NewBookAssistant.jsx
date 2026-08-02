import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check } from 'lucide-react';
import {
  ASSISTANT_BOOK_TYPES,
  BOOK_THEME_PRESETS,
  DEFAULT_BOOK_THEME_ID,
  SECTION_KINDS,
  bookFromAssistant,
  buildAssistantSectionPlan,
} from '../../lib/books.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { LanguageSelect } from '../LanguageSelect.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { cn } from '../../lib/utils.js';

const selectClass = 'mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary';

export function NewBookAssistant({ persons, families = [], initialPersonId, outputLanguage = 'en', onFinish, onCancel }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    bookType: 'person',
    title: t('books.defaultTitle'),
    subtitle: '',
    author: '',
    date: '',
    targetPersonId: initialPersonId || persons[0]?.recordName || '',
    targetFamilyId: families[0]?.recordName || '',
    generationsUp: 5,
    generationsDown: 4,
    includeSources: true,
    includeMedia: true,
    includeNotes: true,
    outputLanguage,
    themeId: DEFAULT_BOOK_THEME_ID,
  });
  const focusRef = useRef(null);
  const previousFocusRef = useRef(null);
  const steps = [
    t('books.assistant.steps.type'),
    t('books.assistant.steps.subject'),
    t('books.assistant.steps.scope'),
    t('books.assistant.steps.presentation'),
    t('books.assistant.steps.plan'),
  ];
  const plan = useMemo(() => buildAssistantSectionPlan(draft), [draft]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => previousFocusRef.current?.focus?.());
    };
  }, [onCancel]);

  useEffect(() => {
    requestAnimationFrame(() => focusRef.current?.focus?.());
  }, [step]);

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const needsPerson = draft.bookType !== 'empty' && draft.bookType !== 'family';
  const needsFamily = draft.bookType === 'family';
  const subjectReady = (!needsPerson || !!draft.targetPersonId) && (!needsFamily || !!draft.targetFamilyId);
  const canContinue = step !== 1 || subjectReady;

  const finish = async () => {
    setBusy(true);
    try {
      await onFinish(bookFromAssistant(draft));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t('books.assistant.title')}
      subtitle={t('books.assistant.stepOf', { current: step + 1, total: steps.length, name: steps[step] })}
      maxWidth="max-w-3xl"
      scroll="card"
      maxHeight="max-h-[90vh]"
      bodyClassName="space-y-5 p-5"
      footerClassName="flex items-center justify-between gap-3"
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" size="sm" onClick={() => setStep((value) => value - 1)}>{t('common.back')}</Button>}
            {step < steps.length - 1
              ? <Button variant="primary" size="sm" disabled={!canContinue} onClick={() => setStep((value) => value + 1)}>{t('common.next')}</Button>
              : <Button variant="primary" size="sm" disabled={busy} onClick={finish}>{busy ? t('books.assistant.creating') : t('books.assistant.create')}</Button>}
          </div>
        </>
      )}
    >
      <ol className="grid grid-cols-5 gap-2" aria-label={t('books.assistant.progress')}>
        {steps.map((name, index) => (
          <li key={name} className={cn('rounded-md px-2 py-1.5 text-center text-2xs', index === step ? 'bg-primary text-primary-foreground' : index < step ? 'bg-success/15 text-success-text' : 'bg-secondary text-muted-foreground')}>
            {index < step ? <Check className="me-1 inline" size={12} /> : null}{name}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">{t('books.assistant.chooseType')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {ASSISTANT_BOOK_TYPES.map((type, index) => (
              <label key={type.id} className={cn('flex cursor-pointer gap-3 rounded-lg border p-4', draft.bookType === type.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent')}>
                <input ref={index === 0 ? focusRef : undefined} type="radio" name="book-type" value={type.id} checked={draft.bookType === type.id} onChange={() => set('bookType', type.id)} />
                <span><span className="block text-sm font-semibold">{t(type.labelKey)}</span><span className="mt-1 block text-xs text-muted-foreground">{t(`books.assistant.typeDescriptions.${type.id}`)}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(`books.assistant.subjectHelp.${draft.bookType}`)}</p>
          {needsPerson && <div><div className="mb-1 text-xs font-medium">{t('books.config.startPerson')}</div><PersonPicker persons={persons} value={draft.targetPersonId} onChange={(value) => set('targetPersonId', value)} triggerClassName="ring-offset-background" ariaLabel={t('books.config.startPerson')} /></div>}
          {needsFamily && (
            <label className="block text-xs font-medium">
              {t('books.config.targetFamily')}
              <select ref={focusRef} value={draft.targetFamilyId} onChange={(event) => {
                const family = families.find((entry) => entry.recordName === event.target.value);
                setDraft((current) => ({ ...current, targetFamilyId: event.target.value, targetPersonId: family?.primaryPersonRecordName || current.targetPersonId }));
              }} className={selectClass}>
                <option value="">{t('books.config.selectFamily')}</option>
                {families.map((family) => <option key={family.recordName} value={family.recordName}>{family.label}</option>)}
              </select>
            </label>
          )}
          {draft.bookType === 'empty' && <div ref={focusRef} tabIndex={-1} className="rounded-md border border-border bg-secondary p-4 text-sm">{t('books.assistant.emptyHelp')}</div>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium">{t('books.assistant.generationsUp')}<Input ref={focusRef} className="mt-1" type="number" min={1} max={12} value={draft.generationsUp} onChange={(event) => set('generationsUp', Number(event.target.value) || 1)} /></label>
            <label className="text-xs font-medium">{t('books.assistant.generationsDown')}<Input className="mt-1" type="number" min={1} max={12} value={draft.generationsDown} onChange={(event) => set('generationsDown', Number(event.target.value) || 1)} /></label>
          </div>
          <fieldset className="rounded-md border border-border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">{t('books.config.include')}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <CheckField label={t('books.config.sources')} checked={draft.includeSources} onChange={(value) => set('includeSources', value)} />
              <CheckField label={t('books.config.media')} checked={draft.includeMedia} onChange={(value) => set('includeMedia', value)} />
              <CheckField label={t('books.config.notes')} checked={draft.includeNotes} onChange={(value) => set('includeNotes', value)} />
            </div>
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium">{t('books.config.title')}<Input ref={focusRef} className="mt-1" value={draft.title} onChange={(event) => set('title', event.target.value)} /></label>
            <label className="text-xs font-medium">{t('books.config.subtitle')}<Input className="mt-1" value={draft.subtitle} onChange={(event) => set('subtitle', event.target.value)} /></label>
            <label className="text-xs font-medium">{t('books.config.author')}<Input className="mt-1" value={draft.author} onChange={(event) => set('author', event.target.value)} /></label>
            <label className="text-xs font-medium">{t('books.config.date')}<Input className="mt-1" value={draft.date} onChange={(event) => set('date', event.target.value)} /></label>
            <div><div className="mb-1 text-xs font-medium">{t('books.assistant.outputLanguage')}</div><LanguageSelect value={draft.outputLanguage} onChange={(value) => set('outputLanguage', value)} ariaLabel={t('books.assistant.outputLanguage')} align="start" /></div>
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-medium">{t('books.bookTheme')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BOOK_THEME_PRESETS.map((theme) => (
                <label key={theme.id} className={cn('cursor-pointer rounded-md border p-2', draft.themeId === theme.id ? 'border-primary ring-2 ring-primary/20' : 'border-border')} style={{ background: theme.preview.background, color: theme.preview.foreground }}>
                  <input className="sr-only" type="radio" name="book-theme" value={theme.id} checked={draft.themeId === theme.id} onChange={() => set('themeId', theme.id)} />
                  <span className="block border-s-4 ps-2 text-sm font-semibold" style={{ borderColor: theme.preview.accent }}>{t(theme.labelKey)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 4 && (
        <div ref={focusRef} tabIndex={-1} className="space-y-4 outline-none">
          <div className="flex items-center gap-3 rounded-md border border-border bg-secondary p-3">
            <BookOpen size={22} className="text-primary" />
            <div><div className="font-semibold">{draft.title || t('books.defaultTitle')}</div><div className="text-xs text-muted-foreground">{t(ASSISTANT_BOOK_TYPES.find((entry) => entry.id === draft.bookType)?.labelKey)} · {t(BOOK_THEME_PRESETS.find((entry) => entry.id === draft.themeId)?.labelKey)}</div></div>
          </div>
          <ol className="space-y-2">
            {plan.map((section, index) => {
              const def = SECTION_KINDS.find((entry) => entry.id === section.kind);
              return <li key={`${section.kind}-${index}`} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-semibold">{index + 1}</span><span>{def ? t(def.labelKey) : section.kind}</span>{section.generations ? <span className="ms-auto text-xs text-muted-foreground">{t('books.assistant.generationCount', { count: section.generations })}</span> : null}</li>;
            })}
          </ol>
        </div>
      )}
    </Sheet>
  );
}

function CheckField({ label, checked, onChange }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

export default NewBookAssistant;
