/**
 * DatabaseStatusContext — lightweight wrapper over AppDataClient that tracks
 * whether data has been imported and exposes summary counts. Components
 * subscribe via `useDatabaseStatus()` and receive re-renders after import
 * or clear-all.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getAppDataClient } from '../lib/data/index.js';

const DatabaseStatusContext = createContext(null);

export function DatabaseStatusProvider({ children }) {
  const [status, setStatus] = useState({ loading: true, hasData: false, summary: null });

  const refresh = useCallback(async () => {
    const client = getAppDataClient();
    const hasData = await client.records.hasData();
    const summary = hasData ? await client.records.summary() : null;
    setStatus({ loading: false, hasData, summary });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clear = useCallback(async () => {
    await getAppDataClient().records.clearAll();
    await refresh();
  }, [refresh]);

  return (
    <DatabaseStatusContext.Provider value={{ ...status, refresh, clear }}>
      {children}
    </DatabaseStatusContext.Provider>
  );
}

export function useDatabaseStatus() {
  const ctx = useContext(DatabaseStatusContext);
  if (!ctx) throw new Error('useDatabaseStatus must be used inside <DatabaseStatusProvider>');
  return ctx;
}
