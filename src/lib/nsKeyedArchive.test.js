import { existsSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { decodeNSKeyedArchive } from './nsKeyedArchive.js';

const SAMPLE_DB = "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg/database";

function hasPlutil() {
  try {
    execFileSync('plutil', ['-help'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe.skipIf(!existsSync(SAMPLE_DB) || !hasPlutil())('NSKeyedArchive decoder', () => {
  it('decodes binary plist archives through the same summary path as XML archives', () => {
    const db = new Database(SAMPLE_DB, { readonly: true });
    try {
      const row = db.prepare("SELECT ZARCHIVEDFILTERSCONTAINERDATA as data FROM ZSCOPE WHERE ZSCOPENAME = 'Families with one child'").get();
      const dir = mkdtempSync(join(tmpdir(), 'mft-bplist-'));
      const xmlPath = join(dir, 'scope.xml.plist');
      const binaryPath = join(dir, 'scope.binary.plist');
      writeFileSync(xmlPath, row.data);
      execFileSync('plutil', ['-convert', 'binary1', '-o', binaryPath, xmlPath]);
      const decoded = decodeNSKeyedArchive(readFileSync(binaryPath).toString('base64'));
      expect(decoded.status).toBe('decoded');
      expect(decoded.summary.entityName).toBe('Family');
      expect(decoded.summary.identifier).toBe('StandardScope_Families_NumberOfChildren');
      expect(decoded.summary.filters.some((filter) => filter.selectionDictionary?.NUMBERCOMPARISONOPERATOR === 'equalKey')).toBe(true);
    } finally {
      db.close();
    }
  });
});
