import { describe, expect, it } from 'vitest';
import { DATA_CLIENT_MODE, createAppDataClient } from './AppDataClient.js';

describe('AppDataClient', () => {
  it('wraps the local Dexie database behind the records/assets/meta boundary', async () => {
    const calls = [];
    const database = {
      hasData: async () => true,
      getRecord: async (id) => ({ recordName: id }),
      importDataset: async (dataset) => {
        calls.push(dataset);
        return Object.keys(dataset.records || {}).length;
      },
      listAllAssets: async () => [],
      getMeta: async (key) => key,
    };
    const client = createAppDataClient({ mode: DATA_CLIENT_MODE.LOCAL, localDatabase: database });

    await expect(client.records.hasData()).resolves.toBe(true);
    await expect(client.records.get('person-1')).resolves.toEqual({ recordName: 'person-1' });
    await expect(client.records.importDataset({ records: { a: {} } })).resolves.toBe(1);
    await expect(client.assets.listAll()).resolves.toEqual([]);
    await expect(client.meta.get('importInfo')).resolves.toBe('importInfo');
    expect(calls).toEqual([{ records: { a: {} } }]);
  });

  it('makes Convex mode explicit until the Convex adapter is implemented', () => {
    const client = createAppDataClient({ mode: DATA_CLIENT_MODE.CONVEX });

    expect(client.kind).toBe('convex');
    expect(() => client.records.query('Person')).toThrow(/not configured/i);
  });
});
