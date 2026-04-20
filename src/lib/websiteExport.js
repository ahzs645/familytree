/**
 * Static website export.
 *
 * Generates a downloadable zip with indexes and entity pages for the public
 * family tree. The builder is option-driven so the publish UI can surface
 * branding, privacy, progress, and validation state instead of treating the
 * export as a fire-and-forget data transfer.
 */
import JSZip from 'jszip';
import { getLocalDatabase } from './LocalDatabase.js';
import { readConclusionType, readField, readRef } from './schema.js';
import { isPrivateRecord, isPublicRecord, isLiving, maskLivingDetails } from './privacy.js';
import { getAuthorInfo } from './authorInfo.js';
import {
  DEFAULT_LOCALIZATION,
  compareStrings,
  directionForLocale,
  formatInteger,
  getCurrentLocalization,
  normalizeLocale,
} from './i18n.js';
import {
  familySummary,
  lifeSpanLabel,
  personSummary,
  placeSummary,
  sourceSummary,
} from '../models/index.js';

const MEDIA_TYPES = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];

export const SITE_THEMES = [
  { id: 'classic', label: 'Classic' },
  { id: 'journal', label: 'Journal' },
  { id: 'archive', label: 'Archive' },
];

export const DEFAULT_SITE_OPTIONS = {
  siteTitle: 'Family Tree',
  tagline: '',
  theme: 'classic',
  accentColor: '#2563eb',
  includePrivate: false,
  hideLiving: false,
  hideLivingDetailsOnly: false,
  livingThresholdYears: 110,
  includeAssets: true,
  locale: DEFAULT_LOCALIZATION.locale,
  direction: DEFAULT_LOCALIZATION.direction,
  numberingSystem: DEFAULT_LOCALIZATION.numberingSystem,
  calendar: DEFAULT_LOCALIZATION.calendar,
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attr(value) {
  return esc(value).replace(/'/g, '&#39;');
}

function bdi(value) {
  return `<bdi dir="auto">${esc(value)}</bdi>`;
}

function normalizeOptions(options = {}) {
  const currentLocalization = getCurrentLocalization();
  const locale = normalizeLocale(options.locale || currentLocalization.locale || DEFAULT_SITE_OPTIONS.locale);
  const directionPreference = options.direction || currentLocalization.direction || DEFAULT_SITE_OPTIONS.direction;
  return {
    ...DEFAULT_SITE_OPTIONS,
    ...options,
    theme: SITE_THEMES.some((theme) => theme.id === options.theme) ? options.theme : DEFAULT_SITE_OPTIONS.theme,
    accentColor: normalizeColor(options.accentColor || DEFAULT_SITE_OPTIONS.accentColor),
    siteTitle: String(options.siteTitle || DEFAULT_SITE_OPTIONS.siteTitle).trim() || DEFAULT_SITE_OPTIONS.siteTitle,
    tagline: String(options.tagline || '').trim(),
    includePrivate: !!options.includePrivate,
    hideLiving: !!options.hideLiving,
    hideLivingDetailsOnly: !!options.hideLivingDetailsOnly,
    livingThresholdYears: Number.isFinite(+options.livingThresholdYears) ? +options.livingThresholdYears : DEFAULT_SITE_OPTIONS.livingThresholdYears,
    includeAssets: options.includeAssets !== false,
    locale,
    direction: directionForLocale(locale, directionPreference),
    numberingSystem: options.numberingSystem || currentLocalization.numberingSystem || DEFAULT_SITE_OPTIONS.numberingSystem,
    calendar: options.calendar || currentLocalization.calendar || DEFAULT_SITE_OPTIONS.calendar,
  };
}

function normalizeColor(value) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_SITE_OPTIONS.accentColor;
}

function checkCanceled(signal) {
  if (!signal?.aborted) return;
  throw new DOMException('Site export canceled.', 'AbortError');
}

function progress(onProgress, update) {
  onProgress?.(update);
}

async function loadSnapshot() {
  const db = getLocalDatabase();
  const [
    rawPersons,
    rawFamilies,
    rawChildRels,
    rawPersonEvents,
    rawFamilyEvents,
    rawPlaces,
    rawSources,
    rawSourceRelations,
    rawMediaRelations,
    rawStoryRelations,
    rawStories,
    rawStorySections,
    rawAssets,
    ...mediaRows
  ] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
    db.query('Place', { limit: 100000 }),
    db.query('Source', { limit: 100000 }),
    db.query('SourceRelation', { limit: 100000 }),
    db.query('MediaRelation', { limit: 100000 }),
    db.query('StoryRelation', { limit: 100000 }),
    db.query('Story', { limit: 100000 }),
    db.query('StorySection', { limit: 100000 }),
    db.listAllAssets(),
    ...MEDIA_TYPES.map((type) => db.query(type, { limit: 100000 })),
  ]);

  const mediaRecords = mediaRows.flatMap((row) => row.records);
  const records = [
    ...rawPersons.records,
    ...rawFamilies.records,
    ...rawChildRels.records,
    ...rawPersonEvents.records,
    ...rawFamilyEvents.records,
    ...rawPlaces.records,
    ...rawSources.records,
    ...rawSourceRelations.records,
    ...rawMediaRelations.records,
    ...rawStoryRelations.records,
    ...rawStories.records,
    ...rawStorySections.records,
    ...mediaRecords,
  ];
  const allRecordsById = new Map(records.map((record) => [record.recordName, record]));

  return {
    persons: rawPersons.records,
    families: rawFamilies.records,
    childRels: rawChildRels.records,
    personEvents: rawPersonEvents.records,
    familyEvents: rawFamilyEvents.records,
    places: rawPlaces.records,
    sources: rawSources.records,
    sourceRelations: rawSourceRelations.records,
    mediaRelations: rawMediaRelations.records,
    storyRelations: rawStoryRelations.records,
    stories: rawStories.records,
    storySections: rawStorySections.records,
    media: mediaRecords,
    assets: rawAssets,
    allRecordsById,
  };
}

export async function validateSiteExport(options = {}) {
  const normalized = normalizeOptions(options);
  const snapshot = await loadSnapshot();
  return validateSnapshot(snapshot, normalized);
}

function validateSnapshot(snapshot, options) {
  const allRecordIds = new Set(snapshot.allRecordsById.keys());
  const includedPersons = snapshot.persons.filter((record) => options.includePrivate || isPublicRecord(record));
  const missing = [];
  const privacyConflicts = [];

  for (const record of snapshot.allRecordsById.values()) {
    for (const ref of referenceFields(record)) {
      const target = snapshot.allRecordsById.get(ref.recordName);
      if (!target && !allRecordIds.has(ref.recordName)) {
        missing.push({
          from: record.recordName,
          fromType: record.recordType,
          field: ref.fieldName,
          to: ref.recordName,
        });
      } else if (!options.includePrivate && isPublicRecord(record) && isPrivateRecord(target)) {
        privacyConflicts.push({
          from: record.recordName,
          fromType: record.recordType,
          field: ref.fieldName,
          to: target.recordName,
          toType: target.recordType,
        });
      }
    }
  }

  const errors = [];
  const warnings = [];
  if (includedPersons.length === 0) {
    errors.push('No publishable people were found. Add people or include private records before exporting.');
  }
  if (missing.length > 0) {
    warnings.push(`${formatInteger(missing.length, options)} reference${missing.length === 1 ? '' : 's'} point to missing records and will be omitted.`);
  }
  if (privacyConflicts.length > 0) {
    warnings.push(`${formatInteger(privacyConflicts.length, options)} public record${privacyConflicts.length === 1 ? '' : 's'} link to private records that will be hidden.`);
  }

  return {
    canExport: errors.length === 0,
    errors,
    warnings,
    counts: {
      persons: includedPersons.length,
      privatePersons: snapshot.persons.filter(isPrivateRecord).length,
      totalPersons: snapshot.persons.length,
      records: snapshot.allRecordsById.size,
    },
    missingReferences: missing,
    privacyConflicts,
  };
}

function referenceFields(record) {
  const refs = [];
  for (const [fieldName, field] of Object.entries(record?.fields || {})) {
    const value = field?.value ?? field;
    if (field?.type !== 'REFERENCE' && !(typeof value === 'string' && value.includes('---'))) continue;
    const recordName = readRef(field);
    if (recordName) refs.push({ fieldName, recordName });
  }
  return refs;
}

export async function buildSite(options = {}) {
  const normalized = normalizeOptions(options);
  const { onProgress, signal } = options;

  progress(onProgress, { phase: 'loading', completed: 0, total: 1, message: 'Loading tree records...' });
  const snapshot = await loadSnapshot();
  const author = await safeGetAuthorInfo();
  checkCanceled(signal);

  const validation = validateSnapshot(snapshot, normalized);
  if (!validation.canExport) {
    throw new Error(validation.errors.join(' '));
  }

  const model = buildPublishModel(snapshot, normalized);
  model.author = author;
  const zip = new JSZip();
  const css = createCSS(normalized);
  zip.file('assets/site.css', css);

  const totalPages =
    1 +
    6 +
    model.persons.length +
    model.families.length +
    model.places.length +
    model.sources.length +
    model.media.length +
    model.stories.length;
  let completed = 0;
  const markPage = (message) => {
    completed += 1;
    progress(onProgress, { phase: 'pages', completed, total: totalPages, message });
  };

  progress(onProgress, { phase: 'pages', completed, total: totalPages, message: 'Writing index pages...' });
  zip.file('index.html', pageWrap('Home', homePage(model, normalized), normalized, '', author));
  markPage('Wrote home page.');
  for (const [folder, title, records, renderer] of [
    ['people', 'People', model.persons, personIndexItem],
    ['families', 'Families', model.families, familyIndexItem],
    ['places', 'Places', model.places, placeIndexItem],
    ['sources', 'Sources', model.sources, sourceIndexItem],
    ['media', 'Media', model.media, mediaIndexItem],
    ['stories', 'Stories', model.stories, storyIndexItem],
  ]) {
    checkCanceled(signal);
    zip.file(`${folder}/index.html`, pageWrap(title, entityIndexPage(title, records, renderer, model, folder), normalized, folder, author));
    markPage(`Wrote ${title.toLowerCase()} index.`);
  }

  for (const person of model.persons) {
    checkCanceled(signal);
    const title = personSummary(person)?.fullName || person.recordName;
    zip.file(model.pathById.get(person.recordName), pageWrap(title, personPage(person, model), normalized, 'people', author));
    markPage(`Wrote ${title}.`);
  }
  for (const family of model.families) {
    checkCanceled(signal);
    const title = familyLabel(family, model) || family.recordName;
    zip.file(model.pathById.get(family.recordName), pageWrap(title, familyPage(family, model), normalized, 'families', author));
    markPage(`Wrote ${title}.`);
  }
  for (const place of model.places) {
    checkCanceled(signal);
    const title = placeLabel(place) || place.recordName;
    zip.file(model.pathById.get(place.recordName), pageWrap(title, placePage(place, model), normalized, 'places', author));
    markPage(`Wrote ${title}.`);
  }
  for (const source of model.sources) {
    checkCanceled(signal);
    const title = sourceLabel(source) || source.recordName;
    zip.file(model.pathById.get(source.recordName), pageWrap(title, sourcePage(source, model), normalized, 'sources', author));
    markPage(`Wrote ${title}.`);
  }
  for (const media of model.media) {
    checkCanceled(signal);
    const title = mediaLabel(media) || media.recordName;
    zip.file(model.pathById.get(media.recordName), pageWrap(title, mediaPage(media, model), normalized, 'media', author));
    markPage(`Wrote ${title}.`);
  }
  for (const story of model.stories) {
    checkCanceled(signal);
    const title = storyLabel(story) || story.recordName;
    zip.file(model.pathById.get(story.recordName), pageWrap(title, storyPage(story, model), normalized, 'stories', author));
    markPage(`Wrote ${title}.`);
  }

  let assetCount = 0;
  if (normalized.includeAssets) {
    const assets = model.assets.filter((asset) => asset.dataBase64 && model.mediaById.has(asset.ownerRecordName));
    progress(onProgress, { phase: 'assets', completed: 0, total: assets.length, message: 'Bundling media assets...' });
    for (const asset of assets) {
      checkCanceled(signal);
      const path = model.assetPathById.get(asset.assetId);
      if (!path) continue;
      zip.file(path, asset.dataBase64, { base64: true });
      assetCount += 1;
      progress(onProgress, {
        phase: 'assets',
        completed: assetCount,
        total: assets.length,
        message: `Bundled ${formatInteger(assetCount, normalized)} media asset${assetCount === 1 ? '' : 's'}.`,
      });
    }
  }

  progress(onProgress, { phase: 'zip', completed: 0, total: 1, message: 'Compressing website zip...' });
  const blob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    progress(onProgress, {
      phase: 'zip',
      completed: Math.round(metadata.percent),
      total: 100,
      message: `Compressing website zip (${Math.round(metadata.percent)}%).`,
    });
  });

  const stats = {
    persons: model.persons.length,
    families: model.families.length,
    places: model.places.length,
    sources: model.sources.length,
    media: model.media.length,
    stories: model.stories.length,
    pages: totalPages,
    assets: assetCount,
  };
  progress(onProgress, { phase: 'complete', completed: totalPages, total: totalPages, message: 'Website export complete.', stats });
  return { blob, stats, validation, options: normalized };
}

function buildPublishModel(snapshot, options) {
  const include = (record) => {
    if (!record) return false;
    if (!options.includePrivate && isPrivateRecord(record)) return false;
    if (options.hideLiving && !options.hideLivingDetailsOnly && isLiving(record, options.livingThresholdYears)) return false;
    return true;
  };
  const livingMaskPolicy = {
    hideMarkedPrivate: !options.includePrivate,
    hideLivingPersons: options.hideLiving,
    hideLivingDetailsOnly: options.hideLivingDetailsOnly,
    livingPersonThresholdYears: options.livingThresholdYears,
  };
  const applyMask = (record) => (options.hideLivingDetailsOnly ? maskLivingDetails(record, livingMaskPolicy) : record);
  const persons = snapshot.persons.filter(include).map(applyMask).sort(compareBy((record) => personSummary(record)?.fullName || record.recordName, options));
  const personIds = new Set(persons.map((record) => record.recordName));
  const childRels = snapshot.childRels.filter((rel) => include(rel) && personIds.has(readRef(rel.fields?.child)));

  const families = snapshot.families
    .filter((family) => include(family) && familyHasIncludedMember(family, childRels, personIds))
    .sort(compareBy((record) => familyLabel(record, { personById: new Map(persons.map((person) => [person.recordName, person])) }) || record.recordName, options));
  const familyIds = new Set(families.map((record) => record.recordName));

  const places = snapshot.places.filter(include).sort(compareBy(placeLabel, options));
  const sources = snapshot.sources.filter(include).sort(compareBy(sourceLabel, options));
  const media = snapshot.media.filter(include).sort(compareBy(mediaLabel, options));
  const stories = snapshot.stories.filter(include).sort(compareBy(storyLabel, options));

  const pageRecords = [
    ...persons,
    ...families,
    ...places,
    ...sources,
    ...media,
    ...stories,
  ];
  const pathById = new Map();
  for (const record of pageRecords) pathById.set(record.recordName, pagePath(record));

  const placeIds = new Set(places.map((record) => record.recordName));
  const sourceIds = new Set(sources.map((record) => record.recordName));
  const mediaIds = new Set(media.map((record) => record.recordName));
  const storyIds = new Set(stories.map((record) => record.recordName));
  const includedRecordIds = new Set([...personIds, ...familyIds, ...placeIds, ...sourceIds, ...mediaIds, ...storyIds]);

  const personEvents = snapshot.personEvents.filter((event) => include(event) && personIds.has(readRef(event.fields?.person)));
  const familyEvents = snapshot.familyEvents.filter((event) => include(event) && familyIds.has(readRef(event.fields?.family)));
  const sourceRelations = snapshot.sourceRelations.filter((rel) => (
    include(rel) &&
    sourceIds.has(readRef(rel.fields?.source)) &&
    (includedRecordIds.has(readRef(rel.fields?.target)) || eventIsIncluded(readRef(rel.fields?.target), personEvents, familyEvents))
  ));
  const mediaRelations = snapshot.mediaRelations.filter((rel) => (
    include(rel) && mediaIds.has(readRef(rel.fields?.media)) && includedRecordIds.has(readRef(rel.fields?.target))
  ));
  const storyRelations = snapshot.storyRelations.filter((rel) => (
    include(rel) && storyIds.has(readRef(rel.fields?.story)) && includedRecordIds.has(readRef(rel.fields?.target))
  ));
  const storySections = snapshot.storySections.filter((section) => (
    include(section) && storyIds.has(readRef(section.fields?.story) || readRef(section.fields?.storySection))
  ));

  const assets = options.includeAssets ? snapshot.assets.filter((asset) => mediaIds.has(asset.ownerRecordName)) : [];
  const assetPathById = new Map();
  for (const asset of assets) assetPathById.set(asset.assetId, `assets/media/${safeAssetName(asset)}`);

  const model = {
    options,
    persons,
    families,
    places,
    sources,
    media,
    stories,
    childRels,
    personEvents,
    familyEvents,
    sourceRelations,
    mediaRelations,
    storyRelations,
    storySections,
    assets,
    pathById,
    assetPathById,
    personById: new Map(persons.map((record) => [record.recordName, record])),
    familyById: new Map(families.map((record) => [record.recordName, record])),
    placeById: new Map(places.map((record) => [record.recordName, record])),
    sourceById: new Map(sources.map((record) => [record.recordName, record])),
    mediaById: new Map(media.map((record) => [record.recordName, record])),
    storyById: new Map(stories.map((record) => [record.recordName, record])),
  };

  model.childrenByFamily = groupRefs(childRels, 'family', 'child');
  model.parentFamilyByChild = new Map(childRels.map((rel) => [readRef(rel.fields?.child), readRef(rel.fields?.family)]));
  model.familiesByPerson = buildFamiliesByPerson(families);
  model.personEventsByPerson = groupRecords(personEvents, (record) => readRef(record.fields?.person));
  model.familyEventsByFamily = groupRecords(familyEvents, (record) => readRef(record.fields?.family));
  model.sourceRelationsByTarget = groupRecords(sourceRelations, (record) => readRef(record.fields?.target));
  model.sourceRelationsBySource = groupRecords(sourceRelations, (record) => readRef(record.fields?.source));
  model.mediaRelationsByTarget = groupRecords(mediaRelations, (record) => readRef(record.fields?.target));
  model.mediaRelationsByMedia = groupRecords(mediaRelations, (record) => readRef(record.fields?.media));
  model.storyRelationsByTarget = groupRecords(storyRelations, (record) => readRef(record.fields?.target));
  model.storyRelationsByStory = groupRecords(storyRelations, (record) => readRef(record.fields?.story));
  model.storySectionsByStory = groupRecords(storySections, (record) => readRef(record.fields?.story) || readRef(record.fields?.storySection));
  model.assetsByOwner = groupRecords(assets, (asset) => asset.ownerRecordName);
  return model;
}

function eventIsIncluded(recordName, personEvents, familyEvents) {
  if (!recordName) return false;
  return personEvents.some((event) => event.recordName === recordName) || familyEvents.some((event) => event.recordName === recordName);
}

function familyHasIncludedMember(family, childRels, personIds) {
  const man = readRef(family.fields?.man);
  const woman = readRef(family.fields?.woman);
  if ((man && personIds.has(man)) || (woman && personIds.has(woman))) return true;
  return childRels.some((rel) => readRef(rel.fields?.family) === family.recordName && personIds.has(readRef(rel.fields?.child)));
}

function buildFamiliesByPerson(families) {
  const out = new Map();
  for (const family of families) {
    for (const slot of ['man', 'woman']) {
      const id = readRef(family.fields?.[slot]);
      if (!id) continue;
      if (!out.has(id)) out.set(id, []);
      out.get(id).push(family.recordName);
    }
  }
  return out;
}

function groupRefs(records, ownerField, itemField) {
  const out = new Map();
  for (const record of records) {
    const owner = readRef(record.fields?.[ownerField]);
    const item = readRef(record.fields?.[itemField]);
    if (!owner || !item) continue;
    if (!out.has(owner)) out.set(owner, []);
    out.get(owner).push(item);
  }
  return out;
}

function groupRecords(records, keyFn) {
  const out = new Map();
  for (const record of records) {
    const key = keyFn(record);
    if (!key) continue;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(record);
  }
  return out;
}

function compareBy(labelFn, localization) {
  return (a, b) => compareStrings(labelFn(a), labelFn(b), localization);
}

function pagePath(record) {
  const folder = {
    Person: 'people',
    Family: 'families',
    Place: 'places',
    Source: 'sources',
    Story: 'stories',
  }[record.recordType] || (record.recordType?.startsWith('Media') ? 'media' : 'records');
  return `${folder}/${encodeURIComponent(record.recordName)}.html`;
}

function hrefTo(recordName, model, fromFolder = '') {
  const path = model.pathById.get(recordName);
  if (!path) return null;
  return fromFolder ? `../${path}` : path;
}

function linkTo(recordName, label, model, fromFolder = '') {
  const href = hrefTo(recordName, model, fromFolder);
  return href ? `<a href="${attr(href)}">${bdi(label || recordName)}</a>` : bdi(label || recordName);
}

function homeHref(path, fromFolder = '') {
  return fromFolder ? `../${path}` : path;
}

function pageWrap(title, body, options, fromFolder = '', author = null) {
  const cssHref = homeHref('assets/site.css', fromFolder);
  const metaAuthor = author?.authorName ? `<meta name="author" content="${attr(author.authorName)}">` : '';
  const metaCopyright = author?.copyright ? `<meta name="copyright" content="${attr(author.copyright)}">` : '';
  return `<!doctype html>
<html lang="${attr(options.locale)}" dir="${attr(options.direction)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} - ${esc(options.siteTitle)}</title>
  ${metaAuthor}
  ${metaCopyright}
  <link rel="stylesheet" href="${attr(cssHref)}">
</head>
<body class="theme-${attr(options.theme)}">
  <header class="site-header">
    <div>
      <a class="brand" href="${attr(homeHref('index.html', fromFolder))}">${bdi(options.siteTitle)}</a>
      ${options.tagline ? `<p>${bdi(options.tagline)}</p>` : ''}
    </div>
    <nav>
      <a href="${attr(homeHref('people/index.html', fromFolder))}">People</a>
      <a href="${attr(homeHref('families/index.html', fromFolder))}">Families</a>
      <a href="${attr(homeHref('places/index.html', fromFolder))}">Places</a>
      <a href="${attr(homeHref('sources/index.html', fromFolder))}">Sources</a>
      <a href="${attr(homeHref('media/index.html', fromFolder))}">Media</a>
      <a href="${attr(homeHref('stories/index.html', fromFolder))}">Stories</a>
    </nav>
  </header>
  <main class="container">${body}</main>
  <footer>${authorFooterHTML(author)}Exported from CloudTreeWeb</footer>
</body>
</html>`;
}

function authorFooterHTML(author) {
  if (!author) return '';
  const parts = [];
  if (author.authorName) parts.push(`By ${bdi(author.authorName)}`);
  if (author.organization) parts.push(bdi(author.organization));
  if (author.email) parts.push(`<a href="mailto:${attr(author.email)}">${bdi(author.email)}</a>`);
  if (author.website) parts.push(`<a href="${attr(author.website)}">${bdi(author.website)}</a>`);
  if (author.copyright) parts.push(bdi(author.copyright));
  if (!parts.length) return '';
  return `<div class="author-credit">${parts.join(' · ')}</div>`;
}

async function safeGetAuthorInfo() {
  try {
    return await getAuthorInfo();
  } catch {
    return null;
  }
}

function createCSS(options) {
  const journal = options.theme === 'journal';
  const archive = options.theme === 'archive';
  const bg = archive ? '#f4f1ea' : journal ? '#fbfbf8' : '#f8fafc';
  const card = archive ? '#fffaf0' : '#ffffff';
  const fg = archive ? '#2d261d' : '#18202f';
  const muted = archive ? '#736a5d' : '#667085';
  const border = archive ? '#d8cbb8' : '#e2e8f0';
  return `:root{--bg:${bg};--card:${card};--fg:${fg};--muted:${muted};--border:${border};--accent:${options.accentColor}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Naskh Arabic",Tahoma,sans-serif;line-height:1.55;text-align:start}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.site-header{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px 28px;border-bottom:1px solid var(--border);background:var(--card);position:sticky;top:0}
.brand{font-size:20px;font-weight:750;color:var(--fg)}
.site-header p{margin:2px 0 0;color:var(--muted);font-size:13px}
nav{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;font-weight:650}
.container{max-width:1020px;margin:0 auto;padding:30px 24px 56px}
h1{font-size:32px;line-height:1.15;margin:0 0 8px}
h2{font-size:21px;margin:28px 0 10px;padding-bottom:5px;border-bottom:1px solid var(--border)}
h3{font-size:16px;margin:18px 0 8px}
p{margin:8px 0}
.muted{color:var(--muted);font-size:14px}
.badge{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:999px;padding:2px 8px;font-size:12px;color:var(--muted);gap:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px;margin:12px 0}
.card h3{margin-top:0}
.entity-link{display:block;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:13px 14px}
.entity-link strong{display:block;color:var(--fg)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:22px 0}
.stat{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:16px}
.stat strong{display:block;font-size:24px}
table{width:100%;border-collapse:collapse;font-size:14px;background:var(--card);border:1px solid var(--border)}
th,td{padding:8px 10px;text-align:start;border-bottom:1px solid var(--border);vertical-align:top}
th{color:var(--muted);font-size:12px;text-transform:uppercase}
ul{padding-inline-start:22px}
bdi{unicode-bidi:isolate}
.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
.media-card img,.media-preview{max-width:100%;border-radius:7px;border:1px solid var(--border);background:#fff}
.thumb{width:100%;aspect-ratio:4/3;object-fit:cover;margin-bottom:8px}
.private{border-color:#f59e0b}
footer{border-top:1px solid var(--border);padding:18px;color:var(--muted);font-size:12px;text-align:center}
.author-credit{margin-bottom:6px;color:var(--fg);opacity:.85}
@media (max-width:720px){.site-header{align-items:flex-start;flex-direction:column;position:static}.container{padding:22px 16px 44px}h1{font-size:26px}}`;
}

function homePage(model, options) {
  return `<section>
    <h1>${bdi(options.siteTitle)}</h1>
    ${options.tagline ? `<p class="muted">${bdi(options.tagline)}</p>` : ''}
    <div class="stats">
      ${stat('People', model.persons.length, options)}
      ${stat('Families', model.families.length, options)}
      ${stat('Places', model.places.length, options)}
      ${stat('Sources', model.sources.length, options)}
      ${stat('Media', model.media.length, options)}
      ${stat('Stories', model.stories.length, options)}
    </div>
  </section>
  ${authorHomeSection(model.author)}
  <section>
    <h2>People</h2>
    <div class="grid">${model.persons.slice(0, 24).map((person) => personIndexItem(person, model, '')).join('')}</div>
    ${model.persons.length > 24 ? `<p class="muted"><a href="people/index.html">View all people</a></p>` : ''}
  </section>`;
}

function authorHomeSection(author) {
  if (!author) return '';
  const hasAny =
    author.authorName || author.organization || author.email || author.phone ||
    author.website || author.address1 || author.city || author.copyright || author.notes;
  if (!hasAny) return '';
  const lines = [];
  if (author.authorName) lines.push(`<strong>${bdi(author.authorName)}</strong>`);
  if (author.organization) lines.push(bdi(author.organization));
  const addr = [author.address1, author.address2, [author.city, author.region, author.postalCode].filter(Boolean).join(' '), author.country]
    .filter(Boolean);
  if (addr.length) lines.push(addr.map((part) => bdi(part)).join('<br>'));
  if (author.phone) lines.push(bdi(author.phone));
  if (author.email) lines.push(`<a href="mailto:${attr(author.email)}">${bdi(author.email)}</a>`);
  if (author.website) lines.push(`<a href="${attr(author.website)}">${bdi(author.website)}</a>`);
  if (author.notes) lines.push(`<p>${bdi(author.notes)}</p>`);
  if (author.copyright) lines.push(`<p class="muted">${bdi(author.copyright)}</p>`);
  return `<section>
    <h2>About</h2>
    <div class="card">${lines.map((line) => line.startsWith('<p') ? line : `<p>${line}</p>`).join('')}</div>
  </section>`;
}

function stat(label, value, options) {
  return `<div class="stat"><strong>${formatInteger(value, options)}</strong><span class="muted">${esc(label)}</span></div>`;
}

function entityIndexPage(title, records, renderItem, model, fromFolder) {
  return `<h1>${esc(title)}</h1>
    <p class="muted">${formatInteger(records.length, model.options)} ${title.toLowerCase()}</p>
    <div class="grid">${records.map((record) => renderItem(record, model, fromFolder)).join('')}</div>`;
}

function personIndexItem(person, model, fromFolder) {
  const summary = personSummary(person);
  return `<a class="entity-link${isPrivateRecord(person) ? ' private' : ''}" href="${attr(hrefTo(person.recordName, model, fromFolder))}">
    <strong>${bdi(summary?.fullName || person.recordName)}</strong>
    <span class="muted">${esc(lifeSpanLabel(summary) || 'No lifespan recorded')}</span>
  </a>`;
}

function familyIndexItem(family, model, fromFolder) {
  return `<a class="entity-link${isPrivateRecord(family) ? ' private' : ''}" href="${attr(hrefTo(family.recordName, model, fromFolder))}">
    <strong>${bdi(familyLabel(family, model) || family.recordName)}</strong>
    <span class="muted">${esc(readField(family, ['cached_marriageDate', 'marriageDate'], ''))}</span>
  </a>`;
}

function placeIndexItem(place, model, fromFolder) {
  const summary = placeSummary(place);
  return `<a class="entity-link${isPrivateRecord(place) ? ' private' : ''}" href="${attr(hrefTo(place.recordName, model, fromFolder))}">
    <strong>${bdi(summary?.displayName || summary?.name || place.recordName)}</strong>
    <span class="muted">${esc(summary?.geonameID ? `GeoName ${summary.geonameID}` : 'Place')}</span>
  </a>`;
}

function sourceIndexItem(source, model, fromFolder) {
  const summary = sourceSummary(source);
  return `<a class="entity-link${isPrivateRecord(source) ? ' private' : ''}" href="${attr(hrefTo(source.recordName, model, fromFolder))}">
    <strong>${bdi(summary?.title || source.recordName)}</strong>
    <span class="muted">${esc(summary?.date || 'Source')}</span>
  </a>`;
}

function mediaIndexItem(media, model, fromFolder) {
  return `<a class="entity-link${isPrivateRecord(media) ? ' private' : ''}" href="${attr(hrefTo(media.recordName, model, fromFolder))}">
    <strong>${esc(mediaLabel(media))}</strong>
    <span class="muted">${esc(media.recordType.replace('Media', ''))}</span>
  </a>`;
}

function storyIndexItem(story, model, fromFolder) {
  return `<a class="entity-link${isPrivateRecord(story) ? ' private' : ''}" href="${attr(hrefTo(story.recordName, model, fromFolder))}">
    <strong>${esc(storyLabel(story))}</strong>
    <span class="muted">${esc(readField(story, ['date', 'author'], 'Story'))}</span>
  </a>`;
}

function personPage(person, model) {
  const summary = personSummary(person);
  const parentFamilyId = model.parentFamilyByChild.get(person.recordName);
  const parents = parentFamilyId ? [
    readRef(model.familyById.get(parentFamilyId)?.fields?.man),
    readRef(model.familyById.get(parentFamilyId)?.fields?.woman),
  ].filter(Boolean).map((id) => model.personById.get(id)).filter(Boolean) : [];
  const families = (model.familiesByPerson.get(person.recordName) || []).map((id) => model.familyById.get(id)).filter(Boolean);
  const events = model.personEventsByPerson.get(person.recordName) || [];
  return `<article>
    <h1>${esc(summary?.fullName || person.recordName)}</h1>
    <p class="muted">${esc(lifeSpanLabel(summary) || 'No lifespan recorded')}</p>
    ${isPrivateRecord(person) ? '<span class="badge">Private export</span>' : ''}
    ${parents.length ? `<h2>Parents</h2><div class="card">${parents.map((parent) => {
      const parentSummary = personSummary(parent);
      return `<p>${linkTo(parent.recordName, parentSummary?.fullName, model, 'people')} <span class="muted">${esc(lifeSpanLabel(parentSummary) || '')}</span></p>`;
    }).join('')}</div>` : ''}
    ${families.length ? `<h2>Families</h2>${families.map((family) => familyCard(family, person.recordName, model, 'people')).join('')}` : ''}
    ${events.length ? `<h2>Events</h2>${eventsTable(events, model, 'people')}` : ''}
    ${relatedSections(person.recordName, model, 'people')}
  </article>`;
}

function familyPage(family, model) {
  const partners = [readRef(family.fields?.man), readRef(family.fields?.woman)]
    .filter(Boolean)
    .map((id) => model.personById.get(id))
    .filter(Boolean);
  const children = (model.childrenByFamily.get(family.recordName) || []).map((id) => model.personById.get(id)).filter(Boolean);
  const events = model.familyEventsByFamily.get(family.recordName) || [];
  return `<article>
    <h1>${esc(familyLabel(family, model) || family.recordName)}</h1>
    ${isPrivateRecord(family) ? '<span class="badge">Private export</span>' : ''}
    <h2>Partners</h2>
    <div class="card">${partners.length ? partners.map((person) => {
      const summary = personSummary(person);
      return `<p>${linkTo(person.recordName, summary?.fullName, model, 'families')} <span class="muted">${esc(lifeSpanLabel(summary) || '')}</span></p>`;
    }).join('') : '<p class="muted">No partners recorded.</p>'}</div>
    ${children.length ? `<h2>Children</h2><div class="card"><ul>${children.map((child) => {
      const summary = personSummary(child);
      return `<li>${linkTo(child.recordName, summary?.fullName, model, 'families')} <span class="muted">${esc(lifeSpanLabel(summary) || '')}</span></li>`;
    }).join('')}</ul></div>` : ''}
    ${events.length ? `<h2>Events</h2>${eventsTable(events, model, 'families')}` : ''}
    ${relatedSections(family.recordName, model, 'families')}
  </article>`;
}

function familyCard(family, currentPersonId, model, fromFolder) {
  const partnerId = [readRef(family.fields?.man), readRef(family.fields?.woman)].find((id) => id && id !== currentPersonId);
  const partner = partnerId ? model.personById.get(partnerId) : null;
  const kids = (model.childrenByFamily.get(family.recordName) || []).map((id) => model.personById.get(id)).filter(Boolean);
  return `<div class="card">
    <h3>${linkTo(family.recordName, familyLabel(family, model) || 'Family', model, fromFolder)}</h3>
    <p>Partner: ${partner ? linkTo(partner.recordName, personSummary(partner)?.fullName, model, fromFolder) : '<span class="muted">No partner recorded</span>'}</p>
    ${kids.length ? `<p><strong>Children</strong></p><ul>${kids.map((child) => {
      const summary = personSummary(child);
      return `<li>${linkTo(child.recordName, summary?.fullName, model, fromFolder)} <span class="muted">${esc(lifeSpanLabel(summary) || '')}</span></li>`;
    }).join('')}</ul>` : '<p class="muted">No children recorded.</p>'}
  </div>`;
}

function placePage(place, model) {
  const summary = placeSummary(place);
  const events = [...model.personEvents, ...model.familyEvents].filter((event) => eventPlaceId(event) === place.recordName);
  return `<article>
    <h1>${esc(summary?.displayName || summary?.name || place.recordName)}</h1>
    ${summary?.geonameID ? `<p class="muted">GeoName ID ${esc(summary.geonameID)}</p>` : ''}
    ${isPrivateRecord(place) ? '<span class="badge">Private export</span>' : ''}
    ${events.length ? `<h2>Events at this place</h2>${eventsTable(events, model, 'places')}` : '<p class="muted">No linked events were included in this export.</p>'}
    ${relatedSections(place.recordName, model, 'places')}
  </article>`;
}

function sourcePage(source, model) {
  const summary = sourceSummary(source);
  const relations = model.sourceRelationsBySource.get(source.recordName) || [];
  return `<article>
    <h1>${esc(summary?.title || source.recordName)}</h1>
    ${summary?.date ? `<p class="muted">${esc(summary.date)}</p>` : ''}
    ${isPrivateRecord(source) ? '<span class="badge">Private export</span>' : ''}
    ${summary?.text ? `<h2>Source Text</h2><div class="card"><p>${esc(summary.text)}</p></div>` : ''}
    ${relations.length ? `<h2>Referenced Entries</h2><div class="card"><ul>${relations.map((rel) => {
      const targetId = readRef(rel.fields?.target);
      return `<li>${linkTo(targetId, targetLabel(targetId, model), model, 'sources')}${citationDetail(rel)}</li>`;
    }).join('')}</ul></div>` : '<p class="muted">No referenced entries were included in this export.</p>'}
    ${relatedMedia(source.recordName, model, 'sources')}
  </article>`;
}

function mediaPage(media, model) {
  const relations = model.mediaRelationsByMedia.get(media.recordName) || [];
  const assetHtml = mediaAssetHtml(media, model, 'media', 'media-preview');
  return `<article>
    <h1>${esc(mediaLabel(media))}</h1>
    <p class="muted">${esc(media.recordType.replace('Media', ''))}</p>
    ${isPrivateRecord(media) ? '<span class="badge">Private export</span>' : ''}
    ${assetHtml || mediaUrlHtml(media) || '<p class="muted">No local media asset was bundled.</p>'}
    ${readField(media, ['description', 'userDescription', 'text'], '') ? `<h2>Description</h2><div class="card"><p>${esc(readField(media, ['description', 'userDescription', 'text'], ''))}</p></div>` : ''}
    ${relations.length ? `<h2>Related Entries</h2><div class="card"><ul>${relations.map((rel) => {
      const targetId = readRef(rel.fields?.target);
      return `<li>${linkTo(targetId, targetLabel(targetId, model), model, 'media')}</li>`;
    }).join('')}</ul></div>` : ''}
    ${relatedSources(media.recordName, model, 'media')}
  </article>`;
}

function storyPage(story, model) {
  const sections = model.storySectionsByStory.get(story.recordName) || [];
  const relations = model.storyRelationsByStory.get(story.recordName) || [];
  return `<article>
    <h1>${esc(storyLabel(story))}</h1>
    ${readField(story, ['subtitle'], '') ? `<p class="muted">${esc(readField(story, ['subtitle'], ''))}</p>` : ''}
    ${isPrivateRecord(story) ? '<span class="badge">Private export</span>' : ''}
    ${readField(story, ['text', 'description', 'userDescription'], '') ? `<div class="card"><p>${esc(readField(story, ['text', 'description', 'userDescription'], ''))}</p></div>` : ''}
    ${sections.length ? sections.sort((a, b) => Number(readField(a, ['order'], 0)) - Number(readField(b, ['order'], 0))).map((section) => (
      `<section><h2>${esc(readField(section, ['title', 'name'], 'Section'))}</h2><div class="card"><p>${esc(readField(section, ['text', 'description'], ''))}</p></div></section>`
    )).join('') : ''}
    ${relations.length ? `<h2>Related Entries</h2><div class="card"><ul>${relations.map((rel) => {
      const targetId = readRef(rel.fields?.target);
      return `<li>${linkTo(targetId, targetLabel(targetId, model), model, 'stories')}</li>`;
    }).join('')}</ul></div>` : ''}
  </article>`;
}

function eventsTable(events, model, fromFolder) {
  return `<table><thead><tr><th>Type</th><th>Date</th><th>Place</th><th>Description</th><th>Sources</th></tr></thead><tbody>${events.map((event) => {
    const placeId = eventPlaceId(event);
    const place = placeId ? model.placeById.get(placeId) : null;
    const placeText = place
      ? linkTo(place.recordName, placeLabel(place), model, fromFolder)
      : esc(readField(event, ['placeName', 'location'], ''));
    const sources = model.sourceRelationsByTarget.get(event.recordName) || [];
    return `<tr>
      <td>${esc(readConclusionType(event) || readField(event, ['eventType', 'type'], 'Event'))}</td>
      <td>${esc(readField(event, ['date'], ''))}</td>
      <td>${placeText}</td>
      <td>${esc(readField(event, ['description', 'userDescription', 'text'], ''))}</td>
      <td>${sources.map((rel) => {
        const sourceId = readRef(rel.fields?.source);
        return linkTo(sourceId, sourceLabel(model.sourceById.get(sourceId)) || sourceId, model, fromFolder);
      }).join('<br>')}</td>
    </tr>`;
  }).join('')}</tbody></table>`;
}

function relatedSections(recordName, model, fromFolder) {
  return [
    relatedStories(recordName, model, fromFolder),
    relatedMedia(recordName, model, fromFolder),
    relatedSources(recordName, model, fromFolder),
  ].filter(Boolean).join('');
}

function relatedStories(recordName, model, fromFolder) {
  const relations = model.storyRelationsByTarget.get(recordName) || [];
  if (!relations.length) return '';
  return `<h2>Stories</h2><div class="card"><ul>${relations.map((rel) => {
    const storyId = readRef(rel.fields?.story);
    return `<li>${linkTo(storyId, storyLabel(model.storyById.get(storyId)) || storyId, model, fromFolder)}</li>`;
  }).join('')}</ul></div>`;
}

function relatedMedia(recordName, model, fromFolder) {
  const relations = model.mediaRelationsByTarget.get(recordName) || [];
  if (!relations.length) return '';
  return `<h2>Media</h2><div class="media-grid">${relations.map((rel) => {
    const mediaId = readRef(rel.fields?.media);
    const media = model.mediaById.get(mediaId);
    if (!media) return '';
    return `<div class="card media-card">${mediaAssetHtml(media, model, fromFolder, 'thumb') || ''}<strong>${linkTo(mediaId, mediaLabel(media), model, fromFolder)}</strong><div class="muted">${esc(media.recordType.replace('Media', ''))}</div></div>`;
  }).join('')}</div>`;
}

function relatedSources(recordName, model, fromFolder) {
  const relations = model.sourceRelationsByTarget.get(recordName) || [];
  if (!relations.length) return '';
  return `<h2>Sources</h2><div class="card"><ul>${relations.map((rel) => {
    const sourceId = readRef(rel.fields?.source);
    return `<li>${linkTo(sourceId, sourceLabel(model.sourceById.get(sourceId)) || sourceId, model, fromFolder)}${citationDetail(rel)}</li>`;
  }).join('')}</ul></div>`;
}

function citationDetail(rel) {
  const page = readField(rel, ['page'], '');
  const text = readField(rel, ['citation', 'text'], '');
  const details = [page && `p. ${page}`, text].filter(Boolean).map(esc).join(' - ');
  return details ? ` <span class="muted">${details}</span>` : '';
}

function mediaAssetHtml(media, model, fromFolder, className) {
  const asset = (model.assetsByOwner.get(media.recordName) || []).find((item) => item.dataBase64);
  const path = asset ? model.assetPathById.get(asset.assetId) : null;
  if (!asset || !path) return '';
  const href = fromFolder ? `../${path}` : path;
  if (String(asset.mimeType || '').startsWith('image/')) {
    return `<img class="${attr(className)}" src="${attr(href)}" alt="${attr(mediaLabel(media))}">`;
  }
  return `<p><a href="${attr(href)}">Download ${esc(asset.filename || 'media asset')}</a></p>`;
}

function mediaUrlHtml(media) {
  const url = readField(media, ['url'], '');
  return url ? `<p><a href="${attr(url)}">${esc(url)}</a></p>` : '';
}

function eventPlaceId(event) {
  return readRef(event.fields?.place) || readRef(event.fields?.assignedPlace);
}

function targetLabel(recordName, model) {
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

function familyLabel(family, model) {
  const summary = familySummary(family);
  if (summary?.familyName) return summary.familyName;
  const names = [readRef(family?.fields?.man), readRef(family?.fields?.woman)]
    .map((id) => model?.personById?.get(id))
    .filter(Boolean)
    .map((person) => personSummary(person)?.fullName)
    .filter(Boolean);
  return names.length ? names.join(' & ') : family?.recordName;
}

function placeLabel(place) {
  const summary = placeSummary(place);
  return summary?.displayName || summary?.name || place?.recordName;
}

function sourceLabel(source) {
  const summary = sourceSummary(source);
  return summary?.title || source?.recordName;
}

function mediaLabel(media) {
  return readField(media, ['caption', 'title', 'filename', 'fileName', 'url'], media?.recordName || 'Media');
}

function storyLabel(story) {
  return readField(story, ['title', 'name'], story?.recordName || 'Story');
}

function safeAssetName(asset) {
  const name = asset.filename || asset.sourceIdentifier || asset.assetId || 'asset';
  const clean = String(name).replace(/[^a-z0-9._-]+/gi, '_').replace(/^_+|_+$/g, '');
  return `${encodeURIComponent(asset.assetId || clean)}-${clean || 'asset'}`;
}

export async function downloadSite(options = {}) {
  const { blob, stats, validation } = await buildSite(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudtreeweb-site-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
  return { stats, validation };
}
