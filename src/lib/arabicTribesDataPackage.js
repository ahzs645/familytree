import { readField } from './schema.js';
import { makeAffiliationKey } from './tribalAffiliations.js';

export const ARABIC_TRIBES_SOURCE_CATALOG = [
  { id: 'nyu_aco001717' },
  { id: 'columbia_aco002766' },
  { id: 'princeton_aco002158' },
  { id: 'princeton_aco002165' },
  { id: 'princeton_aco002354' },
  { id: 'columbia_aco000984' },
  { id: 'cornell_aco000656' },
  { id: 'aub_aco001670' },
  { id: 'columbia_aco003356' },
];

export const IRAQI_TRIBES_SEED = [
  {
    id: 'iraq-tribe-shammar',
    arabicName: 'شمر',
    englishName: 'Shammar',
    level: 'confederation',
    region: 'Iraq; Jazira; Najd',
    confidence: 'unknown',
    status: 'seed',
    notes: 'Seed authority entry awaiting page-level citation from the Triber Arabic corpus.',
  },
  {
    id: 'iraq-tribe-dulaim',
    arabicName: 'الدليم',
    englishName: 'Dulaim',
    level: 'tribe',
    region: 'Anbar; western Iraq',
    confidence: 'unknown',
    status: 'seed',
    notes: 'Seed authority entry awaiting page-level citation from the Triber Arabic corpus.',
  },
  {
    id: 'iraq-tribe-jubur',
    arabicName: 'الجبور',
    englishName: 'Al Jubur',
    level: 'tribe',
    region: 'Central and northern Iraq',
    confidence: 'unknown',
    status: 'seed',
    notes: 'Seed authority entry awaiting page-level citation from the Triber Arabic corpus.',
  },
  {
    id: 'iraq-tribe-obaid',
    arabicName: 'العبيد',
    englishName: 'Al Ubaid',
    level: 'tribe',
    region: 'Central and northern Iraq',
    confidence: 'unknown',
    status: 'seed',
    notes: 'Seed authority entry awaiting page-level citation from the Triber Arabic corpus.',
  },
  {
    id: 'iraq-tribe-azawi',
    arabicName: 'العزة',
    englishName: 'Al Azza',
    level: 'tribe',
    region: 'Diyala; Salah ad Din; Baghdad belt',
    confidence: 'unknown',
    status: 'seed',
    notes: 'Seed authority entry awaiting page-level citation from the Triber Arabic corpus.',
  },
];

export function tribeDisplayName(record) {
  const arabic = String(record?.arabicName || '').trim();
  const english = String(record?.englishName || '').trim();
  if (arabic && english) return `${arabic} / ${english}`;
  return arabic || english || record?.id || 'Tribal affiliation';
}

export function createTribalAffiliationFromSeed(record) {
  const name = tribeDisplayName(record);
  const fields = {
    name: { value: name, type: 'STRING' },
    arabicName: { value: record.arabicName || '', type: 'STRING' },
    englishName: { value: record.englishName || '', type: 'STRING' },
    level: { value: record.level || 'tribe', type: 'STRING' },
    confidence: { value: record.confidence || 'unknown', type: 'STRING' },
    dataPackage: { value: 'arabic-iraqi-tribes-corpus', type: 'STRING' },
    dataPackageEntityId: { value: record.id, type: 'STRING' },
    notes: {
      value: [record.region ? `Region: ${record.region}` : '', record.notes || '']
        .filter(Boolean)
        .join('\n'),
      type: 'STRING',
    },
  };
  return {
    recordName: `tribe-seed-${record.id}`,
    recordType: 'TribalAffiliation',
    fields,
  };
}

export function createTribalSourcePageRecord(page) {
  const sourceId = String(page?.sourceId || '').trim();
  const pageIndex = Number.isInteger(page?.pageIndex) ? page.pageIndex : 0;
  const fields = {
    dataPackage: { value: 'arabic-iraqi-tribes-corpus', type: 'STRING' },
    sourceId: { value: sourceId, type: 'STRING' },
    pageIndex: { value: pageIndex, type: 'INTEGER' },
    reviewStatus: { value: page?.reviewStatus || 'raw', type: 'STRING' },
    ocrEngine: { value: page?.ocrEngine || 'mineru-pipeline', type: 'STRING' },
    arabicText: { value: page?.arabicText || page?.mineruMarkdown || '', type: 'STRING' },
    englishTranslation: { value: page?.englishTranslation || '', type: 'STRING' },
  };
  if (page?.printedPage) fields.printedPage = { value: page.printedPage, type: 'STRING' };
  if (page?.mineruRunPath) fields.mineruRunPath = { value: page.mineruRunPath, type: 'STRING' };
  if (page?.vlmRunPath) fields.vlmRunPath = { value: page.vlmRunPath, type: 'STRING' };
  if (page?.imagePath) fields.imagePath = { value: page.imagePath, type: 'STRING' };
  if (Array.isArray(page?.entities)) fields.entitiesJson = { value: JSON.stringify(page.entities), type: 'STRING' };

  return {
    recordName: `tribe-page-${sourceId || 'source'}-${pageIndex}`,
    recordType: 'TribalSourcePage',
    fields,
  };
}

export function createTribalAffiliationFromOcrEntity(entity, page) {
  const arabicName = String(entity?.arabicName || '').trim();
  const englishName = String(entity?.englishName || '').trim();
  const level = entity?.type === 'house' ? 'house' : entity?.type === 'branch' ? 'branch' : entity?.type === 'clan' ? 'clan' : 'tribe';
  const sourceId = String(page?.sourceId || '').trim();
  const pageIndex = Number.isInteger(page?.pageIndex) ? page.pageIndex : 0;
  const name = tribeDisplayName({ arabicName, englishName, id: entity?.canonicalId });
  const fields = {
    name: { value: name, type: 'STRING' },
    arabicName: { value: arabicName, type: 'STRING' },
    englishName: { value: englishName, type: 'STRING' },
    level: { value: level, type: 'STRING' },
    confidence: { value: page?.reviewStatus === 'human-reviewed' ? 'documented' : 'unknown', type: 'STRING' },
    dataPackage: { value: 'arabic-iraqi-tribes-corpus', type: 'STRING' },
    dataPackageSourceId: { value: sourceId, type: 'STRING' },
    dataPackagePageIndex: { value: pageIndex, type: 'INTEGER' },
    dataPackageEntityId: { value: entity?.canonicalId || `${sourceId}-${pageIndex}-${level}-${arabicName || englishName}`, type: 'STRING' },
    evidenceText: { value: entity?.evidenceText || '', type: 'STRING' },
    notes: {
      value: [
        `Source: ${sourceId}${page?.printedPage ? `, printed page ${page.printedPage}` : `, page index ${pageIndex}`}`,
        entity?.evidenceText ? `Evidence: ${entity.evidenceText}` : '',
      ].filter(Boolean).join('\n'),
      type: 'STRING',
    },
  };

  return {
    recordName: `tribe-ocr-${sourceId || 'source'}-${pageIndex}-${slugify(arabicName || englishName || entity?.canonicalId || level)}`,
    recordType: 'TribalAffiliation',
    fields,
  };
}

export function buildOcrPageImportPlan(existingAffiliations = [], pages = []) {
  const existingKeys = new Set();
  const existingEntityIds = new Set();
  for (const affiliation of existingAffiliations) {
    const fields = affiliation.record?.fields || affiliation.fields || {};
    const name = affiliation.name || readField({ fields }, ['name', 'title'], '');
    const level = affiliation.level || readField({ fields }, ['level'], 'tribe');
    const entityId = readField({ fields }, ['dataPackageEntityId'], '');
    if (name) existingKeys.add(makeAffiliationKey(name, level));
    if (entityId) existingEntityIds.add(entityId);
  }

  const sourcePages = [];
  const affiliations = [];
  const skipped = [];
  for (const page of pages) {
    sourcePages.push(createTribalSourcePageRecord(page));
    for (const entity of page?.entities || []) {
      if (!['tribe', 'clan', 'branch', 'house'].includes(entity?.type)) continue;
      const record = createTribalAffiliationFromOcrEntity(entity, page);
      const key = makeAffiliationKey(readField(record, ['name'], ''), readField(record, ['level'], 'tribe'));
      const entityId = readField(record, ['dataPackageEntityId'], '');
      if (existingKeys.has(key) || existingEntityIds.has(entityId)) {
        skipped.push({ entity, page });
        continue;
      }
      existingKeys.add(key);
      existingEntityIds.add(entityId);
      affiliations.push(record);
    }
  }

  return { sourcePages, affiliations, skipped };
}

export function buildSeedImportPlan(existingAffiliations = [], seedRecords = IRAQI_TRIBES_SEED) {
  const existingKeys = new Set();
  const existingEntityIds = new Set();

  for (const affiliation of existingAffiliations) {
    const fields = affiliation.record?.fields || affiliation.fields || {};
    const name = affiliation.name || readField({ fields }, ['name', 'title'], '');
    const level = affiliation.level || readField({ fields }, ['level'], 'tribe');
    const entityId = readField({ fields }, ['dataPackageEntityId'], '');
    if (name) existingKeys.add(makeAffiliationKey(name, level));
    if (entityId) existingEntityIds.add(entityId);
  }

  const records = [];
  const skipped = [];
  for (const seed of seedRecords) {
    const next = createTribalAffiliationFromSeed(seed);
    const nextKey = makeAffiliationKey(readField(next, ['name'], ''), readField(next, ['level'], 'tribe'));
    if (existingEntityIds.has(seed.id) || existingKeys.has(nextKey)) skipped.push(seed);
    else records.push(next);
  }

  return { records, skipped };
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'entity';
}
