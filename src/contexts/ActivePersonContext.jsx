/**
 * ActivePersonContext — shared "currently focused person" across routes.
 * When Tree picks Ada, Charts / Reports / Books default to Ada too.
 * Persisted to sessionStorage so route changes + reloads remember the choice.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ActivePersonContext = createContext(null);
const STORAGE_KEY = 'cloudtreeweb:activePerson';

export function ActivePersonProvider({ children }) {
  const [recordName, setRecordName] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (recordName) sessionStorage.setItem(STORAGE_KEY, recordName);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore quota errors */
    }
  }, [recordName]);

  const set = useCallback((id) => setRecordName(id || null), []);

  return (
    <ActivePersonContext.Provider value={{ recordName, setActivePerson: set }}>
      {children}
    </ActivePersonContext.Provider>
  );
}

export function useActivePerson() {
  const ctx = useContext(ActivePersonContext);
  if (!ctx) throw new Error('useActivePerson must be used inside <ActivePersonProvider>');
  return ctx;
}
