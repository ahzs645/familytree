/**
 * HTML and CSS rendering for the static website export.
 *
 * Each function takes the publish model (built by buildModel.js) and a
 * "fromFolder" hint that controls relative-link resolution. SITE_SECTIONS
 * lists the renderable index pages and the per-record renderer that
 * produces a card on the corresponding listing page.
 */
import { readConclusionType, readField, readRef } from '../schema.js';
import { isPrivateRecord } from '../privacy.js';
import { getAuthorInfo } from '../authorInfo.js';
import { formatInteger } from '../i18n.js';
import { resolveSiteTheme } from '../websiteOptions.js';
import {
  lifeSpanLabel,
  personSummary,
  placeSummary,
  sourceSummary,
} from '../../models/index.js';
import { attr, bdi, esc, mailtoUrl, safeUrl } from './utilities.js';
import {
  familyLabel,
  mediaLabel,
  placeLabel,
  sourceLabel,
  storyLabel,
  targetLabel,
} from './labels.js';

export const SITE_SECTIONS = [
  ['people', 'People', 'persons', personIndexItem],
  ['families', 'Families', 'families', familyIndexItem],
  ['places', 'Places', 'places', placeIndexItem],
  ['sources', 'Sources', 'sources', sourceIndexItem],
  ['media', 'Media', 'media', mediaIndexItem],
  ['stories', 'Stories', 'stories', storyIndexItem],
];

export function hrefTo(recordName, model, fromFolder = '') {
  const path = model.pathById.get(recordName);
  if (!path) return null;
  return `${relativeRoot(fromFolder)}${path}`;
}

export function linkTo(recordName, label, model, fromFolder = '') {
  const href = hrefTo(recordName, model, fromFolder);
  return href ? `<a href="${attr(href)}">${bdi(label || recordName)}</a>` : bdi(label || recordName);
}

function homeHref(path, fromFolder = '') {
  return `${relativeRoot(fromFolder)}${path}`;
}

export function pageWrap(title, body, options, fromFolder = '', author = null, pagePath = '') {
  const cssHref = homeHref('assets/site.css', fromFolder);
  const includeAuthor = options.contentSections.author;
  const metaAuthor = includeAuthor && author?.authorName ? `<meta name="author" content="${attr(author.authorName)}">` : '';
  const metaCopyright = includeAuthor && author?.copyright ? `<meta name="copyright" content="${attr(author.copyright)}">` : '';
  const robotsMeta = `<meta name="robots" content="${attr(options.allowSearchIndexing ? 'index, follow' : 'noindex, nofollow')}">`;
  const canonical = canonicalUrl(options, pagePath) ? `<link rel="canonical" href="${attr(canonicalUrl(options, pagePath))}">` : '';
  const navLinks = SITE_SECTIONS
    .filter(([key]) => options.contentSections[key])
    .map(([folder, label]) => `<a href="${attr(homeHref(`${folder}/index.html`, fromFolder))}">${esc(label)}</a>`)
    .join('');
  const privacyLink = `<a href="${attr(homeHref('privacy.html', fromFolder))}">Privacy</a>`;
  return `<!doctype html>
<html lang="${attr(options.locale)}" dir="${attr(options.direction)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} - ${esc(options.siteTitle)}</title>
  ${robotsMeta}
  ${metaAuthor}
  ${metaCopyright}
  ${canonical}
  <link rel="stylesheet" href="${attr(cssHref)}">
</head>
<body class="theme-${attr(options.theme)}">
  <header class="site-header">
    <div>
      <a class="brand" href="${attr(homeHref('index.html', fromFolder))}">${bdi(options.siteTitle)}</a>
      ${options.tagline ? `<p>${bdi(options.tagline)}</p>` : ''}
    </div>
    <nav>
      ${navLinks}
      ${privacyLink}
    </nav>
  </header>
  <main class="container">${body}</main>
  <footer>${includeAuthor ? authorFooterHTML(author) : ''}Exported from CloudTreeWeb</footer>
</body>
</html>`;
}

function relativeRoot(fromFolder = '') {
  const depth = String(fromFolder || '').split('/').filter(Boolean).length;
  return depth ? '../'.repeat(depth) : '';
}

function canonicalUrl(options, pagePath = '') {
  if (!options.baseUrl) return '';
  const path = String(pagePath || 'index.html').replace(/^\/+/, '');
  return `${options.baseUrl}/${path}`;
}

function authorFooterHTML(author) {
  if (!author) return '';
  const parts = [];
  if (author.authorName) parts.push(`By ${bdi(author.authorName)}`);
  if (author.organization) parts.push(bdi(author.organization));
  const emailHref = mailtoUrl(author.email);
  const websiteHref = safeUrl(author.website);
  if (emailHref) parts.push(`<a href="${attr(emailHref)}">${bdi(author.email)}</a>`);
  if (websiteHref) parts.push(`<a href="${attr(websiteHref)}">${bdi(author.website)}</a>`);
  if (author.copyright) parts.push(bdi(author.copyright));
  if (!parts.length) return '';
  return `<div class="author-credit">${parts.join(' · ')}</div>`;
}

export async function safeGetAuthorInfo() {
  try {
    return await getAuthorInfo();
  } catch {
    return null;
  }
}

export function createCSS(options) {
  const theme = resolveSiteTheme(options);
  const bg = theme.colors.background;
  const card = theme.colors.card;
  const fg = theme.colors.text;
  const muted = theme.colors.muted;
  const border = theme.colors.border;
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

export function homePage(model, options) {
  const stats = [
    options.contentSections.people && stat('People', model.persons.length, options),
    options.contentSections.families && stat('Families', model.families.length, options),
    options.contentSections.places && stat('Places', model.places.length, options),
    options.contentSections.sources && stat('Sources', model.sources.length, options),
    options.contentSections.media && stat('Media', model.media.length, options),
    options.contentSections.stories && stat('Stories', model.stories.length, options),
  ].filter(Boolean).join('');
  const peoplePreview = options.contentSections.people
    ? `<section>
    <h2>People</h2>
    <div class="grid">${model.persons.slice(0, 24).map((person) => personIndexItem(person, model, '')).join('')}</div>
    ${model.persons.length > 24 ? `<p class="muted"><a href="people/index.html">View all people</a></p>` : ''}
  </section>`
    : '';
  return `<section>
    <h1>${bdi(options.siteTitle)}</h1>
    ${options.tagline ? `<p class="muted">${bdi(options.tagline)}</p>` : ''}
    <div class="stats">${stats}</div>
  </section>
  ${options.contentSections.author ? authorHomeSection(model.author) : ''}
  ${peoplePreview}`;
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
  const emailHref = mailtoUrl(author.email);
  const websiteHref = safeUrl(author.website);
  if (emailHref) lines.push(`<a href="${attr(emailHref)}">${bdi(author.email)}</a>`);
  if (websiteHref) lines.push(`<a href="${attr(websiteHref)}">${bdi(author.website)}</a>`);
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

export function entityIndexPage(title, records, renderItem, model, fromFolder) {
  const deeperIndexes = title === 'People' && model.personSurnameGroups?.length
    ? `<p class="muted"><a href="${attr(homeHref('people/surnames/index.html', fromFolder))}">Browse people by surname</a></p>`
    : '';
  return `<h1>${esc(title)}</h1>
    <p class="muted">${formatInteger(records.length, model.options)} ${title.toLowerCase()}</p>
    ${deeperIndexes}
    <div class="grid">${records.map((record) => renderItem(record, model, fromFolder)).join('')}</div>`;
}

export function personSurnameIndexPage(model, fromFolder = 'people/surnames') {
  return `<h1>People by surname</h1>
    <p class="muted">${formatInteger(model.personSurnameGroups.length, model.options)} surname groups</p>
    <div class="grid">${model.personSurnameGroups.map((group) => (
      `<a class="entity-link" href="${attr(`${group.slug}.html`)}">
        <strong>${bdi(group.surname)}</strong>
        <span class="muted">${formatInteger(group.records.length, model.options)} people</span>
      </a>`
    )).join('')}</div>
    <p class="muted"><a href="${attr(homeHref('people/index.html', fromFolder))}">Back to all people</a></p>`;
}

export function personSurnamePage(group, model, fromFolder = 'people/surnames') {
  return `<h1>${bdi(group.surname)}</h1>
    <p class="muted">${formatInteger(group.records.length, model.options)} people</p>
    <div class="grid">${group.records.map((person) => personIndexItem(person, model, fromFolder)).join('')}</div>
    <p class="muted"><a href="${attr(homeHref('people/surnames/index.html', fromFolder))}">Back to surnames</a></p>`;
}

export function privacyPage(model, options) {
  const privatePolicy = options.includePrivate
    ? 'Records marked private may be included because this export was configured to include private records.'
    : 'Records marked private are omitted from this export.';
  const livingPolicy = options.hideLiving
    ? (options.hideLivingDetailsOnly
      ? 'Living people remain listed, but sensitive living-person details such as vital dates and contact fields are removed.'
      : 'Living people are omitted from this export.')
    : 'Living-person filtering is not enabled for this export.';
  const searchPolicy = options.allowSearchIndexing
    ? 'Search engines are allowed to index this site.'
    : 'Search engines are asked not to index this site through page metadata and robots.txt.';
  const assetsPolicy = options.includeAssets
    ? 'Linked media assets may be bundled when they are attached to included media records.'
    : 'Local media assets are not bundled in this export.';
  return `<article>
    <h1>Privacy</h1>
    <p>This static family tree is generated from the records selected for publishing.</p>
    <div class="card">
      <p>${esc(privatePolicy)}</p>
      <p>${esc(livingPolicy)}</p>
      <p>${esc(searchPolicy)}</p>
      <p>${esc(assetsPolicy)}</p>
    </div>
    <h2>Included content</h2>
    <div class="stats">
      ${options.contentSections.people ? stat('People', model.persons.length, options) : ''}
      ${options.contentSections.families ? stat('Families', model.families.length, options) : ''}
      ${options.contentSections.places ? stat('Places', model.places.length, options) : ''}
      ${options.contentSections.sources ? stat('Sources', model.sources.length, options) : ''}
      ${options.contentSections.media ? stat('Media', model.media.length, options) : ''}
      ${options.contentSections.stories ? stat('Stories', model.stories.length, options) : ''}
    </div>
  </article>`;
}

export function robotsTxt(options) {
  if (!options.allowSearchIndexing) return 'User-agent: *\nDisallow: /\n';
  const sitemap = options.baseUrl ? `\nSitemap: ${options.baseUrl}/sitemap.xml\n` : '';
  return `User-agent: *\nAllow: /\n${sitemap}`;
}

export function sitemapXml(paths, options) {
  if (!options.baseUrl) return '';
  const urls = paths.map((path) => (
    `  <url><loc>${esc(`${options.baseUrl}/${String(path).replace(/^\/+/, '')}`)}</loc></url>`
  )).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
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

export function personPage(person, model) {
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

export function familyPage(family, model) {
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

export function placePage(place, model) {
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

export function sourcePage(source, model) {
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
    ${model.options.contentSections.relatedMedia && model.options.contentSections.media ? relatedMedia(source.recordName, model, 'sources') : ''}
  </article>`;
}

export function mediaPage(media, model) {
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
    ${model.options.contentSections.relatedSources && model.options.contentSections.sources ? relatedSources(media.recordName, model, 'media') : ''}
  </article>`;
}

export function storyPage(story, model) {
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
    model.options.contentSections.relatedStories && model.options.contentSections.stories ? relatedStories(recordName, model, fromFolder) : '',
    model.options.contentSections.relatedMedia && model.options.contentSections.media ? relatedMedia(recordName, model, fromFolder) : '',
    model.options.contentSections.relatedSources && model.options.contentSections.sources ? relatedSources(recordName, model, fromFolder) : '',
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
  const rawUrl = readField(media, ['url'], '');
  const url = safeUrl(rawUrl);
  return url ? `<p><a href="${attr(url)}">${esc(rawUrl)}</a></p>` : '';
}

function eventPlaceId(event) {
  return readRef(event.fields?.place) || readRef(event.fields?.assignedPlace);
}
