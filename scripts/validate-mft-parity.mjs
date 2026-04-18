#!/usr/bin/env node

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { extractMFTPKGDataset } from '../src/lib/mftpkgExtractor.js';
import { createParitySnapshot, validateParitySnapshot } from '../src/lib/parityValidation.js';

const DEFAULT_SAMPLE = "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg";
const args = process.argv.slice(2);
const update = args.includes('--update');
const snapshotDirArg = args.find((arg) => arg.startsWith('--snapshot-dir='));
const snapshotDir = resolve(snapshotDirArg ? snapshotDirArg.split('=').slice(1).join('=') : 'fixtures/mft-parity');
const paths = args.filter((arg) => !arg.startsWith('--'));

if (paths.length === 0 && existsSync(DEFAULT_SAMPLE)) paths.push(DEFAULT_SAMPLE);
if (paths.length === 0) {
  console.error('Usage: node scripts/validate-mft-parity.mjs [--update] [--snapshot-dir=fixtures/mft-parity] <file-or-package>...');
  process.exit(1);
}

mkdirSync(snapshotDir, { recursive: true });

let failed = false;
for (const input of paths) {
  const packagePath = resolve(input);
  const snapshot = extractSnapshot(packagePath);
  const snapshotPath = join(snapshotDir, `${slugFor(packagePath)}.snapshot.json`);

  if (update || !existsSync(snapshotPath)) {
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`Updated ${snapshotPath}`);
    continue;
  }

  const expected = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const result = validateParitySnapshot(snapshot, expected);
  if (result.ok) {
    console.log(`OK ${packagePath}`);
  } else {
    failed = true;
    console.error(`Mismatch ${packagePath}`);
    for (const diff of result.diffs.slice(0, 20)) {
      console.error(`  ${diff.path}`);
      console.error(`    expected: ${JSON.stringify(diff.expected)}`);
      console.error(`    actual:   ${JSON.stringify(diff.actual)}`);
    }
    if (result.diffs.length > 20) console.error(`  ... ${result.diffs.length - 20} more`);
  }
}

if (failed) process.exit(1);

function extractSnapshot(packagePath) {
  if (!existsSync(packagePath)) throw new Error(`Path does not exist: ${packagePath}`);
  const stat = statSync(packagePath);
  const dbPath = stat.isDirectory() ? join(packagePath, 'database') : packagePath;
  if (!existsSync(dbPath)) throw new Error(`Could not find database at ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });
  try {
    const resourceFiles = stat.isDirectory() ? collectResources(packagePath) : [];
    const dataset = extractMFTPKGDataset({
      query: (sql) => db.prepare(sql).all(),
      sourceName: basename(packagePath),
      resourceFiles,
    });
    return createParitySnapshot(dataset, { sourcePath: packagePath, sourceName: basename(packagePath) });
  } finally {
    db.close();
  }
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

function slugFor(path) {
  return basename(path)
    .replace(/\.mftpkg$/i, '')
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'mft-package';
}
