import { afterEach, describe, expect, it } from 'vitest';
import { createAppDataClient, setAppDataClientForTesting } from './data/index.js';
import { refToRecordName, refValue } from './recordRef.js';
import { linkExistingRelative } from './relativeLinks.js';
import { Gender } from '../models/index.js';

afterEach(() => {
  setAppDataClientForTesting(null);
});

/** Minimal in-memory record store — enough for the link helpers + change log. */
class MemoryRecordDatabase {
  constructor(records = []) {
    this.records = new Map(records.map((record) => [record.recordName, record]));
    this.assets = new Map();
    this.meta = new Map();
  }

  async hasData() { return this.records.size > 0; }
  async getRecordCount() { return this.records.size; }
  async getRecordCountByType(type) { return [...this.records.values()].filter((r) => r.recordType === type).length; }
  async getSummary() { return { types: {}, total: this.records.size, meta: null }; }
  async getRecord(recordName) { return this.records.get(recordName); }
  async getRecords(names) { return names.map((n) => this.records.get(n)).filter(Boolean); }
  async getAllRecords() { return [...this.records.values()]; }

  async query(recordType, options = {}) {
    let records = [...this.records.values()].filter((r) => r.recordType === recordType);
    if (options.referenceField && options.referenceValue) {
      records = records.filter((r) => refToRecordName(r.fields?.[options.referenceField]?.value) === options.referenceValue);
    }
    const limit = options.limit || 500;
    return { records: records.slice(0, limit), hasMore: records.length > limit };
  }

  async saveRecord(record) { this.records.set(record.recordName, record); return record; }
  async saveRecords(records) { for (const r of records) await this.saveRecord(r); return records; }
  async deleteRecord(recordName) { this.records.delete(recordName); }
  async applyRecordTransaction({ saveRecords = [], deleteRecordNames = [] } = {}) {
    for (const r of saveRecords) await this.saveRecord(r);
    for (const n of deleteRecordNames) await this.deleteRecord(n);
  }
  async clearAll() { this.records.clear(); }
  async saveAsset() {} async getAsset() { return null; } async deleteAsset() {}
  async listAssetsForRecord() { return []; } async listAllAssets() { return []; } async getAssetCount() { return 0; }
  async getMeta(key) { return this.meta.get(key) ?? null; }
  async setMeta(key, value) { this.meta.set(key, value); }
}

const person = (id, gender = Gender.Male) => ({
  recordName: id,
  recordType: 'Person',
  fields: { cached_fullName: { value: id }, gender: { value: gender, type: 'INT64' } },
});

const family = (id, man, woman) => ({
  recordName: id,
  recordType: 'Family',
  fields: {
    ...(man ? { man: { value: refValue(man, 'Person'), type: 'REFERENCE' } } : {}),
    ...(woman ? { woman: { value: refValue(woman, 'Person'), type: 'REFERENCE' } } : {}),
  },
});

const childOf = (id, familyId, childId) => ({
  recordName: id,
  recordType: 'ChildRelation',
  fields: {
    family: { value: refValue(familyId, 'Family'), type: 'REFERENCE' },
    child: { value: refValue(childId, 'Person'), type: 'REFERENCE' },
  },
});

function setup(records) {
  const client = createAppDataClient({ localDatabase: new MemoryRecordDatabase(records) });
  setAppDataClientForTesting(client);
  return client.records;
}

/** Families this person is a parent in. */
async function parentFamilies(db, personId) {
  const { records } = await db.query('Family', { limit: 1000 });
  return records.filter((f) => (
    refToRecordName(f.fields?.man?.value) === personId
    || refToRecordName(f.fields?.woman?.value) === personId
  ));
}

describe('linkExistingRelative — parents', () => {
  it('fills a free parent slot in the family the child already belongs to', async () => {
    const db = setup([
      person('child'), person('dad'),
      family('fam', null, 'mum'), person('mum', Gender.Female),
      childOf('cr', 'fam', 'child'),
    ]);

    await linkExistingRelative('child', 'dad', 'parent');

    const fam = await db.get('fam');
    expect(refToRecordName(fam.fields.man.value)).toBe('dad');
    expect(await parentFamilies(db, 'dad')).toHaveLength(1);
  });

  it('creates another parent family when both slots are taken', async () => {
    // Regression: assignParent() silently did nothing once man and woman were
    // both set, so "Add father" from the tree reported success and left the
    // new person with no relationship at all.
    const db = setup([
      person('child'), person('dad'), person('mum', Gender.Female), person('stepdad'),
      family('fam', 'dad', 'mum'),
      childOf('cr', 'fam', 'child'),
    ]);

    const result = await linkExistingRelative('child', 'stepdad', 'parent');

    expect(result.created).toBe(true);
    const families = await parentFamilies(db, 'stepdad');
    expect(families).toHaveLength(1);
    expect(families[0].recordName).not.toBe('fam');

    // …and the child is actually attached to that new family.
    const { records } = await db.query('ChildRelation', { limit: 1000 });
    const linked = records.filter((r) => refToRecordName(r.fields.family.value) === families[0].recordName);
    expect(linked).toHaveLength(1);
    expect(refToRecordName(linked[0].fields.child.value)).toBe('child');

    // The original family is untouched.
    const original = await db.get('fam');
    expect(refToRecordName(original.fields.man.value)).toBe('dad');
    expect(refToRecordName(original.fields.woman.value)).toBe('mum');
  });

  it('is a no-op when that parent is already linked', async () => {
    const db = setup([
      person('child'), person('dad'), person('mum', Gender.Female),
      family('fam', 'dad', 'mum'),
      childOf('cr', 'fam', 'child'),
    ]);

    const result = await linkExistingRelative('child', 'dad', 'parent');

    expect(result.created).toBe(false);
    expect(await parentFamilies(db, 'dad')).toHaveLength(1);
    expect((await db.query('ChildRelation', { limit: 1000 })).records).toHaveLength(1);
  });

  it('creates a family when the child has no parents at all', async () => {
    const db = setup([person('child'), person('dad')]);

    await linkExistingRelative('child', 'dad', 'parent');

    const families = await parentFamilies(db, 'dad');
    expect(families).toHaveLength(1);
    const { records } = await db.query('ChildRelation', { limit: 1000 });
    expect(refToRecordName(records[0].fields.child.value)).toBe('child');
  });
});

describe('linkExistingRelative — children', () => {
  it('attaches the child to the union named by partnerId', async () => {
    // Regression: "Add son with <partner>" ignored the partner and used
    // whichever family came back first.
    const db = setup([
      person('dad'), person('wife1', Gender.Female), person('wife2', Gender.Female), person('kid'),
      family('fam1', 'dad', 'wife1'),
      family('fam2', 'dad', 'wife2'),
    ]);

    await linkExistingRelative('dad', 'kid', 'child', { partnerId: 'wife2' });

    const { records } = await db.query('ChildRelation', { limit: 1000 });
    expect(records).toHaveLength(1);
    expect(refToRecordName(records[0].fields.family.value)).toBe('fam2');
  });

  it('falls back to any family with that parent when no partner is named', async () => {
    const db = setup([
      person('dad'), person('wife1', Gender.Female), person('kid'),
      family('fam1', 'dad', 'wife1'),
    ]);

    await linkExistingRelative('dad', 'kid', 'child');

    const { records } = await db.query('ChildRelation', { limit: 1000 });
    expect(refToRecordName(records[0].fields.family.value)).toBe('fam1');
  });
});
