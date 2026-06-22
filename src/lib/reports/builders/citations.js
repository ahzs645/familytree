/**
 * Source-citation helpers for report builders.
 *
 * Several narrative/summary report builders gained an "append citations"
 * option. When enabled they emit a Citations/Bibliography section at the end
 * of the report. The actual citation string formatting is shared with the
 * Lists workbench and books bibliography via `formatCitation` /
 * `formatBibliography` (src/lib/citationFormat.js) — we only handle the
 * gathering of the relevant Source records here.
 */
import { CITATION_MODE, formatCitation } from '../../citationFormat.js';
import { block } from '../ast.js';
import { compareStrings } from '../../i18n.js';
import {
  getLocalDatabase,
  readRef,
  sourceSummary,
} from './_helpers.js';

/**
 * Collect the distinct Source records cited by any of the given target record
 * names (people, families, events). SourceRelation records carry a `source`
 * ref and a `target` ref; we follow those backwards.
 *
 * @param {string[]} targetRecordNames
 * @returns {Promise<object[]>} ordered list of Source records
 */
export async function collectCitedSources(targetRecordNames = []) {
  const db = getLocalDatabase();
  const wanted = new Set((targetRecordNames || []).filter(Boolean));
  if (wanted.size === 0) return [];
  const { records: relations } = await db.query('SourceRelation', { limit: 100000 });
  const sourceIds = [...new Set(
    (relations || [])
      .filter((rel) => wanted.has(readRef(rel.fields?.target)))
      .map((rel) => readRef(rel.fields?.source))
      .filter(Boolean)
  )];
  const sources = [];
  for (const id of sourceIds) {
    const source = await db.getRecord(id);
    if (source) sources.push(source);
  }
  sources.sort((a, b) => compareStrings(
    sourceSummary(a)?.title || '',
    sourceSummary(b)?.title || ''
  ));
  return sources;
}

/**
 * Append a "Citations" section listing formatted citations for the supplied
 * target record names. No-ops (adds nothing) when no sources are cited so the
 * report does not gain an empty heading.
 *
 * @param {object} report report AST being built (mutated in place)
 * @param {string[]} targetRecordNames records whose sources should be listed
 * @param {{ mode?: string, heading?: string }} [opts]
 */
export async function appendCitationsSection(report, targetRecordNames, opts = {}) {
  const sources = await collectCitedSources(targetRecordNames);
  if (sources.length === 0) return report;
  const mode = opts.mode === CITATION_MODE.NORMAL ? CITATION_MODE.NORMAL : CITATION_MODE.LONG;
  const lines = sources
    .map((source) => formatCitation(source, mode))
    .filter(Boolean);
  if (lines.length === 0) return report;
  report.blocks.push(block.spacer(8));
  report.blocks.push(block.title(opts.heading || 'Citations', 2));
  report.blocks.push(block.list(lines));
  return report;
}
