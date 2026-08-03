import { describe, expect, it } from 'vitest';
import { normalizeGenogramConfig } from './genogramBuilder.js';

describe('genogram presentation options', () => {
  it('normalizes Mac event position and background choices', () => {
    expect(normalizeGenogramConfig({ eventPosition: 'below', eventBackground: 'filled' })).toMatchObject({ eventPosition: 'below', eventBackground: 'filled' });
    expect(normalizeGenogramConfig({ eventPosition: 'above', eventBackground: 'other' })).toMatchObject({ eventPosition: 'right', eventBackground: 'none' });
  });
});
