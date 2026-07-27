/**
 * useRecords — cached full-table record queries for the UI layer.
 *
 * Replaces the per-route `db.query(type, { limit: 100000 })` + useEffect +
 * cancelled-flag pattern. Results are cached per recordType across mounts
 * and navigations; LocalDatabase's write paths emit change events (see
 * recordEvents.js) that invalidate the affected types, so consumers never
 * need the ad-hoc `window` event bus for record freshness.
 */
import { useCallback, useEffect, useState } from 'react';
import { getAppDataClient } from './AppDataClient.js';
import { subscribeRecordChanges } from './recordEvents.js';

const cache = new Map(); // recordType -> Promise<records[]>
const hookListeners = new Set();

function fetchRecords(recordType) {
  let promise = cache.get(recordType);
  if (!promise) {
    promise = getAppDataClient()
      .records.query(recordType, { limit: 100000 })
      .then((result) => result.records);
    // Drop failed fetches so the next consumer retries instead of caching an error.
    promise.catch(() => {
      if (cache.get(recordType) === promise) cache.delete(recordType);
    });
    cache.set(recordType, promise);
  }
  return promise;
}

export function invalidateRecords(types = '*') {
  if (types === '*') cache.clear();
  else for (const type of types) cache.delete(type);
  for (const listener of [...hookListeners]) listener(types);
}

subscribeRecordChanges((types) => invalidateRecords(types));

/** Non-hook access to the same cache (for loaders and imperative code). */
export function queryAllRecords(recordType) {
  return fetchRecords(recordType);
}

/**
 * Subscribe a component to the (cached) full record list for a type.
 * Returns { records, loading, reload }. `reload` force-invalidates the type.
 */
export function useRecords(recordType, { enabled = true } = {}) {
  const [state, setState] = useState({ records: [], loading: enabled });

  useEffect(() => {
    if (!enabled || !recordType) return undefined;
    let cancelled = false;
    let current = null;
    const load = () => {
      const promise = fetchRecords(recordType);
      current = promise;
      setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
      promise.then((records) => {
        if (!cancelled && current === promise) setState({ records, loading: false });
      }).catch(() => {
        if (!cancelled && current === promise) setState((prev) => ({ ...prev, loading: false }));
      });
    };
    const onChange = (types) => {
      if (types === '*' || types.has?.(recordType) || (Array.isArray(types) && types.includes(recordType))) load();
    };
    hookListeners.add(onChange);
    load();
    return () => {
      cancelled = true;
      hookListeners.delete(onChange);
    };
  }, [recordType, enabled]);

  const reload = useCallback(() => {
    if (recordType) invalidateRecords([recordType]);
  }, [recordType]);

  return { records: state.records, loading: state.loading, reload };
}
