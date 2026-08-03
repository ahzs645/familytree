// @ts-check
/**
 * Offline geographic packages.
 *
 * The manifest intentionally stays static and small. A package server only
 * needs to expose one JSON file per entry at `<baseUrl>/<fileName>` using:
 *
 * {
 *   "schemaVersion": 1,
 *   "packageId": "europe",
 *   "generatedAt": "2026-01-01T00:00:00Z",
 *   "places": [{
 *     "geonameId": "2643743", "name": "London", "asciiName": "London",
 *     "alternateNames": [{ "name": "Londres", "language": "fr", "preferred": true }],
 *     "latitude": 51.5085, "longitude": -0.1257,
 *     "featureClass": "P", "featureCode": "PPLC", "population": 8961989,
 *     "countryCode": "GB", "countryName": "United Kingdom",
 *     "admin1Name": "England", "admin2Name": "Greater London"
 *   }]
 * }
 *
 * Unknown fields are ignored. Packages are validated and normalized before
 * being stored in IndexedDB through AppDataClient.assets.
 */
import { getAppDataClient } from './data/AppDataClient.js';

export const GEOGRAPHIC_PACKAGE_OWNER = 'cloudtreeweb-geographic-packages';
export const GEOGRAPHIC_PACKAGE_SCHEMA_VERSION = 1;

export const GEOGRAPHIC_PACKAGE_MANIFESTS = Object.freeze([
  { id: 'africa', nameKey: 'settingsPage.contentDownload.packages.africa', fileName: 'africa.json', size: 38_000_000 },
  { id: 'asia', nameKey: 'settingsPage.contentDownload.packages.asia', fileName: 'asia.json', size: 82_000_000 },
  { id: 'europe', nameKey: 'settingsPage.contentDownload.packages.europe', fileName: 'europe.json', size: 71_000_000 },
  { id: 'north-america', nameKey: 'settingsPage.contentDownload.packages.northAmerica', fileName: 'north-america.json', size: 64_000_000 },
  { id: 'south-america', nameKey: 'settingsPage.contentDownload.packages.southAmerica', fileName: 'south-america.json', size: 29_000_000 },
  { id: 'oceania', nameKey: 'settingsPage.contentDownload.packages.oceania', fileName: 'oceania.json', size: 17_000_000 },
]);

/** @param {string} packageId */
export function geographicPackageAssetId(packageId) {
  return `geographic-package:${packageId}`;
}

/** @param {string} baseUrl @param {string} fileName */
export function geographicPackageUrl(baseUrl, fileName) {
  const base = String(baseUrl || '').trim();
  if (!base) return '';
  return `${base.replace(/\/+$/, '')}/${String(fileName || '').replace(/^\/+/, '')}`;
}

/**
 * @param {unknown} payload
 * @param {string} expectedPackageId
 */
export function normalizeGeographicPackage(payload, expectedPackageId) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid geographic package payload.');
  const input = /** @type {Record<string, any>} */ (payload);
  if (Number(input.schemaVersion) !== GEOGRAPHIC_PACKAGE_SCHEMA_VERSION) {
    throw new Error(`Unsupported geographic package schema ${input.schemaVersion ?? ''}.`);
  }
  const packageId = String(input.packageId || '').trim();
  if (!packageId || packageId !== expectedPackageId) throw new Error('Geographic package identifier does not match its manifest.');
  if (!Array.isArray(input.places)) throw new Error('Geographic package does not contain a places array.');
  const places = input.places.map(normalizeGeographicPlace).filter(Boolean);
  return {
    schemaVersion: GEOGRAPHIC_PACKAGE_SCHEMA_VERSION,
    packageId,
    generatedAt: String(input.generatedAt || ''),
    places,
  };
}

/** @param {any} row */
function normalizeGeographicPlace(row) {
  const latitude = Number(row?.latitude ?? row?.lat);
  const longitude = Number(row?.longitude ?? row?.lng ?? row?.lon);
  const name = String(row?.name || row?.toponymName || '').trim();
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    geonameId: String(row.geonameId ?? row.geoNameID ?? row.geonameID ?? '').trim(),
    name,
    asciiName: String(row.asciiName || '').trim(),
    alternateNames: normalizeAlternateNames(row.alternateNames),
    latitude,
    longitude,
    featureClass: String(row.featureClass || row.fcl || '').trim(),
    featureCode: String(row.featureCode || row.fcode || '').trim(),
    population: finiteNumberOrNull(row.population),
    countryCode: String(row.countryCode || '').trim().toUpperCase(),
    countryName: String(row.countryName || row.country || '').trim(),
    admin1Name: String(row.admin1Name || row.admin1 || '').trim(),
    admin2Name: String(row.admin2Name || row.admin2 || '').trim(),
    admin3Name: String(row.admin3Name || row.admin3 || '').trim(),
    admin4Name: String(row.admin4Name || row.admin4 || '').trim(),
  };
}

/** @param {unknown} value */
function normalizeAlternateNames(value) {
  if (typeof value === 'string') {
    return value.split(',').map((name) => ({ name: name.trim(), language: '', preferred: false })).filter((item) => item.name);
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { name: item.trim(), language: '', preferred: false };
    return {
      name: String(item?.name || '').trim(),
      language: String(item?.language || item?.lang || '').trim(),
      preferred: item?.preferred === true || item?.isPreferredName === true,
    };
  }).filter((item) => item.name);
}

/** @param {unknown} value */
function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function listInstalledGeographicPackages() {
  const assets = /** @type {Array<any>} */ (await getAppDataClient().assets.listForRecord(GEOGRAPHIC_PACKAGE_OWNER));
  return assets.filter((asset) => asset?.kind === 'geographic-package');
}

/**
 * @param {string} packageId
 * @param {string} baseUrl
 * @param {{ fetchImpl?: typeof fetch }} [options]
 */
export async function installGeographicPackage(packageId, baseUrl, { fetchImpl = fetch } = {}) {
  const manifest = GEOGRAPHIC_PACKAGE_MANIFESTS.find((entry) => entry.id === packageId);
  if (!manifest) throw new Error('Unknown geographic package.');
  const url = geographicPackageUrl(baseUrl, manifest.fileName);
  if (!url) throw new Error('Configure a geographic package base URL first.');
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Geographic package download failed (${response.status}).`);
  const payload = normalizeGeographicPackage(await response.json(), packageId);
  const asset = {
    assetId: geographicPackageAssetId(packageId),
    ownerRecordName: GEOGRAPHIC_PACKAGE_OWNER,
    sourceIdentifier: url,
    kind: 'geographic-package',
    packageId,
    installedAt: new Date().toISOString(),
    byteSize: Number(response.headers.get('content-length')) || manifest.size,
    payload,
  };
  await getAppDataClient().assets.save(asset);
  return asset;
}

/** @param {string} packageId */
export async function removeGeographicPackage(packageId) {
  await getAppDataClient().assets.delete(geographicPackageAssetId(packageId));
}

/**
 * Search already-loaded package assets. Exported separately so matching and
 * ranking remain testable without IndexedDB.
 * @param {Array<any>} assets
 * @param {string} query
 * @param {{ limit?: number }} [options]
 */
export function searchGeographicPackageAssets(assets, query, { limit = 8 } = {}) {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  const primaryNeedle = normalizeSearch(String(query || '').split(',')[0]);
  const matches = [];
  for (const asset of assets || []) {
    for (const place of asset?.payload?.places || []) {
      const score = geographicPlaceScore(place, needle, primaryNeedle);
      if (score < 0) continue;
      matches.push({ ...place, packageId: asset.packageId || asset.payload?.packageId || '', score });
    }
  }
  matches.sort((a, b) => b.score - a.score || Number(b.population || 0) - Number(a.population || 0) || a.name.localeCompare(b.name));
  return matches.slice(0, Math.max(1, limit));
}

/** @param {string} query @param {{ limit?: number }} [options] */
export async function searchInstalledGeographicPackages(query, options = {}) {
  return searchGeographicPackageAssets(await listInstalledGeographicPackages(), query, options);
}

/** @param {string} geoNameId */
export async function findInstalledGeoName(geoNameId) {
  const target = String(geoNameId || '').trim();
  if (!target) return null;
  const assets = await listInstalledGeographicPackages();
  for (const asset of assets) {
    const places = /** @type {Array<any>} */ (asset?.payload?.places || []);
    const found = places.find((place) => String(place.geonameId || '') === target);
    if (found) return { ...found, packageId: asset.packageId || '' };
  }
  return null;
}

/** @param {any} place @param {string} needle @param {string} primaryNeedle */
function geographicPlaceScore(place, needle, primaryNeedle) {
  const alternateNames = /** @type {Array<any>} */ (place.alternateNames || []);
  const names = [place.name, place.asciiName, ...alternateNames.map((item) => item.name)].filter(Boolean);
  let best = -1;
  for (const name of names) {
    const normalized = normalizeSearch(name);
    if (normalized === needle) best = Math.max(best, 1000);
    else if (normalized.startsWith(needle)) best = Math.max(best, 700 - normalized.length);
    else if (normalized.includes(needle)) best = Math.max(best, 400 - normalized.indexOf(needle));
    if (primaryNeedle && primaryNeedle !== needle) {
      if (normalized === primaryNeedle) best = Math.max(best, 900);
      else if (normalized.startsWith(primaryNeedle)) best = Math.max(best, 600 - normalized.length);
    }
  }
  if (best < 0) return -1;
  const hierarchy = normalizeSearch([place.admin4Name, place.admin3Name, place.admin2Name, place.admin1Name, place.countryName].filter(Boolean).join(' '));
  const hierarchyQuery = normalizeSearch(String(needle).replace(primaryNeedle, '').replace(/^\s*,?\s*/, ''));
  if (hierarchy.includes(needle) || (hierarchyQuery && hierarchy.includes(hierarchyQuery))) best += 25;
  if (Number(place.population) > 0) best += Math.min(50, Math.log10(Number(place.population)) * 5);
  return best;
}

/** @param {unknown} value */
function normalizeSearch(value) {
  return String(value || '').trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}
