/**
 * LocalDatabase — IndexedDB-backed storage for family tree records.
 *
 * Replaces CloudKit entirely. All data lives in the browser's IndexedDB.
 * Records are stored in the same format the app expects (recordName, recordType, fields).
 *
 * Usage:
 *   const db = new LocalDatabase();
 *   await db.open();
 *   await db.importRecords(records);  // bulk import from .mftpkg
 *   const persons = await db.query('Person');
 *   const person = await db.getRecord('person-123');
 */
import { openDB } from 'idb';
import { refToRecordName } from './recordRef.js';

const DB_NAME = 'cloudtreeweb-local';
export const LOCAL_DB_VERSION = 3;
const STORE_RECORDS = 'records';
const STORE_META = 'meta';
const STORE_ASSETS = 'assets';

export class LocalDatabase {
  constructor() {
    this._db = null;
  }

  async open() {
    if (this._db) return this._db;

    this._db = await openDB(DB_NAME, LOCAL_DB_VERSION, {
      upgrade(db, oldVersion) {
        // Records store — keyed by recordName, indexed by recordType
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'recordName' });
          store.createIndex('byType', 'recordType', { unique: false });
          store.createIndex('byTypeAndField', ['recordType', 'fields.lastName.value'], { unique: false });
        }

        // Metadata store — tree info, import history, preferences
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          const assets = db.createObjectStore(STORE_ASSETS, { keyPath: 'assetId' });
          assets.createIndex('byOwnerRecordName', 'ownerRecordName', { unique: false });
          assets.createIndex('bySourceIdentifier', 'sourceIdentifier', { unique: false });
        }
      },
    });

    return this._db;
  }

  /** Check if there's any data imported. */
  async hasData() {
    const db = await this.open();
    const count = await db.count(STORE_RECORDS);
    return count > 0;
  }

  /** Get total record count. */
  async getRecordCount() {
    const db = await this.open();
    return db.count(STORE_RECORDS);
  }

  /** Get record count by type. */
  async getRecordCountByType(recordType) {
    const db = await this.open();
    const index = db.transaction(STORE_RECORDS).store.index('byType');
    return index.count(recordType);
  }

  /** Get a summary of imported data. */
  async getSummary() {
    const db = await this.open();
    const tx = db.transaction(STORE_RECORDS);
    const index = tx.store.index('byType');
    const types = {};
    let cursor = await index.openCursor();
    while (cursor) {
      const type = cursor.value.recordType;
      types[type] = (types[type] || 0) + 1;
      cursor = await cursor.continue();
    }
    const meta = await this.getMeta('importInfo');
    return { types, total: Object.values(types).reduce((a, b) => a + b, 0), meta };
  }

  // ── Record CRUD ──

  /** Get a single record by recordName. */
  async getRecord(recordName) {
    const db = await this.open();
    return db.get(STORE_RECORDS, recordName);
  }

  /** Get multiple records by recordName array. */
  async getRecords(recordNames) {
    const db = await this.open();
    const tx = db.transaction(STORE_RECORDS);
    const results = await Promise.all(recordNames.map((name) => tx.store.get(name)));
    return results.filter(Boolean);
  }

  /** Get every stored record. Use only for maintenance/import/merge operations. */
  async getAllRecords() {
    const db = await this.open();
    return db.getAll(STORE_RECORDS);
  }

  /** Query records by type with optional filter, sort, and limit. */
  async query(recordType, options = {}) {
    const db = await this.open();
    const tx = db.transaction(STORE_RECORDS);
    const index = tx.store.index('byType');

    let records = await index.getAll(recordType);

    // Apply filters
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
          if (filter.comparator === 'BEGINS_WITH') return typeof val === 'string' && val.startsWith(target);
          if (filter.comparator === 'IN') return Array.isArray(target) && target.includes(val);
          return true;
        });
      }
    }

    // Apply search (text match on common fields)
    if (options.searchText) {
      const q = options.searchText.toLowerCase();
      records = records.filter((r) => {
        const fields = r.fields || {};
        return Object.values(fields).some((f) => {
          if (typeof f.value === 'string') return f.value.toLowerCase().includes(q);
          return false;
        });
      });
    }

    // Apply sort
    if (options.sortBy && options.sortBy.length > 0) {
      const sort = options.sortBy[0];
      records.sort((a, b) => {
        const va = a.fields?.[sort.fieldName]?.value ?? '';
        const vb = b.fields?.[sort.fieldName]?.value ?? '';
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return sort.ascending === false ? -cmp : cmp;
      });
    }

    // Apply reference filter (e.g., get all events for a person)
    if (options.referenceField && options.referenceValue) {
      records = records.filter((r) => {
        const ref = r.fields?.[options.referenceField];
        if (!ref) return false;
        return refToRecordName(ref.value) === options.referenceValue;
      });
    }

    // Apply limit
    const limit = options.limit || 500;
    const hasMore = records.length > limit;
    records = records.slice(0, limit);

    return { records, hasMore };
  }

  /** Save a record (insert or update). */
  async saveRecord(record) {
    const db = await this.open();
    record.modified = { timestamp: Date.now() };
    await db.put(STORE_RECORDS, record);
    return record;
  }

  /** Save multiple records in a single transaction. */
  async saveRecords(records) {
    const db = await this.open();
    const tx = db.transaction(STORE_RECORDS, 'readwrite');
    for (const record of records) {
      record.modified = { timestamp: Date.now() };
      tx.store.put(record);
    }
    await tx.done;
    return records;
  }

  /** Apply a records/assets mutation atomically in one IndexedDB transaction. */
  async applyRecordTransaction({ saveRecords = [], deleteRecordNames = [], saveAssets = [], deleteAssetIds = [] } = {}) {
    const db = await this.open();
    const tx = db.transaction([STORE_RECORDS, STORE_ASSETS], 'readwrite');
    const now = Date.now();
    for (const record of saveRecords) {
      if (!record) continue;
      record.modified = { timestamp: now };
      tx.objectStore(STORE_RECORDS).put(record);
    }
    for (const recordName of deleteRecordNames) {
      if (recordName) tx.objectStore(STORE_RECORDS).delete(recordName);
    }
    for (const asset of saveAssets) {
      if (asset?.assetId) tx.objectStore(STORE_ASSETS).put(asset);
    }
    for (const assetId of deleteAssetIds) {
      if (assetId) tx.objectStore(STORE_ASSETS).delete(assetId);
    }
    await tx.done;
  }

  /** Delete a record by recordName. */
  async deleteRecord(recordName) {
    const db = await this.open();
    await db.delete(STORE_RECORDS, recordName);
  }

  // ── Bulk Import ──

  /** Import a full dataset (replaces all existing data). */
  async importDataset(dataset) {
    const db = await this.open();

    // Clear existing data
    const clearTx = db.transaction([STORE_RECORDS, STORE_META, STORE_ASSETS], 'readwrite');
    await clearTx.objectStore(STORE_RECORDS).clear();
    await clearTx.objectStore(STORE_META).clear();
    await clearTx.objectStore(STORE_ASSETS).clear();
    await clearTx.done;

    // Import records in batches of 500
    const records = Object.values(dataset.records || dataset);
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const tx = db.transaction(STORE_RECORDS, 'readwrite');
      for (const record of batch) {
        tx.store.put(record);
      }
      await tx.done;
    }

    // Save metadata
    if (dataset.meta) {
      await this.setMeta('importInfo', dataset.meta);
    }
    if (dataset.zones) {
      await this.setMeta('zones', dataset.zones);
    }
    if (Array.isArray(dataset.assets) && dataset.assets.length > 0) {
      const tx = db.transaction(STORE_ASSETS, 'readwrite');
      for (const asset of dataset.assets) {
        if (asset?.assetId) tx.store.put(asset);
      }
      await tx.done;
    }

    return records.length;
  }

  /** Clear all data. */
  async clearAll() {
    const db = await this.open();
    const tx = db.transaction([STORE_RECORDS, STORE_META, STORE_ASSETS], 'readwrite');
    await tx.objectStore(STORE_RECORDS).clear();
    await tx.objectStore(STORE_META).clear();
    await tx.objectStore(STORE_ASSETS).clear();
    await tx.done;
  }

  // ── Assets ──

  async saveAsset(asset) {
    if (!asset?.assetId) throw new Error('Asset must include assetId');
    const db = await this.open();
    await db.put(STORE_ASSETS, asset);
    return asset;
  }

  async getAsset(assetId) {
    const db = await this.open();
    return db.get(STORE_ASSETS, assetId);
  }

  async deleteAsset(assetId) {
    const db = await this.open();
    await db.delete(STORE_ASSETS, assetId);
  }

  async listAssetsForRecord(ownerRecordName) {
    const db = await this.open();
    const index = db.transaction(STORE_ASSETS).store.index('byOwnerRecordName');
    return index.getAll(ownerRecordName);
  }

  async listAllAssets() {
    const db = await this.open();
    return db.getAll(STORE_ASSETS);
  }

  async getAssetCount() {
    const db = await this.open();
    return db.count(STORE_ASSETS);
  }

  // ── Metadata ──

  async getMeta(key) {
    const db = await this.open();
    const row = await db.get(STORE_META, key);
    return row?.value ?? null;
  }

  async setMeta(key, value) {
    const db = await this.open();
    await db.put(STORE_META, { key, value });
  }

  // ── Family Tree Specific Queries ──

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
    // Find ChildRelation records where child = personRecordName
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
      });
    }
    return results;
  }

  async getPersonsChildrenInformation(personRecordName) {
    // Find families where this person is man or woman
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

      // Find children via ChildRelation
      const { records: childRels } = await this.query('ChildRelation', {
        referenceField: 'family',
        referenceValue: fam.recordName,
        limit: 100000,
      });
      const children = [];
      for (const cr of childRels) {
        const childRef = refToRecordName(cr.fields?.child?.value);
        if (childRef) {
          const child = await this.getRecord(childRef);
          if (child) children.push(child);
        }
      }

      results.push({
        family: fam,
        partner: partnerId ? await this.getRecord(partnerId) : null,
        children,
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
