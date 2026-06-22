/**
 * Database snapshot loader and pre-export validator.
 *
 * loadSnapshot() pulls every relevant record type out of IndexedDB in
 * one parallel batch — the rest of the pipeline operates on the in-
 * memory snapshot rather than re-querying the database.
 *
 * validateSnapshot() walks references to surface broken pointers and
 * privacy conflicts before the user commits to the export.
 */
import { getLocalDatabase } from '../LocalDatabase.js';
import { readRef } from '../schema.js';
import { isPrivateRecord, isPublicRecord } from '../privacy.js';
import { formatInteger } from '../i18n.js';
import { MEDIA_TYPES, normalizeOptions } from './utilities.js';

export async function loadSnapshot() {
  const db = getLocalDatabase();
  const [
    rawPersons,
    rawFamilies,
    rawChildRels,
    rawPersonEvents,
    rawFamilyEvents,
    rawPlaces,
    rawSources,
    rawSourceRelations,
    rawMediaRelations,
    rawStoryRelations,
    rawStories,
    rawStorySections,
    rawDnaResults,
    rawAssets,
    ...mediaRows
  ] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
    db.query('Place', { limit: 100000 }),
    db.query('Source', { limit: 100000 }),
    db.query('SourceRelation', { limit: 100000 }),
    db.query('MediaRelation', { limit: 100000 }),
    db.query('StoryRelation', { limit: 100000 }),
    db.query('Story', { limit: 100000 }),
    db.query('StorySection', { limit: 100000 }),
    db.query('DNATestResult', { limit: 100000 }),
    db.listAllAssets(),
    ...MEDIA_TYPES.map((type) => db.query(type, { limit: 100000 })),
  ]);

  const mediaRecords = mediaRows.flatMap((row) => row.records);
  const publicSourceRelations = rawSourceRelations.records.map(stripPrivateLineageFields);
  const records = [
    ...rawPersons.records,
    ...rawFamilies.records,
    ...rawChildRels.records,
    ...rawPersonEvents.records,
    ...rawFamilyEvents.records,
    ...rawPlaces.records,
    ...rawSources.records,
    ...publicSourceRelations,
    ...rawMediaRelations.records,
    ...rawStoryRelations.records,
    ...rawStories.records,
    ...rawStorySections.records,
    ...rawDnaResults.records,
    ...mediaRecords,
  ];
  const allRecordsById = new Map(records.map((record) => [record.recordName, record]));

  return {
    persons: rawPersons.records,
    families: rawFamilies.records,
    childRels: rawChildRels.records,
    personEvents: rawPersonEvents.records,
    familyEvents: rawFamilyEvents.records,
    places: rawPlaces.records,
    sources: rawSources.records,
    sourceRelations: publicSourceRelations,
    mediaRelations: rawMediaRelations.records,
    storyRelations: rawStoryRelations.records,
    stories: rawStories.records,
    storySections: rawStorySections.records,
    dnaResults: rawDnaResults.records,
    media: mediaRecords,
    assets: rawAssets,
    allRecordsById,
  };
}

function stripPrivateLineageFields(record) {
  const fields = { ...(record.fields || {}) };
  for (const key of Object.keys(fields)) {
    if (key.startsWith('lineage')) delete fields[key];
  }
  return { ...record, fields };
}

function referenceFields(record) {
  const refs = [];
  for (const [fieldName, field] of Object.entries(record?.fields || {})) {
    const value = field?.value ?? field;
    if (field?.type !== 'REFERENCE' && !(typeof value === 'string' && value.includes('---'))) continue;
    const recordName = readRef(field);
    if (recordName) refs.push({ fieldName, recordName });
  }
  return refs;
}

export function validateSnapshot(snapshot, options) {
  const allRecordIds = new Set(snapshot.allRecordsById.keys());
  const includedPersons = snapshot.persons.filter((record) => options.includePrivate || isPublicRecord(record));
  const missing = [];
  const privacyConflicts = [];

  for (const record of snapshot.allRecordsById.values()) {
    for (const ref of referenceFields(record)) {
      const target = snapshot.allRecordsById.get(ref.recordName);
      if (!target && !allRecordIds.has(ref.recordName)) {
        missing.push({
          from: record.recordName,
          fromType: record.recordType,
          field: ref.fieldName,
          to: ref.recordName,
        });
      } else if (!options.includePrivate && isPublicRecord(record) && isPrivateRecord(target)) {
        privacyConflicts.push({
          from: record.recordName,
          fromType: record.recordType,
          field: ref.fieldName,
          to: target.recordName,
          toType: target.recordType,
        });
      }
    }
  }

  const errors = [];
  const warnings = [];
  if (includedPersons.length === 0) {
    errors.push('No publishable people were found. Add people or include private records before exporting.');
  }
  if (!Object.entries(options.contentSections).some(([key, enabled]) => ['people', 'families', 'places', 'sources', 'media', 'stories'].includes(key) && enabled)) {
    errors.push('Select at least one website content section before exporting.');
  }
  if (missing.length > 0) {
    warnings.push(`${formatInteger(missing.length, options)} reference${missing.length === 1 ? '' : 's'} point to missing records and will be omitted.`);
  }
  if (privacyConflicts.length > 0) {
    warnings.push(`${formatInteger(privacyConflicts.length, options)} public record${privacyConflicts.length === 1 ? '' : 's'} link to private records that will be hidden.`);
  }

  return {
    canExport: errors.length === 0,
    errors,
    warnings,
    counts: {
      persons: includedPersons.length,
      privatePersons: snapshot.persons.filter(isPrivateRecord).length,
      totalPersons: snapshot.persons.length,
      records: snapshot.allRecordsById.size,
    },
    missingReferences: missing,
    privacyConflicts,
  };
}

export async function validateSiteExport(options = {}) {
  const normalized = normalizeOptions(options);
  const snapshot = await loadSnapshot();
  return validateSnapshot(snapshot, normalized);
}
