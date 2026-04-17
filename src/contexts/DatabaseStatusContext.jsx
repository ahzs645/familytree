/**
 * DatabaseStatusContext — lightweight wrapper over LocalDatabase that tracks
 * whether data has been imported and exposes summary counts. Components
 * subscribe via `useDatabaseStatus()` and receive re-renders after import
 * or clear-all.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';

const DatabaseStatusContext = createContext(null);

export function DatabaseStatusProvider({ children }) {
  const [status, setStatus] = useState({ loading: true, hasData: false, summary: null });

  const refresh = useCallback(async () => {
    const db = getLocalDatabase();
    await db.open();
    const hasData = await db.hasData();
    const summary = hasData ? await db.getSummary() : null;
    setStatus({ loading: false, hasData, summary });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clear = useCallback(async () => {
    const db = getLocalDatabase();
    await db.clearAll();
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
