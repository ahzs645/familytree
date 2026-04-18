import { readConclusionType, readField, readRef } from './schema.js';

export const PARITY_CHART_TYPES = [
  'ancestor',
  'descendant',
  'hourglass',
  'tree',
  'double-ancestor',
  'fan',
  'circular',
  'symmetrical',
  'distribution',
  'timeline',
  'genogram',
  'sociogram',
  'fractal-h-tree',
  'square-tree',
  'fractal-tree',
  'relationship',
  'virtual',
];

export function createParitySnapshot(dataset, { sourcePath = '', sourceName = '' } = {}) {
  const records = Object.values(dataset.records || {});
  const byType = groupByType(records);
  const ctx = buildDatasetContext(byType);
  const scopeRows = (byType.Scope || []).map((scope) => scopeSnapshot(scope, ctx)).sort((a, b) => a.name.localeCompare(b.name));
  const startPerson = findStartPerson(byType.Person || []);

  return sortObjectKeys({
    format: 'cloudtreeweb-mft-parity-snapshot',
    version: 1,
    sourceName: sourceName || dataset.meta?.sourceName || sourcePath.split('/').pop() || 'unknown',
    recordTotal: records.length,
    counts: sortObjectKeys(dataset.counts || {}),
    warnings: {
      total: dataset.warnings?.length || 0,
      archivedPayloads: (dataset.warnings || []).filter((warning) => warning.includes('archived Mac payload')).length,
    },
    assets: {
      count: dataset.assets?.length || 0,
      owners: countBy(dataset.assets || [], (asset) => asset.ownerRecordName || 'unknown'),
      mediaRecordsWithAssetIds: countRecordsWithField(records, 'assetIds'),
      mediaIdentifiers: mediaIdentifierSummary(byType),
    },
    savedViews: savedViewSnapshot(byType),
    smartScopes: {
      count: scopeRows.length,
      executable: scopeRows.filter((scope) => scope.executable).length,
      scopes: scopeRows,
    },
    reports: reportInputSignatures(byType),
    charts: chartInputSignatures(byType, ctx, startPerson),
  });
}

export function validateParitySnapshot(actual, expected) {
  const normalizedActual = JSON.stringify(sortObjectKeys(actual), null, 2);
  const normalizedExpected = JSON.stringify(sortObjectKeys(expected), null, 2);
  if (normalizedActual === normalizedExpected) return { ok: true, diffs: [] };

  const diffs = [];
  compareValues(actual, expected, '', diffs);
  return { ok: false, diffs };
}

function groupByType(records) {
  const out = {};
  for (const record of records) {
    if (!out[record.recordType]) out[record.recordType] = [];
    out[record.recordType].push(record);
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.recordName.localeCompare(b.recordName));
  return out;
}

function buildDatasetContext(byType) {
  const personsById = new Map((byType.Person || []).map((person) => [person.recordName, person]));
  const familiesById = new Map((byType.Family || []).map((family) => [family.recordName, family]));
  const labelsById = new Map((byType.Label || []).map((label) => [label.recordName, label]));
  const coordinatesById = new Map((byType.Coordinate || []).map((coord) => [coord.recordName, coord]));
  const childrenByFamily = new Map();
  const parentFamilyByChild = new Map();
  const mediaTargetIds = new Set();
  const sourceAssignedIds = new Set();
  const todoAssignedIds = new Set();
  const eventPlaceIds = new Set();
  const labelTargetsByUniqueID = new Map();
  const labelTargetsByName = new Map();
  const placeCoordinateIds = new Set();
  const coordinateValueIds = new Set();

  for (const rel of byType.ChildRelation || []) {
    const family = readRef(rel.fields?.family);
    const child = readRef(rel.fields?.child);
    if (family) childrenByFamily.set(family, (childrenByFamily.get(family) || 0) + 1);
    if (child && family) addToSetMap(parentFamilyByChild, child, family);
  }
  for (const rel of byType.MediaRelation || []) {
    const target = readRef(rel.fields?.target) || readRef(rel.fields?.baseObject);
    if (target) mediaTargetIds.add(target);
  }
  for (const rel of byType.SourceRelation || []) {
    const source = readRef(rel.fields?.source);
    if (source) sourceAssignedIds.add(source);
  }
  for (const rel of byType.ToDoRelation || []) {
    const todo = readRef(rel.fields?.todo);
    if (todo) todoAssignedIds.add(todo);
  }
  for (const event of [...(byType.PersonEvent || []), ...(byType.FamilyEvent || [])]) {
    const place = readRef(event.fields?.place) || readRef(event.fields?.assignedPlace);
    if (place) eventPlaceIds.add(place);
  }
  for (const coord of byType.Coordinate || []) {
    if (hasCoordinateValues(coord)) coordinateValueIds.add(coord.recordName);
    const place = readRef(coord.fields?.place);
    if (place && hasCoordinateValues(coord)) placeCoordinateIds.add(place);
  }
  for (const rel of byType.LabelRelation || []) {
    const labelId = readRef(rel.fields?.label);
    const target = readRef(rel.fields?.target) || readRef(rel.fields?.baseObject);
    const label = labelsById.get(labelId);
    const uniqueID = readField(label, ['uniqueID']);
    const name = String(readField(label, ['name', 'title'], '')).toLowerCase();
    addToSetMap(labelTargetsByUniqueID, uniqueID, target);
    addToSetMap(labelTargetsByName, name, target);
  }

  return {
    personsById,
    familiesById,
    labelsById,
    coordinatesById,
    childrenByFamily,
    parentFamilyByChild,
    mediaTargetIds,
    sourceAssignedIds,
    todoAssignedIds,
    eventPlaceIds,
    labelTargetsByUniqueID,
    labelTargetsByName,
    placeCoordinateIds,
    coordinateValueIds,
    byType,
  };
}

function scopeSnapshot(scope, ctx) {
  const decoded = parseDecoded(scope.fields?.archivedFiltersDecoded?.value);
  const summary = decoded?.summary || {};
  const identifier = summary.identifier || readField(scope, ['uniqueID']) || scope.recordName;
  const evaluator = scopeEvaluator(identifier);
  const entityType = readField(scope, ['scopeEntity']) || summary.entityName || 'Unknown';
  const candidateRecords = ctx.byType[entityType] || [];
  return {
    recordName: scope.recordName,
    name: readField(scope, ['scopeName', 'name'], scope.recordName),
    entityType,
    identifier,
    decodedStatus: decoded?.status || 'missing',
    filterCount: summary.filterCount || 0,
    executable: Boolean(evaluator),
    resultCount: evaluator ? candidateRecords.filter((record) => evaluator(record, ctx, summary)).length : null,
  };
}

function scopeEvaluator(identifier) {
  const map = {
    StandardScope_Sources_AtLeastOneMedia: (r, ctx) => ctx.mediaTargetIds.has(r.recordName),
    StandardScope_ToDos_AtLeastOneAssignedEntry: (r, ctx) => ctx.todoAssignedIds.has(r.recordName),
    StandardScope_Families_NumberOfChildren: (r, ctx, summary) => compareNumber(ctx.childrenByFamily.get(r.recordName) || 0, selectedNumber(summary, 1), selectedOperator(summary, 'equalKey')),
    StandardScope_ToDos_FurtherResearch: (r) => hasToken(r, ['type', 'title', 'description', 'text'], 'research'),
    StandardScope_Places_WithoutCoordinates: (r, ctx) => !hasAnyCoordinates(r, ctx),
    StandardScope_ToDos_FurtherResearchAndPriorityHigh: (r) => hasToken(r, ['type', 'title', 'description', 'text'], 'research') && hasToken(r, ['priority', 'title', 'description', 'text'], 'high'),
    StandardScope_Persons_HasPictures: (r, ctx) => Boolean(r.fields?.thumbnailFileIdentifier?.value) || ctx.mediaTargetIds.has(r.recordName),
    StandardScope_Families_Label: (r, ctx, summary) => labelMatch(r, ctx, summary),
    StandardScope_Sources_AtLeastOneAssignedEntry: (r, ctx) => ctx.sourceAssignedIds.has(r.recordName),
    StandardScope_Sources_Label: (r, ctx, summary) => labelMatch(r, ctx, summary),
    StandardScope_Places_AtLeastOneEvent: (r, ctx) => ctx.eventPlaceIds.has(r.recordName),
    StandardScope_Persons_Labels: (r, ctx, summary) => labelMatch(r, ctx, summary),
    StandardScope_Persons_FamilySearch: (r) => Boolean(readField(r, ['familySearchID', 'familySearchId'])),
    StandardScope_Places_Label: (r, ctx, summary) => labelMatch(r, ctx, summary),
    StandardScope_Families_MarriageDate: (r, _ctx, summary) => compareDate(readField(r, ['cached_marriageDate', 'marriageDate']), selectedValue(summary), selectedOperator(summary, 'beforeKey')),
    StandardScope_Persons_Ancestors: (r, ctx, summary) => ancestorIdsForScope(ctx, selectedValue(summary, 'P1')).has(r.recordName),
    StandardScope_Persons_IsLiving: (r) => !readField(r, ['cached_deathDate', 'deathDate']),
  };
  return map[identifier] || null;
}

function savedViewSnapshot(byType) {
  const out = [];
  for (const type of ['SavedView', 'SavedBook', 'SavedChart', 'SavedReport', 'SavedWebsite']) {
    for (const record of byType[type] || []) {
      out.push({
        recordName: record.recordName,
        recordType: record.recordType,
        title: readField(record, ['title', 'name'], ''),
        author: readField(record, ['author'], ''),
        hasBookData: Boolean(readField(record, ['bookData'])),
        bookStatus: decodedStatus(record.fields?.bookDataDecoded?.value),
        hasChartData: Boolean(readField(record, ['chartObjectsContainerData'])),
        chartStatus: decodedStatus(record.fields?.chartObjectsContainerDataDecoded?.value),
        hasReportData: Boolean(readField(record, ['reportNodesContainerData'])),
        reportStatus: decodedStatus(record.fields?.reportNodesContainerDataDecoded?.value),
        hasThumbnail: Boolean(readField(record, ['thumbnailData', 'chartThumbnailData', 'reportThumbnailData', 'websiteThumbnailData'])),
      });
    }
  }
  return out.sort((a, b) => a.recordType.localeCompare(b.recordType) || a.recordName.localeCompare(b.recordName));
}

function mediaIdentifierSummary(byType) {
  const mediaTypes = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];
  const out = {};
  for (const type of mediaTypes) {
    const records = byType[type] || [];
    out[type] = {
      records: records.length,
      withFileIdentifier: records.filter((record) => (
        readField(record, ['audioFileIdentifier', 'pdfFileIdentifier', 'originalPictureFileIdentifier', 'pictureFileIdentifier', 'thumbnailFileIdentifier', 'videoFileIdentifier'])
      )).length,
      withAssetIds: records.filter((record) => Array.isArray(readField(record, ['assetIds'])) && readField(record, ['assetIds']).length > 0).length,
    };
  }
  return out;
}

function reportInputSignatures(byType) {
  const personEvents = byType.PersonEvent || [];
  const familyEvents = byType.FamilyEvent || [];
  const facts = byType.PersonFact || [];
  const marriageEvents = familyEvents.filter((event) => /marriage/i.test(readConclusionType(event) || readField(event, ['eventType', 'conclusionType'], '')));
  const today = new Date();
  const todayKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return {
    personsListRows: (byType.Person || []).length,
    placesListRows: (byType.Place || []).length,
    sourcesListRows: (byType.Source || []).length,
    eventsListRows: personEvents.length + familyEvents.length,
    factsListRows: facts.length,
    marriageListRows: marriageEvents.length,
    todoListRows: (byType.ToDo || []).length,
    mediaGalleryRows: ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'].reduce((total, type) => total + (byType[type]?.length || 0), 0),
    changesListRows: (byType.ChangeLogEntry || []).length,
    todayRows: anniversaryRows(byType.Person || [], todayKey),
    mapRows: [...personEvents, ...familyEvents].filter((event) => readRef(event.fields?.place) || readRef(event.fields?.assignedPlace)).length,
    statusRows: {
      personsWithoutBirth: (byType.Person || []).filter((person) => !readField(person, ['cached_birthDate', 'birthDate'])).length,
      personsWithoutDeath: (byType.Person || []).filter((person) => !readField(person, ['cached_deathDate', 'deathDate'])).length,
      placesWithoutCoordinates: (byType.Place || []).filter((place) => !readField(place, ['coordinate', 'latitude'])).length,
    },
  };
}

function chartInputSignatures(byType, ctx, startPerson) {
  return {
    chartTypes: PARITY_CHART_TYPES,
    startPerson: startPerson ? {
      recordName: startPerson.recordName,
      uniqueID: readField(startPerson, ['uniqueID'], ''),
      name: readField(startPerson, ['cached_fullName', 'firstName', 'lastName'], ''),
    } : null,
    ancestorNodes5: startPerson ? collectAncestorIds(startPerson.recordName, ctx, 5).size : 0,
    descendantNodes4: startPerson ? collectDescendantIds(startPerson.recordName, ctx, 4).size : 0,
    peopleWithTimelineDates: (byType.Person || []).filter((person) => readField(person, ['cached_birthDate', 'cached_deathDate'])).length,
  };
}

function findStartPerson(persons) {
  return persons.find((person) => readField(person, ['isStartPerson'])) || persons[0] || null;
}

function collectAncestorIds(recordName, ctx, maxDepth) {
  const out = new Set();
  function visit(id, depth) {
    if (!id || depth > maxDepth || out.has(id)) return;
    out.add(id);
    for (const familyId of ctx.parentFamilyByChild.get(id) || []) {
      const family = ctx.familiesById.get(familyId);
      visit(readRef(family?.fields?.man), depth + 1);
      visit(readRef(family?.fields?.woman), depth + 1);
    }
  }
  visit(recordName, 0);
  return out;
}

function collectDescendantIds(recordName, ctx, maxDepth) {
  const out = new Set();
  function visit(id, depth) {
    if (!id || depth > maxDepth || out.has(id)) return;
    out.add(id);
    for (const family of ctx.familiesById.values()) {
      const man = readRef(family.fields?.man);
      const woman = readRef(family.fields?.woman);
      if (man !== id && woman !== id) continue;
      for (const childRel of ctx.byType.ChildRelation || []) {
        if (readRef(childRel.fields?.family) === family.recordName) visit(readRef(childRel.fields?.child), depth + 1);
      }
    }
  }
  visit(recordName, 0);
  return out;
}

function ancestorIdsForScope(ctx, uniqueID) {
  if (!uniqueID) return new Set();
  const root = [...ctx.personsById.values()].find((person) => readField(person, ['uniqueID']) === uniqueID);
  return root ? collectAncestorIds(root.recordName, ctx, 99) : new Set();
}

function selectedFilter(summary) {
  return summary?.filters?.find((filter) => filter.selectionDictionary && filter.kind !== 'compound') || null;
}

function selectedValue(summary, key = 'A1') {
  return selectedFilter(summary)?.selectionDictionary?.[key] ?? null;
}

function selectedNumber(summary, fallback) {
  const value = Number(selectedValue(summary));
  return Number.isFinite(value) ? value : fallback;
}

function selectedOperator(summary, fallback) {
  const dict = selectedFilter(summary)?.selectionDictionary || {};
  return dict.NUMBERCOMPARISONOPERATOR || dict.DATECOMPARISONOPERATOR || dict.HASORHASNOTLABELCOMPARISONOPERATOR || fallback;
}

function compareNumber(value, target, op) {
  if (op === 'greaterThanKey') return value > target;
  if (op === 'lessThanKey') return value < target;
  if (op === 'notEqualKey') return value !== target;
  return value === target;
}

function compareDate(raw, target, op) {
  const valueYear = parseYear(raw);
  const targetYear = parseYear(target);
  if (valueYear == null || targetYear == null) return false;
  if (op === 'beforeKey') return valueYear < targetYear;
  if (op === 'afterKey') return valueYear > targetYear;
  if (op === 'notEqualKey') return valueYear !== targetYear;
  return valueYear === targetYear;
}

function labelMatch(record, ctx, summary) {
  const targetLabel = selectedValue(summary);
  if (targetLabel && ctx.labelTargetsByUniqueID.get(targetLabel)?.has(record.recordName)) return true;
  return ctx.labelTargetsByName.get('incomplete')?.has(record.recordName) || false;
}

function hasAnyCoordinates(record, ctx) {
  const coordinateRef = readRef(record.fields?.coordinate);
  return (
    hasCoordinateValues(record) ||
    (coordinateRef && ctx.coordinateValueIds.has(coordinateRef)) ||
    ctx.placeCoordinateIds.has(record.recordName)
  );
}

function hasCoordinateValues(record) {
  return hasCoordValue(record?.fields?.latitude?.value) && hasCoordValue(record?.fields?.longitude?.value);
}

function hasCoordValue(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return Number.isFinite(Number.parseFloat(value));
}

function hasToken(record, fields, token) {
  const needle = String(token).toLowerCase();
  return fields.some((field) => String(readField(record, [field], '')).toLowerCase().includes(needle));
}

function parseYear(s) {
  const m = String(s || '').match(/(\d{4})/);
  return m ? Number.parseInt(m[1], 10) : null;
}

function anniversaryRows(persons, monthDay) {
  return persons.filter((person) => [readField(person, ['cached_birthDate']), readField(person, ['cached_deathDate'])].some((value) => dateMonthDay(value) === monthDay)).length;
}

function dateMonthDay(value) {
  const match = String(value || '').match(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  return match ? `${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}` : '';
}

function decodedStatus(value) {
  return parseDecoded(value)?.status || null;
}

function parseDecoded(value) {
  if (!value) return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function countRecordsWithField(records, fieldName) {
  return records.filter((record) => readField(record, [fieldName]) != null).length;
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return sortObjectKeys(out);
}

function addToSetMap(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== 'object' || value instanceof Set || value instanceof Map) return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = sortObjectKeys(value[key]);
  return out;
}

function compareValues(actual, expected, path, diffs) {
  if (diffs.length >= 50) return;
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object') {
    diffs.push({ path: path || '$', expected, actual });
    return;
  }
  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  for (const key of [...keys].sort()) {
    compareValues(actual[key], expected[key], `${path}/${key}`, diffs);
  }
}
