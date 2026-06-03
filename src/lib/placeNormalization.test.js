import { describe, expect, it } from 'vitest';
import {
  comparePlaces,
  normalizePlace,
  onlySuburb,
  splitSuburb,
  withoutSuburb,
} from './placeNormalization.js';

describe('place normalization', () => {
  it('normalizes GeneWeb suburb prefixes', () => {
    expect(normalizePlace('[foo-bar] - boobar (baz)')).toBe('foo-bar, boobar (baz)');
    expect(normalizePlace('[foo-bar - boobar (baz)')).toBe('[foo-bar - boobar (baz)');
    expect(normalizePlace('[foo-bar] boobar (baz)')).toBe('[foo-bar] boobar (baz)');
  });

  it('splits suburbs from places', () => {
    expect(splitSuburb('[foo-bar] - boobar (baz)')).toEqual(['foo-bar', 'boobar (baz)']);
    expect(splitSuburb('[foo-bar] \u2013 boobar (baz)')).toEqual(['foo-bar', 'boobar (baz)']);
    expect(splitSuburb('[foo-bar] \u2014 boobar (baz)')).toEqual(['foo-bar', 'boobar (baz)']);
    expect(splitSuburb('boobar (baz)')).toEqual(['', 'boobar (baz)']);
  });

  it('extracts only the suburb', () => {
    expect(onlySuburb('[foo-bar] - boobar (baz)')).toBe('foo-bar');
    expect(onlySuburb('boobar (baz)')).toBe('');
  });

  it('removes the suburb', () => {
    expect(withoutSuburb('[foo-bar] - boobar (baz)')).toBe('boobar (baz)');
    expect(withoutSuburb('boobar (baz)')).toBe('boobar (baz)');
  });

  it('compares places by place fields before suburb', () => {
    expect(comparePlaces('boobar (baz)', 'boobar (baz)')).toBe(0);
    expect(comparePlaces('baz (boobar)', 'boobar (baz)')).toBe(-1);
    expect(comparePlaces('baz (boobar)', '[foo-bar] - baz (boobar)')).toBe(-1);
    expect(comparePlaces('[bar-foo] - baz (boobar)', '[foo-bar] - baz (boobar)')).toBe(-1);
    expect(comparePlaces('[foo-bar] - baz (boobar)', '[bar-foo] - boobar (baz)')).toBe(-1);
    expect(comparePlaces('[foo-bar] - ebaz (boobar)', '[bar-foo] - \u00e9boobar (baz)')).toBe(-1);
    expect(comparePlaces('[foo-bar] - baz, boobar, barboo', '[foo-bar] - baz, boobar, barboo, bam')).toBe(-1);
  });
});

