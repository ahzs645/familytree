import { describe, expect, it } from 'vitest';
import { deepLinkForRecord } from './deepLinks.js';

describe('deepLinkForRecord', () => {
  it('uses detail routes for people and families', () => {
    expect(deepLinkForRecord('Person', 'person/1')).toBe('/person/person%2F1');
    expect(deepLinkForRecord('Family', 'family-1')).toBe('/family/family-1');
  });

  it('uses editor selection query parameters for list editors', () => {
    expect(deepLinkForRecord('Source', 'source-1')).toBe('/sources?sourceId=source-1');
    expect(deepLinkForRecord('MediaPicture', 'photo-1')).toBe('/media?mediaId=photo-1');
    expect(deepLinkForRecord('FamilyEvent', 'event-1')).toBe('/events?eventId=event-1');
  });

  it('falls back to object search when no dedicated editor mapping exists', () => {
    expect(deepLinkForRecord('UnknownRecord', 'x')).toBe('/search?query=x');
  });
});
