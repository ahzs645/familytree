// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createAppDataClient, setAppDataClientForTesting } from './data/index.js';
import { refValue } from './recordRef.js';
import { planMerge, mergeBackupJSONWithResolutions, listUndoableMerges, undoMerge, CONFLICT_RESOLUTION } from './mergeImport.js';
import { buildDeletionLogEntries } from './changeLog.js';

afterEach(() => {
  setAppDataClientForTesting(null);
});

class MemoryRecordDatabase {
  constructor(records = []) {
    this.records = new Map(records.map((r) => [r.recordName, r]));
    this.assets = new Map();
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
  async deleteRecord(name) { this.records.delete(name); }
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

const person = (id, name) => ({
  recordName: id,
  recordType: 'Person',
  fields: { cached_fullName: { value: name } },
});

function setup(records) {
  const client = createAppDataClient({ localDatabase: new MemoryRecordDatabase(records) });
  setAppDataClientForTesting(client);
  return client.records;
}

const backup = (records) => ({
  format: 'cloudtreeweb-backup',
  version: 2,
  records: Object.fromEntries(records.map((r) => [r.recordName, r])),
  assets: [],
});

describe('merge deletions', () => {
  it('proposes records the incoming copy logged as deleted', async () => {
    const alive = person('p1', 'باقٍ');
    const removed = person('p2', 'محذوف');
    setup([alive, removed]);

    // The reviewer's package: p2 gone, plus the Delete entry their app wrote.
    const incoming = backup([alive, ...buildDeletionLogEntries([removed])]);
    const plan = await planMerge(incoming);

    expect(plan.deletions).toHaveLength(1);
    expect(plan.deletions[0]).toMatchObject({ recordName: 'p2', recordType: 'Person', label: 'محذوف' });
  });

  it('ignores a deletion the same file also re-adds', async () => {
    const alive = person('p1', 'باقٍ');
    const readded = person('p2', 'أُعيد');
    setup([alive, readded]);

    const incoming = backup([alive, readded, ...buildDeletionLogEntries([readded])]);
    const plan = await planMerge(incoming);

    expect(plan.deletions).toHaveLength(0);
  });

  it('does not treat plain absence as a deletion', async () => {
    // A subtree export or GEDCOM subset is missing most of the tree without
    // meaning any of it should be removed.
    setup([person('p1', 'أ'), person('p2', 'ب'), person('p3', 'ج')]);

    const plan = await planMerge(backup([person('p1', 'أ')]));

    expect(plan.deletions).toHaveLength(0);
  });

  it('keeps the record unless the owner ticks it', async () => {
    const alive = person('p1', 'باقٍ');
    const removed = person('p2', 'محذوف');
    const db = setup([alive, removed]);
    const incoming = backup([alive, ...buildDeletionLogEntries([removed])]);

    const untouched = await mergeBackupJSONWithResolutions(incoming, {});
    expect(untouched.deleted).toBe(0);
    expect(await db.get('p2')).toBeTruthy();

    const applied = await mergeBackupJSONWithResolutions(incoming, {
      'delete:p2': CONFLICT_RESOLUTION.USE_INCOMING,
    });
    expect(applied.deleted).toBe(1);
    expect(await db.get('p2')).toBeFalsy();
    expect(await db.get('p1')).toBeTruthy();
  });
});

describe('merge attribution', () => {
  it('names who changed each conflicting record, from the incoming change log', async () => {
    setup([person('p1', 'قديم')]);
    const edited = person('p1', 'جديد');
    const incoming = backup([
      edited,
      {
        recordName: 'cle-1',
        recordType: 'ChangeLogEntry',
        fields: {
          target: { value: refValue('p1', 'Person'), type: 'REFERENCE' },
          targetType: { value: 'Person' },
          author: { value: 'Raad' },
          timestamp: { value: '2026-07-30T10:00:00.000Z' },
          changeType: { value: 'Change' },
        },
      },
    ]);

    const [conflict] = (await planMerge(incoming)).conflicts;
    expect(conflict.editedBy).toBe('Raad');
    expect(conflict.editedAt).toBe('2026-07-30T10:00:00.000Z');
  });

  it('keeps the most recent author when a record was edited twice', async () => {
    setup([person('p1', 'قديم')]);
    const entry = (id, author, timestamp) => ({
      recordName: id,
      recordType: 'ChangeLogEntry',
      fields: {
        target: { value: refValue('p1', 'Person'), type: 'REFERENCE' },
        author: { value: author },
        timestamp: { value: timestamp },
        changeType: { value: 'Change' },
      },
    });
    const incoming = backup([
      person('p1', 'جديد'),
      entry('cle-1', 'Raad', '2026-07-01T00:00:00.000Z'),
      entry('cle-2', 'Jenan', '2026-07-30T00:00:00.000Z'),
    ]);

    expect((await planMerge(incoming)).conflicts[0].editedBy).toBe('Jenan');
  });

  it('treats the default "You" as unknown, since it means nothing in someone else\'s file', async () => {
    setup([person('p1', 'قديم')]);
    const incoming = backup([
      person('p1', 'جديد'),
      {
        recordName: 'cle-1',
        recordType: 'ChangeLogEntry',
        fields: {
          target: { value: refValue('p1', 'Person'), type: 'REFERENCE' },
          author: { value: 'You' },
          timestamp: { value: '2026-07-30T10:00:00.000Z' },
          changeType: { value: 'Change' },
        },
      },
    ]);

    expect((await planMerge(incoming)).conflicts[0].editedBy).toBe('');
  });
});

describe('merge undo', () => {
  it('restores overwrites, removes additions and puts deletions back', async () => {
    const db = setup([person('p1', 'الأصلي'), person('p2', 'محذوف')]);
    const incoming = backup([
      person('p1', 'المعدل'),
      person('p3', 'جديد'),
      ...buildDeletionLogEntries([person('p2', 'محذوف')]),
    ]);

    await mergeBackupJSONWithResolutions(incoming, {
      p1: CONFLICT_RESOLUTION.USE_INCOMING,
      'delete:p2': CONFLICT_RESOLUTION.USE_INCOMING,
    });
    expect((await db.get('p1')).fields.cached_fullName.value).toBe('المعدل');
    expect(await db.get('p3')).toBeTruthy();
    expect(await db.get('p2')).toBeFalsy();

    const [pending] = await listUndoableMerges();
    const result = await undoMerge(pending.id);

    expect(result).toMatchObject({ restored: 1, removed: 1, reinstated: 1 });
    expect((await db.get('p1')).fields.cached_fullName.value).toBe('الأصلي');
    expect(await db.get('p3')).toBeFalsy();
    expect((await db.get('p2')).fields.cached_fullName.value).toBe('محذوف');
  });

  it('cannot be undone twice', async () => {
    setup([person('p1', 'الأصلي')]);
    const incoming = backup([person('p1', 'المعدل')]);
    await mergeBackupJSONWithResolutions(incoming, { p1: CONFLICT_RESOLUTION.USE_INCOMING });

    const [pending] = await listUndoableMerges();
    expect(await undoMerge(pending.id)).toBeTruthy();
    expect(await undoMerge(pending.id)).toBeNull();
    expect(await listUndoableMerges()).toHaveLength(0);
  });
});
