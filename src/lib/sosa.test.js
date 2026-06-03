import { describe, expect, it } from 'vitest';
import {
  nextSosa,
  previousSosa,
  sosaBranchPath,
  sosaFather,
  sosaGeneration,
  sosaMother,
  sosaParent,
  sosaRelation,
} from './sosa.js';

describe('sosa helpers', () => {
  it('computes parent and child numbers', () => {
    expect(sosaFather(1)).toBe(2);
    expect(sosaMother(1)).toBe(3);
    expect(sosaParent(7)).toBe(3);
  });

  it('computes generation and branch path', () => {
    expect(sosaGeneration(1)).toBe(1);
    expect(sosaGeneration(8)).toBe(4);
    expect(sosaBranchPath(13)).toEqual(['M', 'F', 'M']);
  });

  it('labels ancestor relation paths', () => {
    expect(sosaRelation(1)).toBe('Self');
    expect(sosaRelation(2)).toBe('Father');
    expect(sosaRelation(7)).toBe("Mother's Mother");
  });

  it('supports sequential navigation', () => {
    expect(previousSosa(1)).toBeNull();
    expect(previousSosa(6)).toBe(5);
    expect(nextSosa(6)).toBe(7);
  });
});
