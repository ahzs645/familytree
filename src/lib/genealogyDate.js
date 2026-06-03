export const DATE_PRECISION = Object.freeze({
  EXACT: 'exact',
  ABOUT: 'about',
  BEFORE: 'before',
  AFTER: 'after',
  BETWEEN: 'between',
  FROM_TO: 'from-to',
  PERIOD: 'period',
  UNKNOWN: 'unknown',
});

export const CALENDAR = Object.freeze({
  GREGORIAN: 'gregorian',
  JULIAN: 'julian',
  HEBREW: 'hebrew',
  FRENCH_REPUBLICAN: 'french-republican',
  ROMAN: 'roman',
  UNKNOWN: 'unknown',
});

const MONTHS = Object.freeze({
  JAN: 1,
  JANUARY: 1,
  FEB: 2,
  FEBRUARY: 2,
  MAR: 3,
  MARCH: 3,
  APR: 4,
  APRIL: 4,
  MAY: 5,
  JUN: 6,
  JUNE: 6,
  JUL: 7,
  JULY: 7,
  AUG: 8,
  AUGUST: 8,
  SEP: 9,
  SEPT: 9,
  SEPTEMBER: 9,
  OCT: 10,
  OCTOBER: 10,
  NOV: 11,
  NOVEMBER: 11,
  DEC: 12,
  DECEMBER: 12,
});

const MONTH_NAMES = Object.freeze([
  null,
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]);

const PREFIXES = Object.freeze({
  ABT: DATE_PRECISION.ABOUT,
  ABOUT: DATE_PRECISION.ABOUT,
  CIRCA: DATE_PRECISION.ABOUT,
  CA: DATE_PRECISION.ABOUT,
  C: DATE_PRECISION.ABOUT,
  EST: DATE_PRECISION.ABOUT,
  CAL: DATE_PRECISION.ABOUT,
  BEF: DATE_PRECISION.BEFORE,
  BEFORE: DATE_PRECISION.BEFORE,
  AFT: DATE_PRECISION.AFTER,
  AFTER: DATE_PRECISION.AFTER,
});

const CALENDAR_TAGS = Object.freeze({
  DGREGORIAN: CALENDAR.GREGORIAN,
  DJULIAN: CALENDAR.JULIAN,
  DHEBREW: CALENDAR.HEBREW,
  'DFRENCH R': CALENDAR.FRENCH_REPUBLICAN,
  DROMAN: CALENDAR.ROMAN,
  DUNKNOWN: CALENDAR.UNKNOWN,
});

const PRECISION_SORT_WEIGHT = Object.freeze({
  [DATE_PRECISION.BEFORE]: 0,
  [DATE_PRECISION.EXACT]: 1,
  [DATE_PRECISION.ABOUT]: 2,
  [DATE_PRECISION.BETWEEN]: 3,
  [DATE_PRECISION.FROM_TO]: 4,
  [DATE_PRECISION.PERIOD]: 5,
  [DATE_PRECISION.AFTER]: 6,
  [DATE_PRECISION.UNKNOWN]: 7,
});

export function parseGenealogyDate(raw) {
  const original = raw == null ? '' : String(raw);
  const empty = buildResult({
    original,
    normalized: '',
    precision: DATE_PRECISION.UNKNOWN,
    calendar: CALENDAR.GREGORIAN,
  });
  let text = compactSpaces(original);
  if (!text) return empty;

  const calendarParse = consumeCalendar(text);
  const calendar = calendarParse.calendar;
  text = calendarParse.rest;

  const between = text.match(/^BET(?:WEEN)?\s+(.+?)\s+(?:AND|TO)\s+(.+)$/i);
  if (between) {
    return buildRangeResult({
      original,
      precision: DATE_PRECISION.BETWEEN,
      calendar,
      startRaw: between[1],
      endRaw: between[2],
      prefix: 'BET',
      separator: 'AND',
    });
  }

  const fromTo = text.match(/^FROM\s+(.+?)\s+TO\s+(.+)$/i);
  if (fromTo) {
    return buildRangeResult({
      original,
      precision: DATE_PRECISION.FROM_TO,
      calendar,
      startRaw: fromTo[1],
      endRaw: fromTo[2],
      prefix: 'FROM',
      separator: 'TO',
    });
  }

  const fromOnly = text.match(/^FROM\s+(.+)$/i);
  if (fromOnly) {
    const start = parseAtomicDate(fromOnly[1], calendar);
    return buildResult({
      original,
      normalized: joinDateParts(['FROM', start.normalized]),
      precision: DATE_PRECISION.PERIOD,
      calendar,
      start,
      end: null,
    });
  }

  const toOnly = text.match(/^TO\s+(.+)$/i);
  if (toOnly) {
    const end = parseAtomicDate(toOnly[1], calendar);
    return buildResult({
      original,
      normalized: joinDateParts(['TO', end.normalized]),
      precision: DATE_PRECISION.PERIOD,
      calendar,
      start: null,
      end,
    });
  }

  const prefixed = text.match(/^([A-Za-z.]+)\s+(.+)$/);
  if (prefixed) {
    const prefix = normalizePrefix(prefixed[1]);
    const precision = PREFIXES[prefix];
    if (precision) {
      const date = parseAtomicDate(prefixed[2], calendar);
      return buildResult({
        original,
        normalized: joinDateParts([canonicalPrefix(precision), date.normalized]),
        precision,
        calendar,
        start: date,
        end: date,
      });
    }
  }

  const exact = parseAtomicDate(text, calendar);
  return buildResult({
    original,
    normalized: exact.normalized,
    precision: exact.comparable ? DATE_PRECISION.EXACT : DATE_PRECISION.UNKNOWN,
    calendar,
    start: exact,
    end: exact,
  });
}

export function normalizeDateString(raw) {
  return parseGenealogyDate(raw).normalized;
}

export function normalizeGedcomDateLine(line) {
  const raw = line == null ? '' : String(line);
  const match = raw.match(/^(\s*\d+\s+DATE)(?:\s+(.+))?$/i);
  if (!match) return raw.trimEnd();
  const normalizedDate = normalizeDateString(match[2] || '');
  return normalizedDate ? `${match[1].toUpperCase()} ${normalizedDate}` : match[1].toUpperCase();
}

export function compareGenealogyDates(a, b) {
  const left = typeof a === 'object' && a ? a : parseGenealogyDate(a);
  const right = typeof b === 'object' && b ? b : parseGenealogyDate(b);
  const leftKey = sortKey(left);
  const rightKey = sortKey(right);
  for (let index = 0; index < leftKey.length; index += 1) {
    if (leftKey[index] < rightKey[index]) return -1;
    if (leftKey[index] > rightKey[index]) return 1;
  }
  return 0;
}

export function sortGenealogyDates(values) {
  return [...values].sort(compareGenealogyDates);
}

export function ageInYears(birthDate, deathDate) {
  const birth = parseGenealogyDate(birthDate);
  const death = parseGenealogyDate(deathDate);
  const birthParts = representativeParts(birth, 'start');
  const deathParts = representativeParts(death, 'start');
  if (birthParts?.year == null || deathParts?.year == null) return null;

  let age = deathParts.year - birthParts.year;
  if (age < 0) return null;
  if (birthParts.month && birthParts.day && deathParts.month && deathParts.day) {
    const birthdayPassed = deathParts.month > birthParts.month
      || (deathParts.month === birthParts.month && deathParts.day >= birthParts.day);
    if (!birthdayPassed) age -= 1;
  }
  return age >= 0 ? age : null;
}

export function extractComparableDate(raw) {
  const parsed = typeof raw === 'object' && raw ? raw : parseGenealogyDate(raw);
  const start = parsed.start?.comparable || null;
  const end = parsed.end?.comparable || null;
  if (!start && !end) return null;
  return { start, end, precision: parsed.precision, calendar: parsed.calendar };
}

function buildRangeResult({ original, precision, calendar, startRaw, endRaw, prefix, separator }) {
  const start = parseAtomicDate(startRaw, calendar);
  const end = parseAtomicDate(endRaw, calendar);
  return buildResult({
    original,
    normalized: joinDateParts([prefix, start.normalized, separator, end.normalized]),
    precision,
    calendar,
    start,
    end,
  });
}

function buildResult({ original, normalized, precision, calendar, start = null, end = null }) {
  return {
    original,
    normalized: calendarPrefix(calendar, normalized),
    precision,
    calendar,
    start,
    end,
    comparable: {
      start: start?.comparable || null,
      end: end?.comparable || null,
    },
  };
}

function parseAtomicDate(raw, calendar = CALENDAR.GREGORIAN) {
  const original = compactSpaces(raw);
  const era = consumeEra(original);
  const text = era.rest;
  const normalized = normalizeAtomicText(text, era.era);
  const comparable = comparableParts(text, era.era, calendar);
  return { original, normalized, calendar, era: era.era, comparable };
}

function comparableParts(text, era, calendar) {
  if (calendar === CALENDAR.HEBREW || calendar === CALENDAR.FRENCH_REPUBLICAN || calendar === CALENDAR.ROMAN) {
    return parseYearOnly(text, era);
  }

  let match = text.match(/^(\d{1,2})\s+([A-Za-z.]+)\s+(-?\d{1,6})$/);
  if (match) return validParts(toYear(match[3], era), monthNumber(match[2]), Number(match[1]));

  match = text.match(/^([A-Za-z.]+)\s+(\d{1,2}),?\s+(-?\d{1,6})$/);
  if (match) return validParts(toYear(match[3], era), monthNumber(match[1]), Number(match[2]));

  match = text.match(/^(-?\d{1,6})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (match) return validParts(toYear(match[1], era), Number(match[2]), match[3] ? Number(match[3]) : null);

  match = text.match(/^([A-Za-z.]+)\s+(-?\d{1,6})$/);
  if (match) return validParts(toYear(match[2], era), monthNumber(match[1]), null);

  return parseYearOnly(text, era);
}

function parseYearOnly(text, era) {
  const match = text.match(/^(-?\d{1,6})$/);
  if (!match) return null;
  return validParts(toYear(match[1], era), null, null);
}

function validParts(year, month, day) {
  if (!Number.isInteger(year)) return null;
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) return null;
  if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) return null;
  return { year, month: month || null, day: day || null };
}

function normalizeAtomicText(text, era) {
  const parts = comparableParts(text, era, CALENDAR.GREGORIAN);
  if (!parts) return compactSpaces(text).toUpperCase();
  return formatComparableParts(parts);
}

function formatComparableParts({ year, month, day }) {
  const displayYear = year <= 0 ? `${Math.abs(year - 1)} BC` : String(year);
  if (month && day) return `${day} ${MONTH_NAMES[month]} ${displayYear}`;
  if (month) return `${MONTH_NAMES[month]} ${displayYear}`;
  return displayYear;
}

function sortKey(parsed) {
  const comparable = parsed.comparable?.start || parsed.comparable?.end;
  if (!comparable) return [1, Infinity, Infinity, Infinity, PRECISION_SORT_WEIGHT[parsed.precision] ?? 99, parsed.normalized || ''];
  return [
    0,
    comparable.year,
    comparable.month || 0,
    comparable.day || 0,
    PRECISION_SORT_WEIGHT[parsed.precision] ?? 99,
    parsed.normalized || '',
  ];
}

function representativeParts(parsed, side) {
  return parsed.comparable?.[side] || parsed.comparable?.start || parsed.comparable?.end || null;
}

function consumeCalendar(text) {
  const match = text.match(/^@#([^@]+)@\s*(.*)$/i);
  if (!match) return { calendar: CALENDAR.GREGORIAN, rest: text };
  const tag = match[1].trim().toUpperCase();
  return {
    calendar: CALENDAR_TAGS[tag] || CALENDAR.UNKNOWN,
    rest: compactSpaces(match[2]),
  };
}

function consumeEra(text) {
  const match = text.match(/^(.+?)\s+(BC|BCE|AD|CE)$/i);
  if (!match) return { era: 'AD', rest: text };
  const era = /BC|BCE/i.test(match[2]) ? 'BC' : 'AD';
  return { era, rest: compactSpaces(match[1]) };
}

function calendarPrefix(calendar, normalized) {
  if (!normalized) return '';
  if (calendar === CALENDAR.JULIAN) return `@#DJULIAN@ ${normalized}`;
  if (calendar === CALENDAR.HEBREW) return `@#DHEBREW@ ${normalized}`;
  if (calendar === CALENDAR.FRENCH_REPUBLICAN) return `@#DFRENCH R@ ${normalized}`;
  if (calendar === CALENDAR.ROMAN) return `@#DROMAN@ ${normalized}`;
  if (calendar === CALENDAR.UNKNOWN) return `@#DUNKNOWN@ ${normalized}`;
  return normalized;
}

function normalizePrefix(token) {
  return String(token || '').replace(/\.$/, '').toUpperCase();
}

function canonicalPrefix(precision) {
  if (precision === DATE_PRECISION.ABOUT) return 'ABT';
  if (precision === DATE_PRECISION.BEFORE) return 'BEF';
  if (precision === DATE_PRECISION.AFTER) return 'AFT';
  return '';
}

function monthNumber(token) {
  const key = String(token || '').replace(/\.$/, '').toUpperCase();
  return MONTHS[key] || null;
}

function toYear(value, era) {
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  return era === 'BC' ? 1 - year : year;
}

function joinDateParts(parts) {
  return parts.filter(Boolean).join(' ').trim();
}

function compactSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
