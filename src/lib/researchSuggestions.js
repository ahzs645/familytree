/**
 * Heuristic next-step research questions per person.
 * Generated from data gaps; intentionally not exhaustive.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { personSummary } from '../models/index.js';

export async function generateResearchSuggestions() {
  const db = getLocalDatabase();
  const persons = (await db.query('Person', { limit: 100000 })).records;
  const families = (await db.query('Family', { limit: 100000 })).records;
  const childRels = (await db.query('ChildRelation', { limit: 100000 })).records;

  const childrenByParent = new Set();
  for (const fam of families) {
    if (fam.fields?.man?.value) childrenByParent.add(refToRecordName(fam.fields.man.value));
    if (fam.fields?.woman?.value) childrenByParent.add(refToRecordName(fam.fields.woman.value));
  }
  const hasParents = new Set();
  for (const cr of childRels) {
    const c = refToRecordName(cr.fields?.child?.value);
    if (c) hasParents.add(c);
  }

  const out = [];
  for (const p of persons) {
    const sum = personSummary(p);
    if (!sum) continue;
    const f = p.fields || {};
    const suggestions = [];
    if (!f.cached_birthDate?.value) suggestions.push('Find a birth record');
    if (!f.cached_deathDate?.value && f.cached_birthDate?.value) {
      const y = parseInt(String(f.cached_birthDate.value).match(/(\d{4})/)?.[1] || '0', 10);
      if (y && new Date().getFullYear() - y > 110) suggestions.push('Probable death — find death record');
    }
    if (!hasParents.has(p.recordName)) suggestions.push('Identify parents');
    if (!childrenByParent.has(p.recordName)) suggestions.push('Identify spouses / children');
    if (!f.thumbnailFileIdentifier?.value) suggestions.push('Add a portrait photo');
    if (!f.cached_fullName?.value) suggestions.push('Confirm full name');

    if (suggestions.length > 0) {
      out.push({
        recordName: p.recordName,
        fullName: sum.fullName,
        suggestions,
        score: suggestions.length,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
