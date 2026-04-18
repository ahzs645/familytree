import { describe, expect, it } from 'vitest';
import { readConclusionType, readField, readLabel, readRef, refType, replaceRefValue, writeRef } from './schema.js';

describe('schema compatibility helpers', () => {
  it('reads all supported reference shapes', () => {
    expect(readRef('person-1---Person')).toBe('person-1');
    expect(readRef('person-2')).toBe('person-2');
    expect(readRef({ recordName: 'person-3' })).toBe('person-3');
    expect(readRef({ value: 'person-4---Person', type: 'REFERENCE' })).toBe('person-4');
    expect(readRef(null)).toBeNull();
    expect(refType({ value: 'person-4---Person', type: 'REFERENCE' })).toBe('Person');
  });

  it('writes and replaces references without changing non-matches', () => {
    expect(writeRef('person-1', 'Person')).toEqual({ value: 'person-1---Person', type: 'REFERENCE' });
    expect(replaceRefValue({ value: 'person-1---Person', type: 'REFERENCE' }, 'person-1', 'person-2', 'Person')).toEqual({
      value: 'person-2---Person',
      type: 'REFERENCE',
    });
    expect(replaceRefValue('person-9---Person', 'person-1', 'person-2', 'Person')).toBe('person-9---Person');
  });

  it('reads aliased fields and labels', () => {
    const place = { fields: { geonameID: { value: '123' } } };
    expect(readField(place, ['geoNameID', 'geonameID'])).toBe('123');
    expect(readLabel({ recordName: 'label-1', fields: { title: { value: 'Important' }, colorComponentsString: { value: '0;0;1' } } })).toMatchObject({
      name: 'Important',
      color: 'rgb(0 0 255)',
    });
  });

  it('humanizes imported conclusion type references and string types', () => {
    expect(readConclusionType({ fields: { eventType: { value: 'Birth' } } })).toBe('Birth');
    expect(readConclusionType({ fields: { conclusionType: { value: 'UniqueID_PersonEvent_Birth---ConclusionPersonEventType', type: 'REFERENCE' } } })).toBe('Birth');
  });
});
