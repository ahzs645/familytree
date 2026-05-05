/**
 * Build a "context" bundle for a single person — the data needed to render
 * their interactive-tree focus view: parents, partners, children, events.
 * Summaries go through models/wrap.js so Gender enum values and name formatting
 * stay consistent with the rest of the app.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { isPublicRecord } from './privacy.js';
import { personSummary, familySummary, Gender } from '../models/index.js';
import { MILK_KINSHIP_RECORD_TYPE, milkKinshipSummary } from './milkKinship.js';

export async function buildPersonContext(recordName) {
  const db = getLocalDatabase();
  const self = await db.getRecord(recordName);
  if (!isPublicRecord(self)) return null;

  const [parents, families, personEvents, personFacts, milkAsChild, milkAsMother, milkAsFather, persons] = await Promise.all([
    db.getPersonsParents(recordName),
    db.getPersonsChildrenInformation(recordName),
    db.query('PersonEvent', { referenceField: 'person', referenceValue: recordName, limit: 1000 }),
    db.query('PersonFact', { referenceField: 'person', referenceValue: recordName, limit: 1000 }),
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'child', referenceValue: recordName, limit: 1000 }),
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'nursingMother', referenceValue: recordName, limit: 1000 }),
    db.query(MILK_KINSHIP_RECORD_TYPE, { referenceField: 'milkFather', referenceValue: recordName, limit: 1000 }),
    db.query('Person', { limit: 100000 }),
  ]);
  const personById = new Map(persons.records.map((person) => [person.recordName, personSummary(person)]));
  const milkById = new Map();
  for (const row of [...milkAsChild.records, ...milkAsMother.records, ...milkAsFather.records]) milkById.set(row.recordName, row);

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
    milkKinships: [...milkById.values()].map((record) => milkKinshipSummary(record, personById)),
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

/**
 * Person-centric family tree model ported from Gedcom-main's
 * RenderPersonFamilyTreeAsJsonHandler:
 * subject, parents, siblings (with self injected), spouses, and children.
 */
export async function buildFamilyTreeViewModel(recordName) {
  const db = getLocalDatabase();
  const subject = await db.getRecord(recordName);
  if (!isPublicRecord(subject)) return null;

  const [parentFamilies, spouseFamilies] = await Promise.all([
    db.getPersonsParents(recordName),
    db.getPersonsChildrenInformation(recordName),
  ]);

  const parentById = new Map();
  const parentGroups = [];
  const siblingById = new Map([[recordName, selfModel(subject)]]);
  const siblingParentGroups = new Map();

  for (const familyInfo of parentFamilies.filter((info) => isPublicRecord(info.family))) {
    const parentRecords = [familyInfo.man, familyInfo.woman].filter(isPublicRecord);
    const parentIds = parentRecords.map((person) => person.recordName).sort();
    if (parentIds.length) parentGroups.push(parentIds);
    for (const parent of parentRecords) {
      parentById.set(parent.recordName, personRelationModel(parent, parentRelation(parent)));
    }

    const { records: childRels } = await db.query('ChildRelation', {
      referenceField: 'family',
      referenceValue: familyInfo.family.recordName,
      limit: 100000,
    });
    for (const relation of childRels) {
      const childId = refToRecordName(relation.fields?.child?.value);
      if (!childId) continue;
      if (!siblingParentGroups.has(childId)) siblingParentGroups.set(childId, []);
      if (parentIds.length) siblingParentGroups.get(childId).push(parentIds);
      if (siblingById.has(childId)) continue;
      const child = await db.getRecord(childId);
      if (isPublicRecord(child)) siblingById.set(childId, personRelationModel(child, siblingRelation(child)));
    }
  }

  const spouses = [];
  const childById = new Map();
  for (const familyInfo of spouseFamilies.filter((info) => isPublicRecord(info.family))) {
    if (isPublicRecord(familyInfo.partner)) {
      spouses.push({
        ...personRelationModel(familyInfo.partner, spouseRelation(familyInfo.partner)),
        dateOfMarriage: familySummary(familyInfo.family)?.marriageDate || '',
        dateOfDivorce: await findFamilyDivorceDate(familyInfo.family.recordName),
        familyRecordName: familyInfo.family.recordName,
      });
    }
    const parentIds = [subject, familyInfo.partner].filter(isPublicRecord).map((person) => person.recordName).sort();
    for (const child of familyInfo.children.filter(isPublicRecord)) {
      childById.set(child.recordName, {
        ...personRelationModel(child, childRelation(child)),
        parentIds,
        familyRecordName: familyInfo.family.recordName,
      });
    }
  }

  const siblings = [...siblingById.values()].map((sibling) => ({
    ...sibling,
    parentGroupIds: sibling.recordName === recordName
      ? parentGroups
      : siblingParentGroups.get(sibling.recordName) || [],
  }));

  return {
    subject: basePersonModel(subject),
    parents: sortPeople([...parentById.values()]),
    siblings: sortPeople(siblings),
    spouses: sortPeople(spouses),
    children: sortPeople([...childById.values()]),
  };
}

async function findFamilyDivorceDate(familyRecordName) {
  const db = getLocalDatabase();
  const { records } = await db.query('FamilyEvent', {
    referenceField: 'family',
    referenceValue: familyRecordName,
    limit: 1000,
  });
  const divorce = records.find((event) => /divorce/i.test(String(event.fields?.conclusionType?.value || event.fields?.eventType?.value || '')));
  return divorce?.fields?.date?.value || '';
}

function basePersonModel(record) {
  const summary = personSummary(record);
  return {
    ...summary,
    id: summary.recordName,
    name: summary.fullName,
    dateOfBirth: summary.birthDate || '',
    dateOfDeath: summary.deathDate || '',
  };
}

function personRelationModel(record, relationToSubject) {
  return {
    ...basePersonModel(record),
    relationToSubject,
  };
}

function selfModel(record) {
  return personRelationModel(record, 'Self');
}

function parentRelation(record) {
  if (record.fields?.gender?.value === Gender.Male) return 'Father';
  if (record.fields?.gender?.value === Gender.Female) return 'Mother';
  return 'Parent';
}

function siblingRelation(record) {
  if (record.fields?.gender?.value === Gender.Male) return 'Brother';
  if (record.fields?.gender?.value === Gender.Female) return 'Sister';
  return 'Sibling';
}

function spouseRelation(record) {
  if (record.fields?.gender?.value === Gender.Male) return 'Husband';
  if (record.fields?.gender?.value === Gender.Female) return 'Wife';
  return 'Spouse';
}

function childRelation(record) {
  if (record.fields?.gender?.value === Gender.Male) return 'Son';
  if (record.fields?.gender?.value === Gender.Female) return 'Daughter';
  return 'Child';
}

function sortPeople(people) {
  return [...people].sort((a, b) => {
    const dateCompare = String(a.birthDate || '').localeCompare(String(b.birthDate || ''));
    if (dateCompare) return dateCompare;
    return String(a.fullName || '').localeCompare(String(b.fullName || ''));
  });
}
