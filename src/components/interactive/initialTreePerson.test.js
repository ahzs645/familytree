import { describe, expect, it } from 'vitest';
import { resolveInitialTreePersonId } from './initialTreePerson.js';

const persons = [
  { recordName: 'first' },
  { recordName: 'start' },
  { recordName: 'largest' },
  { recordName: 'active' },
];

describe('resolveInitialTreePersonId', () => {
  it('keeps an existing valid active person', () => {
    expect(resolveInitialTreePersonId({
      persons,
      activeId: 'active',
      startPerson: { recordName: 'start' },
      largestRoot: { recordName: 'largest' },
    })).toBe('active');
  });

  it('defaults to the flagged start person before the largest descendant root', () => {
    expect(resolveInitialTreePersonId({
      persons,
      startPerson: { recordName: 'start' },
      largestRoot: { recordName: 'largest' },
    })).toBe('start');
  });

  it('falls back safely when no start person is available', () => {
    expect(resolveInitialTreePersonId({
      persons,
      startPerson: null,
      largestRoot: { recordName: 'largest' },
    })).toBe('largest');
    expect(resolveInitialTreePersonId({ persons: [{ recordName: 'first' }] })).toBe('first');
  });
});
