import { describe, it, expect } from 'vitest';
import {
  buildFamilySearchSyncRows,
  normalizeRecordMatchFeed,
  normalizeChangeHistoryFeed,
  familySearchPersonWebUrl,
  derivePkceCodeChallenge,
  generatePkceCodeVerifier,
} from './familySearchApi.js';

function localPerson(fields) {
  return { recordType: 'Person', recordName: 'p1', fields };
}

describe('buildFamilySearchSyncRows', () => {
  it('flags same/different/missing and offers direction-appropriate actions', () => {
    const local = localPerson({
      cached_fullName: { value: 'Jane Doe' },
      gender: { value: 2 },
      cached_birthDate: { value: '1900' },
    });
    const remote = {
      persons: [{
        id: 'KW1-XYZ',
        names: [{ nameForms: [{ fullText: 'Jane Doe' }] }],
        gender: { type: 'http://gedcomx.org/Female' },
        facts: [
          { type: 'http://gedcomx.org/Birth', date: { original: '1901' } },
          { type: 'http://gedcomx.org/Death', date: { original: '1980' } },
        ],
      }],
    };
    const rows = buildFamilySearchSyncRows(local, remote);
    const byField = Object.fromEntries(rows.map((r) => [r.field, r]));

    expect(byField.Name.status).toBe('same');
    expect(byField.Gender.status).toBe('same');
    expect(byField.Birth.status).toBe('different');
    expect(byField.Birth.actions).toContain('download');
    expect(byField.Birth.actions).toContain('upload');
    expect(byField.Birth.actions).toContain('replace');
    // Local has no death; remote does -> missing locally, download/delete available.
    expect(byField.Death.status).toBe('missing');
    expect(byField.Death.actions).toContain('download');
    expect(byField.Death.actions).not.toContain('upload');
  });
});

describe('normalizeRecordMatchFeed', () => {
  it('flattens atom-style entries', () => {
    const rows = normalizeRecordMatchFeed({
      entries: [
        {
          id: 'm1',
          title: 'Census 1900',
          score: 0.9,
          content: { gedcomx: { persons: [{ display: { name: 'Jane Doe' } }] } },
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('m1');
    expect(rows[0].title).toBe('Census 1900');
    expect(rows[0].score).toBe(0.9);
  });

  it('returns empty array for empty feed', () => {
    expect(normalizeRecordMatchFeed(null)).toEqual([]);
    expect(normalizeRecordMatchFeed({})).toEqual([]);
  });
});

describe('normalizeChangeHistoryFeed', () => {
  it('flattens change entries', () => {
    const rows = normalizeChangeHistoryFeed({
      entries: [{ id: 'c1', title: 'Name changed', updated: '2020-01-01', contributors: [{ name: 'Tester' }] }],
    });
    expect(rows[0]).toMatchObject({ id: 'c1', title: 'Name changed', contributor: 'Tester' });
  });
});

describe('familySearchPersonWebUrl', () => {
  it('builds environment-aware urls', () => {
    expect(familySearchPersonWebUrl({ environment: 'production' }, 'KW1-ABC'))
      .toBe('https://www.familysearch.org/tree/person/details/KW1-ABC');
    expect(familySearchPersonWebUrl({ environment: 'beta' }, 'KW1-ABC'))
      .toBe('https://beta.familysearch.org/tree/person/details/KW1-ABC');
    expect(familySearchPersonWebUrl({}, '')).toBe('');
  });
});

describe('PKCE', () => {
  it('derives a stable S256 challenge for a known verifier', async () => {
    // RFC 7636 Appendix B test vector.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await derivePkceCodeChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('generates url-safe verifiers', () => {
    const v = generatePkceCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v.length).toBeGreaterThanOrEqual(43);
  });
});
