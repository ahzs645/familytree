import { getLocalDatabase } from './LocalDatabase.js';
import { generateId } from './ids.js';

const META_KEY = 'websitePublishTarget';
const HISTORY_META_KEY = 'websitePublishHistory';
const HISTORY_MAX_ENTRIES = 50;
const SESSION_SECRET_KEY = 'websitePublishTargetSecret';
const SESSION_WEBHOOK_HEADER_KEY = 'websitePublishTargetWebhookHeader';

export const DEFAULT_PUBLISH_TARGET = {
  mode: 'download',
  name: 'Default target',
  host: '',
  port: '',
  remotePath: '/',
  username: '',
  secret: '',
  webhookUrl: '',
  webhookHeader: '',
};

export async function getPublishTarget() {
  const target = await getLocalDatabase().getMeta(META_KEY);
  const normalized = normalizePublishTarget(target || DEFAULT_PUBLISH_TARGET);
  if (normalized.secret || normalized.webhookHeader) {
    writeSessionValue(SESSION_SECRET_KEY, normalized.secret);
    writeSessionValue(SESSION_WEBHOOK_HEADER_KEY, normalized.webhookHeader);
    await getLocalDatabase().setMeta(META_KEY, persistedPublishTarget(normalized));
  }
  return withSessionSecrets(normalized);
}

export async function savePublishTarget(target) {
  const normalized = normalizePublishTarget(target);
  writeSessionValue(SESSION_SECRET_KEY, normalized.secret);
  writeSessionValue(SESSION_WEBHOOK_HEADER_KEY, normalized.webhookHeader);
  await getLocalDatabase().setMeta(META_KEY, persistedPublishTarget(normalized));
  return withSessionSecrets(normalized);
}

export function normalizePublishTarget(target = {}) {
  const mode = ['download', 'ftp', 'sftp', 'webhook'].includes(target.mode) ? target.mode : 'download';
  return {
    ...DEFAULT_PUBLISH_TARGET,
    ...target,
    mode,
    name: String(target.name || DEFAULT_PUBLISH_TARGET.name).trim() || DEFAULT_PUBLISH_TARGET.name,
    host: String(target.host || '').trim(),
    port: String(target.port || '').trim(),
    remotePath: String(target.remotePath || '/').trim() || '/',
    username: String(target.username || '').trim(),
    secret: String(target.secret || ''),
    webhookUrl: String(target.webhookUrl || '').trim(),
    webhookHeader: String(target.webhookHeader || '').trim(),
  };
}

function persistedPublishTarget(target) {
  return {
    ...normalizePublishTarget(target),
    secret: '',
    webhookHeader: '',
  };
}

function withSessionSecrets(target) {
  return {
    ...normalizePublishTarget(target),
    secret: readSessionValue(SESSION_SECRET_KEY),
    webhookHeader: readSessionValue(SESSION_WEBHOOK_HEADER_KEY),
  };
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

export function validatePublishTarget(target) {
  const normalized = normalizePublishTarget(target);
  const errors = [];
  if (normalized.mode === 'ftp' || normalized.mode === 'sftp') {
    if (!normalized.host) errors.push('Host is required.');
    if (!normalized.username) errors.push('Username is required.');
    if (!normalized.remotePath) errors.push('Remote path is required.');
  }
  if (normalized.mode === 'webhook') {
    if (!/^https?:\/\//i.test(normalized.webhookUrl)) errors.push('Webhook URL must start with http:// or https://.');
  }
  return { target: normalized, errors, canPublish: errors.length === 0 };
}

export function publishTargetActionLabel(mode) {
  if (mode === 'webhook') return 'Publish to webhook';
  if (mode === 'ftp' || mode === 'sftp') return `Prepare ${mode.toUpperCase()} upload package`;
  return 'Download website zip';
}

export function publishTargetModeDescription(mode) {
  if (mode === 'webhook') return 'Webhook sends the generated zip to the configured endpoint.';
  if (mode === 'ftp' || mode === 'sftp') return `${mode.toUpperCase()} currently prepares a zip package and records the destination details; it does not upload directly from the browser.`;
  return 'Download saves a generated website zip for manual hosting or archiving.';
}

/**
 * Publish history — append-only log so the Websites route can surface past
 * publishes with their target, status, and any validation warnings. Entries
 * are persisted in the local meta store so they survive reloads.
 */
export async function listPublishHistory() {
  const list = await getLocalDatabase().getMeta(HISTORY_META_KEY);
  return Array.isArray(list) ? list : [];
}

export async function recordPublishHistoryEntry(entry) {
  const db = getLocalDatabase();
  const current = await listPublishHistory();
  const stamped = {
    id: generateId('publish', { randomLength: 4 }),
    timestamp: new Date().toISOString(),
    mode: entry?.mode || 'download',
    targetName: entry?.targetName || '',
    status: entry?.status || 'unknown',
    siteTitle: entry?.siteTitle || '',
    validationLog: Array.isArray(entry?.validationLog) ? entry.validationLog : [],
    message: entry?.message || '',
  };
  const next = [stamped, ...current].slice(0, HISTORY_MAX_ENTRIES);
  await db.setMeta(HISTORY_META_KEY, next);
  return stamped;
}

export async function clearPublishHistory() {
  await getLocalDatabase().setMeta(HISTORY_META_KEY, []);
}

export async function postWebsiteToWebhook({ blob, target, siteTitle }) {
  const normalized = normalizePublishTarget(target);
  const headers = {
    'Content-Type': 'application/zip',
    'X-CloudTreeWeb-Site': siteTitle || 'Family Tree',
  };
  if (normalized.webhookHeader) {
    const [name, ...valueParts] = normalized.webhookHeader.split(':');
    if (name && valueParts.length) headers[name.trim()] = valueParts.join(':').trim();
  }
  const response = await fetch(normalized.webhookUrl, {
    method: 'POST',
    headers,
    body: blob,
  });
  if (!response.ok) throw new Error(`Webhook returned ${response.status}`);
  return { status: response.status };
}
