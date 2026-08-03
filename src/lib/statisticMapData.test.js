import { describe, expect, it } from 'vitest';
import { buildAggregateStatisticPoints, eventKind, STATISTIC_MAP_SOURCES } from './statisticMapData.js';

const field = (value) => ({ value });
const ref = (recordName) => ({ value: { recordName } });
const birth = (id, personId, year, placeId = 'place-1') => ({
  recordName: id,
  recordType: 'PersonEvent',
  conclusionType: 'Birth',
  subjectId: personId,
  year,
  placeId,
  placeName: placeId,
  lat: placeId === 'place-1' ? 10 : 20,
  lng: placeId === 'place-1' ? 30 : 40,
});

describe('statistic map data', () => {
  it('lists every CoreMapsController statistic source', () => {
    expect(STATISTIC_MAP_SOURCES.map((source) => source.id)).toEqual(expect.arrayContaining([
      'marriage-heat', 'divorce-heat', 'father-first-child-age', 'mother-first-child-age',
      'father-child-count', 'mother-child-count', 'man-marriage-age', 'woman-marriage-age',
    ]));
  });

  it('recognizes localized-style event labels by semantic kind', () => {
    expect(eventKind('Wedding ceremony')).toBe('marriage');
    expect(eventKind('Divorce')).toBe('divorce');
    expect(eventKind('Cremation')).toBe('death');
  });

  it('averages father age at first child at the father birth place', () => {
    const events = [
      birth('dad-birth', 'dad', 1970),
      birth('child-1-birth', 'child-1', 1995, 'place-2'),
      birth('child-2-birth', 'child-2', 2000, 'place-2'),
    ];
    const families = [{ recordName: 'fam', fields: { man: ref('dad') } }];
    const childRelations = [
      { fields: { family: ref('fam'), child: ref('child-1') } },
      { fields: { family: ref('fam'), child: ref('child-2') } },
    ];
    const points = buildAggregateStatisticPoints('father-first-child-age', { events, families, childRelations });
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ placeId: 'place-1', value: 25, sampleCount: 1, unit: 'years' });
  });

  it('averages marriage ages per marriage place and scales circles', () => {
    const events = [
      birth('man-a', 'man-a', 1980),
      birth('man-b', 'man-b', 1970),
      { recordName: 'm1', recordType: 'FamilyEvent', conclusionType: 'Marriage', subjectId: 'f1', year: 2010, placeId: 'wedding', placeName: 'Wedding', lat: 1, lng: 2 },
      { recordName: 'm2', recordType: 'FamilyEvent', conclusionType: 'Marriage', subjectId: 'f2', year: 2010, placeId: 'wedding', placeName: 'Wedding', lat: 1, lng: 2 },
    ];
    const families = [
      { recordName: 'f1', fields: { man: ref('man-a') } },
      { recordName: 'f2', fields: { man: ref('man-b') } },
    ];
    const points = buildAggregateStatisticPoints('man-marriage-age', { events, families });
    expect(points[0].value).toBe(35);
    expect(points[0].sampleCount).toBe(2);
    expect(points[0].size).toBeGreaterThanOrEqual(18);
  });
});
