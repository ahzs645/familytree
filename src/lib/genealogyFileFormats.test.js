import { describe, expect, it } from 'vitest';
import { extractGedcomCharTag } from './genealogyFileFormats.js';

describe('extractGedcomCharTag', () => {
  it('detects CHAR tags in CR-only GEDCOM headers', () => {
    const bytes = new TextEncoder().encode(['0 HEAD', '1 SOUR Legacy', '1 CHAR ANSEL', '0 TRLR'].join('\r'));

    expect(extractGedcomCharTag(bytes)).toBe('ANSEL');
  });
});
