import { describe, expect, it } from 'vitest';
import { exportFileBaseName } from './backup.js';

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

  it('keeps Arabic names and drops path-hostile characters', () => {
    expect(exportFileBaseName({ treeName: 'عائلة أحمد', now: AT })).toBe('عائلة-أحمد-2026-07-30-140509');
    expect(exportFileBaseName({ treeName: 'a/b:c*d?', now: AT })).toBe('a-b-c-d-2026-07-30-140509');
  });

  it('falls back when nothing is configured', () => {
    expect(exportFileBaseName({ now: AT })).toBe('cloudtreeweb-2026-07-30-140509');
  });
});
