import { describe, expect, it } from 'vitest';
import { extractGedcomCharTag, isGeneWebFileName } from './genealogyFileFormats.js';

describe('extractGedcomCharTag', () => {
  it('detects CHAR tags in CR-only GEDCOM headers', () => {
    const bytes = new TextEncoder().encode(['0 HEAD', '1 SOUR Legacy', '1 CHAR ANSEL', '0 TRLR'].join('\r'));

    expect(extractGedcomCharTag(bytes)).toBe('ANSEL');
  });
});

describe('isGeneWebFileName', () => {
  it('recognizes .gw files without treating GEDCOM names as GeneWeb', () => {
    expect(isGeneWebFileName('tree.gw')).toBe(true);
    expect(isGeneWebFileName('tree.GW')).toBe(true);
    expect(isGeneWebFileName('tree.ged')).toBe(false);
  });
});
