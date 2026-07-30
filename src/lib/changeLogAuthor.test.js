import { afterEach, describe, expect, it } from 'vitest';
import { createAppDataClient, setAppDataClientForTesting } from './data/index.js';
import { refToRecordName } from './recordRef.js';
import { saveWithChangeLog, setChangeLogAuthor, getChangeLogAuthor, resetChangeLogAuthor, UNKNOWN_AUTHOR } from './changeLog.js';
import { getAuthorInfo, saveAuthorInfo } from './authorInfo.js';

afterEach(() => {
  setAppDataClientForTesting(null);
  resetChangeLogAuthor();
});

class MemoryRecordDatabase {
  constructor(records = []) {
    this.records = new Map(records.map((r) => [r.recordName, r]));
    this.meta = new Map();
  }
  async hasData() { return this.records.size > 0; }
  async getRecordCount() { return this.records.size; }
  async getRecordCountByType(type) { return [...this.records.values()].filter((r) => r.recordType === type).length; }
  async getSummary() { return { types: {}, total: this.records.size, meta: null }; }
  async getRecord(name) { return this.records.get(name); }
  async getRecords(names) { return names.map((n) => this.records.get(n)).filter(Boolean); }
  async getAllRecords() { return [...this.records.values()]; }
  async query(type, options = {}) {
    const records = [...this.records.values()].filter((r) => r.recordType === type);
    return { records: records.slice(0, options.limit || 500), hasMore: false };
  }
  async saveRecord(r) { this.records.set(r.recordName, r); return r; }
  async saveRecords(rs) { for (const r of rs) await this.saveRecord(r); return rs; }
  async deleteRecord(n) { this.records.delete(n); }
  async applyRecordTransaction({ saveRecords = [], deleteRecordNames = [] } = {}) {
    for (const r of saveRecords) await this.saveRecord(r);
    for (const n of deleteRecordNames) await this.deleteRecord(n);
  }
  async clearAll() { this.records.clear(); }
  async saveAsset() {} async getAsset() { return null; } async deleteAsset() {}
  async listAssetsForRecord() { return []; } async listAllAssets() { return []; } async getAssetCount() { return 0; }
  async getMeta(k) { return this.meta.get(k) ?? null; }
  async setMeta(k, v) { this.meta.set(k, v); }
}

function setup() {
  const client = createAppDataClient({
    localDatabase: new MemoryRecordDatabase([
      { recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'قديم' } } },
    ]),
  });
  setAppDataClientForTesting(client);
  return client.records;
}

const entriesFor = async (db, target) => (await db.query('ChangeLogEntry', { limit: 500 })).records
  .filter((e) => refToRecordName(e.fields?.target?.value) === target);

describe('change-log author', () => {
  it('defaults to the "You" placeholder', async () => {
    const db = setup();
    await saveWithChangeLog({ recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'جديد' } } });
    expect((await entriesFor(db, 'p1'))[0].fields.author.value).toBe(UNKNOWN_AUTHOR);
  });

  it('uses the name from Author Information once it is saved', async () => {
    // This is what makes a returned package attributable: without it every
    // reviewer's edits come back stamped "You".
    const db = setup();
    await saveAuthorInfo({ authorName: 'رعد' });
    expect(getChangeLogAuthor()).toBe('رعد');

    await saveWithChangeLog({ recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'جديد' } } });
    expect((await entriesFor(db, 'p1'))[0].fields.author.value).toBe('رعد');
  });

  it('picks the stored name back up on a fresh load without visiting the form', async () => {
    // A page load that never opens Author Information used to stamp every
    // edit "You", which is precisely the case that reaches someone else.
    const db = setup();
    await saveAuthorInfo({ authorName: 'جنان' });
    resetChangeLogAuthor();
    expect(getChangeLogAuthor()).toBe(UNKNOWN_AUTHOR);

    await saveWithChangeLog({ recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'جديد' } } });
    expect((await entriesFor(db, 'p1'))[0].fields.author.value).toBe('جنان');
  });

  it('still resolves through Author Information when it is opened', async () => {
    const db = setup();
    await saveAuthorInfo({ authorName: 'أحمد' });
    resetChangeLogAuthor();
    await getAuthorInfo();
    expect(getChangeLogAuthor()).toBe('أحمد');

    await saveWithChangeLog({ recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'جديد' } } });
    expect((await entriesFor(db, 'p1'))[0].fields.author.value).toBe('أحمد');
  });
});
