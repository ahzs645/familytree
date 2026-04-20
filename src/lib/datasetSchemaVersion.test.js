import { describe, expect, it } from 'vitest';
import {
  DATASET_SCHEMA_VERSION,
  datasetSchemaVersionForImport,
  normalizeDatasetSchemaVersion,
} from './datasetSchemaVersion.js';

describe('dataset schema version metadata', () => {
  it('defaults converted imports to the current runtime schema', () => {
    expect(datasetSchemaVersionForImport({ records: {} })).toBe(DATASET_SCHEMA_VERSION);
    expect(datasetSchemaVersionForImport({ records: {}, meta: { source: 'sample.mftpkg' } })).toBe(DATASET_SCHEMA_VERSION);
  });

  it('preserves explicit older versions so migrations still run', () => {
    expect(datasetSchemaVersionForImport({ records: {}, datasetSchemaVersion: 0 })).toBe(0);
    expect(datasetSchemaVersionForImport({ records: {}, meta: { datasetSchemaVersion: '0' } })).toBe(0);
  });

  it('does not coerce missing metadata to zero', () => {
    expect(normalizeDatasetSchemaVersion(null, null)).toBeNull();
    expect(normalizeDatasetSchemaVersion(undefined, null)).toBeNull();
    expect(normalizeDatasetSchemaVersion('', null)).toBeNull();
  });
});
