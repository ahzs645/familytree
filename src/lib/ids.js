/**
 * generateId — local record / entity id generator.
 *
 * Single source of truth for the `prefix-<base36 time>-<base36 random>` ids
 * that were hand-rolled across ~10 modules. Collision-resistant within a tree:
 * the timestamp orders ids roughly by creation and the random suffix
 * disambiguates ids minted in the same millisecond.
 *
 * @param {string} prefix       short namespace, e.g. 'tree', 'coord-lookup'
 * @param {object} [opts]
 * @param {number} [opts.randomLength=6]  length of the random base36 suffix
 *                                        (matches the old `.slice(2, 2+n)` forms)
 */
export function generateId(prefix, { randomLength = 6 } = {}) {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 2 + randomLength);
  return `${prefix}-${time}-${random}`;
}

export default generateId;
