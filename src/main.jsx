/**
 * SPA entry point — mounts <App /> into #root.
 *
 * Import flows are intentionally explicit in production. Demo data and remote
 * URL imports are opt-in so a deployment cannot accidentally publish or replace
 * private family tree data.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { getLocalDatabase } from './lib/LocalDatabase.js';
import { getShareTokenFromHash } from './lib/shareRoute.js';

if (import.meta.env.DEV) {
  exposeDebugHandles();
}

async function exposeDebugHandles() {
  const [
    { AppController },
    { DatabasesController },
    { Localizer },
    Models,
  ] = await Promise.all([
    import('./lib/AppController.js'),
    import('./lib/DatabasesController.js'),
    import('./lib/Localizer.js'),
    import('./models/index.js'),
  ]);
  window.__cloudtreeweb = {
    ...Models,
    AppController,
    DatabasesController,
    Localizer,
    LocalDatabase: getLocalDatabase(),
    importMFTPKG: () => import('./lib/MFTPKGImporter.js'),
    React,
  };
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(`${base.replace(/\/?$/, '/')}sw.js`).catch((error) => {
      console.warn('[CloudTreeWeb] service worker registration failed', error);
    });
  });
}

const LOADED_URL_KEY = 'cloudtreeweb-loaded-url';
const REMOTE_IMPORT_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_REMOTE_IMPORT === 'true';
const DEMO_DATA_ENABLED = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';
const MAX_REMOTE_IMPORT_BYTES = Number(import.meta.env.VITE_MAX_REMOTE_IMPORT_BYTES) || 50 * 1024 * 1024;

function currentRoutePath() {
  try {
    const basePath = new URL(import.meta.env?.BASE_URL || '/', window.location.origin).pathname.replace(/\/?$/, '/');
    let path = window.location.pathname;
    if (basePath !== '/' && path.startsWith(basePath)) {
      path = path.slice(basePath.length);
    }
    return path.replace(/^\/+/, '');
  } catch {
    return window.location.pathname.replace(/^\/+/, '');
  }
}

function isSharePreviewRoute() {
  return currentRoutePath().startsWith('view/') || Boolean(getShareTokenFromHash());
}

function getDatasetUrlFromQuery() {
  try {
    const raw = new URLSearchParams(window.location.search).get('url');
    if (!raw) return null;
    return new URL(raw, window.location.href).href;
  } catch {
    return null;
  }
}

async function loadFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const size = Number(res.headers.get('content-length') || 0);
  if (size > MAX_REMOTE_IMPORT_BYTES) {
    throw new Error(`Remote dataset is too large (${Math.round(size / 1024 / 1024)} MB).`);
  }
  const contentType = res.headers.get('content-type') || '';
  const sourceName = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'remote-import');
  const { MFTPKGImporter } = await import('./lib/MFTPKGImporter.js');
  const importer = new MFTPKGImporter();

  let result;
  if (contentType.includes('application/json') || sourceName.endsWith('.json')) {
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REMOTE_IMPORT_BYTES) {
      throw new Error(`Remote dataset is too large (${Math.round(text.length / 1024 / 1024)} MB).`);
    }
    result = await importer.importFromJSON(JSON.parse(text));
  } else {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_REMOTE_IMPORT_BYTES) {
      throw new Error(`Remote dataset is too large (${Math.round(bytes.byteLength / 1024 / 1024)} MB).`);
    }
    result = await importer.importFromBytes(bytes, sourceName);
  }

  localStorage.setItem('cloudtreeweb-has-imported', '1');
  localStorage.setItem(LOADED_URL_KEY, url);
  console.log(`[CloudTreeWeb] loaded ${result.total || 0} records from ${url}`);
}

async function autoLoadIfEmpty() {
  if (isSharePreviewRoute()) return;

  const db = getLocalDatabase();
  await db.open();
  const queryUrl = getDatasetUrlFromQuery();

  if (queryUrl) {
    if (!REMOTE_IMPORT_ENABLED) {
      console.warn('[CloudTreeWeb] ignored ?url= import because remote imports are disabled.');
      return;
    }
    if (localStorage.getItem(LOADED_URL_KEY) === queryUrl && (await db.hasData())) return;
    const hasData = await db.hasData();
    const ok = window.confirm(
      hasData
        ? `Importing ${queryUrl} will replace the family tree currently stored in this browser. Continue?`
        : `Import family tree data from ${queryUrl}?`
    );
    if (!ok) return;
    try {
      await loadFromUrl(queryUrl);
    } catch (err) {
      console.error('[CloudTreeWeb] failed to load dataset from ?url=', err);
    }
    return;
  }

  if (await db.hasData()) return;
  if (localStorage.getItem('cloudtreeweb-has-imported')) return;
  if (!DEMO_DATA_ENABLED) return;
  try {
    const base = import.meta.env?.BASE_URL || '/';
    const res = await fetch(base + 'family-data.json');
    if (!res.ok) return;
    const data = await res.json();
    const count = await db.importDataset(data);
    localStorage.setItem('cloudtreeweb-has-imported', '1');
    console.log(`[CloudTreeWeb] auto-loaded ${count} records from family-data.json`);
  } catch {
    /* no pre-extracted data — that's fine */
  }
}

autoLoadIfEmpty().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
});
