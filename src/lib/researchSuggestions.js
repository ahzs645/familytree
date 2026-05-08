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
    // Each suggestion is a stable key (used as identity in dismissal state) +
    // an `i18nKey` that consumers can pass to t() for display. Old code paths
    // that read `suggestions` as strings still work because we attach
    // toString() returning the key, but new render code should use t(i18nKey).
    const suggestions = [];
    const push = (key) => suggestions.push({ key, i18nKey: `researchSuggestions.${key}` });
    if (!f.cached_birthDate?.value) push('findBirthRecord');
    if (!f.cached_deathDate?.value && f.cached_birthDate?.value) {
      const y = parseInt(String(f.cached_birthDate.value).match(/(\d{4})/)?.[1] || '0', 10);
      if (y && new Date().getFullYear() - y > 110) push('findDeathRecord');
    }
    if (!hasParents.has(p.recordName)) push('identifyParents');
    if (!childrenByParent.has(p.recordName)) push('identifySpousesChildren');
    if (!f.thumbnailFileIdentifier?.value) push('addPortraitPhoto');
    if (!f.cached_fullName?.value) push('confirmFullName');

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
