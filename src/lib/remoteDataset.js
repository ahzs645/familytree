/**
 * Remote dataset (`?url=…`) import — the flow behind shared deep links like
 * `/familytree/?url=https://…/family_tree_arabic.mftpkg.zip`.
 *
 * This module is the headless half: query parsing, the download with
 * determinate progress, and the size guard. The UI half lives in
 * components/RemoteDatasetLoader.jsx, which mounts inside the React tree so
 * the app shell paints immediately and every outcome — waiting, cancelled,
 * failed — has somewhere to show itself.
 *
 * Previously all of this ran in main.jsx *before* ReactDOM.render(), which
 * meant a blank white page for the whole download and a native window.confirm
 * over it; failures reached the user as nothing at all.
 */
import { getAppDataClient } from './data/index.js';
import { getShareTokenFromHash } from './shareRoute.js';

const LOADED_URL_KEY = 'cloudtreeweb-loaded-url';
export const REMOTE_IMPORT_ENABLED = import.meta.env.DEV
  || import.meta.env.VITE_ENABLE_REMOTE_IMPORT === 'true';
export const MAX_REMOTE_IMPORT_BYTES = Number(import.meta.env.VITE_MAX_REMOTE_IMPORT_BYTES)
  || 50 * 1024 * 1024;

function currentRoutePath() {
  try {
    const basePath = new URL(import.meta.env?.BASE_URL || '/', window.location.origin)
      .pathname.replace(/\/?$/, '/');
    let path = window.location.pathname;
    if (basePath !== '/' && path.startsWith(basePath)) {
      path = path.slice(basePath.length);
    }
    return path.replace(/^\/+/, '');
  } catch {
    return window.location.pathname.replace(/^\/+/, '');
  }
}

export function isSharePreviewRoute() {
  return currentRoutePath().startsWith('view/') || Boolean(getShareTokenFromHash());
}

export function getDatasetUrlFromQuery(search = window.location.search) {
  try {
    const raw = new URLSearchParams(search).get('url');
    if (!raw) return null;
    return new URL(raw, window.location.href).href;
  } catch {
    return null;
  }
}

function readLoadedUrl() {
  try {
    return localStorage.getItem(LOADED_URL_KEY);
  } catch {
    return null;
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function tooLarge(bytes) {
  return new Error(`Remote dataset is too large (${formatBytes(bytes)}). The limit is ${formatBytes(MAX_REMOTE_IMPORT_BYTES)}.`);
}

/**
 * Stream the response so progress is determinate and the size cap is enforced
 * as bytes arrive. The old code trusted `content-length` — absent on a chunked
 * response, which let an oversized download through and only tripped the guard
 * once the whole thing was already buffered in memory.
 */
async function readAllWithProgress(res, onProgress) {
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_REMOTE_IMPORT_BYTES) throw tooLarge(declared);

  if (!res.body?.getReader) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_REMOTE_IMPORT_BYTES) throw tooLarge(bytes.byteLength);
    onProgress?.({ loaded: bytes.byteLength, total: declared || bytes.byteLength });
    return bytes;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loaded += value.byteLength;
    if (loaded > MAX_REMOTE_IMPORT_BYTES) {
      reader.cancel().catch(() => {});
      throw tooLarge(loaded);
    }
    chunks.push(value);
    onProgress?.({ loaded, total: declared });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Download and import a remote dataset.
 *
 * `onStage` receives `{ stage, loaded, total }` where stage is one of
 * 'downloading' | 'importing' | 'done'. Throws on failure — the caller is
 * expected to surface the message, not swallow it.
 */
export async function importRemoteDataset(url, { onStage } = {}) {
  onStage?.({ stage: 'downloading', loaded: 0, total: 0 });

  let res;
  try {
    res = await fetch(url);
  } catch (cause) {
    // fetch() rejects for DNS, offline, and CORS alike; the browser withholds
    // which, so say what the user can actually check.
    throw new Error(`Could not reach ${url}. The host may be offline or blocking cross-origin requests.`, { cause });
  }
  if (!res.ok) throw new Error(`The server returned HTTP ${res.status} for ${url}.`);

  const contentType = res.headers.get('content-type') || '';
  const sourceName = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'remote-import');
  const isJson = contentType.includes('application/json') || sourceName.endsWith('.json');

  const bytes = await readAllWithProgress(res, ({ loaded, total }) => {
    onStage?.({ stage: 'downloading', loaded, total });
  });

  onStage?.({ stage: 'importing', loaded: bytes.byteLength, total: bytes.byteLength });

  const { MFTPKGImporter } = await import('./MFTPKGImporter.js');
  const importer = new MFTPKGImporter();
  const result = isJson
    ? await importer.importFromJSON(JSON.parse(new TextDecoder().decode(bytes)))
    : await importer.importFromBytes(bytes, sourceName);

  try {
    localStorage.setItem('cloudtreeweb-has-imported', '1');
    localStorage.setItem(LOADED_URL_KEY, url);
  } catch { /* private mode — the import itself still stands */ }

  // Register in the library so the tree switcher and Home's "My family trees"
  // list show it instead of "No tree yet".
  try {
    const { upsertActiveTreeSnapshot } = await import('./treeLibrary.js');
    await upsertActiveTreeSnapshot({
      name: result.treeName || sourceName.replace(/\.(mftpkg\.zip|mftpkg|zip|ged|json)$/i, ''),
    });
  } catch (err) {
    console.warn('[CloudTreeWeb] could not register imported tree in the library', err);
  }

  onStage?.({ stage: 'done', loaded: bytes.byteLength, total: bytes.byteLength });
  return result;
}

/** True when the dataset behind `url` is already the one sitting in IndexedDB. */
export async function isAlreadyLoaded(url) {
  if (readLoadedUrl() !== url) return false;
  return getAppDataClient().records.hasData();
}

/**
 * The opt-in demo dataset (`VITE_ENABLE_DEMO_DATA`). Unrelated to `?url=`, but
 * it shares the "only when the database is empty" precondition.
 */
export async function autoLoadDemoDataIfEmpty() {
  if (import.meta.env.VITE_ENABLE_DEMO_DATA !== 'true') return;
  const client = getAppDataClient();
  if (await client.records.hasData()) return;
  if (readLoadedUrl() || localStorage.getItem('cloudtreeweb-has-imported')) return;
  try {
    const base = import.meta.env?.BASE_URL || '/';
    const res = await fetch(base + 'family-data.json');
    if (!res.ok) return;
    const count = await client.records.importDataset(await res.json());
    localStorage.setItem('cloudtreeweb-has-imported', '1');
    console.log(`[CloudTreeWeb] auto-loaded ${count} records from family-data.json`);
  } catch {
    /* no pre-extracted data — that's fine */
  }
}
