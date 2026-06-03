import { getLocalDatabase } from './LocalDatabase.js';
import { readField, readRef } from './schema.js';
import { refToRecordName } from './recordRef.js';
import { personDisplayName, yearOf } from './familyGraph.js';
import { generateId } from './ids.js';

const META_KEY = 'customValidationSchemas';

function uuid(prefix) {
  return generateId(prefix);
}

export async function listCustomValidationSchemas() {
  const db = getLocalDatabase();
  const list = await db.getMeta(META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveCustomValidationSchema(schema) {
  const db = getLocalDatabase();
  const list = await listCustomValidationSchemas();
  const stamped = normalizeSchema({ ...schema, id: schema.id || uuid('rule') });
  const index = list.findIndex((item) => item.id === stamped.id);
  if (index >= 0) list[index] = stamped;
  else list.push(stamped);
  await db.setMeta(META_KEY, list);
  return stamped;
}

export async function deleteCustomValidationSchema(id) {
  const db = getLocalDatabase();
  const list = await listCustomValidationSchemas();
  await db.setMeta(META_KEY, list.filter((item) => item.id !== id));
}

export async function runCustomValidationSchemas() {
  const db = getLocalDatabase();
  const schemas = (await listCustomValidationSchemas()).map(normalizeSchema).filter((schema) => schema.enabled !== false);
  const [{ records: persons }, { records: groups }, { records: groupRelations }, { records: places }] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('PersonGroup', { limit: 100000 }),
    db.query('PersonGroupRelation', { limit: 100000 }),
    db.query('Place', { limit: 100000 }),
  ]);
  const groupNameToId = new Map(groups.map((group) => [String(readField(group, ['name', 'title'], group.recordName)).toLowerCase(), group.recordName]));
  const personGroups = new Map();
  for (const rel of groupRelations) {
    const personId = refToRecordName(rel.fields?.person?.value);
    const groupId = refToRecordName(rel.fields?.personGroup?.value);
    if (!personId || !groupId) continue;
    if (!personGroups.has(personId)) personGroups.set(personId, new Set());
    personGroups.get(personId).add(groupId);
  }
  const recordsById = new Map([...persons, ...groups, ...places].map((record) => [record.recordName, record]));
  const issues = [];
  for (const schema of schemas) {
    const scoped = persons.filter((person) => appliesTo(schema, person, personGroups, groupNameToId));
    for (const person of scoped) {
      issues.push(...validatePerson(schema, person, recordsById));
    }
  }
  return issues;
}

export function normalizeSchema(schema = {}) {
  return {
    id: schema.id || uuid('rule'),
    name: schema.name || 'Custom Rule',
    enabled: schema.enabled !== false,
    severity: ['high', 'medium', 'low'].includes(schema.severity) ? schema.severity : 'medium',
    scopeType: ['all', 'group', 'field'].includes(schema.scopeType) ? schema.scopeType : 'all',
    scopeValue: schema.scopeValue || '',
    requiredFields: Array.isArray(schema.requiredFields) ? schema.requiredFields : [],
    properties: schema.properties && typeof schema.properties === 'object' ? schema.properties : {},
    constraints: Array.isArray(schema.constraints) ? schema.constraints : [],
    updatedAt: Date.now(),
  };
}

function appliesTo(schema, person, personGroups, groupNameToId) {
  if (schema.scopeType === 'all') return true;
  if (schema.scopeType === 'group') {
    const wanted = groupNameToId.get(String(schema.scopeValue || '').toLowerCase()) || schema.scopeValue;
    return personGroups.get(person.recordName)?.has(wanted);
  }
  if (schema.scopeType === 'field') {
    const [fieldName, expected] = String(schema.scopeValue || '').split('=').map((part) => part.trim());
    if (!fieldName) return false;
    const value = readField(person, fieldName, '');
    return expected ? String(value) === expected : value !== '';
  }
  return true;
}

function validatePerson(schema, person, recordsById) {
  const issues = [];
  const name = personDisplayName(person);
  const push = (message, rule) => issues.push({
    severity: schema.severity,
    schemaId: schema.id,
    schemaName: schema.name,
    rule,
    recordType: 'Person',
    recordName: person.recordName,
    message: `${name}: ${message}`,
  });

  for (const fieldName of schema.requiredFields) {
    if (readField(person, fieldName, '') === '') push(`missing required field "${fieldName}"`, `required:${fieldName}`);
  }

  for (const [fieldName, config] of Object.entries(schema.properties || {})) {
    const value = readField(person, fieldName, undefined);
    if ((value === undefined || value === null || value === '') && !config?.required) continue;
    if (config?.required && (value === undefined || value === null || value === '')) {
      push(`missing required field "${fieldName}"`, `property:${fieldName}:required`);
      continue;
    }
    const typeIssue = validateType(fieldName, value, config, recordsById);
    if (typeIssue) push(typeIssue, `property:${fieldName}:${config.type || 'value'}`);
  }

  for (const constraint of schema.constraints || []) {
    const issue = validateConstraint(person, constraint);
    if (issue) push(issue, `constraint:${constraint.type || constraint.rule || 'custom'}`);
  }
  return issues;
}

function validateType(fieldName, value, config = {}, recordsById) {
  const type = config.type || 'string';
  if (type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return `"${fieldName}" must be a number`;
    if (config.min != null && n < Number(config.min)) return `"${fieldName}" must be at least ${config.min}`;
    if (config.max != null && n > Number(config.max)) return `"${fieldName}" must be at most ${config.max}`;
  }
  if (type === 'date' && yearOf(value) == null) return `"${fieldName}" must contain a year`;
  if (type === 'boolean' && typeof value !== 'boolean') return `"${fieldName}" must be true or false`;
  if (type === 'enum') {
    const values = Array.isArray(config.values) ? config.values.map(String) : [];
    if (values.length && !values.includes(String(value))) return `"${fieldName}" must be one of ${values.join(', ')}`;
  }
  if (type === 'wikilink' || type === 'reference') {
    const id = readRef(value);
    if (!id || !recordsById.has(id)) return `"${fieldName}" references a missing record`;
    if (config.targetType && recordsById.get(id)?.recordType !== config.targetType) return `"${fieldName}" must reference ${config.targetType}`;
  }
  return null;
}

function validateConstraint(person, constraint = {}) {
  const type = constraint.type || constraint.rule;
  if (type === 'after') {
    const left = yearOf(readField(person, constraint.field, ''));
    const right = yearOf(readField(person, constraint.afterField, ''));
    if (left != null && right != null && left < right) return `"${constraint.field}" must be after "${constraint.afterField}"`;
  }
  if (type === 'before') {
    const left = yearOf(readField(person, constraint.field, ''));
    const right = yearOf(readField(person, constraint.beforeField, ''));
    if (left != null && right != null && left > right) return `"${constraint.field}" must be before "${constraint.beforeField}"`;
  }
  if (type === 'requiresWhenPresent') {
    const trigger = readField(person, constraint.field, '');
    const required = readField(person, constraint.requiredField, '');
    if (trigger !== '' && required === '') return `"${constraint.requiredField}" is required when "${constraint.field}" is present`;
  }
  return null;
}
