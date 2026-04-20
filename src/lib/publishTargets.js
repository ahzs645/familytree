import { getLocalDatabase } from './LocalDatabase.js';

const META_KEY = 'websitePublishTarget';
const HISTORY_META_KEY = 'websitePublishHistory';
const HISTORY_MAX_ENTRIES = 50;

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
  return normalizePublishTarget(target || DEFAULT_PUBLISH_TARGET);
}

export async function savePublishTarget(target) {
  const normalized = normalizePublishTarget(target);
  await getLocalDatabase().setMeta(META_KEY, normalized);
  return normalized;
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
    id: `publish-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
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
