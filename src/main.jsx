/**
 * Application entry point.
 *
 * Loads the new modular source alongside the legacy bundle.
 * Handles importing .mftpkg files and pre-loading data into IndexedDB
 * before the legacy bundle tries to access it.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { getLocalDatabase } from './lib/LocalDatabase.js';

// Re-export for console debugging
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
  // MFTPKGImporter loaded on-demand (it pulls in sql.js WASM)
  importMFTPKG: () => import('./lib/MFTPKGImporter.js'),
  React,
};

// ── Pre-load data into IndexedDB before the legacy bundle starts ──

async function ensureDataLoaded() {
  const db = getLocalDatabase();
  await db.open();

  if (await db.hasData()) {
    const summary = await db.getSummary();
    console.log(
      `[CloudTreeWeb] IndexedDB has ${summary.total} records` +
      (summary.meta?.source ? ` (from ${summary.meta.source})` : '')
    );
    return true;
  }

  // No data — only auto-load from family-data.json on FIRST EVER visit
  // (if the user has never imported or cleared data before)
  if (localStorage.getItem('cloudtreeweb-has-imported')) {
    console.log('[CloudTreeWeb] No data in IndexedDB — use the Import button to load a .mftpkg file');
    return false;
  }
  try {
    const base = import.meta.env?.BASE_URL || '/';
    const response = await fetch(base + 'family-data.json');
    if (response.ok) {
      const data = await response.json();
      const count = await db.importDataset(data);
      localStorage.setItem('cloudtreeweb-has-imported', '1');
      console.log(`[CloudTreeWeb] First visit — loaded ${count} records from family-data.json into IndexedDB`);
      return true;
    }
  } catch (e) {
    // No pre-extracted data available — that's fine
  }

  console.log('[CloudTreeWeb] No family data found — use the Import button to load a .mftpkg file');
  return false;
}

// Run data loading
ensureDataLoaded();

console.log(
  '%c[CloudTreeWeb] %cModular source loaded — %c' +
    Object.keys(window.__cloudtreeweb).length +
    ' modules available at window.__cloudtreeweb',
  'color: #6c8aff; font-weight: bold',
  'color: #e2e4eb',
  'color: #4ade80; font-weight: bold'
);
