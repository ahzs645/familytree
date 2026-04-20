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
