import { useCallback, useEffect, useRef, useState } from 'react';

export function speechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Shared Web Speech API controller. Unsupported browsers get no UI. */
export function useSpeechRecognition({ locale, onTranscript }) {
  const constructor = speechRecognitionConstructor();
  const recognitionRef = useRef(null);
  const transcriptCallback = useRef(onTranscript);
  const [listening, setListening] = useState(false);

  useEffect(() => { transcriptCallback.current = onTranscript; }, [onTranscript]);

  useEffect(() => () => {
    recognitionRef.current?.abort?.();
    recognitionRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (!constructor) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recognition = new constructor();
    recognition.lang = locale || document.documentElement.lang || navigator.language || 'en';
    recognition.interimResults = false;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) transcript += event.results[index][0]?.transcript || '';
      }
      if (transcript.trim()) transcriptCallback.current?.(transcript.trim());
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [constructor, locale]);

  return { supported: !!constructor, listening, toggle };
}

export function appendDictation(value, transcript) {
  const current = String(value || '');
  const separator = current && !/\s$/.test(current) ? ' ' : '';
  return `${current}${separator}${String(transcript || '').trim()}`;
}
