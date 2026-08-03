/**
 * Boot-time deep link resolver for `?person=`, `?family=`, `?source=`, `?place=`, `?media=`.
 *
 * Paired with main.jsx's `?url=` loader: after a tree loads, the router
 * consumes any object hint and routes to its editor/list without keeping
 * the hint in the visible URL.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAppDataClient } from './data/AppDataClient.js';

const OBJECT_PARAM_ROUTES = [
  { param: 'person', path: (id) => `/person/${id}` },
  { param: 'family', path: (id) => `/family/${id}` },
  { param: 'source', path: () => '/sources', recordType: 'Source' },
  { param: 'place', path: () => '/places', recordType: 'Place' },
  { param: 'media', path: () => '/media', recordType: 'BaseMedia' },
];

/** Route a concrete change-log target to the editor that owns that record. */
export function deepLinkForRecord(recordType, recordName, record = null) {
  if (!recordType || !recordName) return null;
  const id = encodeURIComponent(recordName);
  if (recordType === 'Person') return `/person/${id}`;
  if (recordType === 'Family') return `/family/${id}`;
  if (recordType === 'Place') return `/places?placeId=${id}`;
  if (recordType === 'Source') return `/sources?sourceId=${id}`;
  if (recordType === 'PersonEvent' || recordType === 'FamilyEvent') return `/events?eventId=${id}`;
  if (recordType.startsWith('Media')) return `/media?mediaId=${id}`;
  if (recordType === 'Story') return `/stories?storyId=${id}`;
  if (recordType === 'DNATestResult') return `/dna?dnaId=${id}`;
  if (recordType === 'LabelDefinition') return `/labels?labelId=${id}`;
  if (recordType === 'ToDo') return `/todos?todoId=${id}`;
  const fields = record?.fields || {};
  if (recordType === 'StorySection' || recordType === 'StoryRelation') {
    const storyId = fieldRef(fields.story);
    return storyId ? `/stories?storyId=${encodeURIComponent(storyId)}` : '/stories';
  }
  if (recordType === 'StorySectionRelation') return '/stories';
  if (recordType === 'MediaRelation') {
    const mediaId = fieldRef(fields.media);
    return mediaId ? `/media?mediaId=${encodeURIComponent(mediaId)}` : '/media';
  }
  if (recordType === 'SourceRelation') {
    const sourceId = fieldRef(fields.source);
    return sourceId ? `/sources?sourceId=${encodeURIComponent(sourceId)}` : '/sources';
  }
  if (recordType === 'Note' || recordType === 'PersonFact' || recordType === 'AssociateRelation') {
    const personId = fieldRef(fields.person) || fieldRef(fields.targetPerson);
    const familyId = fieldRef(fields.family);
    if (personId) return `/person/${encodeURIComponent(personId)}`;
    if (familyId) return `/family/${encodeURIComponent(familyId)}`;
  }
  if (recordType === 'ChildRelation') {
    const familyId = fieldRef(fields.family);
    return familyId ? `/family/${encodeURIComponent(familyId)}` : '/families';
  }
  if (recordType === 'Coordinate' || recordType === 'PlaceDetail') {
    const placeId = fieldRef(fields.place);
    return placeId ? `/places?placeId=${encodeURIComponent(placeId)}` : '/places';
  }
  const listRoutes = {
    PersonGroup: '/groups',
    TribalAffiliation: '/tribal-affiliations',
    SourceRepository: '/repositories',
  };
  return listRoutes[recordType] ? `${listRoutes[recordType]}?focus=${id}` : `/search?query=${id}`;
}

function fieldRef(field) {
  const value = field?.value ?? field;
  if (!value) return '';
  if (typeof value === 'object') return value.recordName || value.id || value.identifier || '';
  const text = String(value);
  return text.includes('---') ? text.slice(0, text.lastIndexOf('---')) : text;
}

function resolveDeepLinkFromLocation(search) {
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
    if (location.pathname === '/charts' || location.pathname === '/view') return;
    const hit = resolveDeepLinkFromLocation(location.search);
    if (!hit) return;
    let cancelled = false;
    (async () => {
      if (hit.recordType) {
        try {
          const db = getAppDataClient().records;
          const record = await db.get(hit.id);
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
