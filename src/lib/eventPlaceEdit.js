// @ts-check
/**
 * Pure helpers for editing a Place from an event. Keeping the reference
 * counting and clone shape here makes the safeguard testable without React or
 * IndexedDB.
 */
import { FIELD_ALIASES, readField, readRef } from './schema.js';

const CLONE_ONLY_FIELDS = new Set([
  'cloudKitChangeTag',
  'coordinate',
  'gedcomID',
  'uniqueID',
]);

/** @param {any} event @param {string} placeId */
export function eventReferencesPlace(event, placeId) {
  if (!event || !placeId) return false;
  return readRef(event.fields?.place) === placeId || readRef(event.fields?.assignedPlace) === placeId;
}

/**
 * Count event records other than the event being edited that share a place.
 * @param {any[]} events
 * @param {string} placeId
 * @param {string} currentEventId
 */
export function countOtherEventPlaceReferences(events, placeId, currentEventId) {
  return (events || []).filter((event) => (
    event?.recordName !== currentEventId && eventReferencesPlace(event, placeId)
  )).length;
}

/** @param {any} place */
export function placeDisplayName(place) {
  return String(readField(place, FIELD_ALIASES.placeName) || '');
}

/**
 * Update all display-name caches that exist on a Place plus the canonical web
 * field. Mac packages differ in which cached spelling they contain.
 * @param {Record<string, any>} inputFields
 * @param {string} name
 */
export function placeFieldsWithName(inputFields, name) {
  const fields = { ...(inputFields || {}) };
  const clean = String(name || '').trim();
  const value = { value: clean, type: 'STRING' };
  fields.placeName = value;
  for (const fieldName of [
    'cached_displayName',
    'cached_normalLocationString',
    'cached_normallocationString',
    'cached_shortLocationString',
    'cached_standardizedLocationString',
    'cached_veryShortLocationString',
  ]) {
    if (fields[fieldName]) fields[fieldName] = { ...fields[fieldName], value: clean, type: 'STRING' };
  }
  return fields;
}

/** @param {any} place @param {string} name */
export function renamePlaceRecord(place, name) {
  return { ...place, fields: placeFieldsWithName(place?.fields, name) };
}

/**
 * Clone a place for a single event. Database/cloud identity and the direct
 * coordinate pointer are deliberately not shared; descriptive/template fields
 * remain available on the clone.
 * @param {any} place
 * @param {string} name
 * @param {string} recordName
 */
export function clonePlaceRecord(place, name, recordName) {
  const fields = placeFieldsWithName(place?.fields, name);
  for (const fieldName of CLONE_ONLY_FIELDS) delete fields[fieldName];
  return { recordName, recordType: 'Place', fields };
}
