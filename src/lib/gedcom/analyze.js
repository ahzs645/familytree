/**
 * GEDCOM analysis stage — runs over the raw token stream and produces a
 * report the importer UI can show before committing the records:
 *
 *   { counts, tags, issues, canImport }
 *
 * Severity rules feed into canImportGedcomAnalysis(): the user-selected
 * mode controls whether warnings block the import.
 */
import { compareIssues, hasBlockingIssues } from '../validationIssues.js';
import { tokenizeGedcomText, isPointerValue, eventLikeTag, issue } from './tokenize.js';
import { EVENT_TAG_TO_NAME, TOP_LEVEL_TAGS } from './constants.js';

export function analyzeGedcomText(text) {
  const { tokens, issues } = tokenizeGedcomText(text);
  const counts = { INDI: 0, FAM: 0, SOUR: 0, NOTE: 0, OBJE: 0, unsupportedEvents: 0, customTags: 0, continuations: 0 };
  const declaredXrefs = new Map();
  const pointerRefs = [];
  const seenTags = new Set();
  const customTags = new Set();
  let hasHead = false;
  let hasTrailer = false;
  for (const token of tokens) {
    seenTags.add(token.tag);
    if (token.level === 0 && token.tag === 'HEAD') hasHead = true;
    if (token.level === 0 && token.tag === 'TRLR') hasTrailer = true;
    if (token.level === 0 && counts[token.tag] !== undefined && token.tag !== 'OBJE') counts[token.tag] += 1;
    if (token.tag === 'OBJE') counts.OBJE += 1;
    if (token.tag === 'CONC' || token.tag === 'CONT') counts.continuations += 1;
    if (token.tag.startsWith('_')) {
      customTags.add(token.tag);
      counts.customTags += 1;
    }
    if (token.level === 0 && !TOP_LEVEL_TAGS.has(token.tag)) {
      issues.push(issue('warning', token.line, 'unsupported-top-level-record', `Top-level ${token.tag} record is not mapped by the importer.`, { refs: [token.tag] }));
    }
    if (token.xref) {
      if (declaredXrefs.has(token.xref)) {
        issues.push(issue('error', token.line, 'duplicate-xref', `Duplicate XREF ${token.xref}; first declared on line ${declaredXrefs.get(token.xref).line}.`, { refs: [token.xref] }));
      } else {
        declaredXrefs.set(token.xref, { line: token.line, tag: token.tag });
      }
    }
    if (isPointerValue(token.value)) {
      pointerRefs.push({ line: token.line, tag: token.tag, value: token.value });
    }
    if (token.level > 0 && /^[A-Z0-9_]+$/.test(token.tag) && token.tag.length >= 3 && !EVENT_TAG_TO_NAME[token.tag] && eventLikeTag(token.tag)) {
      counts.unsupportedEvents += 1;
      issues.push(issue('warning', token.line, 'unsupported-event-tag', `Event-like tag ${token.tag} is not mapped by the importer.`, { refs: [token.tag] }));
    }
  }
  for (const ref of pointerRefs) {
    if (!declaredXrefs.has(ref.value)) {
      issues.push(issue('warning', ref.line, 'unresolved-xref', `${ref.tag} points to missing record ${ref.value}.`, { refs: [ref.value] }));
    }
  }
  if (!hasHead) issues.push(issue('warning', 0, 'missing-head', 'Missing HEAD record.'));
  if (!hasTrailer) issues.push(issue('warning', 0, 'missing-trailer', 'Missing TRLR record.'));
  if (counts.OBJE > 0) issues.push(issue('warning', 0, 'media-resource-matching', `${counts.OBJE} media object reference(s) found; matching GedZip resources or an attached media folder will be imported as media assets.`));
  if (customTags.size > 0) {
    issues.push(issue('warning', 0, 'custom-tags', `${customTags.size} custom GEDCOM tag type(s) found: ${Array.from(customTags).sort().slice(0, 8).join(', ')}${customTags.size > 8 ? ', …' : ''}.`, {
      refs: Array.from(customTags).sort(),
    }));
  }
  return {
    counts,
    tags: Array.from(seenTags).sort(),
    issues: issues.sort(compareIssues),
    canImport: !hasBlockingIssues(issues),
  };
}

export function canImportGedcomAnalysis(analysis, mode = 'review') {
  const issues = Array.isArray(analysis?.issues) ? analysis.issues : [];
  if (mode === 'strict') return issues.length === 0;
  if (mode === 'lenient') return !issues.some((item) => item.code === 'duplicate-xref');
  return !hasBlockingIssues(issues);
}

export function gedcomImportModeLabel(mode = 'review') {
  if (mode === 'strict') return 'Strict';
  if (mode === 'lenient') return 'Lenient';
  return 'Review warnings';
}
