import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';

/**
 * Collect the recordNames of every ancestor of `personId` up to the given
 * generation depth. Used by the subtree wizard's "Add Ancestors" button.
 */
export async function collectAncestorIds(personId, maxDepth = 5) {
  const db = getLocalDatabase();
  const result = new Set();
  async function walk(id, depth) {
    if (!id || depth > maxDepth || result.has(id)) return;
    result.add(id);
    const parents = await db.getPersonsParents(id);
    for (const fam of parents) {
      if (fam.man?.recordName) await walk(fam.man.recordName, depth + 1);
      if (fam.woman?.recordName) await walk(fam.woman.recordName, depth + 1);
    }
  }
  await walk(personId, 0);
  result.delete(personId);
  return [...result];
}

/**
 * Collect the recordNames of every descendant of `personId` up to the given
 * generation depth. Used by the subtree wizard's "Add Descendants" button.
 */
export async function collectDescendantIds(personId, maxDepth = 5) {
  const db = getLocalDatabase();
  const result = new Set();
  async function walk(id, depth) {
    if (!id || depth > maxDepth || result.has(id)) return;
    result.add(id);
    const families = await db.getPersonsChildrenInformation(id);
    for (const fam of families) {
      for (const child of fam.children) {
        await walk(child.recordName, depth + 1);
      }
    }
  }
  await walk(personId, 0);
  result.delete(personId);
  return [...result];
}

export async function collectSubtreeRecordNames(rootPersonRecordName) {
  const db = getLocalDatabase();
  const names = new Set();
  const root = await db.getRecord(rootPersonRecordName);
  if (!root) return names;

  async function visitPerson(personId) {
    if (!personId || names.has(personId)) return;
    const person = await db.getRecord(personId);
    if (!person) return;
    names.add(personId);
    const relatedTypes = ['PersonEvent', 'PersonFact', 'AdditionalName', 'Note'];
    for (const type of relatedTypes) {
      const { records } = await db.query(type, { referenceField: 'person', referenceValue: personId, limit: 100000 });
      for (const record of records) names.add(record.recordName);
    }
    const families = await db.getPersonsChildrenInformation(personId);
    for (const familyInfo of families) {
      names.add(familyInfo.family.recordName);
      for (const child of familyInfo.children) {
        const rels = await db.query('ChildRelation', { referenceField: 'child', referenceValue: child.recordName, limit: 100000 });
        for (const rel of rels.records) {
          if (refToRecordName(rel.fields?.family?.value) === familyInfo.family.recordName) names.add(rel.recordName);
        }
        await visitPerson(child.recordName);
      }
    }
  }

  await visitPerson(rootPersonRecordName);
  for (const type of ['SourceRelation', 'MediaRelation', 'ToDoRelation', 'LabelRelation']) {
    const { records } = await db.query(type, { limit: 100000 });
    for (const record of records) {
      const target = refToRecordName(record.fields?.target?.value) ||
        refToRecordName(record.fields?.baseObject?.value) ||
        refToRecordName(record.fields?.targetPerson?.value);
      if (names.has(target)) names.add(record.recordName);
    }
  }
  return names;
}

export async function exportSubtreeBackup(rootPersonRecordName) {
  const db = getLocalDatabase();
  const names = await collectSubtreeRecordNames(rootPersonRecordName);
  const records = {};
  for (const name of names) {
    const record = await db.getRecord(name);
    if (record) records[name] = record;
  }
  const allAssets = await db.listAllAssets();
  const assets = allAssets.filter((asset) => names.has(asset.ownerRecordName));
  return {
    format: 'cloudtreeweb-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    subtreeRoot: rootPersonRecordName,
    records,
    assets,
  };
}

export async function downloadSubtreeBackup(rootPersonRecordName) {
  const backup = await exportSubtreeBackup(rootPersonRecordName);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudtreeweb-subtree-${rootPersonRecordName}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
  return Object.keys(backup.records).length;
}

export async function removeSubtree(rootPersonRecordName) {
  const names = await collectSubtreeRecordNames(rootPersonRecordName);
  const db = getLocalDatabase();
  await db.applyRecordTransaction({ deleteRecordNames: [...names] });
  return names.size;
}

/**
 * Delete a SINGLE person without removing their descendants. Removes the person
 * record and its own sub-records (events, facts, names, notes), the child
 * relations linking them to their parents, any source/media/todo/label
 * relations targeting them, and detaches them from every family they parent
 * (clearing the man/woman field, deleting the family only if it becomes empty —
 * no remaining parent and no children). Returns the count of deleted records.
 */
export async function deletePerson(personRecordName) {
  const db = getLocalDatabase();
  const person = await db.getRecord(personRecordName);
  if (!person) return 0;

  const deleteNames = new Set([personRecordName]);
  const saveRecords = [];

  // 1. The person's own attached records.
  for (const type of ['PersonEvent', 'PersonFact', 'AdditionalName', 'Note']) {
    const { records } = await db.query(type, { referenceField: 'person', referenceValue: personRecordName, limit: 100000 });
    for (const record of records) deleteNames.add(record.recordName);
  }

  // 2. Child relations where this person is the CHILD (links to their parents).
  const asChild = await db.query('ChildRelation', { referenceField: 'child', referenceValue: personRecordName, limit: 100000 });
  for (const rel of asChild.records) deleteNames.add(rel.recordName);

  // 3. Relations elsewhere that target this person.
  for (const type of ['SourceRelation', 'MediaRelation', 'ToDoRelation', 'LabelRelation']) {
    const { records } = await db.query(type, { limit: 100000 });
    for (const record of records) {
      const target = refToRecordName(record.fields?.target?.value)
        || refToRecordName(record.fields?.baseObject?.value)
        || refToRecordName(record.fields?.targetPerson?.value)
        || refToRecordName(record.fields?.person?.value);
      if (target === personRecordName) deleteNames.add(record.recordName);
    }
  }

  // 4. Detach from every family this person parents; keep the family (and its
  //    children) if a co-parent or children remain, else delete the empty family.
  const familyIds = new Set();
  for (const field of ['man', 'woman']) {
    const { records } = await db.query('Family', { referenceField: field, referenceValue: personRecordName, limit: 100000 });
    for (const family of records) familyIds.add(family.recordName);
  }
  for (const familyId of familyIds) {
    const family = await db.getRecord(familyId);
    if (!family) continue;
    const fields = { ...(family.fields || {}) };
    const manId = refToRecordName(fields.man?.value);
    const womanId = refToRecordName(fields.woman?.value);
    if (manId === personRecordName) delete fields.man;
    if (womanId === personRecordName) delete fields.woman;
    const otherParent = (manId === personRecordName ? womanId : manId);
    const childRels = await db.query('ChildRelation', { referenceField: 'family', referenceValue: familyId, limit: 100000 });
    const hasChildren = childRels.records.length > 0;
    if (!otherParent && !hasChildren) {
      deleteNames.add(familyId);
    } else {
      saveRecords.push({ ...family, fields });
    }
  }

  await db.applyRecordTransaction({
    saveRecords,
    deleteRecordNames: [...deleteNames],
  });
  return deleteNames.size;
}
