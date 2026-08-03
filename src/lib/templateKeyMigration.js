// @ts-check
import { getAppDataClient } from './data/AppDataClient.js';
import { saveWithChangeLog } from './changeLog.js';
import { deleteWithChangeLog } from './recordWrite.js';
import { readRef } from './schema.js';
import { refValue } from './recordRef.js';

export const TEMPLATE_KEY_MIGRATION_STRATEGIES = Object.freeze({
  PRESERVE: 'preserve',
  MAP: 'map',
  ABANDON: 'abandon',
});

/** @param {string} recordType */
export function templateKeyMigrationConfig(recordType) {
  if (recordType === 'SourceTemplateKey') {
    return { keyType: recordType, valueType: 'SourceKeyValue', relationType: 'SourceTemplateKeyRelation', ownerField: 'source' };
  }
  if (recordType === 'PlaceTemplateKey') {
    return { keyType: recordType, valueType: 'PlaceKeyValue', relationType: 'PlaceTemplateKeyRelation', ownerField: 'place' };
  }
  throw new Error(`Unsupported template key type: ${recordType}`);
}

/**
 * Pure usage summary for UI and tests.
 * @param {Array<any>} valueRecords
 * @param {Array<any>} relationRecords
 * @param {string} ownerField
 */
export function summarizeTemplateKeyUsage(valueRecords = [], relationRecords = [], ownerField = 'source') {
  const owners = new Set(valueRecords.map((record) => readRef(record.fields?.[ownerField])).filter(Boolean));
  const templates = new Set(relationRecords.map((record) => readRef(record.fields?.template)).filter(Boolean));
  return {
    valueCount: valueRecords.length,
    recordCount: owners.size,
    relationCount: relationRecords.length,
    templateCount: templates.size,
    total: valueRecords.length + relationRecords.length,
  };
}

/** @param {string} recordType @param {string} keyId */
export async function loadTemplateKeyUsage(recordType, keyId) {
  const config = templateKeyMigrationConfig(recordType);
  const records = getAppDataClient().records;
  const [values, relations, keys] = await Promise.all([
    records.query(config.valueType, { referenceField: 'templateKey', referenceValue: keyId, limit: 100000 }),
    records.query(config.relationType, { referenceField: 'templateKey', referenceValue: keyId, limit: 100000 }),
    records.query(config.keyType, { limit: 100000 }),
  ]);
  return {
    config,
    values: values.records,
    relations: relations.records,
    keys: /** @type {Array<any>} */ (keys.records).filter((record) => record.recordName !== keyId),
    summary: summarizeTemplateKeyUsage(values.records, relations.records, config.ownerField),
  };
}

/** Preserve both values when two keys already have a value for one owner. @param {unknown} targetValue @param {unknown} sourceValue */
export function mergeTemplateValues(targetValue, sourceValue) {
  const target = String(targetValue || '').trim();
  const source = String(sourceValue || '').trim();
  if (!target) return source;
  if (!source || source === target) return target;
  const parts = target.split('\n').map((part) => part.trim()).filter(Boolean);
  if (!parts.includes(source)) parts.push(source);
  return parts.join('\n');
}

/**
 * Execute a migration through change-logged record helpers.
 * - preserve: save the renamed key; references remain stable, so every linked
 *   record immediately uses the renamed key.
 * - map: retarget values and template relations, merging owner collisions,
 *   then delete the old key.
 * - abandon: delete values and relations, then delete the old key.
 *
 * @param {{ recordType: string, sourceKeyId: string, strategy: string, renamedRecord?: any, targetKeyId?: string }} options
 */
export async function migrateTemplateKey({ recordType, sourceKeyId, strategy, renamedRecord, targetKeyId = '' }) {
  if (strategy === TEMPLATE_KEY_MIGRATION_STRATEGIES.PRESERVE) {
    if (!renamedRecord) throw new Error('A renamed template key record is required.');
    await saveWithChangeLog(renamedRecord, { changeKind: 'Template key rename' });
    return { renamed: 1, mappedValues: 0, mergedValues: 0, mappedRelations: 0, removed: 0 };
  }

  const usage = await loadTemplateKeyUsage(recordType, sourceKeyId);
  if (strategy === TEMPLATE_KEY_MIGRATION_STRATEGIES.ABANDON) {
    for (const record of usage.values) await deleteWithChangeLog(record.recordName, usage.config.valueType);
    for (const record of usage.relations) await deleteWithChangeLog(record.recordName, usage.config.relationType);
    await deleteWithChangeLog(sourceKeyId, recordType);
    return { renamed: 0, mappedValues: 0, mergedValues: 0, mappedRelations: 0, removed: usage.values.length + usage.relations.length + 1 };
  }

  if (strategy !== TEMPLATE_KEY_MIGRATION_STRATEGIES.MAP) throw new Error('Unknown template key migration strategy.');
  if (!targetKeyId || targetKeyId === sourceKeyId) throw new Error('Choose a different target template key.');

  const client = getAppDataClient().records;
  const targetValues = /** @type {Array<any>} */ ((await client.query(usage.config.valueType, { referenceField: 'templateKey', referenceValue: targetKeyId, limit: 100000 })).records);
  const targetRelations = /** @type {Array<any>} */ ((await client.query(usage.config.relationType, { referenceField: 'templateKey', referenceValue: targetKeyId, limit: 100000 })).records);
  const targetValueByOwner = new Map(targetValues.map((record) => [readRef(record.fields?.[usage.config.ownerField]), record]));
  const targetRelationByTemplate = new Map(targetRelations.map((record) => [readRef(record.fields?.template), record]));
  let mappedValues = 0;
  let mergedValues = 0;
  let mappedRelations = 0;

  for (const sourceValue of usage.values) {
    const ownerId = readRef(sourceValue.fields?.[usage.config.ownerField]);
    const existingTarget = targetValueByOwner.get(ownerId);
    if (existingTarget) {
      const merged = mergeTemplateValues(existingTarget.fields?.value?.value, sourceValue.fields?.value?.value);
      let mergedTarget = existingTarget;
      if (merged !== String(existingTarget.fields?.value?.value || '')) {
        mergedTarget = { ...existingTarget, fields: { ...existingTarget.fields, value: { value: merged, type: 'STRING' } } };
        await saveWithChangeLog(mergedTarget, { changeKind: 'Template key migration' });
      }
      await deleteWithChangeLog(sourceValue.recordName, usage.config.valueType);
      targetValueByOwner.set(ownerId, mergedTarget);
      mergedValues += 1;
    } else {
      const mappedValue = {
        ...sourceValue,
        fields: { ...sourceValue.fields, templateKey: { value: refValue(targetKeyId, recordType), type: 'REFERENCE' } },
      };
      await saveWithChangeLog(mappedValue, { changeKind: 'Template key migration' });
      targetValueByOwner.set(ownerId, mappedValue);
      mappedValues += 1;
    }
  }

  for (const sourceRelation of usage.relations) {
    const templateId = readRef(sourceRelation.fields?.template);
    if (targetRelationByTemplate.has(templateId)) {
      await deleteWithChangeLog(sourceRelation.recordName, usage.config.relationType);
    } else {
      await saveWithChangeLog({
        ...sourceRelation,
        fields: { ...sourceRelation.fields, templateKey: { value: refValue(targetKeyId, recordType), type: 'REFERENCE' } },
      }, { changeKind: 'Template key migration' });
      targetRelationByTemplate.set(templateId, sourceRelation);
      mappedRelations += 1;
    }
  }

  await deleteWithChangeLog(sourceKeyId, recordType);
  return { renamed: 0, mappedValues, mergedValues, mappedRelations, removed: 1 };
}
