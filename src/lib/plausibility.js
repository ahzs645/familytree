/**
 * Rule-based data quality checks. Each rule yields warnings of shape
 * { rule, severity, recordName, recordType, message }.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { personSummary } from '../models/index.js';

function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2] || '1', 10) - 1, parseInt(m[3] || '1', 10));
}
function yearOf(s) {
  const m = String(s || '').match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

export const PLAUSIBILITY_ANALYZERS = Object.freeze([
  { id: 'death-before-birth', label: 'Death before birth', defaultEnabled: true },
  { id: 'lifespan-over-120', label: 'Lifespan over N years', defaultEnabled: true, threshold: 'maxLifespan' },
  { id: 'birth-year-suspicious', label: 'Birth year before 1000', defaultEnabled: true },
  { id: 'marriage-too-young', label: 'Marriage under age N', defaultEnabled: true, threshold: 'minMarriageAge' },
  { id: 'parent-too-young', label: 'Parent under age N', defaultEnabled: true, threshold: 'minParentAge' },
  { id: 'parent-too-old', label: 'Parent over age N', defaultEnabled: true, threshold: 'maxParentAge' },
  { id: 'child-after-parent-death', label: 'Child born after parent death', defaultEnabled: true },
]);

export const DEFAULT_PLAUSIBILITY_CONFIG = Object.freeze({
  enabled: {
    'death-before-birth': true,
    'lifespan-over-120': true,
    'birth-year-suspicious': true,
    'marriage-too-young': true,
    'parent-too-young': true,
    'parent-too-old': true,
    'child-after-parent-death': true,
  },
  thresholds: {
    maxLifespan: 120,
    minMarriageAge: 12,
    minParentAge: 12,
    maxParentAge: 70,
  },
});

function resolveConfig(config) {
  const base = DEFAULT_PLAUSIBILITY_CONFIG;
  return {
    enabled: { ...base.enabled, ...(config?.enabled || {}) },
    thresholds: { ...base.thresholds, ...(config?.thresholds || {}) },
  };
}

export async function runPlausibilityChecks(config) {
  const { enabled, thresholds } = resolveConfig(config);
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  const families = (await db.query('Family', { limit: 100000 })).records;
  const childRels = (await db.query('ChildRelation', { limit: 100000 })).records;

  const personById = new Map(persons.map((p) => [p.recordName, p]));
  const warnings = [];

  for (const p of persons) {
    const f = p.fields || {};
    const sum = personSummary(p);
    const by = yearOf(f.cached_birthDate?.value);
    const dy = yearOf(f.cached_deathDate?.value);
    if (enabled['death-before-birth'] && by && dy && dy < by) {
      warnings.push(rule('death-before-birth', 'high', p, `${sum.fullName}: died (${dy}) before born (${by})`));
    }
    if (enabled['lifespan-over-120'] && by && dy && dy - by > thresholds.maxLifespan) {
      warnings.push(rule('lifespan-over-120', 'medium', p, `${sum.fullName}: lifespan ${dy - by} years`));
    }
    if (enabled['birth-year-suspicious'] && by && by < 1000) {
      warnings.push(rule('birth-year-suspicious', 'low', p, `${sum.fullName}: birth year ${by} is suspiciously early`));
    }
  }

  for (const fam of families) {
    const manId = refToRecordName(fam.fields?.man?.value);
    const womanId = refToRecordName(fam.fields?.woman?.value);
    const man = personById.get(manId);
    const woman = personById.get(womanId);
    const my = yearOf(fam.fields?.cached_marriageDate?.value);

    if (my && enabled['marriage-too-young']) {
      for (const p of [man, woman]) {
        if (!p) continue;
        const by = yearOf(p.fields?.cached_birthDate?.value);
        if (by && my - by < thresholds.minMarriageAge) {
          warnings.push(rule('marriage-too-young', 'high', p, `${personSummary(p).fullName}: married at age ${my - by}`));
        }
      }
    }

    const rels = childRels.filter((r) => refToRecordName(r.fields?.family?.value) === fam.recordName);
    for (const rel of rels) {
      const childId = refToRecordName(rel.fields?.child?.value);
      const child = personById.get(childId);
      if (!child) continue;
      const cby = yearOf(child.fields?.cached_birthDate?.value);
      if (!cby) continue;
      for (const parent of [man, woman]) {
        if (!parent) continue;
        const pby = yearOf(parent.fields?.cached_birthDate?.value);
        const pdy = yearOf(parent.fields?.cached_deathDate?.value);
        if (enabled['parent-too-young'] && pby && cby - pby < thresholds.minParentAge) {
          warnings.push(rule('parent-too-young', 'high', parent, `${personSummary(parent).fullName}: had child at age ${cby - pby}`));
        }
        if (enabled['parent-too-old'] && pby && cby - pby > thresholds.maxParentAge) {
          warnings.push(rule('parent-too-old', 'medium', parent, `${personSummary(parent).fullName}: had child at age ${cby - pby}`));
        }
        if (enabled['child-after-parent-death'] && pdy && cby > pdy + 1) {
          warnings.push(rule('child-after-parent-death', 'high', parent, `${personSummary(parent).fullName}: child born ${cby - pdy} years after death`));
        }
      }
    }
  }

  return warnings.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));
}

function rule(id, severity, record, message) {
  return { rule: id, severity, recordName: record.recordName, recordType: record.recordType, message };
}
function severityOrder(s) { return { high: 3, medium: 2, low: 1 }[s] || 0; }
