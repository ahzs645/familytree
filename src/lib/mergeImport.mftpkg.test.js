import { describe, expect, it } from 'vitest';
import { mftpkgDatasetToBackupJSON } from './mergeImport.js';

/**
 * Unit tests for the pure mftpkg-dataset → cloudtreeweb-backup mapping that
 * lets a MacFamilyTree package flow through the existing JSON merge pipeline.
 */
describe('mftpkgDatasetToBackupJSON', () => {
  const dataset = {
    datasetSchemaVersion: 7,
    records: {
      'person-1': { recordName: 'person-1', recordType: 'Person', fields: { firstName: { value: 'Ada' } } },
      'person-2': { recordName: 'person-2', recordType: 'Person', fields: { firstName: { value: 'Grace' } } },
    },
    assets: [
      { assetId: 'asset-1', ownerRecordName: 'person-1', dataBase64: 'AAAA', filename: 'a.jpg', mimeType: 'image/jpeg' },
    ],
    counts: { Person: 2 },
    treeName: 'Sample Tree',
    meta: { importedAt: '2026-01-02T03:04:05.000Z', datasetSchemaVersion: 7, counts: { Person: 2 } },
  };

  it('stamps the cloudtreeweb-backup envelope the merge gate recognises', () => {
    const json = mftpkgDatasetToBackupJSON(dataset, { sourceName: 'Sample.mftpkg' });
    expect(json.format).toBe('cloudtreeweb-backup');
    expect(json.sourceFormat).toBe('mftpkg');
    expect(Object.keys(json.records)).toEqual(['person-1', 'person-2']);
    expect(json.assets).toHaveLength(1);
    expect(json.assetCount).toBe(1);
    expect(json.counts).toEqual({ Person: 2 });
    expect(json.exportedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(json.treeName).toBe('Sample Tree');
  });

  it('accepts records as an array and rekeys them by recordName', () => {
    const json = mftpkgDatasetToBackupJSON({
      records: [
        { recordName: 'a', recordType: 'Person', fields: {} },
        { recordName: 'b', recordType: 'Family', fields: {} },
        { recordType: 'Orphan' }, // no recordName — dropped
      ],
    });
    expect(Object.keys(json.records).sort()).toEqual(['a', 'b']);
    expect(json.assets).toEqual([]);
    expect(json.assetCount).toBe(0);
  });

  it('falls back to a sane exportedAt and defaults when metadata is sparse', () => {
    const json = mftpkgDatasetToBackupJSON({ records: { x: { recordName: 'x', recordType: 'Person', fields: {} } } });
    expect(json.format).toBe('cloudtreeweb-backup');
    expect(json.version).toBe(2);
    expect(typeof json.exportedAt).toBe('string');
    expect(json.counts).toEqual({});
  });

  it('throws when there are no records to merge', () => {
    expect(() => mftpkgDatasetToBackupJSON(null)).toThrow(/did not contain any records/i);
    expect(() => mftpkgDatasetToBackupJSON({})).toThrow(/did not contain any records/i);
  });
});
