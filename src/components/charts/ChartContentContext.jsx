/**
 * Chart content options + portraits, supplied via context so PersonNode can
 * render optional portraits, life dates, and reference IDs (#25) without every
 * chart having to thread the props down.
 */
import React, { createContext, useContext } from 'react';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { readRef } from '../../lib/schema.js';

export const DEFAULT_CHART_CONTENT = Object.freeze({
  showPortraits: false,
  showLifespan: true,
  showIds: false,
});

const ChartContentContext = createContext({ content: DEFAULT_CHART_CONTENT, photoFor: () => null });

export function ChartContentProvider({ content = DEFAULT_CHART_CONTENT, photosById = null, children }) {
  const value = {
    content,
    photoFor: (recordName) => (photosById && recordName ? photosById.get(recordName) || null : null),
  };
  return <ChartContentContext.Provider value={value}>{children}</ChartContentContext.Provider>;
}

export function useChartContent() {
  return useContext(ChartContentContext);
}

/**
 * Load portrait data URLs for the given person ids by following MediaRelation →
 * MediaPicture → stored asset. Best-effort; returns a Map(recordName -> dataUrl).
 */
export async function loadChartPortraits(personIds) {
  const ids = new Set((personIds || []).filter(Boolean));
  const out = new Map();
  if (ids.size === 0) return out;
  const db = getLocalDatabase();
  const [rels, pictures] = await Promise.all([
    db.query('MediaRelation', { limit: 100000 }),
    db.query('MediaPicture', { limit: 100000 }),
  ]);
  const pictureById = new Map(pictures.records.map((p) => [p.recordName, p]));
  const pictureForPerson = new Map();
  for (const rel of rels.records) {
    const target = readRef(rel.fields?.target);
    if (!ids.has(target) || pictureForPerson.has(target)) continue;
    const picture = pictureById.get(readRef(rel.fields?.media));
    if (picture) pictureForPerson.set(target, picture);
  }
  for (const [personId, picture] of pictureForPerson) {
    const assetIds = picture.fields?.assetIds?.value || [];
    let asset = assetIds.length ? await db.getAsset(assetIds[0]) : null;
    if (!asset && db.listAssetsForRecord) {
      const assets = await db.listAssetsForRecord(picture.recordName);
      asset = (assets || [])[0] || null;
    }
    if (asset?.dataBase64) out.set(personId, `data:${asset.mimeType || 'image/png'};base64,${asset.dataBase64}`);
  }
  return out;
}
