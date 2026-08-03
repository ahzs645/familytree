import { describe, expect, it } from 'vitest';
import {
  applyPlaceLookupCandidate,
  candidateDisplayName,
  normalizeNominatimCandidate,
  normalizeOfflineCandidate,
} from './placeGeocoding.js';

describe('place lookup candidate normalization', () => {
  it('keeps Nominatim feature, hierarchy, population, and multilingual names', () => {
    const candidate = normalizeNominatimCandidate({
      osm_type: 'node',
      osm_id: 1,
      lat: '51.5',
      lon: '-0.12',
      class: 'amenity',
      type: 'place_of_worship',
      display_name: "St Paul's Cathedral, London, England, United Kingdom",
      namedetails: { name: "St Paul's Cathedral", 'name:fr': 'Cathédrale Saint-Paul', old_name: 'Old St Paul’s' },
      extratags: { population: '1200', geonames: '1234' },
      address: { amenity: "St Paul's Cathedral", city: 'London', state: 'England', country: 'United Kingdom' },
    });

    expect(candidate).toMatchObject({ featureClass: 'amenity', featureCode: 'place_of_worship', population: 1200, geoNameID: '1234' });
    expect(candidate.hierarchy.map((item) => item.value)).toEqual(['London', 'England', 'United Kingdom']);
    expect(candidate.nameForms).toContainEqual(expect.objectContaining({ name: 'Cathédrale Saint-Paul', language: 'fr' }));
  });

  it('builds a full chosen-name display and applies lookup identity fields', () => {
    const candidate = normalizeOfflineCandidate({
      packageId: 'europe',
      geonameId: '2643743',
      name: 'London',
      alternateNames: [{ name: 'Londres', language: 'fr' }],
      latitude: 51.5,
      longitude: -0.12,
      featureClass: 'P',
      featureCode: 'PPLC',
      admin1Name: 'England',
      countryName: 'United Kingdom',
    });
    expect(candidateDisplayName(candidate, 'Londres')).toBe('Londres, England, United Kingdom');

    const record = { recordName: 'place-1', recordType: 'Place', fields: { place: { value: 'London', type: 'STRING' } } };
    const applied = applyPlaceLookupCandidate(record, candidate, 'Londres');
    expect(applied.fields.place.value).toBe('Londres');
    expect(applied.fields.placeName.value).toBe('Londres, England, United Kingdom');
    expect(applied.fields.geonameID.value).toBe('2643743');
    expect(applied.fields.lookupProvider.value).toBe('offline-geonames');
  });
});
