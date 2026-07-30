/**
 * A one-line summary the current page wants shown next to its name.
 *
 * On a phone the app bar shows the page title, and a route's own header then
 * spent a second row on a line like "251 of 251" or "15 generations for Amanda
 * Heasley". Publishing that line here lets the bar carry it instead, so the
 * page keeps the row for its actual controls.
 *
 * Desktop ignores it — there the route header shows title and summary itself,
 * with room to spare.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

const PageMetaContext = createContext({ meta: null, setMeta: () => {} });

export function PageMetaProvider({ children }) {
  const [meta, setMeta] = useState(null);
  const { pathname } = useLocation();

  // Clear on navigation so a stale summary never outlives the page that set
  // it — routes publish on mount, and the new one may not publish at all.
  useEffect(() => { setMeta(null); }, [pathname]);

  const value = useMemo(() => ({ meta, setMeta }), [meta]);
  return <PageMetaContext.Provider value={value}>{children}</PageMetaContext.Provider>;
}

export function usePageMeta() {
  return useContext(PageMetaContext).meta;
}

/**
 * Publish this page's summary line. Pass a string, or null to publish nothing.
 *
 * It is a hook, so it has to run on every render — put the call above any
 * `if (loading) return …` branch the route has, not below it.
 */
export function useSetPageMeta(value) {
  const { setMeta } = useContext(PageMetaContext);
  useEffect(() => {
    setMeta(value ?? null);
    return () => setMeta(null);
  }, [setMeta, value]);
}

export default PageMetaContext;
