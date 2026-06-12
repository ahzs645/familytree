/**
 * MFTPKGImporter — top-level orchestrator for importing genealogy data
 * into the local IndexedDB store.
 *
 * Pipeline:
 *   1. parseSource()  — classify bytes as JSON / SQLite / GEDCOM / ZIP
 *      and hand back the right payload.
 *   2. extract        — for SQLite payloads, run extractMFTPKGDataset
 *      (lib/mftpkgExtractor.js); for GEDCOM, run importGedcomText
 *      (lib/gedcomImport.js); for JSON, the dataset is the payload.
 *   3. persistDataset — write the normalized dataset to IndexedDB.
 *
 * Each stage lives in its own module under lib/import/ so the
 * orchestrator stays small and the stages are individually testable.
 *
 * Usage:
 *   const importer = new MFTPKGImporter();
 *   importer.onProgress = (stage, current, total) => ...;
 *   const result = await importer.importFromFile(file);
 */
import { extractMFTPKGDataset } from './mftpkgExtractor.js';
import {
  analyzeGedcomText,
  canImportGedcomAnalysis,
  gedcomImportModeLabel,
  importGedcomText,
} from './gedcomImport.js';
import {
  decodeGedcomBytes,
  fileExtension,
  isSQLiteBytes,
} from './genealogyFileFormats.js';
import { getSqlJs } from './import/sqlJs.js';
import { getPreferredGedcomEncoding, getPreferredGedcomMode } from './import/importPreferences.js';
import { parseSource, SOURCE_KIND } from './import/parseSource.js';
import { persistDataset } from './import/persistDataset.js';

export class MFTPKGImporter {
  constructor() {
    this.onProgress = null; // callback(stage, current, total)
  }

  /**
   * Import from a File (e.g. drag-and-drop or file-picker).
   */
  async importFromFile(file, options = {}) {
    this._progress('loading', 0, 1);
    const arrayBuffer = await file.arrayBuffer();
    return this.importFromBytes(new Uint8Array(arrayBuffer), file.name || 'browser-import', options);
  }

  /**
   * Import from a "package directory" (used by the directory-picker
   * flow that hands us a pre-located `database` file plus its sibling
   * resource bytes).
   */
  async importFromPackageDirectory({ databaseFile, sourceName = 'MacFamilyTree package', resourceFiles = [] }) {
    this._progress('loading', 0, 1);
    const uint8Array = new Uint8Array(await databaseFile.arrayBuffer());
    if (!isSQLiteBytes(uint8Array)) throw new Error('The selected package database is not a SQLite MacFamilyTree database.');
    return this._openSQLiteAndImport(uint8Array, sourceName, resourceFiles);
  }

  /**
   * Import from a raw byte buffer plus a hint at its origin name
   * (used for the file extension). This is the main entry point that
   * dispatches by source kind.
   */
  async importFromBytes(uint8Array, sourceName = 'browser-import', options = {}) {
    const parsed = await parseSource(uint8Array, sourceName);

    switch (parsed.kind) {
      case SOURCE_KIND.JSON:
        return this.importFromJSON(parsed.data);

      case SOURCE_KIND.GEDCOM:
        return this._importGedcomBytes(parsed.bytes, sourceName, { format: parsed.format, encoding: options.encoding });

      case SOURCE_KIND.ZIP_DATABASE: {
        this._progress('extracting', 0, 1);
        const SQL = await getSqlJs();
        const db = new SQL.Database(parsed.dbBytes);
        try {
          return await this._extractAndImport(db, parsed.sourceName, parsed.resourceFiles);
        } finally {
          db.close();
        }
      }

      case SOURCE_KIND.ZIP_GEDCOM:
        return this._importGedcomBytes(parsed.gedBytes, parsed.sourceName, {
          format: parsed.format,
          resourceFiles: parsed.resourceFiles,
        });

      case SOURCE_KIND.SQLITE:
      default:
        return this._openSQLiteAndImport(parsed.bytes, sourceName);
    }
  }

  /**
   * Import a pre-extracted JSON dataset (from family-data.json or
   * cloudtreeweb-backup.json).
   */
  async importFromJSON(jsonData) {
    this._progress('importing', 0, 1);
    const count = await persistDataset(jsonData);
    this._progress('done', count, count);
    return { total: count, source: 'json' };
  }

  /**
   * Fetch a JSON dataset from a URL and import it.
   */
  async importFromURL(url) {
    this._progress('downloading', 0, 1);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    const data = await response.json();
    return this.importFromJSON(data);
  }

  // ── Internal stages ──

  async _openSQLiteAndImport(uint8Array, sourceName, resourceFiles = []) {
    this._progress('parsing', 0, 1);
    const SQL = await getSqlJs();
    const db = new SQL.Database(uint8Array);
    try {
      return await this._extractAndImport(db, sourceName, resourceFiles);
    } finally {
      db.close();
    }
  }

  async _importGedcomBytes(uint8Array, sourceName, { format = null, resourceFiles = [], encoding } = {}) {
    this._progress('parsing', 0, 1);
    const resolvedEncoding = encoding || await getPreferredGedcomEncoding();
    const text = decodeGedcomBytes(uint8Array, sourceName, { encoding: resolvedEncoding });
    const analysis = analyzeGedcomText(text);
    const mode = await getPreferredGedcomMode();
    if (!canImportGedcomAnalysis(analysis, mode)) {
      const firstError = analysis.issues.find((item) => item.severity === 'error');
      throw new Error(`GEDCOM import blocked in ${gedcomImportModeLabel(mode)} mode${firstError ? `: ${firstError.message}` : ''}`);
    }
    this._progress('importing', 0, 1);
    const total = await importGedcomText(text, { replace: true, sourceName, resourceFiles });
    this._progress('done', total, total);
    return {
      total,
      source: 'gedcom',
      format: format || fileExtension(sourceName).replace('.', '') || 'gedcom',
      mode,
      counts: analysis.counts,
      warnings: analysis.issues.filter((item) => item.severity !== 'error').map((item) => item.message),
      issues: analysis.issues,
    };
  }

  async _extractAndImport(db, sourceName, resourceFiles = []) {
    const query = (sql) => {
      const result = db.exec(sql);
      if (!result.length) return [];
      const { columns, values } = result[0];
      return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
    };

    const dataset = extractMFTPKGDataset({ query, sourceName, resourceFiles });
    this._progress('importing', 0, 1);
    const total = await persistDataset(dataset);
    this._progress('done', total, total);
    return {
      total,
      treeName: dataset.treeName,
      counts: dataset.counts,
      assets: dataset.assets.length,
      decodedSavedViews: dataset.decodedSavedViews,
      warnings: dataset.warnings,
    };
  }

  _progress(stage, current, total) {
    if (this.onProgress) this.onProgress(stage, current, total);
  }
}

export default MFTPKGImporter;
