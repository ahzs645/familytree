import { createConvexDataClient } from './ConvexDataClient.js';
import { createLocalDexieDataClient } from './LocalDexieDataClient.js';

export const DATA_CLIENT_MODE = Object.freeze({
  LOCAL: 'local',
  CONVEX: 'convex',
});

const STORAGE_KEY = 'cloudtreeweb:data-client-mode';
let singleton = null;

export function resolveDataClientMode(mode) {
  if (mode === DATA_CLIENT_MODE.CONVEX) return DATA_CLIENT_MODE.CONVEX;
  return DATA_CLIENT_MODE.LOCAL;
}

export function getStoredDataClientMode() {
  try {
    return resolveDataClientMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DATA_CLIENT_MODE.LOCAL;
  }
}

export function setStoredDataClientMode(mode) {
  const resolved = resolveDataClientMode(mode);
  try {
    localStorage.setItem(STORAGE_KEY, resolved);
  } catch {
    /* localStorage can be unavailable */
  }
  singleton = null;
  return resolved;
}

export function createAppDataClient({ mode = getStoredDataClientMode(), localDatabase, convex } = {}) {
  const resolved = resolveDataClientMode(mode);
  if (resolved === DATA_CLIENT_MODE.CONVEX) return createConvexDataClient(convex);
  return createLocalDexieDataClient({ database: localDatabase });
}

export function getAppDataClient() {
  if (!singleton) singleton = createAppDataClient();
  return singleton;
}

export function setAppDataClientForTesting(client) {
  singleton = client;
}
