import { describe, expect, it } from 'vitest';
import {
  geographicPackageUrl,
  normalizeGeographicPackage,
  searchGeographicPackageAssets,
} from './geographicPackages.js';

describe('geographic packages', () => {
  it('joins a configured base URL to manifest files safely', () => {
    expect(geographicPackageUrl('https://geo.example/data/', '/europe.json')).toBe('https://geo.example/data/europe.json');
    expect(geographicPackageUrl('', 'europe.json')).toBe('');
  });

  it('validates and normalizes package records', () => {
    const pkg = normalizeGeographicPackage({
      schemaVersion: 1,
      packageId: 'europe',
      places: [
        { geonameId: 2643743, name: 'London', lat: '51.5085', lng: '-0.1257', population: '8961989' },
        { name: 'Broken', latitude: null, longitude: null },
      ],
    }, 'europe');

    expect(pkg.places).toHaveLength(1);
    expect(pkg.places[0]).toMatchObject({ geonameId: '2643743', latitude: 51.5085, longitude: -0.1257, population: 8961989 });
  });

  it('ranks exact and alternate-name matches ahead of partial matches', () => {
    const assets = [{
      packageId: 'europe',
      payload: {
        places: [
          { name: 'London', alternateNames: [], population: 9_000_000 },
          { name: 'Londonderry', alternateNames: [], population: 85_000 },
          { name: 'Londres', alternateNames: [{ name: 'London' }], population: 100_000 },
        ],
      },
    }];
    const matches = searchGeographicPackageAssets(assets, 'London');
    expect(matches.map((row) => row.name)).toEqual(['London', 'Londres', 'Londonderry']);
    expect(searchGeographicPackageAssets(assets, 'London, England')[0].name).toBe('London');
  });
});
