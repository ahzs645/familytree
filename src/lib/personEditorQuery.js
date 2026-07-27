/**
 * personEditorQuery — the PersonEditor route's hydration pipeline.
 *
 * loadPersonEditorModel() issues every query the /person/:id editor needs
 * (additional names, facts, notes, events, associates, labels, milk kinships,
 * tribal memberships, and the five related-record relation types) and maps the
 * raw records into the plain viewmodels the route's setState calls expect.
 * Returns null when the person record does not exist.
 */
import { getAppDataClient } from './data/AppDataClient.js';
import { buildPersonContext } from './personContext.js';
import { refToRecordName } from './recordRef.js';
import { readRef } from './schema.js';
import { personSummary } from '../models/index.js';
import { LABELS, REFERENCE_NUMBER_FIELDS, normalizeConclusionTypeId } from './catalogs.js';
import { resolveLabelDefinitions } from './labels.js';
import { listAllPersons } from './treeQuery.js';
import { evidenceStateForRecord, loadResearchCompleteness } from './researchCompleteness.js';
import { milkKinshipSummary, roleForMilkKinship } from './milkKinship.js';
import { loadTribalAffiliationModel } from './tribalAffiliations.js';
import { queryMilkKinshipsForPerson } from '../components/personEditor/persistence.js';

export const NAME_FIELDS = [
  { id: 'firstName', label: 'First Name' },
  { id: 'lastName', label: 'Last Name' },
  { id: 'nameMiddle', label: 'Middle Name' },
  { id: 'namePrefix', label: 'Title' },
  { id: 'nameSuffix', label: 'Suffix' },
];

export async function loadPersonEditorModel(personRecordName) {
  const id = personRecordName;
  const db = getAppDataClient().records;
  const record = await db.get(id);
  if (!record) return null;
  const context = await buildPersonContext(id);

  const values = {};
  for (const f of NAME_FIELDS) values[f.id] = record.fields?.[f.id]?.value ?? '';
  const grave = {
    cemetery: record.fields?.cemetery?.value || '',
    cemeteryLocation: record.fields?.cemeteryLocation?.value || '',
    graveNumber: record.fields?.graveNumber?.value || '',
  };

  const refNumbers = {};
  for (const f of REFERENCE_NUMBER_FIELDS) refNumbers[f.id] = record.fields?.[f.id]?.value ?? '';

  const [an, fact, note, lbl, labelRows, ev, ar, analysis, allPersonRows] = await Promise.all([
    db.query('AdditionalName', { referenceField: 'person', referenceValue: id, limit: 500 }),
    db.query('PersonFact', { referenceField: 'person', referenceValue: id, limit: 500 }),
    db.query('Note', { referenceField: 'person', referenceValue: id, limit: 500 }),
    db.query('LabelRelation', { referenceField: 'targetPerson', referenceValue: id, limit: 500 }),
    db.query('Label', { limit: 100000 }),
    db.query('PersonEvent', { referenceField: 'person', referenceValue: id, limit: 500 }),
    db.query('AssociateRelation', { referenceField: 'sourcePerson', referenceValue: id, limit: 500 }),
    loadResearchCompleteness(),
    db.query('Person', { limit: 100000 }),
  ]);
  const labelDefs = resolveLabelDefinitions(labelRows.records);
  const personEvidence = analysis.rowsByPerson.get(id);
  const evidence = {
    row: personEvidence,
    byRecord: new Map([...ev.records, ...fact.records].map((item) => [item.recordName, evidenceStateForRecord(item.recordName, analysis)])),
  };
  const allPersons = await listAllPersons({ includePrivate: true });
  const personById = new Map(allPersonRows.records.map((person) => [person.recordName, personSummary(person)]));
  const milkRows = await queryMilkKinshipsForPerson(db, id);
  const milkKinships = milkRows.map((milk) => {
    const summary = milkKinshipSummary(milk, personById);
    return {
      ...summary,
      role: roleForMilkKinship(summary, id),
    };
  });

  const additionalNames = an.records.map((a) => ({
    recordName: a.recordName,
    type: normalizeConclusionTypeId(refToRecordName(a.fields?.conclusionType?.value) || a.fields?.type?.value || ''),
    value: a.fields?.name?.value || a.fields?.value?.value || '',
  }));
  const facts = fact.records.map((f) => ({
    recordName: f.recordName,
    type: normalizeConclusionTypeId(refToRecordName(f.fields?.conclusionType?.value) || ''),
    // Canonical fact value lives in `description`; fall back to `value` so facts
    // imported by older builds (which stored the value under `value`) still show.
    value: f.fields?.description?.value || f.fields?.value?.value || '',
    date: f.fields?.date?.value || '',
  }));
  const notes = note.records.map((n) => ({
    recordName: n.recordName,
    text: n.fields?.text?.value || n.fields?.note?.value || '',
  }));
  const events = ev.records;
  const associates = ar.records.map((a) => ({
    recordName: a.recordName,
    type: refToRecordName(a.fields?.relationType?.value) || a.fields?.type?.value || '',
    targetPersonRef: refToRecordName(a.fields?.targetPerson?.value) || '',
    targetName: a.fields?.cached_targetName?.value || '',
  }));

  const [mediaRels, sourceRels, todoRels, storyRels, groupRels] = await Promise.all([
    db.query('MediaRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
    db.query('SourceRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
    db.query('ToDoRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
    db.query('StoryRelation', { referenceField: 'target', referenceValue: id, limit: 500 }),
    db.query('PersonGroupRelation', { referenceField: 'person', referenceValue: id, limit: 500 }),
  ]);
  async function hydrate(rels, fieldName, fallbackType) {
    const out = [];
    for (const rel of rels.records) {
      const targetId = readRef(rel.fields?.[fieldName]);
      const target = targetId ? await db.get(targetId) : null;
      out.push({ rel, target, type: target?.recordType || fallbackType });
    }
    return out;
  }
  const related = {
    media: await hydrate(mediaRels, 'media', 'Media'),
    sources: await hydrate(sourceRels, 'source', 'Source'),
    todos: await hydrate(todoRels, 'todo', 'ToDo'),
    stories: await hydrate(storyRels, 'story', 'Story'),
    groups: await hydrate(groupRels, 'personGroup', 'PersonGroup'),
  };
  const tribalModel = await loadTribalAffiliationModel(db);
  const affiliationsById = new Map(tribalModel.affiliations.map((affiliation) => [affiliation.recordName, affiliation]));
  const tribalMemberships = tribalModel.memberships
    .filter((membership) => membership.personId === id)
    .map((membership) => ({ ...membership, affiliation: affiliationsById.get(membership.affiliationId) }))
    .filter((membership) => membership.affiliation);

  const labelMap = {};
  for (const lr of lbl.records) {
    const labelRef = refToRecordName(lr.fields?.label?.value) || '';
    labelMap[labelRef] = lr.recordName;
  }
  const labels = {};
  for (const def of LABELS) labels[def.id] = !!labelMap[def.id];

  return {
    record,
    context,
    values,
    bookmarked: !!record.fields?.isBookmarked?.value,
    isStartPerson: !!record.fields?.isStartPerson?.value,
    isPrivate: !!record.fields?.isPrivate?.value,
    isDeceased: !!record.fields?.isDeceased?.value,
    outsideFamily: !!record.fields?.fromOutsideFamily?.value,
    grave,
    refNumbers,
    labelDefs,
    evidence,
    allPersons,
    milkKinships,
    additionalNames,
    facts,
    notes,
    events,
    associates,
    related,
    tribalMemberships,
    labels,
  };
}
