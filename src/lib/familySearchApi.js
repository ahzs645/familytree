import { getLocalDatabase } from './LocalDatabase.js';
import { readField } from './schema.js';
import { personSummary } from '../models/index.js';

const META_KEY = 'familySearchApiConfig';

export const FAMILYSEARCH_ENVIRONMENTS = {
  production: {
    label: 'Production',
    apiBase: 'https://api.familysearch.org',
    identBase: 'https://ident.familysearch.org',
  },
  beta: {
    label: 'Beta',
    apiBase: 'https://apibeta.familysearch.org',
    identBase: 'https://identbeta.familysearch.org',
  },
  integration: {
    label: 'Integration',
    apiBase: 'https://api-integ.familysearch.org',
    identBase: 'https://identint.familysearch.org',
  },
};

export const DEFAULT_FAMILYSEARCH_CONFIG = {
  environment: 'beta',
  clientId: '',
  redirectUri: defaultRedirectUri(),
  accessToken: '',
  termsConfirmed: false,
};

export async function getFamilySearchConfig() {
  const config = await getLocalDatabase().getMeta(META_KEY);
  return normalizeFamilySearchConfig(config || DEFAULT_FAMILYSEARCH_CONFIG);
}

export async function saveFamilySearchConfig(config) {
  const normalized = normalizeFamilySearchConfig(config);
  await getLocalDatabase().setMeta(META_KEY, normalized);
  return normalized;
}

export function normalizeFamilySearchConfig(config = {}) {
  const environment = FAMILYSEARCH_ENVIRONMENTS[config.environment] ? config.environment : DEFAULT_FAMILYSEARCH_CONFIG.environment;
  return {
    ...DEFAULT_FAMILYSEARCH_CONFIG,
    ...config,
    environment,
    clientId: String(config.clientId || '').trim(),
    redirectUri: String(config.redirectUri || DEFAULT_FAMILYSEARCH_CONFIG.redirectUri).trim(),
    accessToken: String(config.accessToken || '').trim(),
    termsConfirmed: !!config.termsConfirmed,
  };
}

export function buildFamilySearchAuthorizationUrl(config, state = '') {
  const normalized = normalizeFamilySearchConfig(config);
  if (!normalized.clientId) throw new Error('FamilySearch client ID is required.');
  if (!normalized.redirectUri) throw new Error('FamilySearch redirect URI is required.');
  const env = FAMILYSEARCH_ENVIRONMENTS[normalized.environment];
  const params = new URLSearchParams({
    client_id: normalized.clientId,
    redirect_uri: normalized.redirectUri,
    response_type: 'code',
    scope: 'openid',
  });
  if (state) params.set('state', state);
  return `${env.identBase}/cis-web/oauth2/v3/authorization?${params.toString()}`;
}

export async function familySearchRequest(config, path, {
  method = 'GET',
  headers = {},
  body = null,
  accept = 'application/x-gedcomx-v1+json',
  contentType = null,
} = {}) {
  const normalized = normalizeFamilySearchConfig(config);
  if (!normalized.termsConfirmed) throw new Error('Confirm FamilySearch terms and API eligibility before calling the API.');
  if (!normalized.accessToken) throw new Error('FamilySearch access token is required.');
  const env = FAMILYSEARCH_ENVIRONMENTS[normalized.environment];
  const response = await fetch(`${env.apiBase}${path}`, {
    method,
    headers: {
      Accept: accept,
      Authorization: `Bearer ${normalized.accessToken}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
      ...headers,
    },
    body,
  });
  if (!response.ok && response.status !== 204) {
    const text = await response.text().catch(() => '');
    throw new Error(`FamilySearch ${response.status}: ${text.slice(0, 240) || response.statusText}`);
  }
  if (response.status === 204) return { status: response.status, headers: response.headers };
  const content = response.headers.get('content-type') || '';
  return content.includes('json') ? response.json() : response.text();
}

export async function readFamilySearchPerson(config, personId, { relatives = true } = {}) {
  if (!personId) throw new Error('FamilySearch person ID is required.');
  const params = new URLSearchParams({ relatives: relatives ? 'true' : 'false' });
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}?${params.toString()}`, {
    accept: 'application/x-gedcomx-v1+json',
  });
}

export async function findFamilySearchMatchesByExample(config, localPerson, { count = 10 } = {}) {
  const body = JSON.stringify(localPersonToGedcomX(localPerson));
  return familySearchRequest(config, `/platform/tree/matches?count=${encodeURIComponent(String(count))}`, {
    method: 'POST',
    accept: 'application/x-gedcomx-atom+json',
    contentType: 'application/x-gedcomx-v1+json',
    body,
  });
}

export async function readFamilySearchMergeAnalysis(config, survivorId, duplicateId) {
  if (!survivorId || !duplicateId) throw new Error('Both survivor and duplicate FamilySearch IDs are required.');
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(survivorId)}/merges/${encodeURIComponent(duplicateId)}`, {
    accept: 'application/x-fs-v1+json',
  });
}

export async function mergeFamilySearchPersons(config, {
  survivorId,
  duplicateId,
  reason,
  resourcesToCopy = [],
  resourcesToDelete = [],
}) {
  if (!reason?.trim()) throw new Error('A merge reason is required.');
  const body = JSON.stringify({
    merges: [{
      resourcesToDelete: resourcesToDelete.filter(Boolean).map((resource) => ({ resource })),
      resourcesToCopy: resourcesToCopy.filter(Boolean).map((resource) => ({ resource })),
    }],
  });
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(survivorId)}/merges/${encodeURIComponent(duplicateId)}`, {
    method: 'POST',
    accept: 'application/x-fs-v1+json',
    contentType: 'application/x-fs-v1+json',
    headers: { 'X-Reason': reason.trim() },
    body,
  });
}

export function compareLocalToFamilySearchPerson(localPerson, remotePayload) {
  const local = personSummary(localPerson) || {};
  const remote = summarizeRemotePerson(remotePayload);
  return [
    compareRow('Name', local.fullName, remote.name),
    compareRow('Gender', localGender(localPerson), remote.gender),
    compareRow('Birth', readField(localPerson, ['cached_birthDate', 'birthDate'], ''), remote.birth),
    compareRow('Death', readField(localPerson, ['cached_deathDate', 'deathDate'], ''), remote.death),
  ];
}

function localPersonToGedcomX(person) {
  const summary = personSummary(person) || {};
  const facts = [];
  const birth = readField(person, ['cached_birthDate', 'birthDate'], '');
  const death = readField(person, ['cached_deathDate', 'deathDate'], '');
  if (birth) facts.push({ type: 'http://gedcomx.org/Birth', date: { original: birth } });
  if (death) facts.push({ type: 'http://gedcomx.org/Death', date: { original: death } });
  return {
    description: '#primaryPerson',
    persons: [{
      id: 'primaryPerson',
      ...(localGender(person) ? { gender: { type: localGender(person) === 'Female' ? 'http://gedcomx.org/Female' : 'http://gedcomx.org/Male' } } : {}),
      names: summary.fullName ? [{
        type: 'http://gedcomx.org/BirthName',
        nameForms: [{ fullText: summary.fullName }],
      }] : [],
      facts,
    }],
  };
}

function summarizeRemotePerson(payload) {
  const person = payload?.persons?.[0] || payload?.person || {};
  const name = person.names?.[0]?.nameForms?.[0]?.fullText || person.display?.name || person.id || '';
  const genderUri = person.gender?.type || '';
  const facts = person.facts || [];
  return {
    id: person.id,
    name,
    gender: genderUri.endsWith('/Female') ? 'Female' : genderUri.endsWith('/Male') ? 'Male' : '',
    birth: factOriginal(facts, 'Birth'),
    death: factOriginal(facts, 'Death'),
  };
}

function factOriginal(facts, tag) {
  const fact = facts.find((item) => String(item.type || '').endsWith(`/${tag}`));
  return fact?.date?.original || fact?.place?.original || '';
}

function localGender(person) {
  const value = readField(person, ['gender'], null);
  if (value === 1 || value === '1' || value === 'Male') return 'Male';
  if (value === 2 || value === '2' || value === 'Female') return 'Female';
  return '';
}

function compareRow(field, localValue, remoteValue) {
  const localText = String(localValue || '').trim();
  const remoteText = String(remoteValue || '').trim();
  return {
    field,
    local: localText,
    remote: remoteText,
    status: localText && remoteText && localText.toLowerCase() === remoteText.toLowerCase()
      ? 'same'
      : localText && remoteText ? 'different' : 'missing',
  };
}

function defaultRedirectUri() {
  if (typeof window === 'undefined') return 'http://localhost';
  return window.location.origin + window.location.pathname;
}
