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

async function autoLoadIfEmpty() {
  const db = getLocalDatabase();
  await db.open();
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
