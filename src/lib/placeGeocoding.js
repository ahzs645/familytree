import { getLocalDatabase } from './LocalDatabase.js';
import { refValue } from './recordRef.js';
import { readField, readRef } from './schema.js';

const MAP_PREFS_KEY = 'mapPreferences';

export async function getMapPreferences() {
  const db = getLocalDatabase();
  return (await db.getMeta(MAP_PREFS_KEY)) || {
    provider: 'nominatim',
    defaultZoom: 9,
    batchLimit: 10,
  };
}

export async function saveMapPreferences(prefs) {
  const db = getLocalDatabase();
  const next = { ...(await getMapPreferences()), ...prefs };
  await db.setMeta(MAP_PREFS_KEY, next);
  return next;
}

export async function lookupPlaceCandidates(query, { limit = 5 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', q);
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Place lookup failed (${response.status})`);
  const rows = await response.json();
  return rows.map((row) => ({
    name: row.display_name,
    latitude: Number.parseFloat(row.lat),
    longitude: Number.parseFloat(row.lon),
    provider: 'nominatim',
    providerId: `${row.osm_type || 'osm'}:${row.osm_id || ''}`,
    class: row.class || '',
    type: row.type || '',
    raw: row,
  })).filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}

export async function lookupGeoNameId(geoNameID) {
  const id = String(geoNameID || '').trim();
  if (!id) return null;
  const url = new URL('https://secure.geonames.org/getJSON');
  url.searchParams.set('geonameId', id);
  url.searchParams.set('username', 'demo');
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`GeoName lookup failed (${response.status})`);
  const row = await response.json();
  if (row.status?.message) throw new Error(row.status.message);
  return {
    name: row.name || row.toponymName || id,
    latitude: Number.parseFloat(row.lat),
    longitude: Number.parseFloat(row.lng),
    geoNameID: id,
    raw: row,
  };
}

export async function batchLookupMissingCoordinates({ limit = 10 } = {}) {
  const db = getLocalDatabase();
  const [places, coords] = await Promise.all([
    db.query('Place', { limit: 100000 }),
    db.query('Coordinate', { limit: 100000 }),
  ]);
  const placesWithCoords = new Set();
  for (const coord of coords.records) {
    const placeId = readRef(coord.fields?.place);
    if (placeId && hasCoordinateValues(coord)) placesWithCoords.add(placeId);
  }

  const changed = [];
  for (const place of places.records) {
    if (changed.length >= limit) break;
    if (placesWithCoords.has(place.recordName) || readRef(place.fields?.coordinate)) continue;
    const label = placeLookupLabel(place);
    if (!label) continue;
    const candidates = await lookupPlaceCandidates(label, { limit: 1 });
    const candidate = candidates[0];
    if (!candidate) continue;
    const coordinate = buildCoordinateRecord(place.recordName, candidate);
    await db.saveRecord(coordinate);
    await db.saveRecord({
      ...place,
      fields: {
        ...place.fields,
        coordinate: { value: refValue(coordinate.recordName, 'Coordinate'), type: 'REFERENCE' },
        lookupProvider: { value: candidate.provider, type: 'STRING' },
        lookupProviderId: { value: candidate.providerId, type: 'STRING' },
      },
    });
    changed.push({ place: place.recordName, label, candidate });
  }
  return changed;
}

export function buildCoordinateRecord(placeRecordName, candidate) {
  return {
    recordName: `coord-lookup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    recordType: 'Coordinate',
    fields: {
      place: { value: refValue(placeRecordName, 'Place'), type: 'REFERENCE' },
      latitude: { value: candidate.latitude, type: 'DOUBLE' },
      longitude: { value: candidate.longitude, type: 'DOUBLE' },
      provider: { value: candidate.provider || 'lookup', type: 'STRING' },
      providerId: { value: candidate.providerId || candidate.geoNameID || '', type: 'STRING' },
    },
  };
}

export function placeLookupLabel(place) {
  return readField(place, [
    'cached_standardizedLocationString',
    'cached_normallocationString',
    'cached_normalLocationString',
    'cached_displayName',
    'placeName',
    'place',
    'name',
  ], '');
}

export function placeDetailsFromComponents(components = {}) {
  return Object.entries(components)
    .filter(([, value]) => String(value || '').trim())
    .map(([key, value]) => ({ name: `${titleCase(key)}: ${value}` }));
}

function hasCoordinateValues(record) {
  return Number.isFinite(Number.parseFloat(record?.fields?.latitude?.value)) && Number.isFinite(Number.parseFloat(record?.fields?.longitude?.value));
}

function titleCase(value) {
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
