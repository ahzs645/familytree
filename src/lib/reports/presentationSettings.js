import { SUPPORTED_LOCALES } from '../i18n.js';
import { normalizePageStyle } from '../presentationSettings.js';

export const REPORT_LANGUAGE_APP = 'app';
export const DEFAULT_REPORT_TABLE_STYLE = {
  watermarkText: '',
  watermarkOpacity: 0.12,
  tableGridLines: 'horizontal',
  repeatTableHeader: true,
  stripeTableRows: false,
};

export function normalizeReportPageStyle(pageStyle = {}) {
  const base = normalizePageStyle(pageStyle);
  const merged = { ...DEFAULT_REPORT_TABLE_STYLE, ...(pageStyle || {}) };
  return {
    ...base,
    watermarkText: String(merged.watermarkText || '').slice(0, 120),
    watermarkOpacity: Number.isFinite(Number(merged.watermarkOpacity))
      ? Math.max(0.04, Math.min(0.35, Number(merged.watermarkOpacity)))
      : DEFAULT_REPORT_TABLE_STYLE.watermarkOpacity,
    tableGridLines: ['none', 'horizontal', 'all'].includes(merged.tableGridLines)
      ? merged.tableGridLines
      : DEFAULT_REPORT_TABLE_STYLE.tableGridLines,
    repeatTableHeader: merged.repeatTableHeader !== false,
    stripeTableRows: !!merged.stripeTableRows,
  };
}

export function normalizeReportLanguage(locale) {
  const value = String(locale || REPORT_LANGUAGE_APP);
  return value === REPORT_LANGUAGE_APP || SUPPORTED_LOCALES.some((entry) => entry.value === value)
    ? value
    : REPORT_LANGUAGE_APP;
}

export function reportContainsTables(report) {
  return !!report?.blocks?.some((entry) => entry?.kind === 'table');
}

/** Stable comparison surface for saved-report dirty tracking. */
export function reportConfigurationSignature(configuration = {}) {
  return JSON.stringify(sortObject({
    builderId: configuration.builderId || '',
    targetId: configuration.targetId || null,
    secondTargetId: configuration.secondTargetId || null,
    options: configuration.options || {},
    pageStyle: normalizeReportPageStyle(configuration.pageStyle),
    themeId: configuration.themeId || 'plain',
    reportLanguage: normalizeReportLanguage(configuration.reportLanguage),
  }));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortObject(value[key]);
    return result;
  }, {});
}
