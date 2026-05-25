/**
 * Factory + summary helpers that bridge raw IndexedDB records and the
 * OOP BaseRecord-family classes. Everything display-related should go through
 * these so there's a single source of truth for how a Person is named,
 * lifespans are formatted, etc.
 */
import { BaseRecord } from './BaseRecord.js';
import { PersonRecord } from './PersonRecord.js';
import { FamilyRecord } from './FamilyRecord.js';
import { PlaceRecord } from './PlaceRecord.js';
import { SourceRecord } from './SourceRecord.js';
import { PersonEventRecord, FamilyEventRecord } from './EventRecord.js';
import { Gender } from './constants.js';
import { formatDisplayName, formatSortName, getActiveDisplayFormat, DEFAULT_DISPLAY_FORMAT } from '../lib/nameFormat.js';
import { lifeSpanLabelFor } from '../lib/vitalFormat.js';

/** Placeholder shown when a person record carries no usable name at all. */
export const NO_NAME = 'No name recorded';

const TYPE_TO_CLASS = {
  Person: PersonRecord,
  Family: FamilyRecord,
  Place: PlaceRecord,
  Source: SourceRecord,
  PersonEvent: PersonEventRecord,
  FamilyEvent: FamilyEventRecord,
};

export function wrapRecord(raw) {
  if (!raw) return null;
  const Cls = TYPE_TO_CLASS[raw.recordType] || BaseRecord;
  return new Cls(raw);
}

/**
 * Person summary — the display tuple used by chart nodes, list rows, chips.
 * Accepts either a raw record or an already-wrapped PersonRecord.
 */
export function personSummary(input) {
  if (!input) return null;
  const rec = input instanceof PersonRecord ? input : new PersonRecord(input);
  if (!rec.record) return null;
  const preset = getActiveDisplayFormat();
  const formatted = preset !== DEFAULT_DISPLAY_FORMAT ? formatDisplayName(rec.record) : '';
  return {
    recordName: rec.recordName(),
    firstName: rec.firstName(),
    lastName: rec.lastName(),
    fullName: formatted || rec.fullName() || NO_NAME,
    fullNameForSorting: formatSortName(rec.record) || rec.fullNameForSorting(),
    gender: rec.gender, // 0=Male, 1=Female, 2=UnknownGender, 3=Intersex
    birthDate: rec.birthDate(),
    deathDate: rec.deathDate(),
    thumbnail: rec.getThumbnailImageSource(),
    isStartPerson: rec.isStartPerson(),
  };
}

export function familySummary(input) {
  if (!input) return null;
  const rec = input instanceof FamilyRecord ? input : new FamilyRecord(input);
  if (!rec.record) return null;
  return {
    recordName: rec.recordName(),
    manRecordName: rec.manRecordName(),
    womanRecordName: rec.womanRecordName(),
    marriageDate: rec.marriageDate(),
    familyName: rec.familyName(),
  };
}

export function placeSummary(input) {
  if (!input) return null;
  const rec = input instanceof PlaceRecord ? input : new PlaceRecord(input);
  if (!rec.record) return null;
  return {
    recordName: rec.recordName(),
    name: rec.placeName(),
    displayName: rec.normalLocationString(),
    shortName: rec.shortLocationString(),
    geonameID: rec.geonameID(),
  };
}

export function sourceSummary(input) {
  if (!input) return null;
  const rec = input instanceof SourceRecord ? input : new SourceRecord(input);
  if (!rec.record) return null;
  return {
    recordName: rec.recordName(),
    title: rec.title(),
    date: rec.date(),
    text: rec.text(),
    bookmarked: rec.isBookmarked(),
  };
}

export function lifeSpanLabel(summary) {
  return lifeSpanLabelFor(summary);
}

export { Gender };
