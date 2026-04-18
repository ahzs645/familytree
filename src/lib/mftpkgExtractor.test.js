import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { extractMFTPKGDataset } from './mftpkgExtractor.js';
import { readLabel } from './schema.js';

const SAMPLE_DB = "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg/database";

describe.skipIf(!existsSync(SAMPLE_DB))('MacFamilyTree package extraction', () => {
  it('imports the provided sample tables that were previously missing', () => {
    const db = new Database(SAMPLE_DB, { readonly: true });
    try {
      const dataset = extractMFTPKGDataset({
        sourceName: 'sample.mftpkg',
        query: (sql) => db.prepare(sql).all(),
      });
      expect(dataset.counts.Person).toBe(836);
      expect(dataset.counts.Family).toBe(282);
      expect(dataset.counts.AdditionalName).toBe(16);
      expect(dataset.counts.ToDo).toBe(1);
      expect(dataset.counts.ToDoRelation).toBe(1);
      expect(dataset.counts.SavedChart).toBe(2);
      expect(dataset.counts.Scope).toBe(17);
      expect(dataset.counts.ResearchAssistantQuestionInfo).toBe(440);
      expect(dataset.counts.SourceKeyValue).toBe(10);
      expect(dataset.counts.SourceTemplateKey).toBe(72);
      expect(dataset.counts.SourceTemplateKeyRelation).toBe(640);
      const importedLabel = Object.values(dataset.records).find((record) => record.recordType === 'Label');
      expect(readLabel(importedLabel).name).toBeTruthy();
      expect(Object.keys(dataset.records).length).toBeGreaterThan(6500);
    } finally {
      db.close();
    }
  });
});
