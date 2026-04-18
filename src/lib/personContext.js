/**
 * Build a "context" bundle for a single person — the data needed to render
 * their interactive-tree focus view: parents, partners, children, events.
 * Summaries go through models/wrap.js so Gender enum values and name formatting
 * stay consistent with the rest of the app.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { isPublicRecord } from './privacy.js';
import { personSummary, familySummary } from '../models/index.js';

export async function buildPersonContext(recordName) {
  const db = getLocalDatabase();
  const self = await db.getRecord(recordName);
  if (!isPublicRecord(self)) return null;

  const [parents, families, personEvents, personFacts] = await Promise.all([
    db.getPersonsParents(recordName),
    db.getPersonsChildrenInformation(recordName),
    db.query('PersonEvent', { referenceField: 'person', referenceValue: recordName, limit: 1000 }),
    db.query('PersonFact', { referenceField: 'person', referenceValue: recordName, limit: 1000 }),
  ]);

  return {
    self,
    selfSummary: personSummary(self),
    parents: parents.filter((fam) => isPublicRecord(fam.family)).map((fam) => ({
      family: fam.family,
      familySummary: familySummary(fam.family),
      man: isPublicRecord(fam.man) ? personSummary(fam.man) : null,
      woman: isPublicRecord(fam.woman) ? personSummary(fam.woman) : null,
    })),
    families: families.filter((fam) => isPublicRecord(fam.family)).map((fam) => ({
      family: fam.family,
      familySummary: familySummary(fam.family),
      partner: isPublicRecord(fam.partner) ? personSummary(fam.partner) : null,
      children: fam.children.filter(isPublicRecord).map(personSummary),
    })),
    events: (personEvents.records || []).filter(isPublicRecord),
    facts: (personFacts.records || []).filter(isPublicRecord),
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
    if (!isPublicRecord(fam.family)) continue;
    const { records } = await db.query('ChildRelation', {
      referenceField: 'family',
      referenceValue: fam.family.recordName,
    });
    for (const cr of records) {
      const childRef = refToRecordName(cr.fields?.child?.value);
      if (!childRef || seen.has(childRef)) continue;
      seen.add(childRef);
      const child = await db.getRecord(childRef);
      if (isPublicRecord(child)) siblings.push(personSummary(child));
    }
  }
  return siblings;
}
