/**
 * GEDCOM 5.5.1 date qualifier vocabulary and round-trip helpers.
 *
 * A qualified date is stored as a single string token matching GEDCOM form:
 *   "ABT 1820"            — approximated
 *   "BEF 1 JAN 1900"      — before
 *   "AFT 1820"            — after
 *   "BET 1701 AND 1704"   — range (inclusive)
 *   "FROM 1901 TO 1905"   — span
 *   "CAL 1820"            — calculated
 *   "EST 1820"            — estimated
 *   "INT 1820 (census)"   — interpreted with phrase
 *   "1820 BC"             — era suffix
 *
 * The source-of-truth vocabulary is MacFamilyTree's CoreDateParser.strings:
 *   _DateParser_DatePrefixes_Estimates  — About; After; Before; CA; CIRCA; ABT; INT; EST; CAL; BEF; AFT; Pre; Post; Prior To; By; Perhaps; ~; ?
 *   _DateParser_RangePrefixes            — Bet; Between; From
 *   _DateParser_RangeSeparators          — and; to
 *   _DateParser_EraAD / _EraBC           — AD; BC
 */

export const PREFIX = Object.freeze({
  NONE: '',
  ABT: 'ABT',
  CAL: 'CAL',
  EST: 'EST',
  BEF: 'BEF',
  AFT: 'AFT',
  BET: 'BET',
  FROM: 'FROM',
  INT: 'INT',
});

export const PREFIX_LABELS = Object.freeze({
  [PREFIX.NONE]: 'Exact',
  [PREFIX.ABT]: 'About (ABT)',
  [PREFIX.CAL]: 'Calculated (CAL)',
  [PREFIX.EST]: 'Estimated (EST)',
  [PREFIX.BEF]: 'Before (BEF)',
  [PREFIX.AFT]: 'After (AFT)',
  [PREFIX.BET]: 'Between (BET … AND)',
  [PREFIX.FROM]: 'From (FROM … TO)',
  [PREFIX.INT]: 'Interpreted (INT)',
});

export const ERA = Object.freeze({ AD: '', BC: 'BC' });

const RANGE_PREFIXES = new Set([PREFIX.BET, PREFIX.FROM]);

export function isRangePrefix(prefix) {
  return RANGE_PREFIXES.has(prefix);
}

const PREFIX_ALIASES = {
  ABT: PREFIX.ABT, ABOUT: PREFIX.ABT, CIRCA: PREFIX.ABT, CA: PREFIX.ABT, '~': PREFIX.ABT,
  EST: PREFIX.EST, ESTIMATED: PREFIX.EST, PERHAPS: PREFIX.EST, '?': PREFIX.EST,
  CAL: PREFIX.CAL, CALCULATED: PREFIX.CAL,
  BEF: PREFIX.BEF, BEFORE: PREFIX.BEF, PRE: PREFIX.BEF, 'PRIOR TO': PREFIX.BEF, BY: PREFIX.BEF,
  AFT: PREFIX.AFT, AFTER: PREFIX.AFT, POST: PREFIX.AFT,
  BET: PREFIX.BET, BETWEEN: PREFIX.BET,
  FROM: PREFIX.FROM,
  INT: PREFIX.INT, INTERPRETED: PREFIX.INT,
};

function normalizePrefixToken(token) {
  if (!token) return null;
  const upper = String(token).trim().toUpperCase();
  return PREFIX_ALIASES[upper] || null;
}

/**
 * Parse a free-text or GEDCOM date string into its qualified parts.
 * Returns { prefix, date1, date2, era, phrase } where date1/date2 are raw
 * date strings (still free-text at the atomic level — downstream parseEventDate
 * handles YYYY, YYYY-MM, DD MON YYYY, etc).
 *
 * parse("") → { prefix: '', date1: '', date2: '', era: '', phrase: '' }
 * parse("ABT 1820") → { prefix: 'ABT', date1: '1820', ... }
 * parse("BET 1701 AND 1704") → { prefix: 'BET', date1: '1701', date2: '1704', ... }
 * parse("1820 BC") → { prefix: '', date1: '1820', era: 'BC', ... }
 * parse("INT 1820 (census)") → { prefix: 'INT', date1: '1820', phrase: 'census', ... }
 */
export function parseQualifiedDate(raw) {
  const empty = { prefix: '', date1: '', date2: '', era: '', phrase: '' };
  if (raw == null) return empty;
  let s = String(raw).trim();
  if (!s) return empty;

  let phrase = '';
  const phraseMatch = s.match(/\(([^)]*)\)\s*$/);
  if (phraseMatch) {
    phrase = phraseMatch[1].trim();
    s = s.slice(0, phraseMatch.index).trim();
  }

  let era = '';
  const eraMatch = s.match(/\s+(BC|BCE|AD|CE)$/i);
  if (eraMatch) {
    const tag = eraMatch[1].toUpperCase();
    era = (tag === 'BC' || tag === 'BCE') ? ERA.BC : ERA.AD;
    s = s.slice(0, eraMatch.index).trim();
  }

  const headMatch = s.match(/^([A-Za-z~?]+(?:\s+[A-Za-z]+)?)\s+(.+)$/);
  let prefix = '';
  if (headMatch) {
    const candidate = normalizePrefixToken(headMatch[1]);
    if (candidate) {
      prefix = candidate;
      s = headMatch[2].trim();
    }
  } else {
    const solo = normalizePrefixToken(s);
    if (solo) {
      return { prefix: solo, date1: '', date2: '', era: '', phrase: '' };
    }
  }

  let date1 = s;
  let date2 = '';
  if (isRangePrefix(prefix)) {
    const separator = prefix === PREFIX.BET
      ? /\s+(?:AND|TO|&)\s+/i
      : /\s+(?:TO|AND)\s+/i;
    const parts = s.split(separator);
    if (parts.length >= 2) {
      date1 = parts[0].trim();
      date2 = parts.slice(1).join(' ').trim();
    }
  }

  return { prefix, date1, date2, era, phrase };
}

/**
 * Compose a GEDCOM-style date token from qualified parts.
 * Empty parts are omitted; an empty result indicates no date stored.
 */
export function formatQualifiedDate({ prefix = '', date1 = '', date2 = '', era = '', phrase = '' } = {}) {
  const d1 = String(date1 || '').trim();
  const d2 = String(date2 || '').trim();
  const ph = String(phrase || '').trim();

  let body = '';
  if (isRangePrefix(prefix)) {
    if (!d1 && !d2) body = '';
    else {
      const joiner = prefix === PREFIX.BET ? 'AND' : 'TO';
      body = [d1, joiner, d2].filter(Boolean).join(' ');
    }
  } else {
    body = d1;
  }

  let token = prefix ? (body ? `${prefix} ${body}` : prefix) : body;
  if (era === ERA.BC && token) token = `${token} BC`;
  if (ph) token = token ? `${token} (${ph})` : `(${ph})`;
  return token;
}

/**
 * Human-readable rendering of a qualified date. Defers atomic date formatting
 * to a caller-supplied formatter (usually `formatEventDate`) so the active
 * locale is honored.
 */
export function displayQualifiedDate(raw, atomicFormatter = (x) => x) {
  const parts = parseQualifiedDate(raw);
  const { prefix, date1, date2, era, phrase } = parts;
  const d1 = date1 ? atomicFormatter(date1) : '';
  const d2 = date2 ? atomicFormatter(date2) : '';

  const assembly = (() => {
    if (isRangePrefix(prefix)) {
      if (!d1 && !d2) return PREFIX_LABELS[prefix] || '';
      if (prefix === PREFIX.BET) return `between ${d1}${d2 ? ` and ${d2}` : ''}`;
      return `from ${d1}${d2 ? ` to ${d2}` : ''}`;
    }
    switch (prefix) {
      case PREFIX.ABT: return `about ${d1}`;
      case PREFIX.CAL: return `calculated ${d1}`;
      case PREFIX.EST: return `estimated ${d1}`;
      case PREFIX.BEF: return `before ${d1}`;
      case PREFIX.AFT: return `after ${d1}`;
      case PREFIX.INT: return d1 ? `${d1} (interpreted)` : 'interpreted';
      default: return d1;
    }
  })();

  let text = assembly;
  if (era === ERA.BC && text) text = `${text} BC`;
  if (phrase) text = text ? `${text} (${phrase})` : `(${phrase})`;
  return text;
}

export function hasQualifier(raw) {
  const { prefix, era, phrase } = parseQualifiedDate(raw);
  return Boolean(prefix || era || phrase);
}

export function parseHistoricalDateParts(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const normalized = normalizeLocalizedMonthText(text);
  let match = text.match(/^(-?\d{1,6})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };

  match = normalized.match(/^(\d{1,2})\s+([\p{L}.]+)\s+(-?\d{1,6})$/u);
  if (match) {
    const month = monthNumber(match[2]);
    if (!month) return null;
    return { year: Number(match[3]), month, day: Number(match[1]) };
  }

  match = normalized.match(/^([\p{L}.]+)\s+(\d{1,2}),?\s+(-?\d{1,6})$/u);
  if (match) {
    const month = monthNumber(match[1]);
    if (!month) return null;
    return { year: Number(match[3]), month, day: Number(match[2]) };
  }

  return null;
}

export function parseHistoricalDateRange(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const match = text.match(/^q([1-4])\s+(-?\d{1,6})$/i);
  if (match) {
    const quarter = Number(match[1]);
    const year = Number(match[2]);
    const startMonth = ((quarter - 1) * 3) + 1;
    const endMonth = startMonth + 2;
    return {
      start: { year, month: startMonth, day: 1 },
      end: { year, month: endMonth, day: daysInGregorianMonth(year, endMonth) },
      precision: 'quarter',
    };
  }
  const exact = parseHistoricalDateParts(text);
  if (exact) return { start: exact, end: exact, precision: 'day' };
  return null;
}

export function validateHistoricalDate(raw, calendar = 'gregorian') {
  const parts = typeof raw === 'object' && raw ? raw : parseHistoricalDateParts(raw);
  if (!parts) return { valid: false, calendar, reason: 'unparsed-date' };
  const normalizedCalendar = String(calendar || 'gregorian').toLowerCase();
  const valid = (() => {
    if (normalizedCalendar === 'julian') return isValidJulianDate(parts);
    if (normalizedCalendar === 'swedish') return isValidSwedishDate(parts);
    if (normalizedCalendar === 'french' || normalizedCalendar === 'french-republican') return isValidFrenchRepublicanDate(parts);
    return isValidGregorianDate(parts);
  })();
  return {
    valid,
    calendar: normalizedCalendar,
    reason: valid ? null : 'invalid-day-for-calendar',
    parts,
  };
}

export function isValidGregorianDate({ year, month, day }) {
  return isValidCalendarDate({ year, month, day }, (candidateYear) => (
    candidateYear % 4 === 0 && (candidateYear % 100 !== 0 || candidateYear % 400 === 0)
  ));
}

export function isValidJulianDate({ year, month, day }) {
  return isValidCalendarDate({ year, month, day }, (candidateYear) => candidateYear % 4 === 0);
}

export function isValidSwedishDate(parts) {
  if (parts?.year === 1712 && parts?.month === 2 && parts?.day === 30) return true;
  if (parts?.year === 1700 && parts?.month === 2 && parts?.day === 29) return false;
  return isValidJulianDate(parts);
}

export function isValidFrenchRepublicanDate({ year, month, day }) {
  if (!Number.isInteger(year) || year < 1) return false;
  if (!Number.isInteger(month) || month < 1 || month > 13) return false;
  if (!Number.isInteger(day) || day < 1) return false;
  return month === 13 ? day <= 6 : day <= 30;
}

function isValidCalendarDate({ year, month, day }, isLeapYear) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function monthNumber(name) {
  const key = normalizeLocalizedMonthText(name).replace(/\.$/, '').toLowerCase();
  if (!key) return null;
  if (MONTH_ALIASES[key]) return MONTH_ALIASES[key];
  const short = key.slice(0, 3);
  return MONTH_ALIASES[short] || null;
}

function normalizeLocalizedMonthText(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function daysInGregorianMonth(year, month) {
  return [31, isValidGregorianDate({ year, month: 2, day: 29 }) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || 0;
}

const MONTH_ALIASES = Object.freeze({
  jan: 1, january: 1, janvier: 1, januar: 1, enero: 1, gennaio: 1,
  feb: 2, february: 2, fevrier: 2, februar: 2, febrero: 2, febbraio: 2,
  mar: 3, march: 3, mars: 3, marz: 3, marzo: 3,
  apr: 4, april: 4, avril: 4, abril: 4, aprile: 4,
  may: 5, mai: 5, maj: 5, mayo: 5, maggio: 5,
  jun: 6, june: 6, juin: 6, juni: 6, junio: 6, giugno: 6,
  jul: 7, july: 7, juillet: 7, juli: 7, julio: 7, luglio: 7,
  aug: 8, august: 8, aout: 8, agosto: 8,
  sep: 9, sept: 9, september: 9, septembre: 9, septiembre: 9, settembre: 9,
  oct: 10, october: 10, octobre: 10, oktober: 10, octubre: 10, ottobre: 10,
  nov: 11, november: 11, novembre: 11, noviembre: 11,
  dec: 12, december: 12, decembre: 12, dezember: 12, diciembre: 12, dicembre: 12,
  январь: 1, января: 1, янв: 1,
  февраль: 2, февраля: 2, фев: 2,
  март: 3, марта: 3, мар: 3,
  апрель: 4, апреля: 4, апр: 4,
  май: 5, мая: 5,
  июнь: 6, июня: 6, июн: 6,
  июль: 7, июля: 7, июл: 7,
  август: 8, августа: 8, авг: 8,
  сентябрь: 9, сентября: 9, сентяб: 9, сен: 9,
  октябрь: 10, октября: 10, окт: 10,
  ноябрь: 11, ноября: 11, ноя: 11,
  декабрь: 12, декабря: 12, дек: 12,
});
