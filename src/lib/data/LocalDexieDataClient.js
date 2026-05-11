import { getLocalDatabase } from '../LocalDatabase.js';

export class LocalDexieDataClient {
  constructor({ database = getLocalDatabase() } = {}) {
    this.kind = 'local';
    this.database = database;
    this.records = {
      hasData: () => this.database.hasData(),
      count: () => this.database.getRecordCount(),
      countByType: (recordType) => this.database.getRecordCountByType(recordType),
      summary: () => this.database.getSummary(),
      get: (recordName) => this.database.getRecord(recordName),
      getMany: (recordNames) => this.database.getRecords(recordNames),
      all: () => this.database.getAllRecords(),
      query: (recordType, options) => this.database.query(recordType, options),
      save: (record) => this.database.saveRecord(record),
      saveMany: (records) => this.database.saveRecords(records),
      delete: (recordName) => this.database.deleteRecord(recordName),
      transaction: (mutation) => this.database.applyRecordTransaction(mutation),
      importDataset: (dataset) => this.database.importDataset(dataset),
      clearAll: () => this.database.clearAll(),
    };
    this.assets = {
      save: (asset) => this.database.saveAsset(asset),
      get: (assetId) => this.database.getAsset(assetId),
      delete: (assetId) => this.database.deleteAsset(assetId),
      listForRecord: (ownerRecordName) => this.database.listAssetsForRecord(ownerRecordName),
      listAll: () => this.database.listAllAssets(),
      count: () => this.database.getAssetCount(),
    };
    this.meta = {
      get: (key) => this.database.getMeta(key),
      set: (key, value) => this.database.setMeta(key, value),
    };
  }
}

export function createLocalDexieDataClient(options) {
  return new LocalDexieDataClient(options);
}
