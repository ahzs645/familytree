/**
 * Build a "context" bundle for a single person — the data needed to render
 * their interactive-tree focus view: parents, partners, children, events.
 * Summaries go through models/wrap.js so Gender enum values and name formatting
 * stay consistent with the rest of the app.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { personSummary, familySummary } from '../models/index.js';

export async function buildPersonContext(recordName) {
  const db = getLocalDatabase();
  const self = await db.getRecord(recordName);
  if (!self) return null;

  const [parents, families, personEvents, personFacts] = await Promise.all([
    db.getPersonsParents(recordName),
    db.getPersonsChildrenInformation(recordName),
    db.query('PersonEvent', { referenceField: 'person', referenceValue: recordName, limit: 1000 }),
    db.query('PersonFact', { referenceField: 'person', referenceValue: recordName, limit: 1000 }),
  ]);

  return {
    self,
    selfSummary: personSummary(self),
    parents: parents.map((fam) => ({
      family: fam.family,
      familySummary: familySummary(fam.family),
      man: personSummary(fam.man),
      woman: personSummary(fam.woman),
    })),
    families: families.map((fam) => ({
      family: fam.family,
      familySummary: familySummary(fam.family),
      partner: personSummary(fam.partner),
      children: fam.children.map(personSummary),
    })),
    events: personEvents.records || [],
    facts: personFacts.records || [],
  };
}

/**
 * All siblings (children of any parent family, excluding self).
 */
export async function getSiblings(recordName) {
  const db = getLocalDatabase();
  const parents = await db.getPersonsParents(recordName);
  const siblings = [];
  const seen = new Set([recordName]);
  for (const fam of parents) {
    const { records } = await db.query('ChildRelation', {
      referenceField: 'family',
      referenceValue: fam.family.recordName,
    });
    for (const cr of records) {
      const childRef = cr.fields?.child?.value?.recordName;
      if (!childRef || seen.has(childRef)) continue;
      seen.add(childRef);
      const child = await db.getRecord(childRef);
      if (child) siblings.push(personSummary(child));
    }
  }
  return siblings;
}
