import { getLocalDatabase } from './LocalDatabase.js';
import { readField } from './schema.js';
import { personSummary } from '../models/index.js';

const META_KEY = 'familySearchApiConfig';
const SESSION_ACCESS_TOKEN_KEY = 'familySearchApiAccessToken';
const SESSION_PKCE_VERIFIER_KEY = 'familySearchPkceVerifier';
const SESSION_PKCE_STATE_KEY = 'familySearchPkceState';

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

// OAuth2 authorization/token paths (relative to identBase). The token endpoint is
// exposed as a configurable override (config.tokenEndpoint) because in a backend-less
// browser build the FamilySearch token endpoint usually cannot be reached directly
// (CORS + client-secret), so a deployment may point this at a same-origin proxy.
export const FAMILYSEARCH_OAUTH_AUTHORIZE_PATH = '/cis-web/oauth2/v3/authorization';
export const FAMILYSEARCH_OAUTH_TOKEN_PATH = '/cis-web/oauth2/v3/token';

export const DEFAULT_FAMILYSEARCH_CONFIG = {
  environment: 'beta',
  clientId: '',
  redirectUri: defaultRedirectUri(),
  accessToken: '',
  termsConfirmed: false,
  // Optional override for the OAuth2 token endpoint. Leave blank to use the
  // selected environment's identBase + FAMILYSEARCH_OAUTH_TOKEN_PATH. Point this at
  // a backend proxy URL when running without direct cross-origin token access.
  tokenEndpoint: '',
};

export async function getFamilySearchConfig() {
  const config = await getLocalDatabase().getMeta(META_KEY);
  const normalized = normalizeFamilySearchConfig(config || DEFAULT_FAMILYSEARCH_CONFIG);
  if (normalized.accessToken && readSessionValue(SESSION_ACCESS_TOKEN_KEY) !== normalized.accessToken) {
    writeSessionValue(SESSION_ACCESS_TOKEN_KEY, normalized.accessToken);
    await getLocalDatabase().setMeta(META_KEY, persistedFamilySearchConfig(normalized));
  }
  return {
    ...normalized,
    accessToken: readSessionValue(SESSION_ACCESS_TOKEN_KEY) || normalized.accessToken,
  };
}

export async function saveFamilySearchConfig(config) {
  const normalized = normalizeFamilySearchConfig(config);
  writeSessionValue(SESSION_ACCESS_TOKEN_KEY, normalized.accessToken);
  await getLocalDatabase().setMeta(META_KEY, persistedFamilySearchConfig(normalized));
  return {
    ...normalized,
    accessToken: readSessionValue(SESSION_ACCESS_TOKEN_KEY),
  };
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
    tokenEndpoint: String(config.tokenEndpoint || '').trim(),
  };
}

function persistedFamilySearchConfig(config) {
  const { accessToken, ...persisted } = normalizeFamilySearchConfig(config);
  return persisted;
}

function readSessionValue(key) {
  try {
    return sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeSessionValue(key, value) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    /* sessionStorage can be unavailable */
  }
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
  return `${env.identBase}${FAMILYSEARCH_OAUTH_AUTHORIZE_PATH}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// PKCE OAuth2 (Authorization Code + Proof Key for Code Exchange, S256).
// ---------------------------------------------------------------------------

function base64UrlEncode(bytes) {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generate a high-entropy PKCE code verifier (RFC 7636, 43-128 chars). */
export function generatePkceCodeVerifier() {
  const random = new Uint8Array(32);
  (globalThis.crypto || window.crypto).getRandomValues(random);
  return base64UrlEncode(random);
}

/** Derive the S256 code challenge for a verifier. */
export async function derivePkceCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await (globalThis.crypto || window.crypto).subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/**
 * Build the PKCE authorization URL, persisting the verifier + state in sessionStorage
 * so the redirect handler can complete the exchange. Returns { url, state, verifier }.
 */
export async function beginFamilySearchPkceAuthorization(config, { state = '' } = {}) {
  const normalized = normalizeFamilySearchConfig(config);
  if (!normalized.clientId) throw new Error('FamilySearch client ID is required.');
  if (!normalized.redirectUri) throw new Error('FamilySearch redirect URI is required.');
  const verifier = generatePkceCodeVerifier();
  const challenge = await derivePkceCodeChallenge(verifier);
  const resolvedState = state || `ctw-${Date.now().toString(36)}`;
  writeSessionValue(SESSION_PKCE_VERIFIER_KEY, verifier);
  writeSessionValue(SESSION_PKCE_STATE_KEY, resolvedState);
  const env = FAMILYSEARCH_ENVIRONMENTS[normalized.environment];
  const params = new URLSearchParams({
    client_id: normalized.clientId,
    redirect_uri: normalized.redirectUri,
    response_type: 'code',
    scope: 'openid profile email qualifies_for_affiliate_account country',
    state: resolvedState,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return {
    url: `${env.identBase}${FAMILYSEARCH_OAUTH_AUTHORIZE_PATH}?${params.toString()}`,
    state: resolvedState,
    verifier,
  };
}

export function readStoredPkceState() {
  return readSessionValue(SESSION_PKCE_STATE_KEY);
}

export function clearFamilySearchPkceState() {
  writeSessionValue(SESSION_PKCE_VERIFIER_KEY, '');
  writeSessionValue(SESSION_PKCE_STATE_KEY, '');
}

function resolveTokenEndpoint(normalized) {
  if (normalized.tokenEndpoint) return normalized.tokenEndpoint;
  const env = FAMILYSEARCH_ENVIRONMENTS[normalized.environment];
  return `${env.identBase}${FAMILYSEARCH_OAUTH_TOKEN_PATH}`;
}

/**
 * Exchange an authorization code for an access token using the stored PKCE verifier.
 *
 * NOTE: In a backend-less browser build this request will usually FAIL with a CORS
 * error because the FamilySearch token endpoint does not send permissive CORS headers
 * (and a confidential client would also need a client secret). When that happens the
 * caller should fall back to the manual access-token paste flow. To make this work
 * end-to-end, deploy a same-origin backend proxy and set config.tokenEndpoint to it.
 *
 * @returns {Promise<{ accessToken: string, raw: object }>}
 */
export async function exchangeFamilySearchAuthorizationCode(config, code, { state = '' } = {}) {
  const normalized = normalizeFamilySearchConfig(config);
  if (!code) throw new Error('Authorization code is required.');
  const expectedState = readSessionValue(SESSION_PKCE_STATE_KEY);
  if (state && expectedState && state !== expectedState) {
    throw new Error('OAuth state mismatch — possible CSRF; aborting token exchange.');
  }
  const verifier = readSessionValue(SESSION_PKCE_VERIFIER_KEY);
  if (!verifier) throw new Error('Missing PKCE code verifier — restart the authorization flow.');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: normalized.clientId,
    redirect_uri: normalized.redirectUri,
    code_verifier: verifier,
  });
  let response;
  try {
    response = await fetch(resolveTokenEndpoint(normalized), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });
  } catch (error) {
    // Most commonly a CORS/network failure in the browser-only build.
    throw new Error(`Token exchange request failed (likely CORS — a backend proxy is required): ${error.message}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Token exchange ${response.status}: ${text.slice(0, 240) || response.statusText}`);
  }
  const raw = await response.json().catch(() => ({}));
  const accessToken = raw.access_token || raw.token || '';
  if (!accessToken) throw new Error('Token endpoint returned no access_token.');
  clearFamilySearchPkceState();
  return { accessToken, raw };
}

export async function familySearchRequest(config, path, {
  method = 'GET',
  headers = {},
  body = null,
  accept = 'application/x-gedcomx-v1+json',
  contentType = null,
  // When true, resolve with { status, headers, data } so callers can read response
  // headers (e.g. the Location header carrying a freshly-created resource id).
  returnResponse = false,
} = {}) {
  const normalized = normalizeFamilySearchConfig(config);
  if (!normalized.termsConfirmed) throw new Error('Confirm FamilySearch terms and API eligibility before calling the API.');
  if (!normalized.accessToken) throw new Error('FamilySearch access token is required.');
  const env = FAMILYSEARCH_ENVIRONMENTS[normalized.environment];
  let response;
  try {
    response = await fetch(`${env.apiBase}${path}`, {
      method,
      headers: {
        Accept: accept,
        Authorization: `Bearer ${normalized.accessToken}`,
        // FormData sets its own multipart Content-Type (with boundary); never override it.
        ...(contentType && !(body instanceof FormData) ? { 'Content-Type': contentType } : {}),
        ...headers,
      },
      body,
    });
  } catch (error) {
    // Network/CORS failures (common in the backend-less browser build). A backend
    // proxy is required for cross-origin FamilySearch API access — see token-exchange note.
    throw new Error(`FamilySearch request failed (network/CORS — a backend proxy may be required): ${error.message}`);
  }
  if (!response.ok && response.status !== 204) {
    const text = await response.text().catch(() => '');
    throw new Error(`FamilySearch ${response.status}: ${text.slice(0, 240) || response.statusText}`);
  }
  if (response.status === 204) {
    const empty = { status: response.status, headers: response.headers, data: null };
    return returnResponse ? empty : empty;
  }
  const content = response.headers.get('content-type') || '';
  const data = content.includes('json') ? await response.json() : await response.text();
  if (returnResponse) return { status: response.status, headers: response.headers, data };
  return data;
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

// ---------------------------------------------------------------------------
// Upload local person -> FamilySearch Family Tree.
// ---------------------------------------------------------------------------

/**
 * Create a new FamilySearch tree person from a local record. Reuses the same
 * GEDCOM X serializer used for match search. Returns the created person id when
 * FamilySearch echoes it in the Location/X-Entity-Identity header.
 */
export async function uploadFamilySearchPerson(config, localPerson, { reason = '' } = {}) {
  const gedcomx = localPersonToGedcomX(localPerson);
  // /platform/tree/persons expects a GEDCOM X `persons` collection (no `description`).
  const body = JSON.stringify({ persons: gedcomx.persons });
  const result = await familySearchRequest(config, '/platform/tree/persons', {
    method: 'POST',
    accept: 'application/x-fs-v1+json',
    contentType: 'application/x-gedcomx-v1+json',
    headers: reason?.trim() ? { 'X-Reason': reason.trim() } : {},
    body,
    returnResponse: true,
  });
  return {
    personId: extractCreatedPersonId(result),
    status: result?.status ?? null,
  };
}

function extractCreatedPersonId(result) {
  const headers = result?.headers;
  if (!headers || typeof headers.get !== 'function') return '';
  const location = headers.get('Location') || headers.get('X-ENTITY-IDENTITY') || '';
  const match = String(location).match(/persons\/([^/?]+)/i);
  return match ? match[1] : '';
}

// ---------------------------------------------------------------------------
// Per-conclusion sync helpers (download / upload / replace / delete).
// ---------------------------------------------------------------------------

/**
 * Build a per-field sync model from a local person and a remote FamilySearch payload.
 * Each row exposes the candidate actions the UI can offer (all gated behind a reason
 * prompt before any write). This is pure logic — no network calls.
 */
export function buildFamilySearchSyncRows(localPerson, remotePayload) {
  const local = personSummary(localPerson) || {};
  const remote = summarizeRemotePerson(remotePayload);
  const conclusions = [
    { field: 'Name', conclusion: 'name', local: local.fullName, remote: remote.name },
    { field: 'Gender', conclusion: 'gender', local: localGender(localPerson), remote: remote.gender },
    { field: 'Birth', conclusion: 'birth', local: readField(localPerson, ['cached_birthDate', 'birthDate'], ''), remote: remote.birth },
    { field: 'Death', conclusion: 'death', local: readField(localPerson, ['cached_deathDate', 'deathDate'], ''), remote: remote.death },
  ];
  return conclusions.map(({ field, conclusion, local: localValue, remote: remoteValue }) => {
    const localText = String(localValue || '').trim();
    const remoteText = String(remoteValue || '').trim();
    const status = localText && remoteText && localText.toLowerCase() === remoteText.toLowerCase()
      ? 'same'
      : localText && remoteText ? 'different' : 'missing';
    const actions = [];
    if (remoteText && remoteText !== localText) actions.push('download');
    if (localText && localText !== remoteText) actions.push('upload');
    if (localText && remoteText && status === 'different') actions.push('replace');
    if (remoteText) actions.push('delete');
    return { field, conclusion, local: localText, remote: remoteText, status, actions };
  });
}

/**
 * Perform a single sync action against FamilySearch. `direction` is one of
 * download | upload | replace | delete. Download is a no-op write remotely (the
 * caller persists locally); upload/replace POST the local conclusion; delete removes
 * the remote conclusion. All writes carry the required FamilySearch reason header.
 */
export async function applyFamilySearchSyncAction(config, {
  personId,
  row,
  direction,
  localPerson,
  reason,
}) {
  if (!reason?.trim()) throw new Error('A FamilySearch reason is required for this change.');
  if (!personId) throw new Error('FamilySearch person ID is required.');
  if (direction === 'download') {
    // Pulling a remote value into the local tree is handled by the caller; nothing
    // to write to FamilySearch here.
    return { direction, applied: 'local', value: row?.remote || '' };
  }
  const gedcomx = localPersonToGedcomX(localPerson);
  const person = gedcomx.persons[0] || {};
  let payloadPerson = null;
  if (row.conclusion === 'name') payloadPerson = { names: person.names || [] };
  else if (row.conclusion === 'gender') payloadPerson = person.gender ? { gender: person.gender } : null;
  else if (row.conclusion === 'birth' || row.conclusion === 'death') {
    const tag = row.conclusion === 'birth' ? 'Birth' : 'Death';
    const fact = (person.facts || []).find((item) => String(item.type || '').endsWith(`/${tag}`));
    payloadPerson = fact ? { facts: [fact] } : null;
  }
  if (direction === 'delete') {
    return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}/conclusions`, {
      method: 'DELETE',
      accept: 'application/x-fs-v1+json',
      headers: { 'X-Reason': reason.trim() },
    });
  }
  if (!payloadPerson) throw new Error('No local value to upload for this conclusion.');
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}`, {
    method: 'POST',
    accept: 'application/x-fs-v1+json',
    contentType: 'application/x-gedcomx-v1+json',
    headers: { 'X-Reason': reason.trim() },
    body: JSON.stringify({ persons: [{ id: personId, ...payloadPerson }] }),
  });
}

// ---------------------------------------------------------------------------
// Memories (/platform/memories).
// ---------------------------------------------------------------------------

/** Upload a memory artifact (photo / document / story) as multipart form data. */
export async function uploadFamilySearchMemory(config, { file, title = '', description = '', filename = '' } = {}) {
  if (!file) throw new Error('A file is required to upload a memory.');
  const form = new FormData();
  form.append('artifact', file, filename || file.name || 'memory');
  if (title) form.append('title', title);
  if (description) form.append('description', description);
  // Do NOT set Content-Type — the browser adds the multipart boundary.
  const result = await familySearchRequest(config, '/platform/memories/memories', {
    method: 'POST',
    accept: 'application/x-fs-v1+json',
    body: form,
    returnResponse: true,
  });
  return {
    memoryId: extractCreatedMemoryId(result),
    status: result?.status ?? null,
  };
}

function extractCreatedMemoryId(result) {
  const headers = result?.headers;
  if (!headers || typeof headers.get !== 'function') return '';
  const location = headers.get('Location') || '';
  const match = String(location).match(/memories\/([^/?]+)/i);
  return match ? match[1] : '';
}

/** List memories attached to a FamilySearch person. */
export async function listFamilySearchPersonMemories(config, personId) {
  if (!personId) throw new Error('FamilySearch person ID is required.');
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}/memories`, {
    accept: 'application/x-fs-v1+json',
  });
}

/** Fetch the portrait memory URL for a FamilySearch person (302 to the image). */
export async function readFamilySearchPortrait(config, personId) {
  if (!personId) throw new Error('FamilySearch person ID is required.');
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}/portrait`, {
    accept: 'application/x-fs-v1+json',
  });
}

// ---------------------------------------------------------------------------
// Record matches / hints (/platform/tree/persons/{id}/matches).
// ---------------------------------------------------------------------------

/** Retrieve record hints (record matches) for a FamilySearch person. */
export async function listFamilySearchRecordMatches(config, personId, { count = 25 } = {}) {
  if (!personId) throw new Error('FamilySearch person ID is required.');
  const params = new URLSearchParams({ count: String(count) });
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}/matches?${params.toString()}`, {
    accept: 'application/x-gedcomx-atom+json',
  });
}

/**
 * Update the status of a record match (accept / reject / pending). FamilySearch
 * models this as PUT/DELETE on the match-status resource; we POST a status update
 * with the reason header so the same workflow drives accept/reject/pending.
 */
export async function setFamilySearchRecordMatchStatus(config, { personId, matchId, status, reason = '' } = {}) {
  if (!personId || !matchId) throw new Error('Person ID and match ID are required.');
  const normalizedStatus = String(status || '').toLowerCase();
  const statusEnum = normalizedStatus === 'accepted' ? 'http://familysearch.org/v1/Accepted'
    : normalizedStatus === 'rejected' ? 'http://familysearch.org/v1/Rejected'
      : 'http://familysearch.org/v1/Pending';
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}/matches/${encodeURIComponent(matchId)}`, {
    method: 'PUT',
    accept: 'application/x-fs-v1+json',
    contentType: 'application/x-fs-v1+json',
    headers: reason?.trim() ? { 'X-Reason': reason.trim() } : {},
    body: JSON.stringify({ status: statusEnum }),
  });
}

/** Mark all record matches for a person as seen. */
export async function markFamilySearchRecordMatchesSeen(config, personId) {
  if (!personId) throw new Error('FamilySearch person ID is required.');
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}/matches`, {
    method: 'PUT',
    accept: 'application/x-fs-v1+json',
    contentType: 'application/json',
    body: JSON.stringify({ status: 'http://familysearch.org/v1/Seen' }),
  });
}

/** Normalize a GEDCOM X Atom record-match feed into flat rows for the UI. */
export function normalizeRecordMatchFeed(feed) {
  const entries = feed?.entries || feed?.results || [];
  return entries.map((entry, index) => {
    const person = entry?.content?.gedcomx?.persons?.[0] || entry?.gedcomx?.persons?.[0] || {};
    return {
      id: entry?.id || person.id || `match-${index}`,
      title: entry?.title || person.display?.name || person.names?.[0]?.nameForms?.[0]?.fullText || 'Untitled match',
      score: entry?.score ?? entry?.confidence ?? null,
      collection: entry?.content?.gedcomx?.sourceDescriptions?.[0]?.titles?.[0]?.value
        || entry?.collection?.title || '',
      url: entry?.links?.self?.href || entry?.id || '',
    };
  });
}

// ---------------------------------------------------------------------------
// Discussions (/platform/discussions).
// ---------------------------------------------------------------------------

/** List discussion references attached to a FamilySearch person. */
export async function listFamilySearchDiscussions(config, personId) {
  if (!personId) throw new Error('FamilySearch person ID is required.');
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}/discussion-references`, {
    accept: 'application/x-fs-v1+json',
  });
}

/** Read the comments on a discussion. */
export async function listFamilySearchDiscussionComments(config, discussionId) {
  if (!discussionId) throw new Error('Discussion ID is required.');
  return familySearchRequest(config, `/platform/discussions/discussions/${encodeURIComponent(discussionId)}/comments`, {
    accept: 'application/x-fs-v1+json',
  });
}

/** Create a new discussion (used by the composer). */
export async function createFamilySearchDiscussion(config, { title, details } = {}) {
  if (!title?.trim()) throw new Error('A discussion title is required.');
  const body = JSON.stringify({
    discussions: [{ title: title.trim(), details: String(details || '').trim() }],
  });
  const result = await familySearchRequest(config, '/platform/discussions/discussions', {
    method: 'POST',
    accept: 'application/x-fs-v1+json',
    contentType: 'application/x-fs-v1+json',
    body,
    returnResponse: true,
  });
  return { status: result?.status ?? null, raw: result };
}

/** Add a comment to an existing discussion. */
export async function addFamilySearchDiscussionComment(config, discussionId, text) {
  if (!discussionId) throw new Error('Discussion ID is required.');
  if (!text?.trim()) throw new Error('Comment text is required.');
  return familySearchRequest(config, `/platform/discussions/discussions/${encodeURIComponent(discussionId)}/comments`, {
    method: 'POST',
    accept: 'application/x-fs-v1+json',
    contentType: 'application/x-fs-v1+json',
    body: JSON.stringify({ discussions: [{ comments: [{ text: text.trim() }] }] }),
  });
}

// ---------------------------------------------------------------------------
// Change history / updated-persons feed.
// ---------------------------------------------------------------------------

/** Read the change history for a FamilySearch person. */
export async function readFamilySearchChangeHistory(config, personId) {
  if (!personId) throw new Error('FamilySearch person ID is required.');
  return familySearchRequest(config, `/platform/tree/persons/${encodeURIComponent(personId)}/changes`, {
    accept: 'application/x-gedcomx-atom+json',
  });
}

/** Normalize a change-history Atom feed into flat rows. */
export function normalizeChangeHistoryFeed(feed) {
  const entries = feed?.entries || [];
  return entries.map((entry, index) => ({
    id: entry?.id || `change-${index}`,
    title: entry?.title || '',
    updated: entry?.updated || '',
    contributor: entry?.contributors?.[0]?.name || entry?.author?.name || '',
  }));
}

/** Build an outbound link to a person on the FamilySearch.org website. */
export function familySearchPersonWebUrl(config, personId) {
  if (!personId) return '';
  const normalized = normalizeFamilySearchConfig(config);
  const host = normalized.environment === 'production'
    ? 'https://www.familysearch.org'
    : normalized.environment === 'beta'
      ? 'https://beta.familysearch.org'
      : 'https://integration.familysearch.org';
  return `${host}/tree/person/details/${encodeURIComponent(personId)}`;
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
