/**
 * Label resolvers for record types. These return plain text — callers
 * decide whether to wrap in `bdi(...)` for HTML output or use the value
 * as-is for sorting/comparison.
 *
 * Used by both buildModel.js (for `compareBy(familyLabel, ...)` style
 * sorting) and render.js (for headings, links, fallback text), so they
 * live in their own neutral module to avoid circular imports.
 */
import { readField, readRef } from '../schema.js';
import {
  familySummary,
  personSummary,
  placeSummary,
  sourceSummary,
} from '../../models/index.js';

export function familyLabel(family, model) {
  const summary = familySummary(family);
  if (summary?.familyName) return summary.familyName;
  const names = [readRef(family?.fields?.man), readRef(family?.fields?.woman)]
    .map((id) => model?.personById?.get(id))
    .filter(Boolean)
    .map((person) => personSummary(person)?.fullName)
    .filter(Boolean);
  return names.length ? names.join(' & ') : family?.recordName;
}

export function placeLabel(place) {
  const summary = placeSummary(place);
  return summary?.displayName || summary?.name || place?.recordName;
}

export function sourceLabel(source) {
  const summary = sourceSummary(source);
  return summary?.title || source?.recordName;
}

export function mediaLabel(media) {
  return readField(media, ['caption', 'title', 'filename', 'fileName', 'url'], media?.recordName || 'Media');
}

export function storyLabel(story) {
  return readField(story, ['title', 'name'], story?.recordName || 'Story');
}

export function targetLabel(recordName, model) {
  const record =
    model.personById.get(recordName) ||
    model.familyById.get(recordName) ||
    model.placeById.get(recordName) ||
    model.sourceById.get(recordName) ||
    model.mediaById.get(recordName) ||
    model.storyById.get(recordName);
  if (!record) return recordName;
  if (record.recordType === 'Person') return personSummary(record)?.fullName || recordName;
  if (record.recordType === 'Family') return familyLabel(record, model) || recordName;
  if (record.recordType === 'Place') return placeLabel(record) || recordName;
  if (record.recordType === 'Source') return sourceLabel(record) || recordName;
  if (record.recordType === 'Story') return storyLabel(record) || recordName;
  if (record.recordType?.startsWith('Media')) return mediaLabel(record) || recordName;
  return recordName;
}

export function safeAssetName(asset) {
  const name = asset.filename || asset.sourceIdentifier || asset.assetId || 'asset';
  const clean = String(name).replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '');
  return `${encodeURIComponent(asset.assetId || clean)}-${clean || 'asset'}`;
}
