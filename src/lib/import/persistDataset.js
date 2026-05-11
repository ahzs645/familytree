/**
 * Final stage of the import pipeline: writes a normalized dataset (the
 * shape returned by extractMFTPKGDataset / importDataset payloads) into
 * the local IndexedDB. Returns the number of records written, which the
 * orchestrator reports back to the UI.
 */
import { getAppDataClient } from '../data/index.js';

export async function persistDataset(dataset) {
  return getAppDataClient().records.importDataset(dataset);
}
