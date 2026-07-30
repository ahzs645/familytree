/**
 * Geographic origins the tree infers from a person's birth or death place
 * (see originForPlace in appTreeAdapter.js).
 *
 * Names are translated — they used to be a hard-coded English map, which put
 * "Czech Republic" on an otherwise Arabic page. Colours are not: they key the
 * card badges, the donut, and the bar chart to each other, so the colour is
 * the data.
 */
export const ORIGIN_KEYS = [
  'polish', 'czech', 'slovak', 'austrian', 'lebanese', 'american', 'german', 'french', 'swiss',
  'irish', 'english', 'scottish', 'italian', 'spanish', 'canadian', 'mexican', 'russian',
  'ukrainian', 'chinese', 'syrian', 'hungarian', 'turkish', 'rusyn', 'generic',
];

/** Localized name for an origin key. Pass the `t` from useTranslation. */
export function originLabel(t, origin) {
  if (!origin) return '';
  return t(`heritageTree.origins.${origin}`, { defaultValue: origin });
}

export const originColors = {
  polish: '#ef4444', czech: '#f97316', slovak: '#8b5cf6', austrian: '#06b6d4', lebanese: '#10b981', american: '#3b82f6',
  german: '#eab308', french: '#ec4899', swiss: '#14b8a6', irish: '#22c55e', english: '#6366f1', scottish: '#0ea5e9', italian: '#84cc16',
  spanish: '#f59e0b', canadian: '#f43f5e', mexican: '#059669', russian: '#4338ca', ukrainian: '#d946ef', chinese: '#b91c1c', syrian: '#9333ea', hungarian: '#16a34a', turkish: '#be123c', rusyn: '#0033a0', generic: '#94a3b8'
};
