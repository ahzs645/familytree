/**
 * Read-only audits + targeted cleanup operations for the imported database.
 * Each function returns a report describing what was/would be changed.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { saveWithChangeLog, logRecordDeleted } from './changeLog.js';
import { refToRecordName } from './recordRef.js';
import { Gender } from '../models/index.js';
import { makeValidationIssue, compareIssues } from './validationIssues.js';
import { findTextHygieneIssues } from './textHygiene.js';

function parseAnyDate(s) {
  if (!s) return null;
  const trimmed = String(s).trim();
  // YYYY, YYYY-MM, YYYY-MM-DD
  let m = trimmed.match(/^(\d{4})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?$/);
  if (m) return { y: +m[1], m: +(m[2] || 0) || null, d: +(m[3] || 0) || null };
  // DD/MM/YYYY or MM/DD/YYYY
  m = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3];
    if (a > 12) return { y, m: b, d: a }; // unambiguous DD/MM/YYYY
    return { y, m: a, d: b }; // assume MM/DD/YYYY
  }
  // Month name
  m = trimmed.match(/(\d{1,2})?\s*([A-Za-z]+)\s*(\d{4})/);
  if (m) {
    const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const idx = monthNames.indexOf(m[2].slice(0, 3).toLowerCase());
    if (idx >= 0) return { y: +m[3], m: idx + 1, d: m[1] ? +m[1] : null };
  }
  return null;
}
function formatDate(p, format) {
  if (!p) return '';
  switch (format) {
    case 'YYYY-MM-DD':
      return [p.y, p.m, p.d].filter((x) => x != null).map((x, i) => i === 0 ? String(x) : String(x).padStart(2, '0')).join('-');
    case 'DD MM YYYY':
      return [p.d, p.m, p.y].filter((x) => x != null).map((x, i) => i === 2 ? String(x) : String(x).padStart(2, '0')).join(' ');
    case 'MM/DD/YYYY':
      return [p.m, p.d, p.y].filter((x) => x != null).map((x, i) => i === 2 ? String(x) : String(x).padStart(2, '0')).join('/');
    default:
      return [p.y, p.m, p.d].filter((x) => x != null).join('-');
  }
}

export async function auditUnreadableDates() {
  const db = getLocalDatabase();
  const out = [];
  for (const type of ['PersonEvent', 'FamilyEvent']) {
    const { records } = await db.query(type, { limit: 100000 });
    for (const r of records) {
      const v = r.fields?.date?.value;
      if (v && !parseAnyDate(v)) out.push({ recordType: type, recordName: r.recordName, value: v });
    }
  }
  return out;
}

export async function reformatAllDates(format = 'YYYY-MM-DD', { dryRun = true } = {}) {
  const db = getLocalDatabase();
  const changes = [];
  for (const type of ['PersonEvent', 'FamilyEvent']) {
    const { records } = await db.query(type, { limit: 100000 });
    for (const r of records) {
      const v = r.fields?.date?.value;
      if (!v) continue;
      const parsed = parseAnyDate(v);
      if (!parsed) continue;
      const formatted = formatDate(parsed, format);
      if (formatted && formatted !== v) {
        changes.push({ recordType: type, recordName: r.recordName, before: v, after: formatted });
        if (!dryRun) {
          await saveWithChangeLog({ ...r, fields: { ...r.fields, date: { value: formatted, type: 'STRING' } } });
        }
      }
    }
  }
  return changes;
}

export async function auditEmptyEntries() {
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  const families = (await db.query('Family', { limit: 100000 })).records;
  const out = [];
  for (const p of persons) {
    const f = p.fields || {};
    const hasContent = f.firstName?.value || f.lastName?.value || f.cached_fullName?.value || f.nameMiddle?.value;
    if (!hasContent) out.push({ recordType: 'Person', recordName: p.recordName });
  }
  for (const fam of families) {
    if (!fam.fields?.man?.value && !fam.fields?.woman?.value) {
      out.push({ recordType: 'Family', recordName: fam.recordName });
    }
  }
  return out;
}

export async function removeEmptyEntries({ dryRun = true } = {}) {
  const db = getLocalDatabase();
  const empties = await auditEmptyEntries();
  if (!dryRun) {
    for (const e of empties) {
      await db.deleteRecord(e.recordName);
      await logRecordDeleted(e.recordName, e.recordType);
    }
  }
  return empties;
}

export async function auditFamilyGenderMismatch() {
  const db = getLocalDatabase();
  const persons = new Map((await db.query('Person', { limit: 100000 })).records.map((p) => [p.recordName, p]));
  const out = [];
  const { records: families } = await db.query('Family', { limit: 100000 });
  for (const fam of families) {
    const manRef = fam.fields?.man?.value;
    const womanRef = fam.fields?.woman?.value;
    const manId = typeof manRef === 'string' ? manRef.split('---')[0] : manRef?.recordName;
    const womanId = typeof womanRef === 'string' ? womanRef.split('---')[0] : womanRef?.recordName;
    const man = persons.get(manId);
    const woman = persons.get(womanId);
    if (man && man.fields?.gender?.value === Gender.Female) {
      out.push({ familyRecordName: fam.recordName, issue: 'Man slot has a female-gendered person', personRecordName: man.recordName });
    }
    if (woman && woman.fields?.gender?.value === Gender.Male) {
      out.push({ familyRecordName: fam.recordName, issue: 'Woman slot has a male-gendered person', personRecordName: woman.recordName });
    }
  }
  return out;
}

export function reformatName(name, mode) {
  if (!name) return name;
  switch (mode) {
    case 'TITLE': return name.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    case 'UPPER': return name.toUpperCase();
    case 'LOWER': return name.toLowerCase();
    case 'TRIM': return name.replace(/\s+/g, ' ').trim();
    default: return name;
  }
}

export async function reformatNames({ field = 'lastName', mode = 'TITLE', dryRun = true } = {}) {
  const db = getLocalDatabase();
  const { records } = await db.query('Person', { limit: 100000 });
  const changes = [];
  for (const p of records) {
    const v = p.fields?.[field]?.value;
    if (!v) continue;
    const next = reformatName(v, mode);
    if (next !== v) {
      changes.push({ recordName: p.recordName, before: v, after: next });
      if (!dryRun) {
        const updated = { ...p, fields: { ...p.fields, [field]: { value: next, type: 'STRING' } } };
        if (field === 'firstName' || field === 'lastName') {
          const fn = updated.fields.firstName?.value || '';
          const ln = updated.fields.lastName?.value || '';
          updated.fields.cached_fullName = { value: `${fn} ${ln}`.trim(), type: 'STRING' };
        }
        await saveWithChangeLog(updated);
      }
    }
  }
  return changes;
}

export async function mediaSizeReport() {
  const db = getLocalDatabase();
  let total = 0;
  let count = 0;
  for (const t of ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo']) {
    const { records } = await db.query(t, { limit: 100000 });
    for (const r of records) {
      count++;
      const v = r.fields?.fileSize?.value;
      if (typeof v === 'number') total += v;
    }
  }
  return { count, totalBytes: total };
}

export function findAncestryLoops(records = []) {
  const families = records.filter((record) => record.recordType === 'Family');
  const childRelations = records.filter((record) => record.recordType === 'ChildRelation');
  const childrenByParent = new Map();

  const addEdge = (parentId, childId, familyId) => {
    if (!parentId || !childId) return;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push({ childId, familyId });
  };

  const familyById = new Map(families.map((family) => [family.recordName, family]));
  for (const relation of childRelations) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    const childId = refToRecordName(relation.fields?.child?.value);
    const family = familyById.get(familyId);
    addEdge(refToRecordName(family?.fields?.man?.value), childId, familyId);
    addEdge(refToRecordName(family?.fields?.woman?.value), childId, familyId);
  }

  const loops = [];
  const visiting = new Set();
  const visited = new Set();

  const walk = (personId, path = []) => {
    if (visiting.has(personId)) {
      const start = path.findIndex((step) => step.personId === personId);
      loops.push({ personId, path: path.slice(Math.max(0, start)).map((step) => step.personId).concat(personId) });
      return;
    }
    if (visited.has(personId)) return;
    visiting.add(personId);
    for (const edge of childrenByParent.get(personId) || []) {
      walk(edge.childId, [...path, { personId, familyId: edge.familyId }]);
    }
    visiting.delete(personId);
    visited.add(personId);
  };

  for (const personId of childrenByParent.keys()) walk(personId);
  return dedupeLoops(loops);
}

export function findUnusedRecords(records = [], { keepTypes = ['Person'], ignoreTypes = ['ChangeLogEntry'] } = {}) {
  const byId = new Map(records.map((record) => [record.recordName, record]));
  const referenced = new Set();
  for (const record of records) {
    for (const field of Object.values(record.fields || {})) {
      collectFieldRefs(field, referenced);
    }
  }
  return records.filter((record) => (
    !keepTypes.includes(record.recordType) &&
    !ignoreTypes.includes(record.recordType) &&
    !isConnectedRelationRecord(record) &&
    !referenced.has(record.recordName) &&
    byId.has(record.recordName)
  ));
}

export function sortEventRecords(records = []) {
  return [...records].sort((a, b) => {
    const dateDiff = eventDateSortKey(a) - eventDateSortKey(b);
    if (dateDiff) return dateDiff;
    const orderDiff = Number(a.fields?.order?.value ?? 0) - Number(b.fields?.order?.value ?? 0);
    if (orderDiff) return orderDiff;
    return String(a.recordName).localeCompare(String(b.recordName));
  });
}

export function findMaintenanceIssues(records = []) {
  const issues = [
    ...findBrokenParentRelationships(records),
    ...findDuplicateSpouseLinks(records),
    ...findEmptySourceAndCitationRecords(records),
    ...findEventOrderIssues(records),
    ...findInvalidVitalEventLinks(records),
    ...findVitalCacheSyncIssues(records),
    ...findMissingChildFamilyLinks(records),
    ...findTextHygieneIssues(records),
  ];
  return issues.sort(compareIssues);
}

export { findTextHygieneIssues };

export function findBrokenParentRelationships(records = []) {
  const byId = new Map(records.map((record) => [record.recordName, record]));
  const issues = [];
  for (const relation of records.filter((record) => record.recordType === 'ChildRelation')) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    const childId = refToRecordName(relation.fields?.child?.value);
    const family = byId.get(familyId);
    const child = byId.get(childId);
    if (!familyId || !family || family.recordType !== 'Family') {
      issues.push(maintenanceIssue('broken-parent-relationship', 'error', relation, `Child relation ${relation.recordName} points to a missing family.`, [familyId]));
    }
    if (!childId || !child || child.recordType !== 'Person') {
      issues.push(maintenanceIssue('broken-parent-relationship', 'error', relation, `Child relation ${relation.recordName} points to a missing child.`, [childId]));
    }
    if (family && !refToRecordName(family.fields?.man?.value) && !refToRecordName(family.fields?.woman?.value)) {
      issues.push(maintenanceIssue('family-without-parents', 'warning', family, `Family ${family.recordName} has child links but no parents.`));
    }
  }
  return issues;
}

export function findDuplicateSpouseLinks(records = []) {
  const pairs = new Map();
  const issues = [];
  for (const family of records.filter((record) => record.recordType === 'Family')) {
    const man = refToRecordName(family.fields?.man?.value) || '';
    const woman = refToRecordName(family.fields?.woman?.value) || '';
    if (!man && !woman) continue;
    const key = [man, woman].sort().join('|');
    const previous = pairs.get(key);
    if (previous) {
      issues.push(maintenanceIssue('duplicate-spouse-link', 'warning', family, `Family ${family.recordName} duplicates spouse pairing from ${previous.recordName}.`, [previous.recordName]));
    } else {
      pairs.set(key, family);
    }
  }
  return issues;
}

export function findEmptySourceAndCitationRecords(records = []) {
  return records
    .filter((record) => ['Source', 'Citation', 'SourceRelation'].includes(record.recordType))
    .filter((record) => isEffectivelyEmpty(record))
    .map((record) => maintenanceIssue('empty-source-citation-record', 'warning', record, `${record.recordType} ${record.recordName} has no meaningful fields.`));
}

export function findEventOrderIssues(records = []) {
  const out = [];
  const eventsByOwner = new Map();
  for (const event of records.filter((record) => record.recordType === 'PersonEvent' || record.recordType === 'FamilyEvent')) {
    const owner = refToRecordName(event.fields?.person?.value) || refToRecordName(event.fields?.family?.value);
    if (!owner) continue;
    if (!eventsByOwner.has(owner)) eventsByOwner.set(owner, []);
    eventsByOwner.get(owner).push(event);
  }
  for (const [owner, events] of eventsByOwner.entries()) {
    const ordered = [...events].sort((a, b) => Number(a.fields?.order?.value ?? 0) - Number(b.fields?.order?.value ?? 0));
    let previousKey = -Infinity;
    for (const event of ordered) {
      const key = eventDateSortKey(event);
      if (!Number.isFinite(key)) continue;
      if (key < previousKey) {
        out.push(maintenanceIssue('events-out-of-order', 'warning', event, `Events for ${owner} are not in chronological order.`));
        break;
      }
      previousKey = key;
    }
  }
  return out;
}

export function findInvalidVitalEventLinks(records = []) {
  const out = [];
  for (const person of records.filter((record) => record.recordType === 'Person')) {
    const birthId = refToRecordName(person.fields?.birthEvent?.value);
    const deathId = refToRecordName(person.fields?.deathEvent?.value);
    if (birthId) {
      const event = records.find((record) => record.recordName === birthId);
      if (!event || event.recordType !== 'PersonEvent' || !['Birth', 'Stillbirth'].includes(event.fields?.conclusionType?.value)) {
        out.push(maintenanceIssue('invalid-birth-event-link', 'warning', person, `${person.recordName} has a birth event link that is missing or not a birth event.`, [birthId]));
      }
    }
    if (deathId) {
      const event = records.find((record) => record.recordName === deathId);
      if (!event || event.recordType !== 'PersonEvent' || event.fields?.conclusionType?.value !== 'Death') {
        out.push(maintenanceIssue('invalid-death-event-link', 'warning', person, `${person.recordName} has a death event link that is missing or not a death event.`, [deathId]));
      }
    }
  }
  return out;
}

export function findVitalCacheSyncIssues(records = []) {
  const out = [];
  const eventsByPerson = new Map();
  for (const event of records.filter((record) => record.recordType === 'PersonEvent')) {
    const personId = refToRecordName(event.fields?.person?.value);
    if (!personId) continue;
    if (!eventsByPerson.has(personId)) eventsByPerson.set(personId, []);
    eventsByPerson.get(personId).push(event);
  }
  for (const person of records.filter((record) => record.recordType === 'Person')) {
    const events = eventsByPerson.get(person.recordName) || [];
    const birth = firstEventByType(events, ['Birth', 'Stillbirth']);
    const death = firstEventByType(events, ['Death']);
    const birthDate = birth?.fields?.date?.value || '';
    const deathDate = death?.fields?.date?.value || '';
    const cachedBirth = person.fields?.cached_birthDate?.value || '';
    const cachedDeath = person.fields?.cached_deathDate?.value || '';
    if (birthDate && cachedBirth && normalizeDateText(birthDate) !== normalizeDateText(cachedBirth)) {
      out.push(maintenanceIssue('vital-cache-birth-mismatch', 'warning', person, `${person.recordName} cached birth date differs from its birth event.`, [birth.recordName]));
    }
    if (deathDate && cachedDeath && normalizeDateText(deathDate) !== normalizeDateText(cachedDeath)) {
      out.push(maintenanceIssue('vital-cache-death-mismatch', 'warning', person, `${person.recordName} cached death date differs from its death event.`, [death.recordName]));
    }
    if (birthDate && !cachedBirth) {
      out.push(maintenanceIssue('vital-cache-missing-birth', 'info', person, `${person.recordName} has a birth event date but no cached birth date.`, [birth.recordName]));
    }
    if (deathDate && !cachedDeath) {
      out.push(maintenanceIssue('vital-cache-missing-death', 'info', person, `${person.recordName} has a death event date but no cached death date.`, [death.recordName]));
    }
  }
  return out;
}

export function findMissingChildFamilyLinks(records = []) {
  const byId = new Map(records.map((record) => [record.recordName, record]));
  const childRelationKeys = new Set();
  const childRelationFamilies = new Set();
  const out = [];
  for (const relation of records.filter((record) => record.recordType === 'ChildRelation')) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    const childId = refToRecordName(relation.fields?.child?.value);
    if (familyId && childId) childRelationKeys.add(`${familyId}|${childId}`);
    if (familyId) childRelationFamilies.add(familyId);
  }
  for (const family of records.filter((record) => record.recordType === 'Family')) {
    const children = collectFamilyChildRefs(family);
    for (const childId of children) {
      const child = byId.get(childId);
      if (!child || child.recordType !== 'Person') {
        out.push(maintenanceIssue('family-missing-child-person', 'error', family, `${family.recordName} references a missing child.`, [childId]));
      } else if (!childRelationKeys.has(`${family.recordName}|${childId}`)) {
        out.push(maintenanceIssue('missing-child-relation', 'warning', family, `${family.recordName} references child ${childId} without a ChildRelation record.`, [childId]));
      }
    }
    if (!children.length && !childRelationFamilies.has(family.recordName) && !refToRecordName(family.fields?.man?.value) && !refToRecordName(family.fields?.woman?.value)) {
      out.push(maintenanceIssue('empty-family-linkage', 'warning', family, `${family.recordName} has no spouses or children.`));
    }
  }
  return out;
}

export async function auditAncestryLoops() {
  const db = getLocalDatabase();
  return findAncestryLoops(await db.getAllRecords());
}

export async function auditMaintenanceIssues() {
  const db = getLocalDatabase();
  return findMaintenanceIssues(await db.getAllRecords());
}

export async function auditUnusedRecords(options) {
  const db = getLocalDatabase();
  return findUnusedRecords(await db.getAllRecords(), options);
}

function eventDateSortKey(record) {
  const parsed = parseAnyDate(record?.fields?.date?.value || record?.fields?.cached_birthDate?.value || '');
  if (!parsed) return Number.POSITIVE_INFINITY;
  return (parsed.y * 10000) + ((parsed.m || 0) * 100) + (parsed.d || 0);
}

function firstEventByType(events, types) {
  return sortEventRecords(events.filter((event) => types.includes(event.fields?.conclusionType?.value)))[0] || null;
}

function normalizeDateText(value) {
  const parsed = parseAnyDate(value);
  if (parsed) return `${parsed.y}-${parsed.m || 0}-${parsed.d || 0}`;
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function collectFamilyChildRefs(family) {
  const raw = family?.fields?.children?.value || family?.fields?.childRefs?.value || family?.fields?.childReferences?.value || [];
  const values = Array.isArray(raw) ? raw : [raw];
  return values.map((value) => refToRecordName(value)).filter(Boolean);
}

function maintenanceIssue(code, severity, record, message, refs = []) {
  return makeValidationIssue({
    scope: 'maintenance',
    code,
    severity,
    recordName: record?.recordName || null,
    recordType: record?.recordType || null,
    refs,
    message,
  });
}

function isEffectivelyEmpty(record) {
  const fields = record?.fields || {};
  const entries = Object.entries(fields).filter(([key]) => !['gedcomXref', 'gedcomExtensions'].includes(key));
  if (entries.length === 0) return true;
  return entries.every(([, field]) => {
    const value = Object.prototype.hasOwnProperty.call(field || {}, 'value') ? field.value : field;
    if (value == null) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  });
}

function collectFieldRefs(field, out) {
  if (!field) return;
  const value = Object.prototype.hasOwnProperty.call(field, 'value') ? field.value : field;
  if (typeof value === 'string') {
    const ref = refToRecordName(value);
    if (ref && value.includes('---')) out.add(ref);
  } else if (Array.isArray(value)) {
    for (const item of value) collectFieldRefs(item, out);
  } else if (value && typeof value === 'object') {
    const ref = refToRecordName(value);
    if (ref) out.add(ref);
    for (const item of Object.values(value)) collectFieldRefs(item, out);
  }
}

function isConnectedRelationRecord(record) {
  if (!/Relation$/.test(record?.recordType || '')) return false;
  const refs = new Set();
  for (const field of Object.values(record.fields || {})) collectFieldRefs(field, refs);
  return refs.size > 0;
}

function dedupeLoops(loops) {
  const seen = new Set();
  const out = [];
  for (const loop of loops) {
    const key = [...new Set(loop.path)].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(loop);
  }
  return out;
}
