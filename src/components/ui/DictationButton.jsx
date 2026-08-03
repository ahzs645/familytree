import React from 'react';
import { Mic, Square } from 'lucide-react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { appendDictation, useSpeechRecognition } from '../../lib/useSpeechRecognition.js';

export function DictationButton({ value, onChange, className = '' }) {
  const { t, localization } = useTranslation();
  const { supported, listening, toggle } = useSpeechRecognition({
    locale: localization?.locale,
    onTranscript: (transcript) => onChange(appendDictation(value, transcript)),
  });
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      title={listening ? t('dictation.stop') : t('dictation.start')}
      aria-label={listening ? t('dictation.stop') : t('dictation.start')}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 text-xs hover:bg-accent ${listening ? 'text-destructive-text' : ''} ${className}`}
    >
      {listening ? <Square size={13} aria-hidden /> : <Mic size={14} aria-hidden />}
      <span>{listening ? t('dictation.stop') : t('dictation.start')}</span>
    </button>
  );
}

export default DictationButton;
