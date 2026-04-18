import { getLocalDatabase } from './LocalDatabase.js';
import { SEARCH_FIELDS, runSearch } from './search.js';
import { refValue } from './recordRef.js';

let seq = 0;

function uuid(prefix) {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fieldDefinition(entityType, fieldName) {
  return (SEARCH_FIELDS[entityType] || []).find((field) => field.id === fieldName) || null;
}

function resolveExistingField(record, def) {
  const names = [def.id, ...(def.aliases || [])];
  for (const name of names) {
    const field = record.fields?.[name];
    if (field && field.value !== undefined && field.value !== null) return { name, field };
  }
  return null;
}

function replaceString(current, findText, replacementText, { matchCase = false, wholeField = false } = {}) {
  const source = String(current ?? '');
  const find = String(findText ?? '');
  if (!find) return null;

  if (wholeField) {
    const matches = matchCase ? source === find : source.toLowerCase() === find.toLowerCase();
    return matches && source !== replacementText ? String(replacementText ?? '') : null;
  }

  const flags = matchCase ? 'g' : 'gi';
  const next = source.replace(new RegExp(escapeRegex(find), flags), String(replacementText ?? ''));
  return next !== source ? next : null;
}

export function replaceableFields(entityType) {
  return (SEARCH_FIELDS[entityType] || []).filter((field) => field.type !== 'presence');
}

export async function previewSearchReplace(params) {
  const {
    entityType,
    fieldName,
    findText,
    replacementText = '',
    matchCase = false,
    wholeField = false,
    filters = [],
    textQuery = '',
    limit = 100000,
  } = params;
  const def = fieldDefinition(entityType, fieldName);
  if (!def) throw new Error('Choose a field to replace.');
  if (!findText) throw new Error('Enter text to find.');

  const searchResult = await runSearch({ entityType, filters, textQuery, limit });
  const changes = [];
  for (const record of searchResult.records) {
    const resolved = resolveExistingField(record, def);
    if (!resolved) continue;
    const before = resolved.field.value;
    if (before == null || typeof before === 'object') continue;
    const after = replaceString(before, findText, replacementText, { matchCase, wholeField });
    if (after == null) continue;
    changes.push({
      recordName: record.recordName,
      recordType: record.recordType,
      fieldName: resolved.name,
      label: record.fields?.cached_fullName?.value || record.fields?.title?.value || record.fields?.name?.value || record.recordName,
      before,
      after,
    });
  }

  return {
    params: { entityType, fieldName, findText, replacementText, matchCase, wholeField, filters, textQuery },
    searched: searchResult.total,
    total: changes.length,
    changes,
  };
}

export async function applySearchReplace(params) {
  const preview = params?.changes ? params : await previewSearchReplace(params);
  if (!preview.changes?.length) return { changed: 0 };

  const db = getLocalDatabase();
  const savedRecords = [];
  const undoRecords = [];
  const logRecords = [];
  const nowIso = new Date().toISOString();

  for (const change of preview.changes) {
    const record = await db.getRecord(change.recordName);
    if (!record?.fields?.[change.fieldName]) continue;
    undoRecords.push(structuredCloneSafe(record));
    const next = structuredCloneSafe(record);
    next.fields[change.fieldName] = {
      ...next.fields[change.fieldName],
      value: change.after,
    };
    savedRecords.push(next);
    logRecords.push(...buildChangeLogRecords(next, change, nowIso, 'Search Replace'));
  }

  await db.applyRecordTransaction({ saveRecords: [...savedRecords, ...logRecords] });
  await db.setMeta('lastSearchReplaceUndo', {
    appliedAt: Date.now(),
    params: preview.params,
    records: undoRecords,
  });
  return { changed: savedRecords.length };
}

export async function undoLastSearchReplace() {
  const db = getLocalDatabase();
  const snapshot = await db.getMeta('lastSearchReplaceUndo');
  if (!snapshot?.records?.length) throw new Error('No Search and Replace operation is available to undo.');
  const logRecords = [];
  const nowIso = new Date().toISOString();
  for (const record of snapshot.records) {
    logRecords.push(...buildUndoLogRecords(record, nowIso));
  }
  await db.applyRecordTransaction({ saveRecords: [...snapshot.records, ...logRecords] });
  await db.setMeta('lastSearchReplaceUndo', null);
  return { restored: snapshot.records.length };
}

function buildChangeLogRecords(record, change, nowIso, changeType) {
  const entryName = uuid('cle');
  const subName = uuid('cls');
  return [
    {
      recordName: entryName,
      recordType: 'ChangeLogEntry',
      fields: {
        target: { value: refValue(record.recordName, record.recordType), type: 'REFERENCE' },
        targetType: { value: record.recordType },
        timestamp: { value: nowIso },
        author: { value: 'Search and Replace' },
        changeType: { value: changeType },
        changeCount: { value: 1 },
        summary: { value: `${change.fieldName}: ${stringify(change.before)} -> ${stringify(change.after)}` },
      },
    },
    {
      recordName: subName,
      recordType: 'ChangeLogSubEntry',
      fields: {
        changeLogEntry: { value: refValue(entryName, 'ChangeLogEntry'), type: 'REFERENCE' },
        fieldName: { value: change.fieldName },
        oldValue: { value: stringify(change.before) },
        newValue: { value: stringify(change.after) },
      },
    },
  ];
}

function buildUndoLogRecords(record, nowIso) {
  const entryName = uuid('cle');
  return [
    {
      recordName: entryName,
      recordType: 'ChangeLogEntry',
      fields: {
        target: { value: refValue(record.recordName, record.recordType), type: 'REFERENCE' },
        targetType: { value: record.recordType },
        timestamp: { value: nowIso },
        author: { value: 'Search and Replace' },
        changeType: { value: 'Undo Search Replace' },
        changeCount: { value: 1 },
        summary: { value: 'Restored previous field values' },
      },
    },
  ];
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function stringify(value) {
  if (value == null) return '';
  return String(value).slice(0, 120);
}
