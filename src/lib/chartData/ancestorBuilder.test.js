import { describe, expect, it } from 'vitest';
import { siblingRecordNames } from './ancestorBuilder.js';

describe('ancestor sibling builder', () => {
  it('excludes the direct person, missing references, and duplicates', () => {
    const relation = (id) => ({ fields: { child: { value: id ? { recordName: id } : null } } });
    expect(siblingRecordNames([relation('root'), relation('s1'), relation('s1'), relation(null), relation('s2')], 'root')).toEqual(['s1', 's2']);
  });
});
