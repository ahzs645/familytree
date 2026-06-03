import { compareIssues, makeValidationIssue } from './validationIssues.js';

const INVISIBLE_CHAR_RE = /[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/u;
const NBSP_RE = /\u00a0/u;
const REPEATED_WHITESPACE_RE = /[ \t\r\n\f\v]{2,}/u;
const LEADING_TRAILING_WHITESPACE_RE = /^\s|\s$/u;
const SPACE_BEFORE_PUNCTUATION_RE = /\s+[,.!?;:،؛؟]/u;
const MISSING_SPACE_AFTER_PUNCTUATION_RE = /[,:;،؛](?=[^\s\d,.;:!?،؛؟])/u;
const SPACE_INSIDE_BRACKET_RE = /(?:[\[(]\s|\s[\])])/u;

const SCRIPT_TESTS = Object.freeze({
  Latin: /\p{Script=Latin}/u,
  Arabic: /\p{Script=Arabic}/u,
  Cyrillic: /\p{Script=Cyrillic}/u,
});

const FIELD_RULES = Object.freeze({
  Person: {
    kind: 'name',
    fields: ['firstName', 'lastName', 'nameMiddle', 'middleName', 'namePrefix', 'nameSuffix', 'cached_fullName'],
  },
  Place: {
    kind: 'place',
    fields: [
      'placeName',
      'name',
      'place',
      'cached_displayName',
      'cached_standardizedLocationString',
      'cached_normallocationString',
      'cached_normalLocationString',
      'cached_shortLocationString',
      'cached_veryShortLocationString',
    ],
  },
  Source: {
    kind: 'source',
    fields: ['title', 'cached_title', 'name', 'author', 'publisher', 'publication', 'repository', 'callNumber'],
  },
  Citation: {
    kind: 'source',
    fields: ['page', 'citation', 'text', 'transcription', 'excerpt'],
  },
  SourceRelation: {
    kind: 'source',
    fields: ['page', 'citation', 'text', 'transcription', 'excerpt'],
  },
});

const SMALL_WORDS = new Set(['al', 'and', 'bin', 'bint', 'da', 'de', 'del', 'der', 'di', 'el', 'ibn', 'of', 'the', 'van', 'von']);

export function findTextHygieneIssues(records = [], options = {}) {
  const issues = [];
  for (const record of records || []) {
    for (const target of getTextHygieneTargets(record, options)) {
      issues.push(...checkTextValue(target.value, { ...target, record }));
    }
  }
  return issues.sort(compareIssues);
}

export function getTextHygieneTargets(record, { fieldRules = FIELD_RULES } = {}) {
  const rule = fieldRules[record?.recordType];
  if (!rule) return [];
  const fields = record?.fields || {};
  return rule.fields
    .map((fieldName) => {
      const value = readFieldValue(fields[fieldName]);
      if (typeof value !== 'string' || value === '') return null;
      return { fieldName, value, kind: rule.kind };
    })
    .filter(Boolean);
}

export function checkTextValue(value, { record = null, fieldName = 'value', kind = 'text' } = {}) {
  if (typeof value !== 'string' || value === '') return [];
  const context = { record, fieldName, kind, value };
  const scripts = mixedScripts(value);
  return [
    INVISIBLE_CHAR_RE.test(value) ? textIssue('text-invisible-character', 'warning', context, 'contains invisible formatting characters') : null,
    NBSP_RE.test(value) ? textIssue('text-nbsp', 'warning', context, 'contains a non-breaking space') : null,
    REPEATED_WHITESPACE_RE.test(value) ? textIssue('text-repeated-whitespace', 'low', context, 'contains repeated whitespace') : null,
    LEADING_TRAILING_WHITESPACE_RE.test(value) ? textIssue('text-edge-whitespace', 'low', context, 'has leading or trailing whitespace') : null,
    scripts ? textIssue('text-mixed-script', 'warning', context, `mixes ${scripts.join(', ')} scripts`) : null,
    hasSuspiciousPunctuationSpacing(value) ? textIssue('text-punctuation-spacing', 'low', context, 'has suspicious punctuation spacing') : null,
    hasBadCapitalization(value, kind) ? textIssue('text-bad-capitalization', 'low', context, 'has suspicious capitalization') : null,
  ].filter(Boolean);
}

export function mixedScripts(value) {
  const scripts = Object.entries(SCRIPT_TESTS)
    .filter(([, test]) => test.test(value))
    .map(([script]) => script);
  return scripts.length > 1 ? scripts : null;
}

export function hasSuspiciousPunctuationSpacing(value) {
  return SPACE_BEFORE_PUNCTUATION_RE.test(value) ||
    MISSING_SPACE_AFTER_PUNCTUATION_RE.test(value) ||
    SPACE_INSIDE_BRACKET_RE.test(value);
}

export function hasBadCapitalization(value, kind = 'text') {
  if (!['name', 'place', 'source'].includes(kind)) return false;
  if (!SCRIPT_TESTS.Latin.test(value)) return false;
  const words = value.match(/\p{Script=Latin}[\p{Script=Latin}'-]*/gu) || [];
  const meaningfulWords = words.filter((word) => word.replace(/[^A-Za-z]/g, '').length >= 3);
  if (meaningfulWords.length === 0) return false;

  const uppercaseWords = meaningfulWords.filter((word) => hasManyCasedLetters(word) && word === word.toUpperCase());
  if (uppercaseWords.length >= Math.min(2, meaningfulWords.length)) return true;

  const lowerCaseStarts = meaningfulWords.filter((word) => {
    const lower = word.toLowerCase();
    return !SMALL_WORDS.has(lower) && word[0] === word[0].toLowerCase();
  });
  return lowerCaseStarts.length >= Math.min(2, meaningfulWords.length);
}

function textIssue(code, severity, { record, fieldName, kind, value }, description) {
  const label = record?.recordName ? `${record.recordName}.${fieldName}` : fieldName;
  return makeValidationIssue({
    scope: 'text-hygiene',
    code,
    severity,
    recordName: record?.recordName || null,
    recordType: record?.recordType || null,
    refs: [fieldName],
    message: `${label} ${description}.`,
    details: {
      fieldName,
      kind,
      value,
    },
  });
}

function readFieldValue(field) {
  if (!field) return undefined;
  return Object.prototype.hasOwnProperty.call(field, 'value') ? field.value : field;
}

function hasManyCasedLetters(word) {
  return (word.match(/[A-Za-z]/g) || []).length >= 2;
}
