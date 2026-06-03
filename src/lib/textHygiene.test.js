import { describe, expect, it } from 'vitest';
import {
  checkTextValue,
  findTextHygieneIssues,
  getTextHygieneTargets,
  hasBadCapitalization,
  hasSuspiciousPunctuationSpacing,
  mixedScripts,
} from './textHygiene.js';
import { findMaintenanceIssues } from './maintenance.js';

describe('textHygiene', () => {
  it('finds invisible characters, non-breaking spaces, repeated whitespace, and edge whitespace', () => {
    const issues = checkTextValue(' John\u200b\u00a0  Doe ', { fieldName: 'firstName', kind: 'name' });

    expect(codes(issues)).toEqual(expect.arrayContaining([
      'text-invisible-character',
      'text-nbsp',
      'text-repeated-whitespace',
      'text-edge-whitespace',
    ]));
  });

  it('detects mixed Latin, Arabic, and Cyrillic scripts in one value', () => {
    expect(mixedScripts('Ahmad أحمد')).toEqual(['Latin', 'Arabic']);
    expect(mixedScripts('Ivan Иван')).toEqual(['Latin', 'Cyrillic']);
    expect(mixedScripts('أحمد الجليل')).toBeNull();
  });

  it('detects suspicious punctuation spacing without flagging normal names', () => {
    expect(hasSuspiciousPunctuationSpacing('Paris,France')).toBe(true);
    expect(hasSuspiciousPunctuationSpacing('Paris , France')).toBe(true);
    expect(hasSuspiciousPunctuationSpacing('( London)')).toBe(true);
    expect(hasSuspiciousPunctuationSpacing("O'Connor, County Cork")).toBe(false);
  });

  it('detects bad capitalization for name, place, and source style fields', () => {
    expect(hasBadCapitalization('JOHN DOE', 'name')).toBe(true);
    expect(hasBadCapitalization('john doe', 'name')).toBe(true);
    expect(hasBadCapitalization('new york', 'place')).toBe(true);
    expect(hasBadCapitalization('FEDERAL CENSUS', 'source')).toBe(true);
    expect(hasBadCapitalization('Ibn Khaldun', 'name')).toBe(false);
    expect(hasBadCapitalization('New York', 'place')).toBe(false);
  });

  it('selects name, place, and source targets from record arrays', () => {
    const personTargets = getTextHygieneTargets(person('p1', { firstName: 'John', note: 'Ignored' }));
    const placeTargets = getTextHygieneTargets(place('pl1', { placeName: 'New York' }));
    const sourceTargets = getTextHygieneTargets(source('s1', { title: 'Federal Census' }));

    expect(personTargets.map((target) => target.fieldName)).toEqual(['firstName']);
    expect(placeTargets.map((target) => target.kind)).toEqual(['place']);
    expect(sourceTargets.map((target) => target.kind)).toEqual(['source']);
  });

  it('returns validation issues for record arrays', () => {
    const issues = findTextHygieneIssues([
      person('p1', { firstName: 'JOHN', lastName: 'Doe' }),
      place('pl1', { placeName: 'Paris,France' }),
      source('s1', { title: 'Birth\u00a0Record' }),
      person('p2', { cached_fullName: 'Ahmad أحمد' }),
    ]);

    expect(codes(issues)).toEqual(expect.arrayContaining([
      'text-bad-capitalization',
      'text-punctuation-spacing',
      'text-nbsp',
      'text-mixed-script',
    ]));
    expect(issues[0]).toMatchObject({
      scope: 'text-hygiene',
      recordName: expect.any(String),
      details: {
        fieldName: expect.any(String),
        value: expect.any(String),
      },
    });
  });

  it('is included in modular maintenance issues', () => {
    const issues = findMaintenanceIssues([
      place('pl1', { placeName: 'Paris,France' }),
    ]);

    expect(codes(issues)).toContain('text-punctuation-spacing');
  });
});

function codes(issues) {
  return issues.map((issue) => issue.code);
}

function person(recordName, fields) {
  return { recordName, recordType: 'Person', fields: wrap(fields) };
}

function place(recordName, fields) {
  return { recordName, recordType: 'Place', fields: wrap(fields) };
}

function source(recordName, fields) {
  return { recordName, recordType: 'Source', fields: wrap(fields) };
}

function wrap(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, type: 'STRING' }]));
}
