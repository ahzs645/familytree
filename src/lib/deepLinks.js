/**
 * Boot-time deep link resolver for `?person=`, `?family=`, `?source=`, `?place=`, `?media=`.
 *
 * Paired with main.jsx's `?url=` loader: after a tree loads, the router
 * consumes any object hint and routes to its editor/list without keeping
 * the hint in the visible URL.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLocalDatabase } from './LocalDatabase.js';

const OBJECT_PARAM_ROUTES = [
  { param: 'person', path: (id) => `/person/${id}` },
  { param: 'family', path: (id) => `/family/${id}` },
  { param: 'source', path: () => '/sources', recordType: 'Source' },
  { param: 'place', path: () => '/places', recordType: 'Place' },
  { param: 'media', path: () => '/media', recordType: 'BaseMedia' },
];

export function resolveDeepLinkFromLocation(search) {
  const params = new URLSearchParams(search);
  for (const entry of OBJECT_PARAM_ROUTES) {
    const id = params.get(entry.param);
    if (id) return { ...entry, id };
  }
  return null;
}

export function useObjectDeepLink() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const hit = resolveDeepLinkFromLocation(location.search);
    if (!hit) return;
    let cancelled = false;
    (async () => {
      if (hit.recordType) {
        try {
          const db = getLocalDatabase();
          await db.open();
          const record = await db.getRecord(hit.id);
          if (cancelled) return;
          if (!record || record.recordType !== hit.recordType) {
            navigate(hit.path(hit.id), { replace: true });
            return;
          }
        } catch {
          /* fall through to list route */
        }
      }
      navigate(`${hit.path(hit.id)}${hit.recordType ? `?focus=${encodeURIComponent(hit.id)}` : ''}`, { replace: true });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
