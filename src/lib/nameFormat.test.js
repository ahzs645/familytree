import { describe, it, expect } from 'vitest';
import { formatName, NAME_FORMAT, namePartsFromRecord } from './nameFormat.js';

const FULL = { title: 'Dr.', first: 'Ada', middle: 'King', last: 'Lovelace', suffix: 'III' };

describe('formatName', () => {
  it('First Last', () => {
    expect(formatName(FULL, NAME_FORMAT.FIRST_LAST)).toBe('Ada Lovelace');
  });
  it('Last First', () => {
    expect(formatName(FULL, NAME_FORMAT.LAST_FIRST)).toBe('Lovelace Ada');
  });
  it('Last, First Middle', () => {
    expect(formatName(FULL, NAME_FORMAT.LAST_COMMA_FIRST_MIDDLE)).toBe('Lovelace, Ada King');
  });
  it('Title First Middle Last Suffix', () => {
    expect(formatName(FULL, NAME_FORMAT.TITLE_FIRST_MIDDLE_LAST_SUFFIX)).toBe('Dr. Ada King Lovelace III');
  });
  it('Title Last First Suffix', () => {
    expect(formatName(FULL, NAME_FORMAT.TITLE_LAST_FIRST_SUFFIX)).toBe('Dr. Lovelace Ada III');
  });
  it('skips missing parts', () => {
    expect(formatName({ first: 'Ada', last: '' }, NAME_FORMAT.LAST_COMMA_FIRST_MIDDLE)).toBe('Ada');
    expect(formatName({ first: '', last: 'Lovelace' }, NAME_FORMAT.LAST_COMMA_FIRST_MIDDLE)).toBe('Lovelace');
  });
  it('falls back to First Middle Last', () => {
    expect(formatName(FULL, 'unknown-preset')).toBe('Ada King Lovelace');
  });
});

describe('namePartsFromRecord', () => {
  it('reads from canonical field names', () => {
    const record = {
      fields: {
        namePrefix: { value: 'Dr.' },
        firstName: { value: 'Ada' },
        nameMiddle: { value: 'King' },
        lastName: { value: 'Lovelace' },
        nameSuffix: { value: 'III' },
      },
    };
    expect(namePartsFromRecord(record)).toEqual(FULL);
  });
});
