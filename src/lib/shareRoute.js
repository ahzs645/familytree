export function buildHashShareUrl(token, { baseUrl = window.location.origin, basePath = '/' } = {}) {
  if (!token) throw new Error('Missing share token.');
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const urlBase = `${baseUrl.replace(/\/$/, '')}${normalizedBase}`;
  return `${urlBase}#/view/${encodeURIComponent(token)}`;
}

export function getShareTokenFromHash(hash = window.location.hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const match = raw.match(/^\/?view\/(.+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
