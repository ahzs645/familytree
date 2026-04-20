import { describe, it, expect } from 'vitest';
import { isRecordLocked, setRecordLocked } from './recordLock.js';

describe('recordLock', () => {
  it('reads false by default', () => {
    expect(isRecordLocked({ fields: {} })).toBe(false);
    expect(isRecordLocked(null)).toBe(false);
  });

  it('reads true when flag is set', () => {
    expect(isRecordLocked({ fields: { isLocked: { value: true } } })).toBe(true);
    expect(isRecordLocked({ fields: { readOnly: { value: true } } })).toBe(true);
  });

  it('setRecordLocked round-trips', () => {
    const record = { recordName: 'p1', fields: { firstName: { value: 'Ada' } } };
    const locked = setRecordLocked(record, true);
    expect(isRecordLocked(locked)).toBe(true);
    const unlocked = setRecordLocked(locked, false);
    expect(isRecordLocked(unlocked)).toBe(false);
    expect(unlocked.fields.firstName.value).toBe('Ada');
  });
});
