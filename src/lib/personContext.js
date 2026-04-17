/**
 * Build a "context" bundle for a single person — the data needed to render
 * their interactive-tree focus view: parents, partners, children, events.
 */
import { getLocalDatabase } from './LocalDatabase.js';

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
    parents, // [{ family, man, woman }]
    families, // [{ family, partner, children }]
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
      if (child) siblings.push(child);
    }
  }
  return siblings;
}
