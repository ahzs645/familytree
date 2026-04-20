/**
 * Dataset schema version gate.
 *
 * Distinct from IndexedDB's `LOCAL_DB_VERSION` (store shape) — this tracks the
 * shape of the *records* we persist. When we bump `DATASET_SCHEMA_VERSION` we
 * surface a migration dialog so the user can snapshot a backup before the
 * on-disk rewrite kicks in.
 */
import { getLocalDatabase } from './LocalDatabase.js';

export const DATASET_SCHEMA_VERSION = 1;
const META_KEY = 'datasetSchemaVersion';

export async function getStoredDatasetSchemaVersion() {
  const db = getLocalDatabase();
  const value = Number(await db.getMeta(META_KEY));
  if (Number.isFinite(value) && value >= 0) return value;
  if (await db.hasData()) return 0;
  return DATASET_SCHEMA_VERSION;
}

export async function markDatasetSchemaVersion(version = DATASET_SCHEMA_VERSION) {
  const db = getLocalDatabase();
  await db.setMeta(META_KEY, Number(version));
}

export async function describeMigrationPlan(fromVersion, toVersion = DATASET_SCHEMA_VERSION) {
  const steps = [];
  for (let v = fromVersion; v < toVersion; v += 1) {
    const step = MIGRATIONS[v];
    if (step) steps.push({ from: v, to: v + 1, description: step.description });
    else steps.push({ from: v, to: v + 1, description: 'Internal adjustment.' });
  }
  return steps;
}

export async function runMigrations(fromVersion, toVersion = DATASET_SCHEMA_VERSION) {
  for (let v = fromVersion; v < toVersion; v += 1) {
    const step = MIGRATIONS[v];
    if (step?.run) await step.run();
  }
  await markDatasetSchemaVersion(toVersion);
}

const MIGRATIONS = {
  // Example: 0 -> 1. Concrete migration logic belongs here as the schema evolves.
  0: {
    description: 'Adopt versioned dataset metadata. No record transformations required.',
    run: async () => { /* first-time stamp only */ },
  },
};
