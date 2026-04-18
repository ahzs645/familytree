#!/usr/bin/env node

/**
 * Extract family tree data from a MacFamilyTree .mftpkg package and convert it
 * to the same local record format used by the browser importer.
 *
 * Usage:
 *   node scripts/extract-mftpkg.js <path-to.mftpkg> [output.json]
 */

import Database from 'better-sqlite3';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractMFTPKGDataset } from '../src/lib/mftpkgExtractor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mftpkgPath = process.argv[2];
const outputPath = process.argv[3] || resolve(__dirname, '../public/family-data.json');

if (!mftpkgPath) {
  console.error('Usage: node scripts/extract-mftpkg.js <path-to.mftpkg> [output.json]');
  process.exit(1);
}

const packagePath = resolve(mftpkgPath);
const dbPath = statSync(packagePath).isDirectory() ? join(packagePath, 'database') : packagePath;
if (!existsSync(dbPath)) {
  console.error(`Could not find database at ${dbPath}`);
  process.exit(1);
}

function collectResources(root) {
  const resourcesDir = join(root, 'resources');
  if (!existsSync(resourcesDir)) return [];
  const out = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else out.push({ path, name: basename(path), bytes: readFileSync(path) });
    }
  }
  walk(resourcesDir);
  return out;
}

console.log(`Opening ${dbPath}...`);
const db = new Database(dbPath, { readonly: true });
try {
  const query = (sql) => db.prepare(sql).all();
  const resourceFiles = statSync(packagePath).isDirectory() ? collectResources(packagePath) : [];
  const dataset = extractMFTPKGDataset({
    query,
    sourceName: basename(packagePath),
    resourceFiles,
  });
  writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
  console.log(`Wrote ${Object.keys(dataset.records).length} records to ${outputPath}`);
  console.log('Counts:', dataset.counts);
  console.log(`Assets: ${dataset.assets.length}`);
  if (dataset.warnings.length) {
    console.warn('Warnings:');
    for (const warning of dataset.warnings.slice(0, 20)) console.warn(`  - ${warning}`);
    if (dataset.warnings.length > 20) console.warn(`  ... ${dataset.warnings.length - 20} more`);
  }
} finally {
  db.close();
}
