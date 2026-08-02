import { describe, expect, it } from 'vitest';
import {
  clonePlaceRecord,
  countOtherEventPlaceReferences,
  eventReferencesPlace,
  renamePlaceRecord,
} from './eventPlaceEdit.js';

const ref = (id) => ({ value: `${id}---Place`, type: 'REFERENCE' });

describe('event place edit safeguard helpers', () => {
  it('counts direct and Mac assignedPlace references except the current event', () => {
    const events = [
      { recordName: 'current', fields: { place: ref('shared') } },
      { recordName: 'person-2', fields: { assignedPlace: ref('shared') } },
      { recordName: 'family-1', fields: { place: ref('shared') } },
      { recordName: 'elsewhere', fields: { place: ref('other') } },
    ];

    expect(eventReferencesPlace(events[1], 'shared')).toBe(true);
    expect(countOtherEventPlaceReferences(events, 'shared', 'current')).toBe(2);
  });

  it('renames display caches while cloning without shared identity pointers', () => {
    const original = {
      recordName: 'place-1',
      recordType: 'Place',
      fields: {
        placeName: { value: 'Old name', type: 'STRING' },
        cached_normallocationString: { value: 'Old name', type: 'STRING' },
        country: { value: 'Canada', type: 'STRING' },
        coordinate: ref('coord-1'),
        uniqueID: { value: 'mac-id', type: 'STRING' },
      },
    };

    const renamed = renamePlaceRecord(original, 'New name');
    const clone = clonePlaceRecord(original, 'Event-only name', 'place-2');

    expect(renamed.fields.placeName.value).toBe('New name');
    expect(renamed.fields.cached_normallocationString.value).toBe('New name');
    expect(clone.recordName).toBe('place-2');
    expect(clone.fields.country.value).toBe('Canada');
    expect(clone.fields.coordinate).toBeUndefined();
    expect(clone.fields.uniqueID).toBeUndefined();
  });
});
