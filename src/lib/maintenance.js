/**
 * Read-only audits + targeted cleanup operations for the imported database.
 * Each function returns a report describing what was/would be changed.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { saveWithChangeLog, logRecordDeleted } from './changeLog.js';
import { Gender } from '../models/index.js';

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
