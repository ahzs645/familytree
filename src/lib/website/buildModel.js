/**
 * Builds the "publish model" — a derived view of the snapshot that the
 * page renderers can index quickly. Filters records by privacy and
 * living-person policies, builds id→record maps, groups events and
 * relations by their owner, and assigns each record its output path.
 */
import { readRef } from '../schema.js';
import { isLiving, isPrivateRecord, maskLivingDetails } from '../privacy.js';
import { compareStrings } from '../i18n.js';
import {
  personSummary,
} from '../../models/index.js';
import {
  familyLabel,
  mediaLabel,
  placeLabel,
  safeAssetName,
  sourceLabel,
  storyLabel,
} from './labels.js';

export function buildPublishModel(snapshot, options) {
  const include = (record) => {
    if (!record) return false;
    if (!options.includePrivate && isPrivateRecord(record)) return false;
    if (options.hideLiving && !options.hideLivingDetailsOnly && isLiving(record, options.livingThresholdYears)) return false;
    return true;
  };
  const livingMaskPolicy = {
    hideMarkedPrivate: !options.includePrivate,
    hideLivingPersons: options.hideLiving,
    hideLivingDetailsOnly: options.hideLivingDetailsOnly,
    livingPersonThresholdYears: options.livingThresholdYears,
  };
  const applyMask = (record) => (options.hideLivingDetailsOnly ? maskLivingDetails(record, livingMaskPolicy) : record);
  const persons = snapshot.persons.filter(include).map(applyMask).sort(compareBy((record) => personSummary(record)?.fullName || record.recordName, options));
  const personIds = new Set(persons.map((record) => record.recordName));
  const childRels = snapshot.childRels.filter((rel) => include(rel) && personIds.has(readRef(rel.fields?.child)));

  const families = snapshot.families
    .filter((family) => include(family) && familyHasIncludedMember(family, childRels, personIds))
    .sort(compareBy((record) => familyLabel(record, { personById: new Map(persons.map((person) => [person.recordName, person])) }) || record.recordName, options));
  const familyIds = new Set(families.map((record) => record.recordName));

  const places = snapshot.places.filter(include).sort(compareBy(placeLabel, options));
  const sources = snapshot.sources.filter(include).sort(compareBy(sourceLabel, options));
  const media = snapshot.media.filter(include).sort(compareBy(mediaLabel, options));
  const stories = snapshot.stories.filter(include).sort(compareBy(storyLabel, options));

  const pageRecords = [
    ...(options.contentSections.people ? persons : []),
    ...(options.contentSections.families ? families : []),
    ...(options.contentSections.places ? places : []),
    ...(options.contentSections.sources ? sources : []),
    ...(options.contentSections.media ? media : []),
    ...(options.contentSections.stories ? stories : []),
  ];
  const pathById = new Map();
  for (const record of pageRecords) pathById.set(record.recordName, pagePath(record));

  const placeIds = new Set(places.map((record) => record.recordName));
  const sourceIds = new Set(sources.map((record) => record.recordName));
  const mediaIds = new Set(media.map((record) => record.recordName));
  const storyIds = new Set(stories.map((record) => record.recordName));
  const includedRecordIds = new Set([...personIds, ...familyIds, ...placeIds, ...sourceIds, ...mediaIds, ...storyIds]);

  const personEvents = snapshot.personEvents.filter((event) => include(event) && personIds.has(readRef(event.fields?.person)));
  const familyEvents = snapshot.familyEvents.filter((event) => include(event) && familyIds.has(readRef(event.fields?.family)));
  const sourceRelations = snapshot.sourceRelations.filter((rel) => (
    include(rel) &&
    sourceIds.has(readRef(rel.fields?.source)) &&
    (includedRecordIds.has(readRef(rel.fields?.target)) || eventIsIncluded(readRef(rel.fields?.target), personEvents, familyEvents))
  ));
  const mediaRelations = snapshot.mediaRelations.filter((rel) => (
    include(rel) && mediaIds.has(readRef(rel.fields?.media)) && includedRecordIds.has(readRef(rel.fields?.target))
  ));
  const storyRelations = snapshot.storyRelations.filter((rel) => (
    include(rel) && storyIds.has(readRef(rel.fields?.story)) && includedRecordIds.has(readRef(rel.fields?.target))
  ));
  const storySections = snapshot.storySections.filter((section) => (
    include(section) && storyIds.has(readRef(section.fields?.story) || readRef(section.fields?.storySection))
  ));

  const assets = options.includeAssets && options.contentSections.media
    ? snapshot.assets.filter((asset) => mediaIds.has(asset.ownerRecordName))
    : [];
  const assetPathById = new Map();
  for (const asset of assets) assetPathById.set(asset.assetId, `assets/media/${safeAssetName(asset)}`);

  const model = {
    options,
    persons,
    families,
    places,
    sources,
    media,
    stories,
    childRels,
    personEvents,
    familyEvents,
    sourceRelations,
    mediaRelations,
    storyRelations,
    storySections,
    assets,
    pathById,
    assetPathById,
    personById: new Map(persons.map((record) => [record.recordName, record])),
    familyById: new Map(families.map((record) => [record.recordName, record])),
    placeById: new Map(places.map((record) => [record.recordName, record])),
    sourceById: new Map(sources.map((record) => [record.recordName, record])),
    mediaById: new Map(media.map((record) => [record.recordName, record])),
    storyById: new Map(stories.map((record) => [record.recordName, record])),
  };

  model.childrenByFamily = groupRefs(childRels, 'family', 'child');
  model.parentFamilyByChild = new Map(childRels.map((rel) => [readRef(rel.fields?.child), readRef(rel.fields?.family)]));
  model.familiesByPerson = buildFamiliesByPerson(families);
  model.personEventsByPerson = groupRecords(personEvents, (record) => readRef(record.fields?.person));
  model.familyEventsByFamily = groupRecords(familyEvents, (record) => readRef(record.fields?.family));
  model.sourceRelationsByTarget = groupRecords(sourceRelations, (record) => readRef(record.fields?.target));
  model.sourceRelationsBySource = groupRecords(sourceRelations, (record) => readRef(record.fields?.source));
  model.mediaRelationsByTarget = groupRecords(mediaRelations, (record) => readRef(record.fields?.target));
  model.mediaRelationsByMedia = groupRecords(mediaRelations, (record) => readRef(record.fields?.media));
  model.storyRelationsByTarget = groupRecords(storyRelations, (record) => readRef(record.fields?.target));
  model.storyRelationsByStory = groupRecords(storyRelations, (record) => readRef(record.fields?.story));
  model.storySectionsByStory = groupRecords(storySections, (record) => readRef(record.fields?.story) || readRef(record.fields?.storySection));
  model.assetsByOwner = groupRecords(assets, (asset) => asset.ownerRecordName);
  return model;
}

function eventIsIncluded(recordName, personEvents, familyEvents) {
  if (!recordName) return false;
  return personEvents.some((event) => event.recordName === recordName) || familyEvents.some((event) => event.recordName === recordName);
}

function familyHasIncludedMember(family, childRels, personIds) {
  const man = readRef(family.fields?.man);
  const woman = readRef(family.fields?.woman);
  if ((man && personIds.has(man)) || (woman && personIds.has(woman))) return true;
  return childRels.some((rel) => readRef(rel.fields?.family) === family.recordName && personIds.has(readRef(rel.fields?.child)));
}

function buildFamiliesByPerson(families) {
  const out = new Map();
  for (const family of families) {
    for (const slot of ['man', 'woman']) {
      const id = readRef(family.fields?.[slot]);
      if (!id) continue;
      if (!out.has(id)) out.set(id, []);
      out.get(id).push(family.recordName);
    }
  }
  return out;
}

function groupRefs(records, ownerField, itemField) {
  const out = new Map();
  for (const record of records) {
    const owner = readRef(record.fields?.[ownerField]);
    const item = readRef(record.fields?.[itemField]);
    if (!owner || !item) continue;
    if (!out.has(owner)) out.set(owner, []);
    out.get(owner).push(item);
  }
  return out;
}

function groupRecords(records, keyFn) {
  const out = new Map();
  for (const record of records) {
    const key = keyFn(record);
    if (!key) continue;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(record);
  }
  return out;
}

function compareBy(labelFn, localization) {
  return (a, b) => compareStrings(labelFn(a), labelFn(b), localization);
}

function pagePath(record) {
  const folder = {
    Person: 'people',
    Family: 'families',
    Place: 'places',
    Source: 'sources',
    Story: 'stories',
  }[record.recordType] || (record.recordType?.startsWith('Media') ? 'media' : 'records');
  return `${folder}/${encodeURIComponent(record.recordName)}.html`;
}
