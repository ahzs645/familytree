import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppDataClient, setAppDataClientForTesting } from './data/index.js';
import { extractMFTPKGDataset } from './mftpkgExtractor.js';
import { exportBackup } from './backup.js';
import { buildGedcom } from './gedcomExport.js';
import { refToRecordName } from './recordRef.js';
import { isPublicRecord } from './privacy.js';

const SAMPLE_DB = "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg/database";

afterEach(() => {
  setAppDataClientForTesting(null);
});

describe.skipIf(!existsSync(SAMPLE_DB))('local Dexie data-client round trip with the provided family tree', () => {
  it('imports, edits, and exports the actual family tree through the local data client boundary', async () => {
    const sqlite = new Database(SAMPLE_DB, { readonly: true });
    let dataset;
    try {
      dataset = extractMFTPKGDataset({
        sourceName: 'Ahmad family test package',
        query: (sql) => sqlite.prepare(sql).all(),
      });
    } finally {
      sqlite.close();
    }

    const memoryDatabase = new MemoryRecordDatabase();
    const client = createAppDataClient({ localDatabase: memoryDatabase });
    setAppDataClientForTesting(client);

    await client.records.importDataset(dataset);
    expect(await client.records.countByType('Person')).toBe(836);
    expect(await client.records.countByType('Family')).toBe(282);

    const editablePerson = (await client.records.query('Person', { limit: 100000 })).records
      .find((record) => isPublicRecord(record));
    expect(editablePerson).toBeTruthy();

    const editedName = 'Dexie Roundtrip Export Test';
    await client.records.save({
      ...editablePerson,
      fields: {
        ...editablePerson.fields,
        firstName: { value: editedName, type: 'STRING' },
        cached_fullName: { value: `${editedName} ${editablePerson.fields?.lastName?.value || ''}`.trim(), type: 'STRING' },
      },
    });

    const backup = await exportBackup();
    expect(backup.records[editablePerson.recordName].fields.firstName.value).toBe(editedName);

    const gedcom = await buildGedcom();
    expect(gedcom).toContain(`1 NAME ${editedName}`);
  });
});

class MemoryRecordDatabase {
  constructor() {
    this.records = new Map();
    this.assets = new Map();
    this.meta = new Map();
  }

  async hasData() {
    return this.records.size > 0;
  }

  async getRecordCount() {
    return this.records.size;
  }

  async getRecordCountByType(recordType) {
    return [...this.records.values()].filter((record) => record.recordType === recordType).length;
  }

  async getSummary() {
    const types = {};
    for (const record of this.records.values()) {
      types[record.recordType] = (types[record.recordType] || 0) + 1;
    }
    return { types, total: this.records.size, meta: await this.getMeta('importInfo') };
  }

  async getRecord(recordName) {
    return this.records.get(recordName);
  }

  async getRecords(recordNames) {
    return recordNames.map((name) => this.records.get(name)).filter(Boolean);
  }

  async getAllRecords() {
    return [...this.records.values()];
  }

  async query(recordType, options = {}) {
    let records = [...this.records.values()].filter((record) => record.recordType === recordType);
    if (options.referenceField && options.referenceValue) {
      records = records.filter((record) => (
        refToRecordName(record.fields?.[options.referenceField]?.value) === options.referenceValue
      ));
    }
    const limit = options.limit || 500;
    return { records: records.slice(0, limit), hasMore: records.length > limit };
  }

  async saveRecord(record) {
    const next = { ...record, modified: { timestamp: Date.now() } };
    this.records.set(next.recordName, next);
    return next;
  }

  async saveRecords(records) {
    for (const record of records) await this.saveRecord(record);
    return records;
  }

  async deleteRecord(recordName) {
    this.records.delete(recordName);
  }

  async applyRecordTransaction({ saveRecords = [], deleteRecordNames = [], saveAssets = [], deleteAssetIds = [] } = {}) {
    for (const record of saveRecords) await this.saveRecord(record);
    for (const recordName of deleteRecordNames) await this.deleteRecord(recordName);
    for (const asset of saveAssets) await this.saveAsset(asset);
    for (const assetId of deleteAssetIds) await this.deleteAsset(assetId);
  }

  async importDataset(dataset) {
    this.records.clear();
    this.assets.clear();
    this.meta.clear();
    for (const record of Object.values(dataset.records || dataset)) this.records.set(record.recordName, record);
    for (const asset of dataset.assets || []) this.assets.set(asset.assetId, asset);
    if (dataset.datasetSchemaVersion != null) await this.setMeta('datasetSchemaVersion', dataset.datasetSchemaVersion);
    if (dataset.meta) await this.setMeta('importInfo', dataset.meta);
    return this.records.size;
  }

  async clearAll() {
    this.records.clear();
    this.assets.clear();
    this.meta.clear();
  }

  async saveAsset(asset) {
    this.assets.set(asset.assetId, asset);
    return asset;
  }

  async getAsset(assetId) {
    return this.assets.get(assetId);
  }

  async deleteAsset(assetId) {
    this.assets.delete(assetId);
  }

  async listAssetsForRecord(ownerRecordName) {
    return [...this.assets.values()].filter((asset) => asset.ownerRecordName === ownerRecordName);
  }

  async listAllAssets() {
    return [...this.assets.values()];
  }

  async getAssetCount() {
    return this.assets.size;
  }

  async getMeta(key) {
    return this.meta.get(key) ?? null;
  }

  async setMeta(key, value) {
    this.meta.set(key, value);
  }
}
