/**
 * Pure Research Assistant question generation plus its focused write helpers.
 * The generator accepts record arrays so its taxonomy and scope behavior can
 * be tested without IndexedDB or React.
 */
import { readConclusionType, readField, readRef, writeRef } from './schema.js';
import { createWithChangeLog } from './recordWrite.js';
import { saveWithChangeLog } from './changeLog.js';
import { generateId } from './ids.js';
import { personSummary, placeSummary } from '../models/index.js';
import { getAppDataClient } from './data/AppDataClient.js';

export const RESEARCH_CATEGORIES = ['birth', 'death', 'marriage', 'sources', 'parents', 'spouses', 'places'];

export const DEFAULT_RESEARCH_OPTIONS = {
  categories: Object.fromEntries(RESEARCH_CATEGORIES.map((category) => [category, true])),
  scopeMode: 'all',
  smartFilterId: '',
  personGroupId: '',
  targetPersonId: '',
};

export function normalizeResearchOptions(value) {
  const input = value && typeof value === 'object' ? value : {};
  const categories = {};
  for (const category of RESEARCH_CATEGORIES) {
    categories[category] = input.categories?.[category] !== false;
  }
  return {
    categories,
    scopeMode: ['all', 'smartFilter', 'personGroup'].includes(input.scopeMode) ? input.scopeMode : 'all',
    smartFilterId: String(input.smartFilterId || ''),
    personGroupId: String(input.personGroupId || ''),
    targetPersonId: String(input.targetPersonId || ''),
  };
}

function normalizedEventType(record) {
  return String(readConclusionType(record) || '').trim().toLowerCase();
}

function eventOfType(events, type) {
  const needle = type.toLowerCase();
  return events.find((event) => normalizedEventType(event).includes(needle)) || null;
}

function yearFrom(value) {
  const match = String(value || '').match(/(?:^|\D)(\d{4})(?:\D|$)/);
  return match ? Number(match[1]) : 0;
}

function hasIncompleteName(place) {
  if (!place) return true;
  const summary = placeSummary(place);
  const name = String(summary?.displayName || summary?.name || '').trim();
  if (!name) return true;
  return name.split(',').map((part) => part.trim()).filter(Boolean).length < 2;
}

function makeQuestion(kind, category, person, extra = {}) {
  return {
    id: extra.familyId ? `${extra.familyId}:${kind}` : `${person.recordName}:${kind}`,
    kind,
    category,
    personId: person.recordName,
    personName: personSummary(person)?.fullName || person.recordName,
    ...extra,
  };
}

/**
 * Build the open question list. `scopeIds` is resolved by the caller for a
 * Smart Filter or Person Group; target-person mode always takes precedence.
 */
export function buildResearchQuestions(data, rawOptions = DEFAULT_RESEARCH_OPTIONS, scopeIds = null) {
  const options = normalizeResearchOptions(rawOptions);
  const persons = data.persons || [];
  const families = data.families || [];
  const childRelations = data.childRelations || [];
  const personEvents = data.personEvents || [];
  const familyEvents = data.familyEvents || [];
  const sourceRelations = data.sourceRelations || [];
  const places = data.places || [];

  const personById = new Map(persons.map((person) => [person.recordName, person]));
  const placeById = new Map(places.map((place) => [place.recordName, place]));
  const eventsByPerson = new Map();
  for (const event of personEvents) {
    const personId = readRef(event.fields?.person);
    if (!personId) continue;
    if (!eventsByPerson.has(personId)) eventsByPerson.set(personId, []);
    eventsByPerson.get(personId).push(event);
  }
  const eventsByFamily = new Map();
  for (const event of familyEvents) {
    const familyId = readRef(event.fields?.family);
    if (!familyId) continue;
    if (!eventsByFamily.has(familyId)) eventsByFamily.set(familyId, []);
    eventsByFamily.get(familyId).push(event);
  }
  const hasParents = new Set(childRelations.map((relation) => readRef(relation.fields?.child)).filter(Boolean));
  const sourcedPeople = new Set();
  for (const relation of sourceRelations) {
    if ((relation.fields?.targetType?.value || '') !== 'Person') continue;
    const id = readRef(relation.fields?.target);
    if (id) sourcedPeople.add(id);
  }
  const familiesByPerson = new Map();
  for (const family of families) {
    for (const id of [readRef(family.fields?.man), readRef(family.fields?.woman)].filter(Boolean)) {
      if (!familiesByPerson.has(id)) familiesByPerson.set(id, []);
      familiesByPerson.get(id).push(family);
    }
  }

  const inScope = (person) => {
    if (options.targetPersonId) return person.recordName === options.targetPersonId;
    return !scopeIds || scopeIds.has(person.recordName);
  };
  const questions = [];
  for (const person of persons.filter(inScope)) {
    const events = eventsByPerson.get(person.recordName) || [];
    const birth = eventOfType(events, 'birth');
    const death = eventOfType(events, 'death');
    const birthDate = readField(birth, ['date', 'cached_date'], readField(person, 'cached_birthDate', ''));
    const deathDate = readField(death, ['date', 'cached_date'], readField(person, 'cached_deathDate', ''));

    if (options.categories.birth && !birthDate) {
      questions.push(makeQuestion('birthDate', 'birth', person, { eventId: birth?.recordName || '', eventType: 'Birth', eventRecordType: 'PersonEvent' }));
    }
    const birthYear = yearFrom(birthDate);
    const likelyDeceased = !!death || !!deathDate || (birthYear > 0 && new Date().getFullYear() - birthYear > 110);
    if (options.categories.death && likelyDeceased && !deathDate) {
      questions.push(makeQuestion('deathDate', 'death', person, { eventId: death?.recordName || '', eventType: 'Death', eventRecordType: 'PersonEvent' }));
    }
    if (options.categories.sources && !sourcedPeople.has(person.recordName)) {
      questions.push(makeQuestion('personSource', 'sources', person));
    }
    if (options.categories.parents && !hasParents.has(person.recordName)) {
      questions.push(makeQuestion('parents', 'parents', person));
    }
    const personFamilies = familiesByPerson.get(person.recordName) || [];
    const hasPartner = personFamilies.some((family) => {
      const man = readRef(family.fields?.man);
      const woman = readRef(family.fields?.woman);
      return (man === person.recordName && !!woman) || (woman === person.recordName && !!man);
    });
    if (options.categories.spouses && !hasPartner) {
      questions.push(makeQuestion('partner', 'spouses', person));
    }

    if (options.categories.places) {
      for (const [type, event] of [['birth', birth], ['death', death]]) {
        if (!event || !readField(event, ['date', 'cached_date'], '')) continue;
        const placeId = readRef(event.fields?.place || event.fields?.assignedPlace) || '';
        if (!placeId || hasIncompleteName(placeById.get(placeId))) {
          questions.push(makeQuestion(`${type}Place`, 'places', person, {
            eventId: event.recordName,
            eventType: type === 'birth' ? 'Birth' : 'Death',
            eventRecordType: 'PersonEvent',
            placeId,
          }));
        }
      }
    }

    for (const family of personFamilies) {
      const marriage = eventOfType(eventsByFamily.get(family.recordName) || [], 'marriage');
      const marriageDate = readField(marriage, ['date', 'cached_date'], readField(family, ['cached_marriageDate', 'marriedDate'], ''));
      const partnerId = [readRef(family.fields?.man), readRef(family.fields?.woman)].find((id) => id && id !== person.recordName) || '';
      const partnerName = personSummary(personById.get(partnerId))?.fullName || '';
      if (options.categories.marriage && !marriageDate) {
        questions.push(makeQuestion('marriageDate', 'marriage', person, {
          familyId: family.recordName,
          partnerId,
          partnerName,
          eventId: marriage?.recordName || '',
          eventType: 'Marriage',
          eventRecordType: 'FamilyEvent',
        }));
      }
      if (options.categories.places && marriage && marriageDate) {
        const placeId = readRef(marriage.fields?.place || marriage.fields?.assignedPlace) || '';
        if (!placeId || hasIncompleteName(placeById.get(placeId))) {
          questions.push(makeQuestion('marriagePlace', 'places', person, {
            familyId: family.recordName,
            partnerId,
            partnerName,
            eventId: marriage.recordName,
            eventType: 'Marriage',
            eventRecordType: 'FamilyEvent',
            placeId,
          }));
        }
      }
    }
  }

  // A family is visited once for each partner; keep one marriage question.
  const unique = new Map();
  for (const question of questions) if (!unique.has(question.id)) unique.set(question.id, question);
  return [...unique.values()];
}

/** Write or update the event associated with a date/place research answer. */
export async function saveResearchEventAnswer(question, values) {
  if (!question?.eventRecordType || !question?.eventType) return null;
  let record = question.eventId ? await getAppDataClient().records.get(question.eventId) : null;
  if (!record) {
    const ownerField = question.eventRecordType === 'FamilyEvent' ? 'family' : 'person';
    const ownerId = question.eventRecordType === 'FamilyEvent' ? question.familyId : question.personId;
    record = {
      recordName: generateId(question.eventRecordType === 'FamilyEvent' ? 'fe' : 'pe'),
      recordType: question.eventRecordType,
      fields: {
        [ownerField]: writeRef(ownerId, question.eventRecordType === 'FamilyEvent' ? 'Family' : 'Person'),
        conclusionType: writeRef(question.eventType, question.eventRecordType === 'FamilyEvent' ? 'ConclusionFamilyEventType' : 'ConclusionPersonEventType'),
      },
    };
    if (values.date) record.fields.date = { value: values.date, type: 'STRING' };
    if (values.placeId) record.fields.place = writeRef(values.placeId, 'Place');
    await createWithChangeLog(record);
    return record;
  }
  const next = { ...record, fields: { ...record.fields } };
  if (values.date) next.fields.date = { value: values.date, type: 'STRING' };
  if (values.placeId) next.fields.place = writeRef(values.placeId, 'Place');
  await saveWithChangeLog(next);
  return next;
}
