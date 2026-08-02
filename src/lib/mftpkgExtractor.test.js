import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { extractMFTPKGDataset } from './mftpkgExtractor.js';
import { readLabel } from './schema.js';

const SAMPLE_DB = "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg/database";

describe('MacFamilyTree event extraction', () => {
  it('maps the event columns exposed by the shared Core Data event entity', () => {
    const query = (sql) => {
      if (sql.includes('FROM Z_PRIMARYKEY')) return [
        { Z_ENT: 24, Z_NAME: 'FamilyEvent' },
        { Z_ENT: 25, Z_NAME: 'PersonEvent' },
      ];
      if (sql.includes('SELECT Z_PK, Z_ENT FROM ZBASEOBJECT')) return [];
      if (sql.includes('WHERE e.Z_ENT = 25')) return [{
        Z_PK: 1,
        ZPERSON: 7,
        ZDATE: '10 MAY 1999',
        ZAGENCY: 'County Registry',
        ZCAUSE: 'Pneumonia',
        ZTIME: '14:35',
      }];
      if (sql.includes('WHERE e.Z_ENT = 24')) return [{
        Z_PK: 2,
        ZFAMILY: 8,
        ZDATE: '1 JAN 1950',
        ZAGENCY: 'Civil Registrar',
        ZCAUSE: 'Marriage licence',
        ZTIME: '09:15',
      }];
      return [];
    };

    const dataset = extractMFTPKGDataset({ query, sourceName: 'events.mftpkg' });
    expect(dataset.records['personevent-1'].fields).toMatchObject({
      agency: { value: 'County Registry' },
      cause: { value: 'Pneumonia' },
      time: { value: '14:35' },
    });
    expect(dataset.records['familyevent-2'].fields).toMatchObject({
      agency: { value: 'Civil Registrar' },
      cause: { value: 'Marriage licence' },
      time: { value: '09:15' },
    });
  });
});

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
      const importedScope = dataset.records['scope-35'];
      const decodedScope = JSON.parse(importedScope.fields.archivedFiltersDecoded.value);
      expect(decodedScope.status).toBe('decoded');
      expect(decodedScope.summary.entityName).toBe('Family');
      expect(decodedScope.summary.identifier).toBe('StandardScope_Families_MarriageDate');
      expect(decodedScope.summary.filters.some((filter) => filter.selectionDictionary?.A1 === '01.01.1950')).toBe(true);
      const importedLabel = Object.values(dataset.records).find((record) => record.recordType === 'Label');
      expect(readLabel(importedLabel).name).toBeTruthy();
      const sourceRelation = Object.values(dataset.records).find((record) => record.recordType === 'SourceRelation');
      const lineageBatch = Object.values(dataset.records).find((record) => record.recordType === 'LineageBatch');
      const lineageEvent = Object.values(dataset.records).find((record) => record.recordType === 'LineageEvent');
      expect(sourceRelation?.fields.lineageOperation.value).toBe('mftpkgImport');
      expect(sourceRelation?.fields.lineageBatch.value).toBe(`${lineageBatch.recordName}---LineageBatch`);
      expect(sourceRelation?.fields.lineageCreatedByEvent.value).toBe(`${lineageEvent.recordName}---LineageEvent`);
      expect(Object.keys(dataset.records).length).toBeGreaterThan(6500);
    } finally {
      db.close();
    }
  });
});
