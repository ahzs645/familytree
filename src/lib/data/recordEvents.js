// @ts-check
/**
 * recordEvents — in-process change notifications for record storage.
 *
 * LocalDatabase emits from every write path (single saves, transactions,
 * imports, clears), so any cache layered above it can invalidate without
 * each caller remembering to broadcast. `types` is a Set of recordType
 * strings, or the string '*' when the affected types aren't knowable
 * (deletes by name, dataset imports, clearAll).
 */
/**
 * @typedef {'*' | Set<string>} RecordChangeTypes
 * @typedef {(types: RecordChangeTypes) => void} RecordChangeListener
 */

/** @type {Set<RecordChangeListener>} */
const listeners = new Set();

/** @param {RecordChangeListener} listener @returns {() => void} unsubscribe */
export function subscribeRecordChanges(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @param {RecordChangeTypes} types */
export function emitRecordChanges(types) {
  for (const listener of [...listeners]) {
    try {
      listener(types);
    } catch {
      // A broken subscriber must not block other caches from invalidating.
    }
  }
}
