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
import { buildGedcom } from './gedcomExport.js';
import { runScope } from './smartScopes.js';
import { DEFAULT_SITE_OPTIONS, SITE_THEME_PRESETS } from './websiteOptions.js';
import { personSummary } from '../models/index.js';
import { checkCanceled, esc, normalizeOptions, progress } from './website/utilities.js';
import { loadSnapshot, validateSnapshot, validateSiteExport } from './website/snapshot.js';
import { buildPublishModel } from './website/buildModel.js';
import {
  familyLabel,
  mediaLabel,
  personGroupLabel,
  placeLabel,
  savedChartLabel,
  sourceLabel,
  storyLabel,
} from './website/labels.js';
import {
  SITE_SECTIONS,
  createCSS,
  entityIndexPage,
  familyPage,
  homePage,
  imprintPage,
  mediaPage,
  pageWrap,
  personGroupPage,
  personPage,
  personSurnameIndexPage,
  personSurnamePage,
  placePage,
  privacyPage,
  robotsTxt,
  safeGetAuthorInfo,
  savedChartPage,
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

  // "Persons to include" scope (#13): resolve the chosen smart filter to a
  // person-id set the model build can restrict to.
  if (normalized.exportPersonsMode === 'smartFilter' && normalized.exportScopeId) {
    try {
      const result = await runScope(normalized.exportScopeId);
      if (result?.entityType === 'Person') {
        normalized.exportPersonIds = new Set((result.records || []).map((record) => record.recordName));
      }
    } catch {
      // Fall back to publishing everyone if the scope can't be resolved.
    }
  }
  checkCanceled(signal);

  const model = buildPublishModel(snapshot, normalized);
  model.author = author;
  const zip = new JSZip();
  const css = createCSS(normalized);
  zip.file('assets/site.css', css);
  zip.file('robots.txt', robotsTxt(normalized));

  // Downloadable GEDCOM of the published tree (private records always excluded;
  // living-person filtering mirrors the site privacy options). Best-effort:
  // a GEDCOM failure must not abort the whole website export.
  let gedcomText = null;
  try {
    gedcomText = await buildGedcom({
      hideLiving: normalized.hideLiving,
      hideLivingDetailsOnly: normalized.hideLivingDetailsOnly,
      livingThresholdYears: normalized.livingThresholdYears,
    });
  } catch {
    gedcomText = null;
  }
  checkCanceled(signal);

  // Optional favicon (#89) bundled from a data URL.
  if (normalized.faviconDataUrl) {
    const b64 = String(normalized.faviconDataUrl).split(',')[1];
    if (b64) zip.file('favicon.png', b64, { base64: true });
  }

  const enabledSections = SITE_SECTIONS.filter(([key]) => normalized.contentSections[key]);
  const surnamePageCount = normalized.contentSections.people ? 1 + model.personSurnameGroups.length : 0;
  const imprintPageCount = normalized.contentSections.author ? 1 : 0;
  const statisticsPageCount = normalized.includeStatisticsPage ? 1 : 0;
  const totalPages = 2 + imprintPageCount + statisticsPageCount + surnamePageCount + enabledSections.reduce((total, [, , modelKey]) => total + 1 + model[modelKey].length, 0);
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
  const homeImageBlock = normalized.homeImageDataUrl
    ? `<p><img src="${esc(normalized.homeImageDataUrl)}" alt="" style="max-width:100%;border-radius:8px;border:1px solid var(--border)"></p>`
    : '';
  const downloadsBlock = gedcomText
    ? '<section><h2>Downloads</h2><p class="muted"><a href="tree.ged" download>Download this family tree (GEDCOM)</a></p></section>'
    : '';
  writePage('index.html', 'Home', homeImageBlock + homePage(model, normalized) + downloadsBlock, '');
  markPage('Wrote home page.');
  writePage('privacy.html', 'Privacy', privacyPage(model, normalized), '');
  markPage('Wrote privacy page.');
  if (normalized.includeStatisticsPage) {
    writePage('statistics.html', 'Statistics', statisticsPageHtml(model), '');
    markPage('Wrote statistics page.');
  }
  if (normalized.contentSections.author) {
    writePage('imprint.html', 'Imprint', imprintPage(model, normalized, author), '');
    markPage('Wrote imprint page.');
  }
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
  for (const group of normalized.contentSections.personGroups ? model.personGroups : []) {
    checkCanceled(signal);
    const title = personGroupLabel(group) || group.recordName;
    writePage(model.pathById.get(group.recordName), title, personGroupPage(group, model), 'groups');
    markPage(`Wrote ${title}.`);
  }
  for (const chart of normalized.contentSections.savedCharts ? model.savedCharts : []) {
    checkCanceled(signal);
    const title = savedChartLabel(chart) || chart.recordName;
    writePage(model.pathById.get(chart.recordName), title, savedChartPage(chart, model), 'charts');
    markPage(`Wrote ${title}.`);
  }

  const sitemap = sitemapXml(pagePaths, normalized);
  if (sitemap) zip.file('sitemap.xml', sitemap);
  if (gedcomText) zip.file('tree.ged', gedcomText);

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
    personGroups: normalized.contentSections.personGroups ? model.personGroups.length : 0,
    savedCharts: normalized.contentSections.savedCharts ? model.savedCharts.length : 0,
    pages: totalPages,
    assets: assetCount,
  };
  progress(onProgress, { phase: 'complete', completed: totalPages, total: totalPages, message: 'Website export complete.', stats });
  return { blob, stats, validation, options: normalized };
}

function yearFromValue(value) {
  const match = String(value || '').match(/-?\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

function statisticsPageHtml(model) {
  const persons = model.persons || [];
  const lifespans = [];
  for (const person of persons) {
    const by = yearFromValue(person.fields?.cached_birthDate?.value);
    const dy = yearFromValue(person.fields?.cached_deathDate?.value);
    if (by && dy && dy >= by) lifespans.push(dy - by);
  }
  const avgLifespan = lifespans.length ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length) : null;
  const withBirth = persons.filter((p) => p.fields?.cached_birthDate?.value).length;
  const counts = [
    ['People', persons.length],
    ['Families', (model.families || []).length],
    ['Places', (model.places || []).length],
    ['Sources', (model.sources || []).length],
    ['Media', (model.media || []).length],
    ['Stories', (model.stories || []).length],
  ];
  const surnameRows = (model.personSurnameGroups || [])
    .map((g) => [g.surname || '—', (g.persons?.length ?? g.count ?? 0)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const statBlock = counts.map(([k, v]) => `<div class="stat"><strong>${esc(String(v))}</strong>${esc(k)}</div>`).join('');
  return `<article>
    <h1>Statistics</h1>
    <div class="stats">${statBlock}</div>
    <h2>Vital records</h2>
    <table><tbody>
      <tr><th>Average lifespan</th><td>${avgLifespan == null ? '—' : esc(`${avgLifespan} years`)}</td></tr>
      <tr><th>People with a birth date</th><td>${esc(String(withBirth))} of ${esc(String(persons.length))}</td></tr>
    </tbody></table>
    ${surnameRows.length ? `<h2>Most common surnames</h2><table><thead><tr><th>Surname</th><th>People</th></tr></thead><tbody>${surnameRows.map(([s, c]) => `<tr><td>${esc(String(s))}</td><td>${esc(String(c))}</td></tr>`).join('')}</tbody></table>` : ''}
  </article>`;
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
