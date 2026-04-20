/**
 * Relationship-path highlighting for the virtual-tree 3D scene.
 *
 * Given a path (array of record names) and the scene's PersonObject +
 * ConnectionObject maps, temporarily highlight the participating nodes and
 * edges so the user can see a shortest-path trace overlaid on the tree.
 */

export function applyRelationshipPathHighlight({
  pathRecordNames = [],
  personObjects,
  connectionObjects,
}) {
  const pathSet = new Set(pathRecordNames);

  // Reset first so calls are idempotent.
  for (const person of personObjects.values()) person.setHighlight(false);
  for (const connection of connectionObjects) connection.setHighlight(false);

  if (!pathSet.size) return;

  for (const id of pathSet) {
    const obj = personObjects.get(id);
    if (obj) obj.setHighlight(true);
  }

  for (const connection of connectionObjects) {
    if (pathSet.has(connection.fromId) && pathSet.has(connection.toId)) {
      connection.setHighlight(true);
    }
  }
}
