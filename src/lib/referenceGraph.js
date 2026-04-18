import { readRef, refType, replaceRefValue } from './schema.js';

const RELATION_TYPES = new Set([
  'ChildRelation',
  'LabelRelation',
  'SourceRelation',
  'MediaRelation',
  'ToDoRelation',
  'PersonGroupRelation',
  'StoryRelation',
  'StorySectionRelation',
]);

const KEY_FIELDS = {
  ChildRelation: ['family', 'child'],
  LabelRelation: ['label', 'target', 'targetPerson', 'targetFamily', 'targetPlace', 'targetSource', 'baseObject'],
  SourceRelation: ['source', 'target'],
  MediaRelation: ['media', 'target'],
  ToDoRelation: ['todo', 'target'],
  PersonGroupRelation: ['personGroup', 'person'],
  StoryRelation: ['story', 'target'],
  StorySectionRelation: ['storySection', 'target'],
};

function cloneRecord(record) {
  return {
    ...record,
    fields: { ...(record.fields || {}) },
  };
}

function fieldSig(field) {
  return readRef(field) || field?.value || '';
}

function referenceFieldRecordName(field) {
  if (!field) return null;
  if (field.type === 'REFERENCE') return readRef(field);
  if (field.recordName) return readRef(field);
  if (typeof field === 'string' && field.includes('---')) return readRef(field);
  if (field.value && typeof field.value === 'string' && field.value.includes('---')) return readRef(field);
  return null;
}

function relationKey(record) {
  if (!RELATION_TYPES.has(record.recordType)) return null;
  const fields = KEY_FIELDS[record.recordType] || [];
  const sig = fields
    .map((name) => fieldSig(record.fields?.[name]))
    .filter(Boolean)
    .join('|');
  return sig ? `${record.recordType}:${sig}` : null;
}

function mergeFields(primary, secondary) {
  const fields = { ...(secondary.fields || {}), ...(primary.fields || {}) };
  for (const [key, value] of Object.entries(secondary.fields || {})) {
    const current = fields[key];
    if (
      (current == null || current.value == null || current.value === '') &&
      value != null &&
      value.value != null &&
      value.value !== ''
    ) {
      fields[key] = value;
    }
  }
  return { ...primary, fields };
}

export function planReferenceRewrite(records, fromRecordName, toRecordName, toRecordType) {
  const saveMap = new Map();
  const deleteSet = new Set();
  let rewrittenReferenceCount = 0;
  let preservedRecordCount = 0;

  for (const record of records) {
    if (!record || record.recordName === fromRecordName) continue;
    let next = null;
    for (const [fieldName, field] of Object.entries(record.fields || {})) {
      if (referenceFieldRecordName(field) !== fromRecordName) continue;
      if (!next) next = cloneRecord(record);
      next.fields[fieldName] = replaceRefValue(field, fromRecordName, toRecordName, toRecordType || refType(field));
      rewrittenReferenceCount += 1;
    }
    if (next) {
      preservedRecordCount += 1;
      saveMap.set(next.recordName, next);
    }
  }

  const afterRewrite = records
    .filter((record) => record?.recordName !== fromRecordName)
    .map((record) => saveMap.get(record.recordName) || record);
  const byKey = new Map();
  let dedupedRelationCount = 0;

  for (const record of afterRewrite) {
    const key = relationKey(record);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, record);
      continue;
    }
    const keep = existing.recordName.localeCompare(record.recordName) <= 0 ? existing : record;
    const drop = keep === existing ? record : existing;
    const merged = mergeFields(keep, drop);
    saveMap.set(merged.recordName, merged);
    deleteSet.add(drop.recordName);
    byKey.set(key, merged);
    dedupedRelationCount += 1;
  }

  return {
    saveRecords: [...saveMap.values()],
    deleteRecordNames: [...deleteSet],
    rewrittenReferenceCount,
    preservedRecordCount,
    dedupedRelationCount,
  };
}

export function countReferencesTo(records, recordName) {
  let references = 0;
  let recordsWithReferences = 0;
  for (const record of records) {
    let seen = false;
    for (const field of Object.values(record.fields || {})) {
      if (referenceFieldRecordName(field) === recordName) {
        references += 1;
        seen = true;
      }
    }
    if (seen) recordsWithReferences += 1;
  }
  return { references, recordsWithReferences };
}
