/**
 * LocalDatabase — Dexie/IndexedDB-backed storage for family tree records.
 *
 * This is the browser-local adapter. The rest of the app should work through
 * this boundary instead of calling Dexie directly, so a future Convex adapter
 * can preserve the same application-level commands and record shapes.
 */
import Dexie from 'dexie';
import { compareStrings, matchesSearchText, startsWithSearchText } from './i18n.js';
import { refToRecordName } from './recordRef.js';
import {
  DATASET_SCHEMA_VERSION_META_KEY,
  datasetSchemaVersionForImport,
} from './datasetSchemaVersion.js';

const DB_NAME = 'cloudtreeweb-local';
export const LOCAL_DB_VERSION = 4;
const STORE_RECORDS = 'records';
const STORE_META = 'meta';
const STORE_ASSETS = 'assets';

function createDexieDatabase() {
  const db = new Dexie(DB_NAME);
  db.version(LOCAL_DB_VERSION).stores({
    [STORE_RECORDS]: 'recordName, recordType',
    [STORE_META]: 'key',
    [STORE_ASSETS]: 'assetId, ownerRecordName, sourceIdentifier',
  });
  return db;
}

export class LocalDatabase {
  constructor() {
    this._db = null;
  }

  async open() {
    if (!this._db) this._db = createDexieDatabase();
    if (!this._db.isOpen()) await this._db.open();
    return this._db;
  }

  /** Check if there's any data imported. */
  async hasData() {
    const db = await this.open();
    return (await db[STORE_RECORDS].count()) > 0;
  }

  /** Get total record count. */
  async getRecordCount() {
    const db = await this.open();
    return db[STORE_RECORDS].count();
  }

  /** Get record count by type. */
  async getRecordCountByType(recordType) {
    const db = await this.open();
    return db[STORE_RECORDS].where('recordType').equals(recordType).count();
  }

  /** Get a summary of imported data. */
  async getSummary() {
    const db = await this.open();
    const types = {};
    await db[STORE_RECORDS].each((record) => {
      const type = record.recordType;
      types[type] = (types[type] || 0) + 1;
    });
    const meta = await this.getMeta('importInfo');
    return { types, total: Object.values(types).reduce((a, b) => a + b, 0), meta };
  }

  // -- Record CRUD --

  /** Get a single record by recordName. */
  async getRecord(recordName) {
    const db = await this.open();
    return db[STORE_RECORDS].get(recordName);
  }

  /** Get multiple records by recordName array. */
  async getRecords(recordNames) {
    const db = await this.open();
    const results = await Promise.all(recordNames.map((name) => db[STORE_RECORDS].get(name)));
    return results.filter(Boolean);
  }

  /** Get every stored record. Use only for maintenance/import/merge operations. */
  async getAllRecords() {
    const db = await this.open();
    return db[STORE_RECORDS].toArray();
  }

  /** Query records by type with optional filter, sort, and limit. */
  async query(recordType, options = {}) {
    const db = await this.open();
    let records = await db[STORE_RECORDS].where('recordType').equals(recordType).toArray();

    if (options.filterBy) {
      for (const filter of options.filterBy) {
        if (!filter.fieldName || !filter.fieldValue) continue;
        records = records.filter((r) => {
          const field = r.fields?.[filter.fieldName];
          if (!field) return false;
          const val = field.value;
          const target = filter.fieldValue.value ?? filter.fieldValue;
          if (filter.comparator === 'EQUALS') return val === target;
          if (filter.comparator === 'NOT_EQUALS') return val !== target;
          if (filter.comparator === 'BEGINS_WITH') return typeof val === 'string' && startsWithSearchText(val, target);
          if (filter.comparator === 'IN') return Array.isArray(target) && target.includes(val);
          return true;
        });
      }
    }

    if (options.searchText) {
      records = records.filter((r) => {
        const fields = r.fields || {};
        return Object.values(fields).some((f) => {
          if (typeof f.value === 'string') return matchesSearchText(f.value, options.searchText);
          return false;
        });
      });
    }

    if (options.sortBy && options.sortBy.length > 0) {
      const sort = options.sortBy[0];
      records.sort((a, b) => {
        const va = a.fields?.[sort.fieldName]?.value ?? '';
        const vb = b.fields?.[sort.fieldName]?.value ?? '';
        const cmp = typeof va === 'string' ? compareStrings(va, vb) : va - vb;
        return sort.ascending === false ? -cmp : cmp;
      });
    }

    if (options.referenceField && options.referenceValue) {
      records = records.filter((r) => {
        const ref = r.fields?.[options.referenceField];
        if (!ref) return false;
        return refToRecordName(ref.value) === options.referenceValue;
      });
    }

    const limit = options.limit || 500;
    const hasMore = records.length > limit;
    records = records.slice(0, limit);

    return { records, hasMore };
  }

  /** Save a record (insert or update). */
  async saveRecord(record) {
    const db = await this.open();
    record.modified = { timestamp: Date.now() };
    await db[STORE_RECORDS].put(record);
    return record;
  }

  /** Save multiple records in a single transaction. */
  async saveRecords(records) {
    const db = await this.open();
    const now = Date.now();
    const next = records.map((record) => {
      record.modified = { timestamp: now };
      return record;
    });
    await db.transaction('rw', db[STORE_RECORDS], async () => {
      await db[STORE_RECORDS].bulkPut(next);
    });
    return records;
  }

  /** Apply a records/assets mutation atomically in one IndexedDB transaction. */
  async applyRecordTransaction({ saveRecords = [], deleteRecordNames = [], saveAssets = [], deleteAssetIds = [] } = {}) {
    const db = await this.open();
    const now = Date.now();
    await db.transaction('rw', db[STORE_RECORDS], db[STORE_ASSETS], async () => {
      const recordsToSave = saveRecords.filter(Boolean).map((record) => {
        record.modified = { timestamp: now };
        return record;
      });
      const assetsToSave = saveAssets.filter((asset) => asset?.assetId);
      if (recordsToSave.length) await db[STORE_RECORDS].bulkPut(recordsToSave);
      if (deleteRecordNames.length) await db[STORE_RECORDS].bulkDelete(deleteRecordNames.filter(Boolean));
      if (assetsToSave.length) await db[STORE_ASSETS].bulkPut(assetsToSave);
      if (deleteAssetIds.length) await db[STORE_ASSETS].bulkDelete(deleteAssetIds.filter(Boolean));
    });
  }

  /** Delete a record by recordName. */
  async deleteRecord(recordName) {
    const db = await this.open();
    await db[STORE_RECORDS].delete(recordName);
  }

  // -- Bulk Import --

  /** Import a full dataset (replaces all existing data). */
  async importDataset(dataset) {
    const db = await this.open();
    const records = Object.values(dataset.records || dataset);
    const assets = Array.isArray(dataset.assets) ? dataset.assets.filter((asset) => asset?.assetId) : [];

    // One transaction so an interrupted import (tab closed, navigation away)
    // rolls back instead of leaving partial records without the schema-version
    // stamp — which used to resurface as a bogus migration prompt.
    await db.transaction('rw', db[STORE_RECORDS], db[STORE_META], db[STORE_ASSETS], async () => {
      await db[STORE_RECORDS].clear();
      await db[STORE_META].clear();
      await db[STORE_ASSETS].clear();

      const batchSize = 500;
      for (let i = 0; i < records.length; i += batchSize) {
        await db[STORE_RECORDS].bulkPut(records.slice(i, i + batchSize));
      }

      await db[STORE_META].put({ key: DATASET_SCHEMA_VERSION_META_KEY, value: datasetSchemaVersionForImport(dataset) });
      if (dataset.meta) await db[STORE_META].put({ key: 'importInfo', value: dataset.meta });
      if (dataset.zones) await db[STORE_META].put({ key: 'zones', value: dataset.zones });

      for (let i = 0; i < assets.length; i += batchSize) {
        await db[STORE_ASSETS].bulkPut(assets.slice(i, i + batchSize));
      }
    });

    return records.length;
  }

  /** Clear all data. */
  async clearAll() {
    const db = await this.open();
    await db.transaction('rw', db[STORE_RECORDS], db[STORE_META], db[STORE_ASSETS], async () => {
      await db[STORE_RECORDS].clear();
      await db[STORE_META].clear();
      await db[STORE_ASSETS].clear();
    });
  }

  // -- Assets --

  async saveAsset(asset) {
    if (!asset?.assetId) throw new Error('Asset must include assetId');
    const db = await this.open();
    await db[STORE_ASSETS].put(asset);
    return asset;
  }

  async getAsset(assetId) {
    const db = await this.open();
    return db[STORE_ASSETS].get(assetId);
  }

  async deleteAsset(assetId) {
    const db = await this.open();
    await db[STORE_ASSETS].delete(assetId);
  }

  async listAssetsForRecord(ownerRecordName) {
    const db = await this.open();
    return db[STORE_ASSETS].where('ownerRecordName').equals(ownerRecordName).toArray();
  }

  async listAllAssets() {
    const db = await this.open();
    return db[STORE_ASSETS].toArray();
  }

  async getAssetCount() {
    const db = await this.open();
    return db[STORE_ASSETS].count();
  }

  // -- Metadata --

  async getMeta(key) {
    const db = await this.open();
    const row = await db[STORE_META].get(key);
    return row?.value ?? null;
  }

  async setMeta(key, value) {
    const db = await this.open();
    await db[STORE_META].put({ key, value });
  }

  // -- Family Tree Specific Queries --

  async getPersonBirthEvents(personRecordName) {
    const { records } = await this.query('PersonEvent', {
      referenceField: 'person',
      referenceValue: personRecordName,
    });
    return records.filter(
      (r) =>
        r.fields?.conclusionType?.value === 'Birth' ||
        r.fields?.eventType?.value === 'Birth'
    );
  }

  async getPersonsParents(personRecordName) {
    const { records: childRels } = await this.query('ChildRelation', {
      referenceField: 'child',
      referenceValue: personRecordName,
      limit: 100000,
    });

    const results = [];
    for (const cr of childRels) {
      const familyRef = refToRecordName(cr.fields?.family?.value);
      if (!familyRef) continue;
      const family = await this.getRecord(familyRef);
      if (!family) continue;
      const manRef = refToRecordName(family.fields?.man?.value);
      const womanRef = refToRecordName(family.fields?.woman?.value);
      results.push({
        family,
        man: manRef ? await this.getRecord(manRef) : null,
        woman: womanRef ? await this.getRecord(womanRef) : null,
        childRelation: cr,
      });
    }
    return results;
  }

  async getPersonsChildrenInformation(personRecordName) {
    const { records: allFamilies } = await this.query('Family', { limit: 100000 });
    const families = allFamilies.filter((f) => {
      const manRef = refToRecordName(f.fields?.man?.value);
      const womanRef = refToRecordName(f.fields?.woman?.value);
      return manRef === personRecordName || womanRef === personRecordName;
    });

    const results = [];
    for (const fam of families) {
      const manRef = refToRecordName(fam.fields?.man?.value);
      const womanRef = refToRecordName(fam.fields?.woman?.value);
      const partnerId = manRef === personRecordName ? womanRef : manRef;

      const { records: childRels } = await this.query('ChildRelation', {
        referenceField: 'family',
        referenceValue: fam.recordName,
        limit: 100000,
      });
      const children = [];
      const childRelations = [];
      for (const cr of childRels) {
        const childRef = refToRecordName(cr.fields?.child?.value);
        if (childRef) {
          const child = await this.getRecord(childRef);
          if (child) {
            children.push(child);
            childRelations.push({ child, relation: cr });
          }
        }
      }

      results.push({
        family: fam,
        partner: partnerId ? await this.getRecord(partnerId) : null,
        children,
        childRelations,
      });
    }
    return results;
  }
}

/** Singleton instance */
let _instance = null;
export function getLocalDatabase() {
  if (!_instance) _instance = new LocalDatabase();
  return _instance;
}

export default LocalDatabase;
