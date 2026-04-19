/**
 * Best-effort restoration of Mac chart container payloads.
 *
 * This adapter reads the archived payload stored in SavedChart/SavedView records and
 * tries to infer the equivalent web chart document shape.
 */

import { getLocalDatabase } from './LocalDatabase.js';

const DEFAULT_GENERATIONS = 5;

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function recordNameFromValue(value) {
  if (!value && value !== 0) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.recordName === 'string') return value.recordName;
    if (typeof value.value === 'string') return value.value;
    if (typeof value.identifier === 'string') return value.identifier;
    if (typeof value.reference === 'string') return value.reference;
  }
  return undefined;
}

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseMaybeJson(value) {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return undefined;
    }
  }
  return undefined;
}

function normalizeChartType(rawType) {
  if (!rawType) return undefined;
  const lower = String(rawType).toLowerCase();
  const direct = lower.replace(/[^a-z0-9-]/g, '');
  const map = {
    ancestor: 'ancestor',
    ancestors: 'ancestor',
    desc: 'descendant',
    descendant: 'descendant',
    descendants: 'descendant',
    hourglass: 'hourglass',
    tree: 'tree',
    fan: 'fan',
    relationship: 'relationship',
    virtual: 'virtual',
    circular: 'circular',
    'symmetricaltree': 'symmetrical',
    symmetrical: 'symmetrical',
    distribution: 'distribution',
    timeline: 'timeline',
    genogram: 'genogram',
    sociogram: 'sociogram',
    frustum: 'fractal-tree',
    fractal: 'fractal-tree',
    'fractal-tree': 'fractal-tree',
    'fractal-htree': 'fractal-h-tree',
    'fractal-tree': 'fractal-tree',
    'fractal-h-tree': 'fractal-h-tree',
    'square-tree': 'square-tree',
    'doubleancestor': 'double-ancestor',
    'double-ancestor': 'double-ancestor',
  };
  if (map[direct]) return map[direct];
  if (direct.includes('double') && direct.includes('ancestor')) return 'double-ancestor';
  if (direct.includes('fractal') && direct.includes('h')) return 'fractal-h-tree';
  if (direct.includes('virtual')) return 'virtual';
  if (direct.includes('symmetrical') || direct.includes('symetric')) return 'symmetrical';
  if (direct.includes('circle')) return 'circular';
  return undefined;
}

function walkForStringValues(node, predicate, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) walkForStringValues(item, predicate, out);
    return out;
  }
  for (const [key, value] of Object.entries(node)) {
    if (predicate(key, value)) {
      out.push(value);
    }
    walkForStringValues(value, predicate, out);
  }
  return out;
}

function isLikelyOverlay(value) {
  if (!value || typeof value !== 'object') return false;
  const hasLine = typeof value.x1 === 'number' && typeof value.y1 === 'number'
    && typeof value.x2 === 'number' && typeof value.y2 === 'number';
  const hasRect = typeof value.x === 'number' && typeof value.y === 'number'
    && ((typeof value.width === 'number' && typeof value.height === 'number')
      || typeof value.text === 'string'
      || typeof value.href === 'string');
  const type = String(value.type || value.objectType || value.kind || '').toLowerCase();
  const looksLikeType = ['text', 'line', 'image'].includes(type)
    || /text|image|line/.test(type);
  return (hasLine || hasRect) && (looksLikeType || hasRect || hasLine);
}

function normalizeOverlay(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = {
    id: raw.id || raw.identifier || raw.uuid || undefined,
    type: String(raw.type || raw.objectType || raw.kind || '').toLowerCase(),
    x: toNumber(raw.x) ?? 0,
    y: toNumber(raw.y) ?? 0,
    x1: toNumber(raw.x1) ?? 0,
    y1: toNumber(raw.y1) ?? 0,
    x2: toNumber(raw.x2) ?? 0,
    y2: toNumber(raw.y2) ?? 0,
  };

  if (candidate.type === 'text' || typeof raw.text === 'string') {
    candidate.type = 'text';
    candidate.text = raw.text || raw.label || 'Text';
    candidate.fontSize = toNumber(raw.fontSize) || 18;
    candidate.color = raw.color || '#222222';
    return candidate;
  }

  if (candidate.type === 'line' || (candidate.x1 || candidate.y1 || candidate.x2 || candidate.y2)) {
    candidate.type = 'line';
    candidate.strokeWidth = toNumber(raw.strokeWidth) || 2;
    candidate.color = raw.color || '#2f2f2f';
    return candidate;
  }

  if (candidate.type === 'image' || raw.href || raw.image || raw.url) {
    candidate.type = 'image';
    candidate.href = raw.href || raw.image || raw.url || raw.uri || '';
    if (candidate.href && !/^(data:|https?:|\/|file:)/i.test(candidate.href)) {
      const sanitized = String(candidate.href).trim();
      if (/^[A-Za-z0-9+/=]+$/.test(sanitized) && sanitized.length > 120) {
        candidate.href = `data:image/png;base64,${sanitized}`;
      } else {
        candidate.href = sanitized;
      }
    }
    candidate.width = toNumber(raw.width) || 180;
    candidate.height = toNumber(raw.height) || 120;
    return candidate;
  }

  return undefined;
}

function collectOverlays(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const item of node) collectOverlays(item, out);
    return out;
  }

  const asObject = node;
  if (isLikelyOverlay(asObject)) {
    const overlay = normalizeOverlay(asObject);
    if (overlay) out.push(overlay);
  }

  for (const [key, value] of Object.entries(asObject)) {
    const lower = String(key).toLowerCase();
    if (['page', 'pagesetup', 'layout', 'objects', 'chartobjects', 'chart', 'overlays'].includes(lower)) {
      if (Array.isArray(value)) {
        for (const item of value) collectOverlays(item, out);
      } else {
        collectOverlays(value, out);
      }
      continue;
    }
    if (value && typeof value === 'object') collectOverlays(value, out);
  }
  return out;
}

function firstString(node, keys) {
  for (const key of keys) {
    if (key in (node || {})) {
      const value = node[key];
      if (typeof value === 'string' && value.trim()) return value;
      if (value && typeof value === 'object') {
        const inner = value.value;
        if (typeof inner === 'string' && inner.trim()) return inner;
      }
    }
  }
  return undefined;
}

function findPageShape(node) {
  const candidates = [
    'page',
    'pageSetup',
    'pageSetupData',
    'pageSize',
    'paper',
    'paperSize',
    'print',
  ];
  for (const key of candidates) {
    if (node?.[key] && typeof node[key] === 'object') {
      const candidate = node[key];
      const size = firstString(candidate, ['size', 'paperSize', 'format', 'formatName']) || node.size;
      const orientation = firstString(candidate, ['orientation', 'portraitLandscape']) || node.orientation;
      const backgroundColor = firstString(candidate, ['background', 'backgroundColor', 'backgroundColorHex']) || node.backgroundColor;
      return {
        size: size || 'letter',
        orientation: orientation || 'landscape',
        backgroundColor: backgroundColor || '',
      };
    }
  }
  return { size: 'letter', orientation: 'landscape', backgroundColor: '' };
}

function findNumeric(node, keyNames) {
  for (const key of keyNames) {
    const v = node?.[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (v && typeof v === 'object' && typeof v.value === 'number' && Number.isFinite(v.value)) return v.value;
  }
  const found = walkForStringValues(node, (k) => keyNames.includes(k));
  return found
    .map(toNumber)
    .find((value) => Number.isFinite(value));
}

function inferFromDecodedPayload(decoded, record) {
  if (!decoded || typeof decoded !== 'object') {
    return {
      chartType: 'ancestor',
      generations: DEFAULT_GENERATIONS,
      overlays: [],
      virtual: { source: 'descendant', orientation: 'vertical', hSpacing: 24, vSpacing: 110 },
      page: { size: 'letter', orientation: 'landscape', backgroundColor: '' },
    };
  }

  const root =
    recordNameFromValue(decoded.rootRecordName || decoded.rootPerson || decoded.root)
    || recordNameFromValue(firstString(decoded, ['rootPerson', 'subject', 'personRecordName', 'anchor']))
    || undefined;

  const second =
    recordNameFromValue(decoded.secondRecordName || decoded.partnerRecord || decoded.second)
    || recordNameFromValue(firstString(decoded, ['secondPerson', 'partnerRecordName', 'secondaryPerson']));

  const chartTypeHint = normalizeChartType(
    firstString(decoded, ['chartType', 'chartStyle', 'chartKind', 'displayMode'])
    || decoded?.summary?.entityName
    || decoded?.summary?.rootClass
    || decoded?.chartType
  );

  const generations = findNumeric(decoded, ['generations', 'generationCount', 'depth', 'treeDepth']) || DEFAULT_GENERATIONS;

  const virtualSource =
    firstString(decoded, ['virtualSource', 'source'])
    || firstString(decoded?.virtual, ['source'])
    || 'descendant';

  const virtualOrientation =
    firstString(decoded, ['virtualOrientation', 'orientation'])
    || firstString(decoded?.virtual, ['orientation'])
    || 'vertical';

  const hSpacing =
    findNumeric(decoded, ['hSpacing', 'horizontalSpacing'])
    || findNumeric(decoded?.virtual, ['hSpacing', 'horizontalSpacing'])
    || 24;

  const vSpacing =
    findNumeric(decoded, ['vSpacing', 'verticalSpacing'])
    || findNumeric(decoded?.virtual, ['vSpacing', 'verticalSpacing'])
    || 110;

  const title =
    firstString(decoded, ['title'])
    || recordNameFromValue(record?.fields?.title)
    || undefined;

  const note =
    firstString(decoded, ['note', 'subtitle', 'description'])
    || undefined;

  const page = findPageShape(decoded);
  const overlays = collectOverlays(decoded).map((overlay, index) => ({
    id: overlay.id || `overlay-${index}-${Math.random().toString(36).slice(2, 7)}`,
    ...overlay,
  }));

  return {
    name: title || 'Imported Saved Chart',
    chartType: chartTypeHint || 'ancestor',
    rootId: root,
    secondId: second,
    generations: Math.max(2, Math.min(8, generations || DEFAULT_GENERATIONS)),
    virtual: {
      source: virtualSource === 'ancestor' ? 'ancestor' : 'descendant',
      orientation: virtualOrientation || 'vertical',
      hSpacing: Math.max(8, Math.min(200, hSpacing || 24)),
      vSpacing: Math.max(50, Math.min(260, vSpacing || 110)),
    },
    page: {
      title,
      note,
      size: page.size || 'letter',
      orientation: page.orientation || 'landscape',
      backgroundColor: page.backgroundColor || '',
    },
    overlays,
  };
}

function normalizeSource(raw) {
  if (!raw) return undefined;
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseMaybeJson(trimmed);
  }
  return undefined;
}

export async function findSavedChartRecordById(recordName) {
  const db = getLocalDatabase();
  const record = await db.getRecord(recordName);
  if (record && isSavedChartRecord(record)) return record;

  const fallbackQuery = await db.query('SavedChart', { limit: 100000 });
  for (const rec of fallbackQuery.records || []) {
    if (rec.recordName === recordName) return rec;
  }
  const savedViewQuery = await db.query('SavedView', { limit: 100000 });
  for (const rec of savedViewQuery.records || []) {
    if (rec.recordName === recordName) return rec;
  }
  return null;
}

export async function loadSavedChartDocument(recordName) {
  const record = await findSavedChartRecordById(recordName);
  if (!record) return null;
  return mapSavedChartRecordToDocument(record);
}

export function isSavedChartRecord(record) {
  return record?.recordType === 'SavedChart' || record?.recordType === 'SavedView';
}

export function mapSavedChartRecordToDocument(record) {
  if (!record || !record.fields) return null;
  const decoded = parseMaybeJson(record.fields.chartObjectsContainerDataDecoded?.value)
    || parseMaybeJson(record.fields.chartObjectsContainerDataDecoded);
  const fallbackPayload = parseMaybeJson(normalizeSource(record.fields.chartObjectsContainerData?.value))
    || normalizeSource(record.fields.chartObjectsContainerData);
  const payload = decoded?.status === 'decoded' ? decoded.decoded : fallbackPayload;
  const mapped = inferFromDecodedPayload(payload || decoded, record);

  return {
    id: record.recordName,
    chartType: mapped.chartType || 'ancestor',
    rootId: mapped.rootId || undefined,
    secondId: mapped.secondId || undefined,
    themeId: undefined,
    generations: mapped.generations || DEFAULT_GENERATIONS,
    virtual: mapped.virtual,
    page: mapped.page,
    title: mapped.page?.title || record.fields.title?.value || record.fields.name?.value || '',
    note: mapped.page?.note || record.fields.subtitle?.value || '',
    overlays: mapped.overlays || [],
    metadata: {
      sourceRecordName: record.recordName,
      sourceRecordType: record.recordType,
      sourceStatus: decoded?.status || (record.fields.chartObjectsContainerData?.value ? 'stored' : 'missing'),
      sourcePayloadRaw: record.fields.chartObjectsContainerData?.value || null,
    },
  };
}
