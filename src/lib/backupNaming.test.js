import { describe, expect, it } from 'vitest';
import { asciiFileNamePart, exportFileBaseName } from './backup.js';

const AT = new Date(2026, 6, 30, 14, 5, 9); // 2026-07-30 14:05:09 local

describe('exportFileBaseName', () => {
  it('names the file after the tree and whoever exported it', () => {
    expect(exportFileBaseName({ treeName: "Ahmad's Family", authorName: 'Raad', now: AT }))
      .toBe("Ahmad's-Family-Raad-2026-07-30-140509");
  });

  it('separates two people exporting the same tree', () => {
    const a = exportFileBaseName({ treeName: 'Family', authorName: 'Raad', now: AT });
    const b = exportFileBaseName({ treeName: 'Family', authorName: 'Jenan', now: AT });
    expect(a).not.toBe(b);
  });

  it('still differs for the same person seconds apart', () => {
    const a = exportFileBaseName({ treeName: 'Family', now: new Date(2026, 6, 30, 14, 5, 9) });
    const b = exportFileBaseName({ treeName: 'Family', now: new Date(2026, 6, 30, 14, 5, 10) });
    expect(a).not.toBe(b);
  });

  it('drops path-hostile characters', () => {
    expect(exportFileBaseName({ treeName: 'a/b:c*d?', now: AT })).toBe('a-b-c-d-2026-07-30-140509');
  });

  it('transliterates Arabic instead of leaving it non-ASCII', () => {
    // Chromium ignores a download filename with any non-ASCII character and
    // saves it as "download" — which is the collision this is meant to avoid.
    const name = exportFileBaseName({ treeName: 'عائلة أحمد', now: AT });
    expect(name).toMatch(/^[\x20-\x7E]+$/);
    expect(name).toBe('aaylh-ahmd-2026-07-30-140509');
  });

  it('keeps two different Arabic names apart', () => {
    const a = exportFileBaseName({ treeName: 'عائلة', authorName: 'رعد', now: AT });
    const b = exportFileBaseName({ treeName: 'عائلة', authorName: 'جنان', now: AT });
    expect(a).not.toBe(b);
    expect(`${a}${b}`).toMatch(/^[\x20-\x7E]+$/);
  });

  it('falls back when nothing is configured', () => {
    expect(exportFileBaseName({ now: AT })).toBe('cloudtreeweb-2026-07-30-140509');
  });

  it('folds accents rather than dropping the word', () => {
    expect(asciiFileNamePart('Familie Grüße')).toBe('Familie-Grusse');
  });

  it('falls back to a stable token for a script it cannot transliterate', () => {
    const a = asciiFileNamePart('家族');
    const b = asciiFileNamePart('家系');
    expect(a).toMatch(/^t[a-z0-9]+$/);
    expect(a).not.toBe(b);
    expect(asciiFileNamePart('家族')).toBe(a);
  });
});
