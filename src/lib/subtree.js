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
