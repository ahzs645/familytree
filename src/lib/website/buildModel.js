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
  personGroupLabel,
  placeLabel,
  safeAssetName,
  savedChartLabel,
  sourceLabel,
  storyLabel,
} from './labels.js';

// Bookmark flag aliases (mirrors schema FIELD_ALIASES.bookmark).
const BOOKMARK_FIELDS = ['isBookmarked', 'bookmarked', 'isBookmarked1', 'isBookmarked2', 'isBookmarked3', 'isBookmarked4'];

function isBookmarked(record) {
  for (const key of BOOKMARK_FIELDS) {
    const raw = record?.fields?.[key]?.value ?? record?.fields?.[key];
    if (raw === true || raw === 1 || raw === '1' || String(raw).toLowerCase() === 'true') return true;
  }
  return false;
}

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
  // "Persons to include" scope (#13): when a resolved id set is supplied, only
  // those persons (and the families/records reachable from them) are published.
  const inScope = (record) => !options.exportPersonIds || options.exportPersonIds.has(record.recordName);
  const persons = snapshot.persons.filter((record) => include(record) && inScope(record)).map(applyMask).sort(compareBy((record) => personSummary(record)?.fullName || record.recordName, options));
  const personIds = new Set(persons.map((record) => record.recordName));
  const childRels = snapshot.childRels.filter((rel) => include(rel) && personIds.has(readRef(rel.fields?.child)));

  const families = snapshot.families
    .filter((family) => include(family) && familyHasIncludedMember(family, childRels, personIds))
    .sort(compareBy((record) => familyLabel(record, { personById: new Map(persons.map((person) => [person.recordName, person])) }) || record.recordName, options));
  const familyIds = new Set(families.map((record) => record.recordName));

  const places = snapshot.places.filter(include).sort(compareBy(placeLabel, options));
  const sources = snapshot.sources.filter(include).sort(compareBy(sourceLabel, options));
  // Per-media-type include toggles (#62): when a Media* type is switched off,
  // drop those records entirely from the export.
  const mediaTypes = options.mediaTypes || {};
  const media = snapshot.media
    .filter((record) => include(record) && mediaTypes[record.recordType] !== false)
    .sort(compareBy(mediaLabel, options));
  const stories = snapshot.stories.filter(include).sort(compareBy(storyLabel, options));

  // Person Groups page — public groups plus their members that survived the
  // person filter. Each group becomes a standalone page with a member index.
  const personGroupRelations = (snapshot.personGroupRelations || [])
    .filter((rel) => include(rel) && personIds.has(readRef(rel.fields?.person)));
  const groupMembersByGroup = groupRefs(personGroupRelations, 'personGroup', 'person');
  const personGroups = options.contentSections.personGroups
    ? (snapshot.personGroups || [])
      .filter((group) => include(group) && (groupMembersByGroup.get(group.recordName) || []).length > 0)
      .sort(compareBy(personGroupLabel, options))
    : [];

  // Saved Charts page — authored chart records (SavedChart). Always public-only.
  const savedCharts = options.contentSections.savedCharts
    ? (snapshot.savedCharts || [])
      .filter((chart) => include(chart))
      .sort(compareBy(savedChartLabel, options))
    : [];

  const pageRecords = [
    ...(options.contentSections.people ? persons : []),
    ...(options.contentSections.families ? families : []),
    ...(options.contentSections.places ? places : []),
    ...(options.contentSections.sources ? sources : []),
    ...(options.contentSections.media ? media : []),
    ...(options.contentSections.stories ? stories : []),
    ...personGroups,
    ...savedCharts,
  ];
  const pathById = buildPathMap(pageRecords);

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

  // DNA test results (#86) — public results whose person is in the export.
  const dnaResults = options.contentSections.dna
    ? (snapshot.dnaResults || []).filter((record) => include(record) && personIds.has(readRef(record.fields?.person)))
    : [];

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
    dnaResults,
    personGroups,
    personGroupRelations,
    savedCharts,
    assets,
    pathById,
    assetPathById,
    personById: new Map(persons.map((record) => [record.recordName, record])),
    familyById: new Map(families.map((record) => [record.recordName, record])),
    placeById: new Map(places.map((record) => [record.recordName, record])),
    sourceById: new Map(sources.map((record) => [record.recordName, record])),
    mediaById: new Map(media.map((record) => [record.recordName, record])),
    storyById: new Map(stories.map((record) => [record.recordName, record])),
    personGroupById: new Map(personGroups.map((record) => [record.recordName, record])),
    savedChartById: new Map(savedCharts.map((record) => [record.recordName, record])),
  };

  // Group members in published-person sort order, restricted to visible groups.
  model.groupMembersByGroup = new Map();
  for (const group of personGroups) {
    const memberIds = (groupMembersByGroup.get(group.recordName) || []);
    const memberPersons = memberIds
      .map((id) => model.personById.get(id))
      .filter(Boolean)
      .sort(compareBy((record) => personSummary(record)?.fullName || record.recordName, options));
    model.groupMembersByGroup.set(group.recordName, memberPersons);
  }
  // Groups each person belongs to (for cross-linking on person pages).
  model.groupsByPerson = new Map();
  for (const group of personGroups) {
    for (const person of model.groupMembersByGroup.get(group.recordName) || []) {
      if (!model.groupsByPerson.has(person.recordName)) model.groupsByPerson.set(person.recordName, []);
      model.groupsByPerson.get(person.recordName).push(group);
    }
  }

  // Bookmarked people surfaced on the homepage (#homepage bookmarks).
  model.bookmarkedPersons = options.includeBookmarks
    ? persons.filter(isBookmarked)
    : [];

  // Start person card (#homepage start person): only when the chosen person
  // survived the publish filter.
  model.startPerson = options.startPersonId
    ? (model.personById.get(options.startPersonId) || null)
    : null;

  model.dnaResultsByPerson = groupRecords(dnaResults, (record) => readRef(record.fields?.person));
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
  model.personSurnameGroups = buildPersonSurnameGroups(persons, options);
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
  return (a, b) => compareStrings(labelFn(a), labelFn(b), localization) || compareStrings(a?.recordName, b?.recordName, localization);
}

function buildPathMap(records) {
  const pathById = new Map();
  const used = new Set();
  for (const record of records) {
    const path = uniquePagePath(record, used);
    pathById.set(record.recordName, path);
  }
  return pathById;
}

function uniquePagePath(record, used) {
  const folder = pageFolder(record);
  const base = record.recordType === 'Person'
    ? personSlug(record)
    : encodeURIComponent(record.recordName);
  let candidate = `${folder}/${base}.html`;
  if (!used.has(candidate)) {
    used.add(candidate);
    return candidate;
  }

  const recordSlug = slugify(record.recordName, 'record');
  candidate = `${folder}/${base}-${recordSlug}.html`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${folder}/${base}-${recordSlug}-${suffix}.html`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function pageFolder(record) {
  const folder = {
    Person: 'people',
    Family: 'families',
    Place: 'places',
    Source: 'sources',
    Story: 'stories',
    PersonGroup: 'groups',
    SavedChart: 'charts',
    SavedView: 'charts',
  }[record.recordType] || (record.recordType?.startsWith('Media') ? 'media' : 'records');
  return folder;
}

function personSlug(person) {
  const summary = personSummary(person);
  const parts = [
    summary?.firstName,
    summary?.lastName,
  ].filter(Boolean);
  const label = parts.length ? parts.join(' ') : summary?.fullName;
  return slugify(label, slugify(person.recordName, 'person'));
}

function buildPersonSurnameGroups(persons, options) {
  const groups = new Map();
  for (const person of persons) {
    const summary = personSummary(person);
    const surname = String(summary?.lastName || '').trim() || 'Unknown surname';
    if (!groups.has(surname)) groups.set(surname, []);
    groups.get(surname).push(person);
  }
  const usedSlugs = new Set();
  return [...groups.entries()]
    .map(([surname, records]) => ({
      surname,
      slug: uniqueSlug(slugify(surname, 'unknown-surname'), usedSlugs),
      records: records.sort(compareBy((record) => personSummary(record)?.fullName || record.recordName, options)),
    }))
    .sort((a, b) => compareStrings(a.surname, b.surname, options));
}

function uniqueSlug(base, used) {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function slugify(value, fallback = 'item') {
  const clean = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || fallback;
}
