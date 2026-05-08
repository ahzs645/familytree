/**
 * Tiny shared utilities for the website export pipeline:
 * - HTML escaping (esc / attr / bdi)
 * - Option normalization (delegates to lib/websiteOptions)
 * - Cancellation + progress helpers used across the stages
 */
import { normalizeWebsiteOptions } from '../websiteOptions.js';

export const MEDIA_TYPES = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function attr(value) {
  return esc(value).replace(/'/g, '&#39;');
}

export function bdi(value) {
  return `<bdi dir="auto">${esc(value)}</bdi>`;
}

export function normalizeOptions(options = {}) {
  return normalizeWebsiteOptions(options);
}

export function checkCanceled(signal) {
  if (!signal?.aborted) return;
  throw new DOMException('Site export canceled.', 'AbortError');
}

export function progress(onProgress, update) {
  onProgress?.(update);
}
