/**
 * citationLinks — attach a Source to any citable conclusion from anywhere in the
 * interface (the "Unsourced" badge / source-picker modal).
 *
 * This mirrors the lineage-tracked SourceRelation creation in
 * `SourceCitationsEditor.addRelation` so a citation can be added inline (from a
 * fact/event row) without opening the full Source Citations editor, while still
 * recording the same change-log + lineage trail.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { writeRef, readRef } from './schema.js';
import { generateId } from './ids.js';
import { logRecordCreated } from './changeLog.js';
import {
  applySourceRelationLineageFields,
  createLineageBatch,
  recordLineageEvent,
} from './sourceLineage.js';

/**
 * Create a lineage-tracked SourceRelation linking `sourceId` (a Source record)
 * to `targetId` (the cited conclusion — Person, PersonFact, PersonEvent, …).
 * Returns the saved SourceRelation record, or null on invalid input.
 */
export async function attachSourceRelation({ sourceId, targetId, targetType }) {
  if (!sourceId || !targetId || !targetType) return null;
  const db = getLocalDatabase();
  const rec = {
    recordName: generateId('sr'),
    recordType: 'SourceRelation',
    fields: {
      source: writeRef(sourceId, 'Source'),
      target: writeRef(targetId, targetType),
      targetType: { value: targetType, type: 'STRING' },
    },
  };
  const batch = await createLineageBatch({
    kind: 'manualEdit',
    sourceName: 'Source citation edit',
    summary: 'Manual source citation attach',
  });
  const created = await recordLineageEvent({
    eventType: 'created',
    operation: 'manualEdit',
    sourceRelation: rec,
    source: sourceId,
    target: targetId,
    targetType,
    lineageBatch: batch.recordName,
    details: 'Source citation attached from the Unsourced badge.',
  });
  const next = applySourceRelationLineageFields(rec, {
    lineageBatch: batch.recordName,
    operation: 'manualEdit',
    sourceRecord: sourceId,
    targetRecord: targetId,
    createdByEvent: created.recordName,
  });
  await db.saveRecord(next);
  await logRecordCreated(next, {
    lineage: { lineageBatch: batch.recordName, operation: 'manualEdit', lineageEvent: created.recordName },
  });
  return next;
}

/** Create a minimal Source record (title only) and return it. */
export async function createQuickSource(title) {
  const clean = String(title || '').trim();
  if (!clean) return null;
  const db = getLocalDatabase();
  const rec = {
    recordName: generateId('src'),
    recordType: 'Source',
    fields: {
      title: { value: clean, type: 'STRING' },
      cached_title: { value: clean, type: 'STRING' },
    },
  };
  await db.saveRecord(rec);
  await logRecordCreated(rec);
  return rec;
}

/** Set of Source record-names already cited for a given target conclusion. */
export async function attachedSourceIdsForTarget(targetRecordName) {
  if (!targetRecordName) return new Set();
  const db = getLocalDatabase();
  const rows = await db.query('SourceRelation', { referenceField: 'target', referenceValue: targetRecordName, limit: 100000 });
  return new Set(rows.records.map((rel) => readRef(rel.fields?.source)).filter(Boolean));
}
