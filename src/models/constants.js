/**
 * Enums and constants extracted from the CloudTreeWeb bundle.
 */

/** Gender values (was `ct`) */
export const Gender = Object.freeze({
  Male: 0,
  Female: 1,
  UnknownGender: 2,
  Intersex: 3,
});

/** Change log entry types (was `nt`) */
export const ChangeType = Object.freeze({
  Change: 0,
  Add: 1,
  Delete: 2,
  ResolvedConflict: 3,
});

/** Place citation modes (was `yt`) */
export const PlaceCitationMode = Object.freeze({
  Normal: 0,
  VeryShort: 1,
  Short: 2,
});

/** Place citation trailing separator (was unnamed freeze) */
export const PlaceCitationTrailingMode = Object.freeze({
  Comma: 0,
  Period: 1,
  Hyphen: 2,
  Space: 3,
  Colon: 4,
  Semicolon: 5,
});

/** Place citation bracket style (was `gt`) */
export const PlaceCitationBracketMode = Object.freeze({
  None: 0,
  Brackets: 1,
  CurlyBrackets: 2,
  AngleBrackets: 3,
  SingleQuotes: 4,
  DoubleQuotes: 5,
});

/**
 * Record types used in local queries (was `at`).
 */
export const LOCAL_RECORD_TYPES = [
  'Family',
  'MediaPicture',
  'MediaPDF',
  'MediaURL',
  'Note',
  'Person',
  'PersonEvent',
  'FamilyEvent',
  'PersonFact',
  'Place',
  'Source',
];

/**
 * All record types including cloud-only (was `it`).
 */
export const ALL_RECORD_TYPES = [
  ...LOCAL_RECORD_TYPES,
  'DNATestResult',
  'FamilyTreeInformation',
  'PersonGroup',
  'Source',
  'ToDo',
];

/**
 * Person-only type filter (was `ut`).
 */
export const PERSON_RECORD_TYPES = ['Person'];

/**
 * Zone name separator used in the app's internal naming convention (was `sa`).
 */
export const ZONE_SEPARATOR = '#####';
