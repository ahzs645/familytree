import { getLocalDatabase } from './LocalDatabase.js';

const META_KEY = 'websitePublishTarget';

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
