import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_REMOTE_IMPORT_BYTES,
  formatBytes,
  getDatasetUrlFromQuery,
  importRemoteDataset,
} from './remoteDataset.js';

const ORIGIN = 'https://example.test';

function streamOf(chunks, headers = {}) {
  let i = 0;
  return {
    ok: true,
    status: 200,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length ? { done: false, value: chunks[i++] } : { done: true }),
        cancel: async () => {},
      }),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('window', { location: { href: `${ORIGIN}/familytree/`, search: '' } });
  vi.stubGlobal('localStorage', {
    store: new Map(),
    getItem(k) { return this.store.get(k) ?? null; },
    setItem(k, v) { this.store.set(k, v); },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getDatasetUrlFromQuery', () => {
  it('resolves absolute and relative dataset URLs', () => {
    expect(getDatasetUrlFromQuery('?url=https%3A%2F%2Fcdn.test%2Ftree.mftpkg.zip'))
      .toBe('https://cdn.test/tree.mftpkg.zip');
    expect(getDatasetUrlFromQuery('?url=tree.mftpkg.zip'))
      .toBe(`${ORIGIN}/familytree/tree.mftpkg.zip`);
  });

  it('returns null when there is no url param or it is unparseable', () => {
    expect(getDatasetUrlFromQuery('')).toBeNull();
    expect(getDatasetUrlFromQuery('?other=1')).toBeNull();
    expect(getDatasetUrlFromQuery('?url=http%3A%2F%2F')).toBeNull();
  });
});

describe('formatBytes', () => {
  it('scales units and ignores nonsense input', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(NaN)).toBe('');
  });
});

describe('importRemoteDataset', () => {
  it('reports network and HTTP failures as messages the caller can show', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(importRemoteDataset('https://cdn.test/tree.zip'))
      .rejects.toThrow(/Could not reach https:\/\/cdn\.test\/tree\.zip/);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, headers: { get: () => null } }));
    await expect(importRemoteDataset('https://cdn.test/tree.zip'))
      .rejects.toThrow(/HTTP 404/);
  });

  it('rejects an oversized dataset from the content-length header before downloading', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === 'content-length' ? String(MAX_REMOTE_IMPORT_BYTES + 1) : null) },
      body: { getReader: () => { throw new Error('must not read the body'); } },
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(importRemoteDataset('https://cdn.test/big.zip')).rejects.toThrow(/too large/);
  });

  it('still enforces the size cap when the response is chunked with no content-length', async () => {
    // The regression this guards: the old code trusted content-length alone, so
    // a chunked response skipped the guard until the whole body was in memory.
    const oversized = new Uint8Array(1024 * 1024);
    const chunks = Array.from({ length: Math.ceil(MAX_REMOTE_IMPORT_BYTES / oversized.byteLength) + 2 }, () => oversized);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamOf(chunks)));
    await expect(importRemoteDataset('https://cdn.test/chunked.zip')).rejects.toThrow(/too large/);
  });

  it('emits downloading progress against content-length, then an importing stage', async () => {
    const payload = new TextEncoder().encode(JSON.stringify({ records: [] }));
    const half = Math.ceil(payload.byteLength / 2);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      streamOf([payload.subarray(0, half), payload.subarray(half)], {
        'content-length': String(payload.byteLength),
        'content-type': 'application/json',
      }),
    ));
    vi.doMock('./MFTPKGImporter.js', () => ({
      MFTPKGImporter: class { async importFromJSON() { return { total: 0, treeName: 'T' }; } },
    }));

    const stages = [];
    await importRemoteDataset('https://cdn.test/tree.json', { onStage: (s) => stages.push(s) });

    const names = stages.map((s) => s.stage);
    expect(names[0]).toBe('downloading');
    expect(names).toContain('importing');
    expect(names[names.length - 1]).toBe('done');
    // Progress is determinate: total is known and loaded climbs to it.
    const downloads = stages.filter((s) => s.stage === 'downloading' && s.total > 0);
    expect(downloads.length).toBeGreaterThan(0);
    expect(downloads[downloads.length - 1].loaded).toBe(payload.byteLength);
  });
});
