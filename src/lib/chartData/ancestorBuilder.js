import { readRef } from '../schema.js';

/** Return sibling person ids from the ChildRelations of one parent family. */
export function siblingRecordNames(relations = [], personRecordName) {
  const seen = new Set();
  const result = [];
  for (const relation of relations) {
    const id = readRef(relation?.fields?.child?.value ?? relation?.fields?.child);
    if (!id || id === personRecordName || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
