/**
 * Chart share-link payload builder & codec.
 *
 * Given an open chart document we walk the referenced persons/families N
 * generations, strip to the minimum fields needed for render (name, dates,
 * gender, parent/child refs), drop media blobs, and compress with LZ-string.
 *
 * The resulting token is safe to embed in a URL. The preview route rehydrates
 * this payload into a read-only chart render without hitting IndexedDB.
 */
import LZString from 'lz-string';
import { getLocalDatabase } from './LocalDatabase.js';
import { buildAncestorTree, buildDescendantTree } from './treeQuery.js';
import { personSummary } from '../models/index.js';

export const SHARE_PAYLOAD_VERSION = 1;
export const SHARE_CODEC = 'lzstring';

const BASE64_CHUNK_SIZE = 0x8000;

const FIELD_WHITELIST = new Set([
  'firstName',
  'lastName',
  'nameMiddle',
  'namePrefix',
  'nameSuffix',
  'cached_fullName',
  'cached_birthDate',
  'cached_deathDate',
  'gender',
  'cached_familyName',
]);

function bytesToBinary(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return binary;
}

function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64Url(bytes) {
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeBase64Url(value) {
  const padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  return binaryToBytes(atob(base64));
}

export async function buildChartSharePayload(chartDoc, {
  generationsUp = chartDoc?.builderConfig?.common?.generations ?? 5,
  generationsDown = chartDoc?.builderConfig?.common?.descendantGenerations ?? 3,
} = {}) {
  const db = getLocalDatabase();
  const rootIds = [chartDoc?.roots?.primaryPersonId, chartDoc?.roots?.secondaryPersonId].filter(Boolean);
  if (rootIds.length === 0) throw new Error('Chart has no root person selected.');

  const persons = new Map();
  const families = new Map();

  const visitPerson = async (recordName, { depth = 0, direction = 'both' } = {}) => {
    if (!recordName || persons.has(recordName)) return;
    const record = await db.getRecord(recordName);
    if (!record || record.recordType !== 'Person') return;
    persons.set(recordName, trimPersonRecord(record));

    if (direction !== 'down') {
      const parents = await db.getPersonsParents(recordName);
      for (const fam of parents || []) {
        if (fam?.family?.recordName) {
          families.set(fam.family.recordName, trimFamilyRecord(fam.family));
        }
        if (depth < generationsUp) {
          if (fam?.man?.recordName) await visitPerson(fam.man.recordName, { depth: depth + 1, direction: 'up' });
          if (fam?.woman?.recordName) await visitPerson(fam.woman.recordName, { depth: depth + 1, direction: 'up' });
        }
      }
    }
    if (direction !== 'up') {
      const households = await db.getPersonsChildrenInformation(recordName);
      for (const fam of households || []) {
        if (fam?.family?.recordName) {
          families.set(fam.family.recordName, trimFamilyRecord(fam.family));
        }
        if (fam?.partner?.recordName) persons.set(fam.partner.recordName, persons.get(fam.partner.recordName) || trimPersonRecord(fam.partner));
        if (depth < generationsDown) {
          for (const child of fam.children || []) {
            if (child?.recordName) await visitPerson(child.recordName, { depth: depth + 1, direction: 'down' });
          }
        }
      }
    }
  };

  for (const id of rootIds) {
    await visitPerson(id, { depth: 0, direction: 'both' });
  }

  return {
    version: SHARE_PAYLOAD_VERSION,
    chart: trimChartDocument(chartDoc),
    trees: await buildShareTrees(chartDoc, { generationsUp, generationsDown }),
    persons: Object.fromEntries(persons),
    families: Object.fromEntries(families),
  };
}

async function buildShareTrees(chartDoc, { generationsUp, generationsDown }) {
  const rootId = chartDoc?.roots?.primaryPersonId;
  const secondId = chartDoc?.roots?.secondaryPersonId;
  if (!rootId) return {};

  const [ancestorTree, descendantTree, secondAncestorTree] = await Promise.all([
    buildAncestorTree(rootId, generationsUp),
    buildDescendantTree(rootId, generationsDown),
    secondId ? buildAncestorTree(secondId, generationsUp) : Promise.resolve(null),
  ]);

  return {
    ancestorTree,
    descendantTree,
    secondAncestorTree,
  };
}

export async function encodeSharePayload(payload) {
  const text = JSON.stringify(payload);
  return encodeBase64Url(LZString.compressToUint8Array(text));
}

export async function decodeSharePayload(token) {
  if (!token) throw new Error('Missing share token.');
  const text = LZString.decompressFromUint8Array(decodeBase64Url(token));
  if (!text) throw new Error('Unable to decode share token.');
  return JSON.parse(text);
}

export async function buildShareUrl(chartDoc, { baseUrl = window.location.origin, basePath = '/' } = {}) {
  const payload = await buildChartSharePayload(chartDoc);
  const token = await encodeSharePayload(payload);
  const url = buildShareLinkUrl(token, { baseUrl, basePath });
  return { url, token, payload };
}

export function buildShareLinkUrl(token, { baseUrl = window.location.origin, basePath = '/' } = {}) {
  if (!token) throw new Error('Missing share token.');
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const urlBase = `${baseUrl.replace(/\/$/, '')}${normalizedBase}`;
  const params = new URLSearchParams({ p: `/view/${encodeURIComponent(token)}` });
  return `${urlBase}?${params.toString()}`;
}

function trimChartDocument(doc) {
  if (!doc) return null;
  // Only preserve the fields the read-only renderer actually consults.
  return {
    name: doc.name,
    chartType: doc.chartType,
    roots: { ...doc.roots },
    builderConfig: doc.builderConfig,
    compositorConfig: doc.compositorConfig,
    pageSetup: doc.pageSetup,
  };
}

function trimPersonRecord(record) {
  if (!record) return null;
  const summary = personSummary(record);
  const fields = {};
  for (const [key, value] of Object.entries(record.fields || {})) {
    if (!FIELD_WHITELIST.has(key)) continue;
    fields[key] = value;
  }
  return {
    recordName: record.recordName,
    recordType: record.recordType,
    summary: summary ? {
      fullName: summary.fullName,
      birthDate: summary.birthDate || '',
      deathDate: summary.deathDate || '',
      gender: summary.gender,
    } : null,
    fields,
  };
}

function trimFamilyRecord(record) {
  if (!record) return null;
  const fields = {};
  for (const key of ['man', 'woman', 'cached_familyName']) {
    if (record.fields?.[key]) fields[key] = record.fields[key];
  }
  return {
    recordName: record.recordName,
    recordType: record.recordType,
    fields,
  };
}
