import { describe, expect, it } from 'vitest';
import { appendDictation } from './useSpeechRecognition.js';

describe('appendDictation', () => {
  it('adds a separating space to existing text', () => {
    expect(appendDictation('A family memory.', 'Recorded aloud')).toBe('A family memory. Recorded aloud');
  });

  it('does not duplicate existing whitespace', () => {
    expect(appendDictation('Already spaced\n', 'Next line')).toBe('Already spaced\nNext line');
  });
});
