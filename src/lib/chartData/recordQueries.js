/**
 * Shared record-query helpers for chart data builders.
 *
 * Each chart builder (timeline, distribution, statistics, genogram, sociogram,
 * virtualTree) needs access to the same underlying record types. Centralizing
 * the query patterns here keeps builders small and ensures consistent
 * reference parsing, privacy filtering, and field fallbacks.
 *
 * Record types covered (see docs/mac-to-web-chart-implementation-research.md):
 *   - Person, Family, ChildRelation
 *   - PersonEvent, FamilyEvent, PersonFact
 *   - AssociateRelation (non-family links used by genogram/sociogram)
 *   - PersonGroupRelation (group membership used by sociogram)
 *   - LabelRelation (tags / color codes)
 *   - Place
 */

import { getLocalDatabase } from '../LocalDatabase.js';
import { readField, readRef, FIELD_ALIASES } from '../schema.js';
import { isPublicRecord } from '../privacy.js';

const DEFAULT_LIMIT = 100000;

function extractRecords(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.records)) return result.records;
  return [];
}

function filterPublic(records, { includePrivate = false } = {}) {
  if (includePrivate) return records;
  return records.filter((record) => isPublicRecord(record));
}

async function queryAll(recordType, options = {}) {
  const db = getLocalDatabase();
  const result = await db.query(recordType, { limit: DEFAULT_LIMIT, ...options });
  return extractRecords(result);
}

async function queryByReference(recordType, referenceField, referenceValue, options = {}) {
  const db = getLocalDatabase();
  const result = await db.query(recordType, {
    referenceField,
    referenceValue,
    limit: DEFAULT_LIMIT,
    ...options,
  });
  return extractRecords(result);
}

export async function getAllPersons(options = {}) {
  const records = await queryAll('Person', options);
  return filterPublic(records, options);
}

export async function getAllFamilies(options = {}) {
  const records = await queryAll('Family', options);
  return filterPublic(records, options);
}

export async function getAllPlaces(options = {}) {
  return queryAll('Place', options);
}

export async function getAllPersonEvents(options = {}) {
  const records = await queryAll('PersonEvent', options);
  return filterPublic(records, options);
}

export async function getAllFamilyEvents(options = {}) {
  const records = await queryAll('FamilyEvent', options);
  return filterPublic(records, options);
}

export async function getAllPersonFacts(options = {}) {
  const records = await queryAll('PersonFact', options);
  return filterPublic(records, options);
}

export async function getAllChildRelations(options = {}) {
  return queryAll('ChildRelation', options);
}

export async function getAllAssociateRelations(options = {}) {
  return queryAll('AssociateRelation', options);
}

export async function getAllPersonGroupRelations(options = {}) {
  return queryAll('PersonGroupRelation', options);
}

export async function getAllLabelRelations(options = {}) {
  return queryAll('LabelRelation', options);
}

export async function getPersonEventsForPerson(personRecordName, options = {}) {
  if (!personRecordName) return [];
  const records = await queryByReference('PersonEvent', 'person', personRecordName, options);
  return filterPublic(records, options);
}

export async function getPersonFactsForPerson(personRecordName, options = {}) {
  if (!personRecordName) return [];
  const records = await queryByReference('PersonFact', 'person', personRecordName, options);
  return filterPublic(records, options);
}

export async function getFamilyEventsForFamily(familyRecordName, options = {}) {
  if (!familyRecordName) return [];
  const records = await queryByReference('FamilyEvent', 'family', familyRecordName, options);
  return filterPublic(records, options);
}

export async function getChildRelationsForFamily(familyRecordName, options = {}) {
  if (!familyRecordName) return [];
  return queryByReference('ChildRelation', 'family', familyRecordName, options);
}

export async function getAssociateRelationsForPerson(personRecordName, options = {}) {
  if (!personRecordName) return [];
  return queryByReference('AssociateRelation', 'person', personRecordName, options);
}

export async function getPersonGroupRelationsForPerson(personRecordName, options = {}) {
  if (!personRecordName) return [];
  return queryByReference('PersonGroupRelation', 'person', personRecordName, options);
}

export async function getLabelRelationsForPerson(personRecordName, options = {}) {
  if (!personRecordName) return [];
  return queryByReference('LabelRelation', 'person', personRecordName, options);
}

/**
 * Fetch a single record by name.
 */
export async function getRecordByName(recordName) {
  if (!recordName) return null;
  const db = getLocalDatabase();
  return db.getRecord(recordName);
}

export async function getPlaceByRecordName(recordName) {
  if (!recordName) return null;
  return getRecordByName(recordName);
}

/**
 * Extract a year from a date-like field value. Returns null for unparseable input.
 * Re-exported so builders can produce consistent time axes.
 */
export function parseYear(value) {
  if (value == null) return null;
  const raw = typeof value === 'object' && 'value' in value ? value.value : value;
  if (raw == null) return null;
  const match = String(raw).match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * Read a record's cached birth year. Returns null if missing/unparseable.
 */
export function readBirthYear(personRecord) {
  const value = readField(personRecord, ['cached_birthDate', 'birthDate']);
  return parseYear(value);
}

export function readDeathYear(personRecord) {
  const value = readField(personRecord, ['cached_deathDate', 'deathDate']);
  return parseYear(value);
}

export function readEventYear(eventRecord) {
  const value = readField(eventRecord, ['cached_date', 'date', 'cached_formalDate']);
  return parseYear(value);
}

export function readEventType(eventRecord) {
  return readField(eventRecord, FIELD_ALIASES.eventType);
}

export function readPlaceName(placeRecord) {
  return readField(placeRecord, FIELD_ALIASES.placeName);
}

export function readEventPlaceRef(eventRecord) {
  return readRef(eventRecord?.fields?.place?.value ?? eventRecord?.fields?.place);
}

/**
 * Convenience: pre-load a map of all places keyed by recordName for fast lookup.
 */
export async function loadPlaceIndex(options = {}) {
  const places = await getAllPlaces(options);
  const index = new Map();
  for (const place of places) {
    if (place?.recordName) index.set(place.recordName, place);
  }
  return index;
}

/**
 * Convenience: pre-load a map of all persons keyed by recordName.
 */
export async function loadPersonIndex(options = {}) {
  const persons = await getAllPersons(options);
  const index = new Map();
  for (const person of persons) {
    if (person?.recordName) index.set(person.recordName, person);
  }
  return index;
}
