/**
 * Model exports — all record type classes and constants.
 *
 * Minified name mapping:
 *   ft/dt  → PersonRecord
 *   ht/pt  → FamilyRecord
 *   _t/kt  → PlaceRecord
 *   Tt/Nt  → SourceRecord
 *   st/lt  → BaseRecord
 *   ct     → Gender
 *   nt     → ChangeType
 *
 * Record type classes from 047/049 files:
 *   Hr/Zr  → PersonRecord class reference
 *   Yr/$r  → FamilyRecord class reference
 *   eo/to  → EventRecord base
 *   no/ro  → PersonEventRecord
 *   oo/ao  → FamilyEventRecord
 *   io/uo  → PersonFactRecord (extends BaseRecord)
 *   so/lo  → PlaceRecord class reference
 *   co/fo  → SourceRecord class reference
 *   po/ho  → MediaRecord (extends BaseRecord)
 *   mo/vo  → NoteRecord (extends BaseRecord)
 *   yo/go  → DNATestResultRecord (extends BaseRecord)
 *   bo/Co  → ToDoRecord (extends BaseRecord)
 */

export { BaseRecord } from './BaseRecord.js';
export { PersonRecord } from './PersonRecord.js';
export { FamilyRecord } from './FamilyRecord.js';
export { PlaceRecord } from './PlaceRecord.js';
export { EventRecord, PersonEventRecord, FamilyEventRecord } from './EventRecord.js';
export { SourceRecord } from './SourceRecord.js';
export { wrapRecord, personSummary, familySummary, placeSummary, sourceSummary, lifeSpanLabel } from './wrap.js';
export {
  Gender,
  ChangeType,
  PlaceCitationMode,
  PlaceCitationTrailingMode,
  PlaceCitationBracketMode,
  LOCAL_RECORD_TYPES,
  ALL_RECORD_TYPES,
  PERSON_RECORD_TYPES,
  ZONE_SEPARATOR,
} from './constants.js';
