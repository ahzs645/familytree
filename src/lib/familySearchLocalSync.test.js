import { describe, expect, it } from 'vitest';
import { withFamilySearchVitalPlace } from './familySearchLocalSync.js';

describe('FamilySearch local vital-place sync', () => {
  it('updates an existing vital event without losing its date', () => {
    const existing = {
      recordName: 'birth-1',
      recordType: 'PersonEvent',
      fields: {
        date: { value: '1900', type: 'STRING' },
        placeName: { value: 'Old place', type: 'STRING' },
      },
    };

    const next = withFamilySearchVitalPlace(existing, {
      personId: 'person-1', eventType: 'Birth', placeId: 'place-1',
    });

    expect(next.fields.date.value).toBe('1900');
    expect(next.fields.place.value).toBe('place-1---Place');
    expect(next.fields.placeName).toBeUndefined();
    expect(next.fields.person.value).toBe('person-1---Person');
    expect(next.fields.conclusionType.value).toBe('Birth---ConclusionPersonEventType');
  });

  it('stores unresolved text on a new death event', () => {
    const next = withFamilySearchVitalPlace({ recordName: 'death-1', recordType: 'PersonEvent', fields: {} }, {
      personId: 'person-1', eventType: 'Death', text: 'Salem, Massachusetts',
    });

    expect(next.fields.placeName.value).toBe('Salem, Massachusetts');
    expect(next.fields.place).toBeUndefined();
    expect(next.fields.conclusionType.value).toBe('Death---ConclusionPersonEventType');
  });
});
