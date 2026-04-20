/**
 * Dataset schema metadata shared by import, export, and migration code.
 *
 * This is separate from IndexedDB's LOCAL_DB_VERSION and from backup document
 * versions. It tracks the shape of records persisted in the local dataset.
 */
export const DATASET_SCHEMA_VERSION = 1;
export const DATASET_SCHEMA_VERSION_META_KEY = 'datasetSchemaVersion';

export function normalizeDatasetSchemaVersion(value, fallback = DATASET_SCHEMA_VERSION) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.trunc(numeric);
  return fallback;
}

export function datasetSchemaVersionForImport(dataset, fallback = DATASET_SCHEMA_VERSION) {
  return normalizeDatasetSchemaVersion(
    dataset?.datasetSchemaVersion ?? dataset?.meta?.datasetSchemaVersion,
    fallback
  );
}
