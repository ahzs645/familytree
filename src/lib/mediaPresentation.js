const MEDIA_RECORD_TYPES = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];

export const DEFAULT_MEDIA_SLIDESHOW_SETTINGS = {
  interval: 5,
  filter: 'all',
  eventFilter: 'all',
  showCaption: true,
  showMetadata: false,
  loop: true,
  random: false,
  fit: 'contain',
  background: 'dark',
};

export function normalizeMediaSlideshowSettings(value = {}) {
  const settings = { ...DEFAULT_MEDIA_SLIDESHOW_SETTINGS, ...(value || {}) };
  settings.interval = clampNumber(settings.interval, 1, 60, DEFAULT_MEDIA_SLIDESHOW_SETTINGS.interval);
  settings.filter = settings.filter === 'all' || MEDIA_RECORD_TYPES.includes(settings.filter) ? settings.filter : 'all';
  settings.eventFilter = typeof settings.eventFilter === 'string' && settings.eventFilter ? settings.eventFilter : 'all';
  settings.showCaption = settings.showCaption !== false;
  settings.showMetadata = settings.showMetadata === true;
  settings.loop = settings.loop !== false;
  settings.random = settings.random === true;
  settings.fit = ['contain', 'cover', 'actual'].includes(settings.fit) ? settings.fit : DEFAULT_MEDIA_SLIDESHOW_SETTINGS.fit;
  settings.background = ['dark', 'light', 'soft'].includes(settings.background) ? settings.background : DEFAULT_MEDIA_SLIDESHOW_SETTINGS.background;
  return settings;
}

export function mediaTypesForFilter(filter) {
  const normalized = normalizeMediaSlideshowSettings({ filter }).filter;
  return normalized === 'all' ? MEDIA_RECORD_TYPES : [normalized];
}

export function mediaDisplayLabel(record) {
  return record?.fields?.caption?.value ||
    record?.fields?.title?.value ||
    record?.fields?.filename?.value ||
    record?.fields?.fileName?.value ||
    record?.fields?.url?.value ||
    record?.recordName ||
    'Media';
}

export function mediaAssetSrc(asset) {
  if (!asset?.dataBase64) return null;
  return `data:${asset.mimeType || 'application/octet-stream'};base64,${asset.dataBase64}`;
}

export function mediaRecordFallbackSrc(record) {
  const fields = record?.fields || {};
  return fields.fileURL?.value ||
    fields.url?.value ||
    fields.dataURL?.value ||
    fields.thumbnailURL?.value ||
    null;
}

export function buildMediaSlideshowSearchParams({ mediaIds = [], settings = {} } = {}) {
  const params = new URLSearchParams();
  const ids = uniqueStrings(mediaIds);
  if (ids.length) params.set('mediaIds', ids.join(','));
  const normalized = normalizeMediaSlideshowSettings(settings);
  for (const [key, value] of Object.entries(normalized)) {
    if (value !== DEFAULT_MEDIA_SLIDESHOW_SETTINGS[key]) params.set(key, String(value));
  }
  return params;
}

export function parseMediaSlideshowSearchParams(searchParams, defaults = DEFAULT_MEDIA_SLIDESHOW_SETTINGS) {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams || '');
  const selectedIds = uniqueStrings((params.get('mediaIds') || '').split(',').map((id) => decodeURIComponent(id.trim())));
  const settings = normalizeMediaSlideshowSettings({
    ...defaults,
    interval: params.has('interval') ? Number(params.get('interval')) : defaults.interval,
    filter: params.get('filter') || defaults.filter,
    eventFilter: params.get('eventFilter') || defaults.eventFilter,
    showCaption: params.has('showCaption') ? params.get('showCaption') !== 'false' : defaults.showCaption,
    showMetadata: params.has('showMetadata') ? params.get('showMetadata') === 'true' : defaults.showMetadata,
    loop: params.has('loop') ? params.get('loop') !== 'false' : defaults.loop,
    random: params.has('random') ? params.get('random') === 'true' : defaults.random,
    fit: params.get('fit') || defaults.fit,
    background: params.get('background') || defaults.background,
  });
  return { selectedIds, settings };
}

function uniqueStrings(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(String).map((item) => item.trim()).filter(Boolean))];
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
