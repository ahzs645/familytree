/**
 * Bulk operations shared by the list routes — assign a label to many records,
 * delete many records with change-log entries, and resolve which LabelRelation
 * target field a record type uses.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { generateId } from './ids.js';
import { logRecordCreated, logRecordDeleted } from './changeLog.js';
import { toCssHexColor } from './labelColors.js';
import { refToRecordName, refValue } from './recordRef.js';

// MFT stores typed target refs for the four classic label targets and a
// generic `target` ref for everything else (ToDos, media, ...). Labels.jsx
// resolves either shape when listing assignments.
const LABEL_TARGET_FIELDS = {
  Person: 'targetPerson',
  Family: 'targetFamily',
  Place: 'targetPlace',
  Source: 'targetSource',
};

export function labelTargetField(recordType) {
  return LABEL_TARGET_FIELDS[recordType] || 'target';
}

export async function listLabels() {
  const db = getLocalDatabase();
  const { records } = await db.query('Label', { limit: 100000 });
  return records
    .map((record) => ({
      id: record.recordName,
      name: record.fields?.name?.value || record.fields?.title?.value || record.recordName,
      color: toCssHexColor(record.fields?.color?.value) || '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Assign a label to each target record, skipping targets that already carry
 * the label. Returns the number of new assignments created.
 */
export async function assignLabelToRecords(labelId, targetIds, recordType) {
  const db = getLocalDatabase();
  const field = labelTargetField(recordType);
  const { records: relations } = await db.query('LabelRelation', { limit: 100000 });
  const alreadyLabeled = new Set(
    relations
      .filter((rel) => refToRecordName(rel.fields?.label?.value) === labelId)
      .map((rel) => refToRecordName(rel.fields?.[field]?.value) ?? refToRecordName(rel.fields?.target?.value))
      .filter(Boolean)
  );
  let created = 0;
  for (const targetId of targetIds) {
    if (alreadyLabeled.has(targetId)) continue;
    const record = {
      recordName: generateId('lblrel'),
      recordType: 'LabelRelation',
      fields: {
        label: { value: refValue(labelId, 'Label'), type: 'REFERENCE' },
        [field]: { value: refValue(targetId, recordType), type: 'REFERENCE' },
      },
    };
    await db.saveRecord(record);
    await logRecordCreated(record);
    created += 1;
  }
  return created;
}

export async function deleteRecordsWithLog(ids, recordType) {
  const db = getLocalDatabase();
  for (const id of ids) {
    await db.deleteRecord(id);
    await logRecordDeleted(id, recordType);
  }
}
