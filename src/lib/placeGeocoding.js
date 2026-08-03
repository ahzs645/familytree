import { getAppDataClient } from './data/AppDataClient.js';
import { saveWithChangeLog } from './changeLog.js';
import { createWithChangeLog } from './recordWrite.js';
import { refValue } from './recordRef.js';
import { readField, readRef } from './schema.js';
import { generateId } from './ids.js';
import {
  findInstalledGeoName,
  searchInstalledGeographicPackages,
} from './geographicPackages.js';

const MAP_PREFS_KEY = 'mapPreferences';
export const MAP_PREFERENCES_EVENT = 'cloudtreeweb:map-preferences-changed';

export const DEFAULT_MAP_PREFERENCES = {
  provider: 'nominatim',
  defaultZoom: 9,
  batchLimit: 10,
  basemap: 'auto',
  showLabels: true,
  markerClustering: true,
};

function normalizeMapPreferences(prefs = {}) {
  const next = { ...DEFAULT_MAP_PREFERENCES, ...prefs };
  next.defaultZoom = clampNumber(next.defaultZoom, 1, 18, DEFAULT_MAP_PREFERENCES.defaultZoom);
  next.batchLimit = clampNumber(next.batchLimit, 1, 50, DEFAULT_MAP_PREFERENCES.batchLimit);
  next.basemap = ['auto', 'positron', 'voyager', 'dark'].includes(next.basemap) ? next.basemap : DEFAULT_MAP_PREFERENCES.basemap;
  next.showLabels = next.showLabels !== false;
  next.markerClustering = next.markerClustering !== false;
  return next;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function announceMapPreferences(prefs) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MAP_PREFERENCES_EVENT, { detail: prefs }));
}

export async function getMapPreferences() {
  return normalizeMapPreferences(await getAppDataClient().meta.get(MAP_PREFS_KEY));
}

export async function saveMapPreferences(prefs) {
  const next = normalizeMapPreferences({ ...(await getMapPreferences()), ...prefs });
  await getAppDataClient().meta.set(MAP_PREFS_KEY, next);
  announceMapPreferences(next);
  return next;
}

export async function lookupPlaceCandidates(query, { limit = 5 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    const offlineRows = await searchInstalledGeographicPackages(q, { limit });
    if (offlineRows.length) return offlineRows.map(normalizeOfflineCandidate);
  } catch {
    // An unavailable package store must not prevent the network fallback.
  }
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('namedetails', '1');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('q', q);
  if (typeof navigator !== 'undefined' && navigator.languages?.length) {
    url.searchParams.set('accept-language', navigator.languages.join(','));
  }
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Place lookup failed (${response.status})`);
  const rows = await response.json();
  return rows.map(normalizeNominatimCandidate).filter(Boolean);
}

export async function lookupGeoNameId(geoNameID) {
  const id = String(geoNameID || '').trim();
  if (!id) return null;
  try {
    const offline = await findInstalledGeoName(id);
    if (offline) return normalizeOfflineCandidate(offline);
  } catch {
    // Continue with the network provider when IndexedDB is unavailable.
  }
  const url = new URL('https://secure.geonames.org/getJSON');
  url.searchParams.set('geonameId', id);
  url.searchParams.set('username', 'demo');
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`GeoName lookup failed (${response.status})`);
  const row = await response.json();
  if (row.status?.message) throw new Error(row.status.message);
  return normalizeGeoNamesCandidate({ ...row, geonameId: id });
}

/** Normalize a Nominatim jsonv2 search result into the shared candidate shape. */
export function normalizeNominatimCandidate(row) {
  const latitude = Number.parseFloat(row?.lat);
  const longitude = Number.parseFloat(row?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = row.address || {};
  const baseName = firstValue(
    row.namedetails?.name,
    address.amenity,
    address.historic,
    address.tourism,
    address.leisure,
    address.shop,
    address.building,
    address.place,
    address.city,
    address.town,
    address.village,
    String(row.display_name || '').split(',')[0],
  );
  const nameForms = nominatimNameForms(row, baseName);
  return {
    candidateId: `nominatim:${row.osm_type || 'osm'}:${row.osm_id || ''}`,
    name: baseName || row.display_name || '',
    displayName: row.display_name || baseName || '',
    latitude,
    longitude,
    provider: 'nominatim',
    providerId: `${row.osm_type || 'osm'}:${row.osm_id || ''}`,
    geoNameID: String(row.extratags?.geonames || row.extratags?.geoname_id || ''),
    featureClass: row.class || '',
    featureCode: row.type || '',
    population: numberOrNull(row.extratags?.population),
    hierarchy: nominatimHierarchy(address),
    components: candidateComponentsFromAddress(address, baseName),
    nameForms,
    raw: row,
  };
}

/** Normalize a stored GeoNames package row into the shared candidate shape. */
export function normalizeOfflineCandidate(row) {
  const candidate = normalizeGeoNamesCandidate(row);
  return {
    ...candidate,
    candidateId: `offline:${row.packageId || 'package'}:${row.geonameId || `${row.latitude},${row.longitude}`}`,
    provider: 'offline-geonames',
    providerId: String(row.geonameId || ''),
    packageId: row.packageId || '',
  };
}

function normalizeGeoNamesCandidate(row) {
  const name = firstValue(row.name, row.toponymName, row.asciiName);
  const hierarchy = [
    ['admin4', row.admin4Name],
    ['admin3', row.admin3Name],
    ['admin2', row.admin2Name],
    ['admin1', row.admin1Name],
    ['country', row.countryName || row.country],
  ].filter(([, value]) => String(value || '').trim()).map(([level, value]) => ({ level, value: String(value) }));
  const alternateNames = Array.isArray(row.alternateNames)
    ? row.alternateNames
    : String(row.alternateNames || '').split(',').map((name) => name.trim()).filter(Boolean);
  const nameForms = uniqueNameForms([
    { name, language: '', kind: 'preferred' },
    { name: row.asciiName, language: '', kind: 'ascii' },
    ...alternateNames.map((item) => typeof item === 'string'
      ? { name: item, language: '', kind: 'alternate' }
      : { name: item.name, language: item.language || '', kind: item.preferred ? 'preferred' : 'alternate' }),
  ]);
  const hierarchyValues = hierarchy.map((item) => item.value);
  return {
    candidateId: `geonames:${row.geonameId || row.geonameID || ''}`,
    name,
    displayName: [name, ...hierarchyValues.filter((value) => value !== name)].filter(Boolean).join(', '),
    latitude: Number(row.latitude ?? row.lat),
    longitude: Number(row.longitude ?? row.lng),
    provider: 'geonames',
    providerId: String(row.geonameId || row.geonameID || ''),
    geoNameID: String(row.geonameId || row.geonameID || ''),
    featureClass: row.featureClass || row.fcl || '',
    featureCode: row.featureCode || row.fcode || '',
    population: numberOrNull(row.population),
    hierarchy,
    components: {
      place: name,
      city: name,
      county: row.admin2Name || row.admin3Name || '',
      district: row.admin3Name || row.admin2Name || '',
      state: row.admin1Name || '',
      province: row.admin1Name || '',
      region: row.admin1Name || '',
      country: row.countryName || row.country || '',
    },
    nameForms,
    raw: row,
  };
}

/** Return the complete display label after a particular name form is chosen. */
export function candidateDisplayName(candidate, chosenName) {
  const name = String(chosenName || candidate?.name || '').trim();
  const hierarchy = (candidate?.hierarchy || []).map((item) => String(item.value || '').trim()).filter(Boolean);
  return [name, ...hierarchy.filter((value) => value.toLocaleLowerCase() !== name.toLocaleLowerCase())].filter(Boolean).join(', ');
}

/** Apply lookup identity/name fields to a stored Place envelope. */
export function applyPlaceLookupCandidate(record, candidate, chosenName) {
  const displayName = candidateDisplayName(candidate, chosenName);
  const fields = { ...record.fields };
  if (displayName) {
    fields.placeName = { value: displayName, type: 'STRING' };
    fields.cached_displayName = { value: displayName, type: 'STRING' };
    fields.cached_normallocationString = { value: displayName, type: 'STRING' };
    fields.cached_shortLocationString = { value: displayName, type: 'STRING' };
    fields.cached_standardizedLocationString = { value: displayName, type: 'STRING' };
  }
  for (const [slot, value] of Object.entries(candidate?.components || {})) {
    if (!value || !(slot in fields)) continue;
    fields[slot] = { value: slot === 'place' || slot === 'city' ? chosenName || value : value, type: 'STRING' };
  }
  fields.lookupProvider = { value: candidate.provider || 'lookup', type: 'STRING' };
  fields.lookupProviderId = { value: candidate.providerId || '', type: 'STRING' };
  if (candidate.geoNameID) {
    fields.geonameID = { value: candidate.geoNameID, type: 'STRING' };
    fields.geoNameID = { value: candidate.geoNameID, type: 'STRING' };
  }
  return { ...record, fields };
}

function nominatimNameForms(row, baseName) {
  const forms = [{ name: baseName, language: '', kind: 'preferred' }];
  for (const [key, value] of Object.entries(row.namedetails || {})) {
    const [kindPart, language = ''] = key.split(':');
    const kind = kindPart === 'name' || kindPart === 'official_name' ? 'preferred'
      : kindPart === 'short_name' ? 'short'
        : kindPart === 'old_name' ? 'historical' : 'alternate';
    for (const name of String(value || '').split(';')) forms.push({ name, language, kind });
  }
  for (const key of ['alt_name', 'official_name', 'old_name', 'short_name']) {
    for (const name of String(row.extratags?.[key] || '').split(';')) {
      forms.push({ name, language: '', kind: key === 'official_name' ? 'preferred' : key === 'old_name' ? 'historical' : key === 'short_name' ? 'short' : 'alternate' });
    }
  }
  return uniqueNameForms(forms);
}

function uniqueNameForms(forms) {
  const seen = new Set();
  return forms.map((form) => ({
    name: String(form.name || '').trim(),
    language: String(form.language || '').trim(),
    kind: form.kind || 'alternate',
  })).filter((form) => {
    if (!form.name) return false;
    const key = `${form.name.toLocaleLowerCase()}\u0000${form.language}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nominatimHierarchy(address) {
  const levels = [
    ['neighbourhood', address.neighbourhood || address.quarter],
    ['suburb', address.suburb],
    ['cityDistrict', address.city_district || address.borough],
    ['locality', address.city || address.town || address.village || address.hamlet || address.municipality],
    ['county', address.county || address.state_district],
    ['state', address.state || address.region],
    ['country', address.country],
  ];
  const seen = new Set();
  return levels.filter(([, value]) => String(value || '').trim()).map(([level, value]) => ({ level, value: String(value) })).filter((item) => {
    const key = item.value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function candidateComponentsFromAddress(address, baseName) {
  return {
    place: baseName || '',
    city: baseName || address.city || address.town || address.village || '',
    locality: address.city || address.town || address.village || address.hamlet || '',
    county: address.county || address.state_district || '',
    district: address.city_district || address.county || '',
    state: address.state || address.region || '',
    province: address.state || address.region || '',
    region: address.region || address.state || '',
    country: address.country || '',
  };
}

function firstValue(...values) {
  return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}

function numberOrNull(value) {
  const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) ? number : null;
}

// Search GeoNames by free-text name and return the top match's id (or null).
async function searchGeoNameIdForName(name) {
  const q = String(name || '').trim();
  if (!q) return null;
  try {
    const offline = await searchInstalledGeographicPackages(q, { limit: 1 });
    if (offline[0]?.geonameId) return String(offline[0].geonameId);
  } catch {
    // Continue with GeoNames when the offline package store is unavailable.
  }
  const url = new URL('https://secure.geonames.org/searchJSON');
  url.searchParams.set('q', q);
  url.searchParams.set('maxRows', '1');
  url.searchParams.set('username', 'demo');
  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`GeoName search failed (${response.status})`);
  const data = await response.json();
  if (data.status?.message) throw new Error(data.status.message);
  const row = (data.geonames || [])[0];
  return row?.geonameId ? String(row.geonameId) : null;
}

// Tree-wide "Find GeoName IDs for Places" (#35): fills in geonameID on places
// that don't have one yet, matched by their display name.
export async function batchLookupMissingGeoNames({ limit = 10 } = {}) {
  const db = getAppDataClient().records;
  const { records: places } = await db.query('Place', { limit: 100000 });
  const changed = [];
  for (const place of places) {
    if (changed.length >= limit) break;
    if (place.fields?.geonameID?.value || place.fields?.geoNameID?.value) continue;
    const label = placeLookupLabel(place);
    if (!label) continue;
    let geonameId = null;
    try { geonameId = await searchGeoNameIdForName(label); } catch { geonameId = null; }
    if (!geonameId) continue;
    await saveWithChangeLog({
      ...place,
      fields: {
        ...place.fields,
        geonameID: { value: geonameId, type: 'STRING' },
        geoNameID: { value: geonameId, type: 'STRING' },
      },
    });
    changed.push({ place: place.recordName, label, geonameId });
  }
  return changed;
}

export async function batchLookupMissingCoordinates({ limit = 10 } = {}) {
  const db = getAppDataClient().records;
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
    await createWithChangeLog(coordinate);
    await saveWithChangeLog({
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
    recordName: generateId('coord-lookup'),
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
