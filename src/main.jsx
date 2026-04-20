/**
 * SPA entry point — mounts <App /> into #root.
 *
 * If IndexedDB is empty on first ever visit, we try to auto-load a pre-extracted
 * `family-data.json` from public/ so the demo has data to show immediately.
 * Users can still re-import their own file from the Home route.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { getLocalDatabase } from './lib/LocalDatabase.js';

// Expose debug handles for the console.
import { AppController } from './lib/AppController.js';
import { DatabasesController } from './lib/DatabasesController.js';
import { Localizer } from './lib/Localizer.js';
import * as Models from './models/index.js';

window.__cloudtreeweb = {
  ...Models,
  AppController,
  DatabasesController,
  Localizer,
  LocalDatabase: getLocalDatabase(),
  importMFTPKG: () => import('./lib/MFTPKGImporter.js'),
  React,
};

const LOADED_URL_KEY = 'cloudtreeweb-loaded-url';

function getDatasetUrlFromQuery() {
  try {
    const raw = new URLSearchParams(window.location.search).get('url');
    if (!raw) return null;
    return new URL(raw, window.location.href).href;
  } catch {
    return null;
  }
}

async function loadFromUrl(db, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const data = await res.json();
  const count = await db.importDataset(data);
  localStorage.setItem('cloudtreeweb-has-imported', '1');
  localStorage.setItem(LOADED_URL_KEY, url);
  console.log(`[CloudTreeWeb] loaded ${count} records from ${url}`);
}

async function autoLoadIfEmpty() {
  const db = getLocalDatabase();
  await db.open();
  const queryUrl = getDatasetUrlFromQuery();

  if (queryUrl) {
    if (localStorage.getItem(LOADED_URL_KEY) === queryUrl && (await db.hasData())) return;
    try {
      await loadFromUrl(db, queryUrl);
    } catch (err) {
      console.error('[CloudTreeWeb] failed to load dataset from ?url=', err);
    }
    return;
  }

  if (await db.hasData()) return;
  if (localStorage.getItem('cloudtreeweb-has-imported')) return;
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
