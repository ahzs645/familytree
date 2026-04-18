import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { extractMFTPKGDataset } from './mftpkgExtractor.js';
import { createParitySnapshot, validateParitySnapshot } from './parityValidation.js';

const SAMPLE_DB = "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg/database";
const SNAPSHOT = 'fixtures/mft-parity/ahmad-s-family-arabic.snapshot.json';

describe.skipIf(!existsSync(SAMPLE_DB) || !existsSync(SNAPSHOT))('MacFamilyTree parity snapshot', () => {
  it('matches the Ahmad sample extraction guardrail snapshot', async () => {
    const db = new Database(SAMPLE_DB, { readonly: true });
    try {
      const dataset = extractMFTPKGDataset({
        sourceName: "Ahmad's Family (Arabic).mftpkg",
        query: (sql) => db.prepare(sql).all(),
      });
      const actual = createParitySnapshot(dataset, { sourceName: "Ahmad's Family (Arabic).mftpkg" });
      const expected = JSON.parse(await readFile(SNAPSHOT, 'utf8'));
      const result = validateParitySnapshot(actual, expected);
      expect(result.ok, JSON.stringify(result.diffs.slice(0, 5), null, 2)).toBe(true);
      expect(actual.smartScopes.executable).toBe(17);
      expect(actual.savedViews.length).toBe(2);
    } finally {
      db.close();
    }
  });
});
