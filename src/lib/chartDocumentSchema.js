export const CHART_DOCUMENT_SCHEMA_VERSION = 2;

const DEFAULT_GENERATIONS = 5;

const CHART_OPTION_KEYS = [
  'ancestor',
  'descendant',
  'tree',
  'fan',
  'hourglass',
  'doubleAncestor',
  'relationship',
  'genogram',
  'sociogram',
  'timeline',
  'distribution',
  'statistics',
  'virtual',
];

export function normalizeChartDocument(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const chartType = source.chartType || 'ancestor';
  const roots = normalizeRoots(source);
  const builderConfig = createDefaultBuilderConfig(chartType, source);
  const compositorConfig = createDefaultCompositorConfig(source);
  const pageSetup = createDefaultPageSetup(source);
  const exportSettings = createDefaultExportSettings(source);
  const importedMac = normalizeImportedMac(source);

  return {
    ...source,
    id: source.id,
    name: source.name || source.title || 'Untitled Chart',
    schemaVersion: CHART_DOCUMENT_SCHEMA_VERSION,
    chartType,
    roots,
    builderConfig,
    compositorConfig,
    pageSetup,
    exportSettings,
    importedMac,

    // Compatibility fields kept until all callers consume the container schema.
    rootId: roots.primaryPersonId,
    secondId: roots.secondaryPersonId,
    themeId: compositorConfig.themeId,
    generations: builderConfig.common.generations,
    virtual: {
      source: builderConfig.virtual.source,
      orientation: builderConfig.virtual.orientation,
      hSpacing: builderConfig.virtual.hSpacing,
      vSpacing: builderConfig.virtual.vSpacing,
    },
    page: {
      title: pageSetup.title,
      note: pageSetup.note,
      size: pageSetup.paperSize,
      orientation: pageSetup.orientation,
      backgroundColor: pageSetup.backgroundColor,
    },
    overlays: compositorConfig.overlays,
  };
}

export function migrateChartDocument(raw = {}) {
  return normalizeChartDocument(raw);
}

export function createDefaultBuilderConfig(chartType = 'ancestor', raw = {}) {
  const existing = raw.builderConfig && typeof raw.builderConfig === 'object' ? raw.builderConfig : {};
  const generations = normalizeGenerations(existing.common?.generations ?? raw.generations);
  const relationship = {
    ...(existing.relationship || {}),
    ...(raw.relationship || {}),
  };
  const virtual = {
    ...(existing.virtual || {}),
    ...(raw.virtual || {}),
  };

  const config = {
    ...existing,
    common: {
      privacyMode: 'public',
      ...(existing.common || {}),
      generations,
    },
  };

  for (const key of CHART_OPTION_KEYS) {
    config[key] = { ...(existing[key] || {}) };
  }

  config.relationship = {
    ...relationship,
    bloodlineOnly: Boolean(relationship.bloodlineOnly),
    selectedPathId: relationship.selectedPathId || null,
    maxDepth: numberOrDefault(relationship.maxDepth, 12),
    maxPaths: numberOrDefault(relationship.maxPaths, 12),
  };

  config.virtual = {
    ...virtual,
    source: virtual.source === 'ancestor' ? 'ancestor' : 'descendant',
    orientation: virtual.orientation || 'vertical',
    hSpacing: clampNumber(virtual.hSpacing, 8, 200, 24),
    vSpacing: clampNumber(virtual.vSpacing, 50, 260, 110),
  };

  config.activeChart = chartType;
  return config;
}

export function createDefaultCompositorConfig(raw = {}) {
  const existing = raw.compositorConfig && typeof raw.compositorConfig === 'object' ? raw.compositorConfig : {};
  return {
    ...existing,
    themeId: existing.themeId || raw.themeId || 'auto',
    layoutMode: existing.layoutMode || raw.layoutMode || 'auto',
    objectStyles: { ...(existing.objectStyles || {}) },
    connectionStyles: { ...(existing.connectionStyles || {}) },
    overlays: Array.isArray(existing.overlays)
      ? existing.overlays
      : Array.isArray(raw.overlays)
        ? raw.overlays
        : [],
    selectedObjectIds: Array.isArray(existing.selectedObjectIds) ? existing.selectedObjectIds : [],
  };
}

export function createDefaultPageSetup(raw = {}) {
  const existing = raw.pageSetup && typeof raw.pageSetup === 'object' ? raw.pageSetup : {};
  const legacyPage = raw.page && typeof raw.page === 'object' ? raw.page : {};
  return {
    ...existing,
    paperSize: existing.paperSize || legacyPage.size || 'letter',
    orientation: existing.orientation || legacyPage.orientation || 'landscape',
    width: numberOrNull(existing.width),
    height: numberOrNull(existing.height),
    margins: {
      top: numberOrDefault(existing.margins?.top, 36),
      right: numberOrDefault(existing.margins?.right, 36),
      bottom: numberOrDefault(existing.margins?.bottom, 36),
      left: numberOrDefault(existing.margins?.left, 36),
    },
    overlap: numberOrDefault(existing.overlap, 0),
    printPageNumbers: Boolean(existing.printPageNumbers),
    cutMarks: Boolean(existing.cutMarks),
    omitEmptyPages: existing.omitEmptyPages !== false,
    backgroundColor: existing.backgroundColor || legacyPage.backgroundColor || '',
    title: existing.title || legacyPage.title || raw.title || '',
    note: existing.note || legacyPage.note || raw.note || '',
  };
}

export function createDefaultExportSettings(raw = {}) {
  const existing = raw.exportSettings && typeof raw.exportSettings === 'object' ? raw.exportSettings : {};
  return {
    ...existing,
    format: existing.format || 'png',
    scale: clampNumber(existing.scale, 0.25, 4, 1),
    includeBackground: existing.includeBackground !== false,
    jpegQuality: clampNumber(existing.jpegQuality, 0.1, 1, 0.92),
    fileNameTemplate: existing.fileNameTemplate || '{title}-{date}',
  };
}

function normalizeRoots(raw) {
  const roots = raw.roots && typeof raw.roots === 'object' ? raw.roots : {};
  return {
    primaryPersonId: roots.primaryPersonId || raw.rootId || null,
    secondaryPersonId: roots.secondaryPersonId || raw.secondId || null,
  };
}

function normalizeImportedMac(raw) {
  const existing = raw.importedMac && typeof raw.importedMac === 'object' ? raw.importedMac : {};
  const metadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  if (!Object.keys(existing).length && !Object.keys(metadata).length) return undefined;
  return {
    sourceRecordName: existing.sourceRecordName || metadata.sourceRecordName || null,
    sourceRecordType: existing.sourceRecordType || metadata.sourceRecordType || null,
    sourceStatus: existing.sourceStatus || metadata.sourceStatus || null,
    detectedChartClass: existing.detectedChartClass || metadata.detectedChartClass || null,
    decodedPayloadSummary: existing.decodedPayloadSummary || metadata.decodedPayloadSummary || null,
    unsupportedObjectCount: numberOrDefault(existing.unsupportedObjectCount ?? metadata.unsupportedObjectCount, 0),
    ...existing,
  };
}

function normalizeGenerations(value) {
  return clampNumber(value, 2, 12, DEFAULT_GENERATIONS);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
