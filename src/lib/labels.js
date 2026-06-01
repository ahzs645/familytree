import { readLabel } from './schema.js';
import { LABELS as FALLBACK_LABELS } from './catalogs.js';

export function resolveLabelDefinitions(records = [], fallbackLabels = FALLBACK_LABELS) {
  const byId = new Map(records.map((record) => [record.recordName, readLabel(record)]));
  return fallbackLabels.map((fallback) => {
    const actual = byId.get(fallback.id);
    return {
      ...fallback,
      label: actual?.name || fallback.label,
      color: actual?.color || fallback.color,
    };
  });
}
