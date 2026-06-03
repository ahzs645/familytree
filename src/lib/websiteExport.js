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
  personSurnameIndexPage,
  personSurnamePage,
  placePage,
  privacyPage,
  robotsTxt,
  safeGetAuthorInfo,
  sitemapXml,
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
  zip.file('robots.txt', robotsTxt(normalized));

  const enabledSections = SITE_SECTIONS.filter(([key]) => normalized.contentSections[key]);
  const surnamePageCount = normalized.contentSections.people ? 1 + model.personSurnameGroups.length : 0;
  const totalPages = 2 + surnamePageCount + enabledSections.reduce((total, [, , modelKey]) => total + 1 + model[modelKey].length, 0);
  let completed = 0;
  const pagePaths = [];
  const markPage = (message) => {
    completed += 1;
    progress(onProgress, { phase: 'pages', completed, total: totalPages, message });
  };
  const writePage = (path, title, body, fromFolder = '') => {
    zip.file(path, pageWrap(title, body, normalized, fromFolder, author, path));
    pagePaths.push(path);
  };

  progress(onProgress, { phase: 'pages', completed, total: totalPages, message: 'Writing index pages...' });
  writePage('index.html', 'Home', homePage(model, normalized), '');
  markPage('Wrote home page.');
  writePage('privacy.html', 'Privacy', privacyPage(model, normalized), '');
  markPage('Wrote privacy page.');
  for (const [folder, title, modelKey, renderer] of enabledSections) {
    checkCanceled(signal);
    const records = model[modelKey];
    writePage(`${folder}/index.html`, title, entityIndexPage(title, records, renderer, model, folder), folder);
    markPage(`Wrote ${title.toLowerCase()} index.`);
  }
  if (normalized.contentSections.people) {
    writePage('people/surnames/index.html', 'People by surname', personSurnameIndexPage(model), 'people/surnames');
    markPage('Wrote surname index.');
    for (const group of model.personSurnameGroups) {
      checkCanceled(signal);
      writePage(`people/surnames/${group.slug}.html`, group.surname, personSurnamePage(group, model), 'people/surnames');
      markPage(`Wrote ${group.surname} surname index.`);
    }
  }

  for (const person of normalized.contentSections.people ? model.persons : []) {
    checkCanceled(signal);
    const title = personSummary(person)?.fullName || person.recordName;
    writePage(model.pathById.get(person.recordName), title, personPage(person, model), 'people');
    markPage(`Wrote ${title}.`);
  }
  for (const family of normalized.contentSections.families ? model.families : []) {
    checkCanceled(signal);
    const title = familyLabel(family, model) || family.recordName;
    writePage(model.pathById.get(family.recordName), title, familyPage(family, model), 'families');
    markPage(`Wrote ${title}.`);
  }
  for (const place of normalized.contentSections.places ? model.places : []) {
    checkCanceled(signal);
    const title = placeLabel(place) || place.recordName;
    writePage(model.pathById.get(place.recordName), title, placePage(place, model), 'places');
    markPage(`Wrote ${title}.`);
  }
  for (const source of normalized.contentSections.sources ? model.sources : []) {
    checkCanceled(signal);
    const title = sourceLabel(source) || source.recordName;
    writePage(model.pathById.get(source.recordName), title, sourcePage(source, model), 'sources');
    markPage(`Wrote ${title}.`);
  }
  for (const media of normalized.contentSections.media ? model.media : []) {
    checkCanceled(signal);
    const title = mediaLabel(media) || media.recordName;
    writePage(model.pathById.get(media.recordName), title, mediaPage(media, model), 'media');
    markPage(`Wrote ${title}.`);
  }
  for (const story of normalized.contentSections.stories ? model.stories : []) {
    checkCanceled(signal);
    const title = storyLabel(story) || story.recordName;
    writePage(model.pathById.get(story.recordName), title, storyPage(story, model), 'stories');
    markPage(`Wrote ${title}.`);
  }

  const sitemap = sitemapXml(pagePaths, normalized);
  if (sitemap) zip.file('sitemap.xml', sitemap);

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
