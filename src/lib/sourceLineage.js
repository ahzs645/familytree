import { getAppDataClient } from './data/AppDataClient.js';
import { readRef, refValue } from './schema.js';

let _seq = 0;

function uuid(prefix) {
  _seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function field(value, type = 'STRING') {
  return { value, type };
}

function ref(recordName, recordType) {
  return recordName ? { value: refValue(recordName, recordType), type: 'REFERENCE' } : undefined;
}

export function createLineageBatchRecord({ kind = 'manualEdit', sourceName = '', summary = '', importMeta = null } = {}) {
  const recordName = uuid('lb');
  return {
    recordName,
    recordType: 'LineageBatch',
    fields: {
      kind: field(kind),
      sourceName: field(sourceName || kind),
      startedAt: field(new Date().toISOString(), 'DATE'),
      summary: field(summary || kind),
      ...(importMeta ? { importMeta: field(JSON.stringify(importMeta), 'JSON') } : {}),
    },
  };
}

export async function createLineageBatch(draft = {}) {
  const db = getAppDataClient().records;
  const record = createLineageBatchRecord(draft);
  await db.save(record);
  return record;
}

export function createLineageEventRecord({
  eventType = 'edited',
  operation = 'manualEdit',
  sourceRelation,
  source,
  target,
  targetType,
  lineageBatch,
  changeLogEntry,
  previousSourceRelation,
  supersedes = [],
  details = '',
  metadata = null,
} = {}) {
  const recordName = uuid('le');
  const sourceRelationId = typeof sourceRelation === 'string' ? sourceRelation : sourceRelation?.recordName;
  const sourceId = source || readRef(sourceRelation?.fields?.source);
  const targetId = target || readRef(sourceRelation?.fields?.target);
  const resolvedTargetType = targetType || sourceRelation?.fields?.targetType?.value || '';
  return {
    recordName,
    recordType: 'LineageEvent',
    fields: {
      eventType: field(eventType),
      operation: field(operation),
      timestamp: field(new Date().toISOString(), 'DATE'),
      ...(sourceRelationId ? { sourceRelation: ref(sourceRelationId, 'SourceRelation') } : {}),
      ...(sourceId ? { source: ref(sourceId, 'Source') } : {}),
      ...(targetId ? { target: ref(targetId, resolvedTargetType) } : {}),
      ...(resolvedTargetType ? { targetType: field(resolvedTargetType) } : {}),
      ...(lineageBatch ? { lineageBatch: ref(lineageBatch, 'LineageBatch') } : {}),
      ...(changeLogEntry ? { changeLogEntry: ref(changeLogEntry, 'ChangeLogEntry') } : {}),
      ...(previousSourceRelation ? { previousSourceRelation: ref(previousSourceRelation, 'SourceRelation') } : {}),
      ...(supersedes?.length ? { supersedes: field(supersedes, 'LIST') } : {}),
      ...(details ? { details: field(details) } : {}),
      ...(metadata ? { metadata: field(JSON.stringify(metadata), 'JSON') } : {}),
    },
  };
}

export async function recordLineageEvent(eventDraft = {}) {
  const db = getAppDataClient().records;
  const event = createLineageEventRecord(eventDraft);
  await db.save(event);
  return event;
}

export function applySourceRelationLineageFields(record, {
  lineageBatch,
  operation = 'manualEdit',
  sourceRecord,
  targetRecord,
  createdByEvent,
  updatedByEvent,
  supersedes = [],
} = {}) {
  const next = { ...record, fields: { ...(record.fields || {}) } };
  const sourceId = sourceRecord || readRef(next.fields.source);
  const targetId = targetRecord || readRef(next.fields.target);
  if (lineageBatch) next.fields.lineageBatch = ref(lineageBatch, 'LineageBatch');
  if (operation) next.fields.lineageOperation = field(operation);
  if (sourceId) next.fields.lineageSourceRecord = field(sourceId);
  if (targetId) next.fields.lineageTargetRecord = field(targetId);
  if (createdByEvent) next.fields.lineageCreatedByEvent = ref(createdByEvent, 'LineageEvent');
  if (updatedByEvent) next.fields.lineageUpdatedByEvent = ref(updatedByEvent, 'LineageEvent');
  if (supersedes?.length) next.fields.lineageSupersedes = field(supersedes, 'LIST');
  return next;
}

async function getEventsForRelation(db, sourceRelationId) {
  if (!sourceRelationId) return [];
  const [direct, previous] = await Promise.all([
    db.query('LineageEvent', { referenceField: 'sourceRelation', referenceValue: sourceRelationId, limit: 100000 }),
    db.query('LineageEvent', { referenceField: 'previousSourceRelation', referenceValue: sourceRelationId, limit: 100000 }),
  ]);
  return [...direct.records, ...previous.records].sort((a, b) => (
    String(a.fields?.timestamp?.value || '').localeCompare(String(b.fields?.timestamp?.value || ''))
  ));
}

async function hydrateRelation(db, relation) {
  if (!relation) return null;
  const sourceId = readRef(relation.fields?.source);
  const targetId = readRef(relation.fields?.target);
  const [source, target, events] = await Promise.all([
    sourceId ? db.get(sourceId) : null,
    targetId ? db.get(targetId) : null,
    getEventsForRelation(db, relation.recordName),
  ]);
  const batchId = readRef(relation.fields?.lineageBatch) || readRef(events.at(-1)?.fields?.lineageBatch);
  const batch = batchId ? await db.get(batchId) : null;
  return { relation, source, target, events, batch };
}

export async function getCitationLineage(sourceRelationId) {
  const db = getAppDataClient().records;
  const relation = await db.get(sourceRelationId);
  return hydrateRelation(db, relation);
}
