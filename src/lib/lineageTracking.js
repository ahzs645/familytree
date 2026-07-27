import { getAppDataClient } from './data/AppDataClient.js';
import { comparePeopleByBirthThenName, loadFamilyGraph, personDisplayName } from './familyGraph.js';
import { writeRef } from './schema.js';
import { logRecordCreated } from './changeLog.js';
import { generateId } from './ids.js';

const META_KEY = 'lineageDefinitions';

function uuid(prefix) {
  return generateId(prefix);
}

export async function listLineageDefinitions() {
  const list = await getAppDataClient().meta.get(META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function saveLineageDefinition(definition) {
  const list = await listLineageDefinitions();
  const stamped = {
    id: definition.id || uuid('lin'),
    name: definition.name || 'New Lineage',
    rootPersonId: definition.rootPersonId || null,
    type: ['all', 'patrilineal', 'matrilineal'].includes(definition.type) ? definition.type : 'all',
    description: definition.description || '',
    updatedAt: Date.now(),
  };
  const index = list.findIndex((item) => item.id === stamped.id);
  if (index >= 0) list[index] = stamped;
  else list.push({ ...stamped, createdAt: Date.now() });
  await getAppDataClient().meta.set(META_KEY, list);
  return stamped;
}

export async function deleteLineageDefinition(id) {
  const list = await listLineageDefinitions();
  await getAppDataClient().meta.set(META_KEY, list.filter((item) => item.id !== id));
}

export async function calculateLineageAssignments(definition, options = {}) {
  const graph = await loadFamilyGraph(options);
  return calculateLineageAssignmentsFromGraph(graph, definition);
}

function calculateLineageAssignmentsFromGraph(graph, definition) {
  const rootId = definition?.rootPersonId;
  if (!rootId || !graph.getPerson(rootId)) return [];
  const type = definition.type || 'all';
  const out = [];
  const visited = new Set();
  const queue = [{ id: rootId, generation: 0, path: [], fromParent: 'root' }];
  while (queue.length) {
    const current = queue.shift();
    if (!current?.id || visited.has(current.id)) continue;
    visited.add(current.id);
    out.push({
      personId: current.id,
      name: personDisplayName(graph.getPerson(current.id)),
      generation: current.generation,
      path: current.path,
    });

    const children = graph.getChildren(current.id).sort((a, b) => comparePeopleByBirthThenName(graph, a, b));
    for (const childId of children) {
      const parentRows = graph.getParents(childId);
      const throughFather = parentRows.some((parents) => parents.fatherId === current.id);
      const throughMother = parentRows.some((parents) => parents.motherId === current.id);
      if (type === 'patrilineal' && !throughFather) continue;
      if (type === 'matrilineal' && !throughMother) continue;
      queue.push({
        id: childId,
        generation: current.generation + 1,
        path: [...current.path, current.id],
        fromParent: throughFather ? 'father' : throughMother ? 'mother' : 'parent',
      });
    }
  }
  return out;
}

export async function applyLineageAsPersonGroup(definition) {
  const db = getAppDataClient().records;
  const assignments = await calculateLineageAssignments(definition);
  if (!assignments.length) return { group: null, assignments: [] };

  const groupName = definition.name || 'Lineage';
  const { records: existingGroups } = await db.query('PersonGroup', { limit: 100000 });
  let group = existingGroups.find((record) => record.fields?.lineageDefinitionId?.value === definition.id);
  if (!group) {
    group = {
      recordName: uuid('grp'),
      recordType: 'PersonGroup',
      fields: {
        name: { value: groupName, type: 'STRING' },
        description: { value: definition.description || `${groupName} lineage`, type: 'STRING' },
        lineageDefinitionId: { value: definition.id, type: 'STRING' },
      },
    };
    await db.save(group);
    await logRecordCreated(group);
  } else {
    group = {
      ...group,
      fields: {
        ...group.fields,
        name: { value: groupName, type: 'STRING' },
        description: { value: definition.description || group.fields?.description?.value || '', type: 'STRING' },
      },
    };
    await db.save(group);
  }

  const { records: relations } = await db.query('PersonGroupRelation', { referenceField: 'personGroup', referenceValue: group.recordName, limit: 100000 });
  const wanted = new Set(assignments.map((item) => item.personId));
  const existingByPerson = new Map(relations.map((rel) => [rel.fields?.person?.value?.split?.('---')?.[0], rel]));
  const saves = [];
  const deletes = [];
  for (const personId of wanted) {
    if (existingByPerson.has(personId)) continue;
    saves.push({
      recordName: uuid('pgr'),
      recordType: 'PersonGroupRelation',
      fields: {
        personGroup: writeRef(group.recordName, 'PersonGroup'),
        person: writeRef(personId, 'Person'),
        lineageDefinitionId: { value: definition.id, type: 'STRING' },
      },
    });
  }
  for (const rel of relations) {
    const personId = rel.fields?.person?.value?.split?.('---')?.[0];
    if (!wanted.has(personId)) deletes.push(rel.recordName);
  }
  await db.transaction({ saveRecords: saves, deleteRecordNames: deletes });
  return { group, assignments };
}
