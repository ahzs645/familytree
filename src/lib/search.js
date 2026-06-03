/**
 * Multi-criteria search engine over LocalDatabase.
 *
 * A query is { entityType, filters: [...], textQuery, limit }.
 * Filters are { field, op, value } where op is one of:
 *   "contains" | "equals" | "startsWith" | "exists" | "missing"
 *   "before" | "after" | "between"   (date ops; values are 'YYYY' or 'YYYY-MM-DD')
 *
 * Each entity type exposes its own searchable fields via `SEARCH_FIELDS`.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { Gender } from '../models/index.js';
import { FIELD_ALIASES, readConclusionType, readField } from './schema.js';
import { equalsSearchText, matchesSearchText, normalizeSearchText, searchTokenVariants, startsWithSearchText } from './i18n.js';
import { refToRecordName } from './recordRef.js';

const searchIndexCache = new Map();

export const ENTITY_TYPES = [
  { id: 'Person', label: 'Persons' },
  { id: 'Family', label: 'Families' },
  { id: 'Place', label: 'Places' },
  { id: 'Source', label: 'Sources' },
  { id: 'PersonEvent', label: 'Person Events' },
  { id: 'FamilyEvent', label: 'Family Events' },
  { id: 'Note', label: 'Notes' },
  { id: 'ToDo', label: 'ToDos' },
  { id: 'MediaPicture', label: 'Pictures' },
  { id: 'SavedChart', label: 'Saved Charts' },
  { id: 'Scope', label: 'Scopes' },
  { id: 'ResearchAssistantQuestionInfo', label: 'Research Questions' },
];

export const SEARCH_FIELDS = {
  Person: [
    { id: 'firstName', label: 'First Name', type: 'text' },
    { id: 'lastName', label: 'Last Name', type: 'text' },
    { id: 'cached_fullName', label: 'Full Name', type: 'text' },
    {
      id: 'gender',
      label: 'Gender',
      type: 'enum',
      options: [
        { value: Gender.Male, label: 'Male' },
        { value: Gender.Female, label: 'Female' },
        { value: Gender.UnknownGender, label: 'Unknown' },
        { value: Gender.Intersex, label: 'Intersex' },
      ],
    },
    { id: 'cached_birthDate', label: 'Birth Date', type: 'date' },
    { id: 'cached_deathDate', label: 'Death Date', type: 'date' },
    { id: 'thumbnailFileIdentifier', label: 'Has Photo', type: 'presence' },
  ],
  Family: [
    { id: 'cached_familyName', label: 'Family Name', type: 'text' },
    { id: 'cached_marriageDate', label: 'Marriage Date', type: 'date' },
  ],
  Place: [
    { id: 'placeName', label: 'Name', type: 'text', aliases: FIELD_ALIASES.placeName },
    { id: 'cached_standardizedLocationString', label: 'Display Name', type: 'text', aliases: ['cached_standardizedLocationString', 'cached_displayName', 'cached_normallocationString', 'cached_normalLocationString', 'cached_shortLocationString', 'placeName'] },
    { id: 'geonameID', label: 'GeoName ID', type: 'text', aliases: FIELD_ALIASES.geonameID },
  ],
  Source: [
    { id: 'title', label: 'Title', type: 'text', aliases: FIELD_ALIASES.sourceTitle },
    { id: 'author', label: 'Author', type: 'text', aliases: ['author', 'authorName', 'cached_author'] },
  ],
  PersonEvent: [
    { id: 'eventType', label: 'Event Type', type: 'text', aliases: ['eventType', 'conclusionType'] },
    { id: 'conclusionType', label: 'Conclusion Type', type: 'text', aliases: ['eventType', 'conclusionType'] },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'description', label: 'Description', type: 'text', aliases: ['description', 'userDescription', 'userDescription1', 'userDescription2'] },
  ],
  FamilyEvent: [
    { id: 'eventType', label: 'Event Type', type: 'text', aliases: ['eventType', 'conclusionType'] },
    { id: 'date', label: 'Date', type: 'date' },
    { id: 'description', label: 'Description', type: 'text', aliases: ['description', 'userDescription', 'userDescription1', 'userDescription2'] },
  ],
  Note: [
    { id: 'text', label: 'Text', type: 'text', aliases: ['text', 'note', 'title'] },
  ],
  ToDo: [
    { id: 'title', label: 'Title', type: 'text' },
    { id: 'status', label: 'Status', type: 'text' },
    { id: 'dueDate', label: 'Due Date', type: 'date' },
  ],
  MediaPicture: [
    { id: 'caption', label: 'Caption', type: 'text', aliases: ['caption', 'title', 'filename'] },
  ],
  SavedChart: [
    { id: 'title', label: 'Title', type: 'text', aliases: ['title', 'name'] },
  ],
  Scope: [
    { id: 'scopeName', label: 'Name', type: 'text', aliases: ['scopeName', 'name'] },
  ],
  ResearchAssistantQuestionInfo: [
    { id: 'infoKey', label: 'Key', type: 'text' },
    { id: 'infoValue', label: 'Value', type: 'text' },
  ],
};

export const FILTER_OPS = {
  text: ['contains', 'equals', 'startsWith'],
  enum: ['equals'],
  date: ['equals', 'before', 'after', 'between'],
  presence: ['exists', 'missing'],
};

function fieldValue(record, filter) {
  if (filter?.field === 'conclusionType') return readConclusionType(record);
  const def = SEARCH_FIELDS[record.recordType]?.find((f) => f.id === (filter?.field || filter));
  return readField(record, def?.aliases || filter?.field || filter);
}

function matchesText(rawValue, op, target) {
  if (rawValue == null) return false;
  if (op === 'contains') return matchesSearchText(rawValue, target);
  if (op === 'equals') return equalsSearchText(rawValue, target);
  if (op === 'startsWith') return startsWithSearchText(rawValue, target);
  return false;
}

function parseYear(s) {
  if (s == null) return null;
  const m = String(s).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function matchesDate(rawValue, op, target, target2) {
  const y = parseYear(rawValue);
  const ty = parseYear(target);
  if (y == null) return false;
  if (op === 'equals') return ty != null && y === ty;
  if (op === 'before') return ty != null && y < ty;
  if (op === 'after') return ty != null && y > ty;
  if (op === 'between') {
    const ty2 = parseYear(target2);
    return ty != null && ty2 != null && y >= Math.min(ty, ty2) && y <= Math.max(ty, ty2);
  }
  return false;
}

function matchesFilter(record, filter) {
  const v = fieldValue(record, filter);
  switch (filter.op) {
    case 'contains':
    case 'equals':
    case 'startsWith':
      if (filter.fieldType === 'enum') return v === filter.value;
      return matchesText(v, filter.op, filter.value);
    case 'before':
    case 'after':
    case 'between':
      return matchesDate(v, filter.op, filter.value, filter.value2);
    case 'exists':
      return v != null && v !== '';
    case 'missing':
      return v == null || v === '';
    default:
      return true;
  }
}

function matchesText_anywhere(record, q) {
  const fields = record.fields || {};
  for (const k of Object.keys(fields)) {
    const val = fields[k]?.value;
    if (typeof val === 'string' && matchesSearchText(val, q)) return true;
  }
  return false;
}

export function createSearchIndex(records = []) {
  const byToken = new Map();
  const textById = new Map();
  const substringTokenCache = new Map();
  for (const record of records || []) {
    if (!record?.recordName) continue;
    const text = searchableText(record);
    textById.set(record.recordName, text);
    for (const token of tokenizeSearchText(text)) {
      if (!byToken.has(token)) byToken.set(token, new Set());
      byToken.get(token).add(record.recordName);
    }
  }
  return { byToken, textById, substringTokenCache, size: textById.size };
}

export function querySearchIndex(index, query) {
  const tokenGroups = tokenizeBaseSearchText(query).map((token) => searchTokenVariants(token));
  if (!tokenGroups.length) return new Set(index?.textById?.keys?.() || []);
  const tokenMatches = tokenGroups.map((tokens) => idsForTokenVariants(index, tokens));
  if (tokenMatches.some((set) => set.size === 0)) return new Set();
  const [first, ...rest] = tokenMatches.sort((a, b) => a.size - b.size);
  const out = new Set();
  for (const id of first) {
    if (rest.every((set) => set.has(id))) out.add(id);
  }
  return out;
}

function idsForTokenVariants(index, tokens) {
  const out = new Set();
  for (const token of tokens) {
    for (const id of idsForToken(index, token)) out.add(id);
  }
  return out;
}

function idsForToken(index, token) {
  const exact = index?.byToken?.get(token);
  if (exact) return exact;
  const cached = index?.substringTokenCache?.get(token);
  if (cached) return cached;
  const out = new Set();
  for (const [candidate, ids] of index?.byToken || []) {
    if (candidate.includes(token)) {
      for (const id of ids) out.add(id);
    }
  }
  index?.substringTokenCache?.set(token, out);
  return out;
}

function searchableText(record) {
  const parts = [record.recordName, record.recordType];
  for (const field of Object.values(record.fields || {})) {
    collectSearchText(field?.value, parts);
  }
  return parts.filter(Boolean).join(' ');
}

function collectSearchText(value, parts) {
  if (value == null) return;
  if (typeof value === 'string' || typeof value === 'number') parts.push(String(value));
  else if (Array.isArray(value)) value.forEach((item) => collectSearchText(item, parts));
  else if (typeof value === 'object') Object.values(value).forEach((item) => collectSearchText(item, parts));
}

function tokenizeSearchText(text) {
  const baseTokens = tokenizeBaseSearchText(text);
  const out = new Set(baseTokens);
  for (const token of baseTokens) {
    for (const variant of searchTokenVariants(token)) {
      if (variant.length >= 2) out.add(variant);
    }
  }
  return [...out];
}

function tokenizeBaseSearchText(text) {
  return [...new Set(normalizeSearchText(text)
    .split(/[^\p{L}\p{N}@_-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2))];
}

function recordSignature(records = []) {
  let hash = 2166136261;
  for (const record of records) {
    const text = `${record.recordName}:${record.modified?.timestamp || ''}:${searchableText(record)}`;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${records.length}:${hash >>> 0}`;
}

function cachedSearchIndex(entityType, records) {
  const signature = recordSignature(records);
  const cached = searchIndexCache.get(entityType);
  if (cached?.signature === signature) return cached.index;
  const index = createSearchIndex(records);
  searchIndexCache.set(entityType, { signature, index });
  return index;
}

export async function runSearch(query) {
  const db = getLocalDatabase();
  const { records } = await db.query(query.entityType, { limit: 100000 });
  let matched = records;
  const textQuery = query.textQuery?.trim();
  if (query.filters && query.filters.length > 0) {
    matched = matched.filter((r) => query.filters.every((f) => matchesFilter(r, f)));
  }
  if (textQuery) {
    const index = cachedSearchIndex(query.entityType, records);
    const ids = querySearchIndex(index, textQuery);
    matched = matched.filter((r) => ids.has(r.recordName) || matchesText_anywhere(r, textQuery));
  }
  const limit = query.limit || 500;
  const total = matched.length;
  return { records: matched.slice(0, limit), total, hasMore: total > limit };
}

export async function runGenealogyAdvancedSearch(criteria = {}) {
  const db = getLocalDatabase();
  const all = typeof db.getAllRecords === 'function'
    ? await db.getAllRecords()
    : await loadSearchUniverse(db);
  const people = all.filter((record) => record.recordType === 'Person');
  const context = buildGenealogySearchContext(all);
  const matchMode = criteria.matchMode === 'any' ? 'any' : 'all';
  const checks = buildGenealogySearchChecks(criteria, context);
  const limit = criteria.limit || 500;
  const matched = checks.length
    ? people.filter((person) => {
      const results = checks.map((check) => check(person));
      return matchMode === 'any' ? results.some(Boolean) : results.every(Boolean);
    })
    : people;
  return { records: matched.slice(0, limit), total: matched.length, hasMore: matched.length > limit };
}

async function loadSearchUniverse(db) {
  const types = ['Person', 'Family', 'PersonEvent', 'FamilyEvent', 'PersonFact', 'Place', 'AdditionalName', 'ChildRelation'];
  const batches = await Promise.all(types.map(async (type) => {
    try {
      return (await db.query(type, { limit: 100000 })).records || [];
    } catch {
      return [];
    }
  }));
  return batches.flat();
}

function buildGenealogySearchContext(records = []) {
  const places = new Map(records.filter((record) => record.recordType === 'Place').map((record) => [record.recordName, record]));
  const personEvents = new Map();
  const familyEvents = new Map();
  const facts = new Map();
  const aliases = new Map();
  const familiesByPerson = new Map();
  const push = (map, key, value) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  for (const event of records.filter((record) => record.recordType === 'PersonEvent')) {
    push(personEvents, refToRecordName(event.fields?.person?.value), event);
  }
  for (const fact of records.filter((record) => record.recordType === 'PersonFact')) {
    push(facts, refToRecordName(fact.fields?.person?.value), fact);
  }
  for (const name of records.filter((record) => record.recordType === 'AdditionalName')) {
    push(aliases, refToRecordName(name.fields?.person?.value), name);
  }
  for (const family of records.filter((record) => record.recordType === 'Family')) {
    const man = refToRecordName(family.fields?.man?.value);
    const woman = refToRecordName(family.fields?.woman?.value);
    push(familiesByPerson, man, family);
    push(familiesByPerson, woman, family);
  }
  for (const event of records.filter((record) => record.recordType === 'FamilyEvent')) {
    push(familyEvents, refToRecordName(event.fields?.family?.value), event);
  }
  return { places, personEvents, familyEvents, facts, aliases, familiesByPerson };
}

function buildGenealogySearchChecks(criteria, context) {
  const checks = [];
  addTextCheck(checks, criteria.firstName, (person) => [person.fields?.firstName?.value, person.fields?.cached_fullName?.value], Boolean(criteria.exactFirstName));
  addTextCheck(checks, criteria.surname, (person) => [person.fields?.lastName?.value, person.fields?.cached_fullName?.value], Boolean(criteria.exactSurname));
  addTextCheck(checks, criteria.alias, (person) => (context.aliases.get(person.recordName) || []).flatMap((record) => Object.values(record.fields || {}).map((field) => field?.value)), false);
  if (criteria.gender !== '' && criteria.gender != null) {
    checks.push((person) => String(person.fields?.gender?.value ?? '') === String(criteria.gender));
  }
  addTextCheck(checks, criteria.occupation, (person) => [
    ...eventValues(context.personEvents.get(person.recordName) || [], ['Occupation', 'Employment', 'Education']),
    ...factValues(context.facts.get(person.recordName) || []),
  ], false);
  for (const eventCriteria of [
    ['birth', 'Birth', criteria.birthPlace, criteria.birthBefore, criteria.birthAfter],
    ['death', 'Death', criteria.deathPlace, criteria.deathBefore, criteria.deathAfter],
    ['baptism', 'Baptism', criteria.baptismPlace, criteria.baptismBefore, criteria.baptismAfter],
    ['burial', 'Burial', criteria.burialPlace, criteria.burialBefore, criteria.burialAfter],
  ]) {
    const [, eventType, place, before, after] = eventCriteria;
    if (hasValue(place) || hasValue(before) || hasValue(after)) {
      checks.push((person) => eventMatches(context.personEvents.get(person.recordName) || [], eventType, { place, before, after }, context));
    }
  }
  if (hasValue(criteria.marriagePlace) || hasValue(criteria.marriageBefore) || hasValue(criteria.marriageAfter)) {
    checks.push((person) => {
      const families = context.familiesByPerson.get(person.recordName) || [];
      const events = families.flatMap((family) => context.familyEvents.get(family.recordName) || []);
      return eventMatches(events, 'Marriage', {
        place: criteria.marriagePlace,
        before: criteria.marriageBefore,
        after: criteria.marriageAfter,
      }, context);
    });
  }
  return checks;
}

function addTextCheck(checks, value, valuesForPerson, exact = false) {
  if (!hasValue(value)) return;
  checks.push((person) => valuesForPerson(person).some((candidate) => (
    exact ? equalsSearchText(candidate, value) : matchesSearchText(candidate, value)
  )));
}

function eventMatches(events, eventType, criteria, context) {
  return events.some((event) => {
    if (!eventTypeMatches(event, eventType)) return false;
    if (hasValue(criteria.place) && !eventPlaceMatches(event, criteria.place, context)) return false;
    if (hasValue(criteria.before) && !dateYearMatches(event.fields?.date?.value, criteria.before, 'before')) return false;
    if (hasValue(criteria.after) && !dateYearMatches(event.fields?.date?.value, criteria.after, 'after')) return false;
    return true;
  });
}

function eventTypeMatches(event, eventType) {
  const type = readConclusionType(event) || event.fields?.eventType?.value || event.fields?.type?.value;
  return equalsSearchText(type, eventType) || matchesSearchText(type, eventType);
}

function eventPlaceMatches(event, placeText, context) {
  const placeId = refToRecordName(event.fields?.place?.value);
  const placeRecord = placeId ? context.places.get(placeId) : null;
  const values = [
    event.fields?.placeName?.value,
    placeRecord?.fields?.placeName?.value,
    placeRecord?.fields?.cached_standardizedLocationString?.value,
    placeRecord?.fields?.cached_displayName?.value,
  ];
  return values.some((value) => matchesSearchText(value, placeText));
}

function eventValues(events, eventTypes) {
  return events
    .filter((event) => eventTypes.some((type) => eventTypeMatches(event, type)))
    .flatMap((event) => [event.fields?.description?.value, event.fields?.placeName?.value, event.fields?.date?.value]);
}

function factValues(facts) {
  return facts.flatMap((fact) => Object.values(fact.fields || {}).map((field) => field?.value));
}

function dateYearMatches(rawDate, rawTarget, op) {
  const year = yearOf(rawDate);
  const target = yearOf(rawTarget);
  if (year == null || target == null) return false;
  return op === 'before' ? year < target : year > target;
}

function yearOf(value) {
  const match = String(value || '').match(/-?\d{3,4}/);
  return match ? Number(match[0]) : null;
}

function hasValue(value) {
  return value != null && String(value).trim() !== '';
}
