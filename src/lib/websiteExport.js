/**
 * Static website export — top-level orchestrator.
 *
 * Pipeline (each stage is its own module under lib/website/):
 *   utilities.js — escaping helpers, option normalization, progress
 *                  reporting, cancellation
 *   snapshot.js  — loadSnapshot + validateSnapshot/validateSiteExport
 *   buildModel.js — snapshot → publish model
 *   labels.js    — record-type label helpers
 *   render.js    — CSS, page templates, index renderers
 *
 * buildSite() ties them together: load → validate → build model →
 * render every page into a JSZip → return the resulting blob plus
 * stats. downloadSite() is a small browser-side helper that turns the
 * blob into a save dialog.
 */
import JSZip from 'jszip';
import { formatInteger } from './i18n.js';
import { DEFAULT_SITE_OPTIONS, SITE_THEME_PRESETS } from './websiteOptions.js';
import { personSummary } from '../models/index.js';
import { checkCanceled, normalizeOptions, progress } from './website/utilities.js';
import { loadSnapshot, validateSnapshot, validateSiteExport } from './website/snapshot.js';
import { buildPublishModel } from './website/buildModel.js';
import {
  familyLabel,
  mediaLabel,
  placeLabel,
  sourceLabel,
  storyLabel,
} from './website/labels.js';
import {
  SITE_SECTIONS,
  createCSS,
  entityIndexPage,
  familyPage,
  homePage,
  mediaPage,
  pageWrap,
  personPage,
  placePage,
  safeGetAuthorInfo,
  sourcePage,
  storyPage,
} from './website/render.js';

export { DEFAULT_SITE_OPTIONS, validateSiteExport };
export const SITE_THEMES = SITE_THEME_PRESETS;

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

  const enabledSections = SITE_SECTIONS.filter(([key]) => normalized.contentSections[key]);
  const totalPages = 1 + enabledSections.reduce((total, [, , modelKey]) => total + 1 + model[modelKey].length, 0);
  let completed = 0;
  const markPage = (message) => {
    completed += 1;
    progress(onProgress, { phase: 'pages', completed, total: totalPages, message });
  };

  progress(onProgress, { phase: 'pages', completed, total: totalPages, message: 'Writing index pages...' });
  zip.file('index.html', pageWrap('Home', homePage(model, normalized), normalized, '', author));
  markPage('Wrote home page.');
  for (const [folder, title, modelKey, renderer] of enabledSections) {
    checkCanceled(signal);
    const records = model[modelKey];
    zip.file(`${folder}/index.html`, pageWrap(title, entityIndexPage(title, records, renderer, model, folder), normalized, folder, author));
    markPage(`Wrote ${title.toLowerCase()} index.`);
  }

  for (const person of normalized.contentSections.people ? model.persons : []) {
    checkCanceled(signal);
    const title = personSummary(person)?.fullName || person.recordName;
    zip.file(model.pathById.get(person.recordName), pageWrap(title, personPage(person, model), normalized, 'people', author));
    markPage(`Wrote ${title}.`);
  }
  for (const family of normalized.contentSections.families ? model.families : []) {
    checkCanceled(signal);
    const title = familyLabel(family, model) || family.recordName;
    zip.file(model.pathById.get(family.recordName), pageWrap(title, familyPage(family, model), normalized, 'families', author));
    markPage(`Wrote ${title}.`);
  }
  for (const place of normalized.contentSections.places ? model.places : []) {
    checkCanceled(signal);
    const title = placeLabel(place) || place.recordName;
    zip.file(model.pathById.get(place.recordName), pageWrap(title, placePage(place, model), normalized, 'places', author));
    markPage(`Wrote ${title}.`);
  }
  for (const source of normalized.contentSections.sources ? model.sources : []) {
    checkCanceled(signal);
    const title = sourceLabel(source) || source.recordName;
    zip.file(model.pathById.get(source.recordName), pageWrap(title, sourcePage(source, model), normalized, 'sources', author));
    markPage(`Wrote ${title}.`);
  }
  for (const media of normalized.contentSections.media ? model.media : []) {
    checkCanceled(signal);
    const title = mediaLabel(media) || media.recordName;
    zip.file(model.pathById.get(media.recordName), pageWrap(title, mediaPage(media, model), normalized, 'media', author));
    markPage(`Wrote ${title}.`);
  }
  for (const story of normalized.contentSections.stories ? model.stories : []) {
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
    persons: normalized.contentSections.people ? model.persons.length : 0,
    families: normalized.contentSections.families ? model.families.length : 0,
    places: normalized.contentSections.places ? model.places.length : 0,
    sources: normalized.contentSections.sources ? model.sources.length : 0,
    media: normalized.contentSections.media ? model.media.length : 0,
    stories: normalized.contentSections.stories ? model.stories.length : 0,
    pages: totalPages,
    assets: assetCount,
  };
  progress(onProgress, { phase: 'complete', completed: totalPages, total: totalPages, message: 'Website export complete.', stats });
  return { blob, stats, validation, options: normalized };
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
  URL.revokeObjectURL(url);
  return { stats, validation };
}
