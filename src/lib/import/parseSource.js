/**
 * Source-format detection and parsing.
 *
 * Given a Uint8Array, classify it (cloudtreeweb JSON, GEDCOM text,
 * SQLite, ZIP/.mftpkg, ZIP/GedZip) and produce a normalised payload that
 * the orchestrator (MFTPKGImporter) can hand to the appropriate
 * downstream pipeline.
 *
 * Pure-ish: only side effect is dynamically importing JSZip when a ZIP
 * is detected. Everything else is byte/text inspection.
 */
import {
  asciiHeader,
  collectGedcomResourceFiles,
  fileExtension,
  findGedcomEntryInZip,
  isGedcomFileName,
  isSQLiteBytes,
  isZipBytes,
  looksLikeGedcomText,
  LEGACY_MFT_BINARY_MESSAGE,
} from '../genealogyFileFormats.js';

export const SOURCE_KIND = Object.freeze({
  JSON: 'json',
  SQLITE: 'sqlite',
  GEDCOM: 'gedcom',
  ZIP_DATABASE: 'zip-database',
  ZIP_JSON: 'zip-json',
  ZIP_GEDCOM: 'zip-gedcom',
});

/**
 * Detect the format of a source byte stream.
 * Returns one of:
 *  - { kind: 'json', data }
 *  - { kind: 'sqlite', bytes }
 *  - { kind: 'gedcom', bytes, format }
 *  - { kind: 'zip-json', data }                       — zipped database.json
 *  - { kind: 'zip-database', dbBytes, resourceFiles, sourceName }  — .mftpkg zip
 *  - { kind: 'zip-gedcom', gedBytes, resourceFiles, sourceName, format } — GedZip
 *
 * Throws when the bytes can't be classified.
 */
export async function parseSource(uint8Array, sourceName) {
  const ext = fileExtension(sourceName);

  // Cloudtreeweb-style JSON export — try this first since it's cheap.
  if (ext === '.json' || uint8Array[0] === 0x7B /* { */) {
    try {
      const text = new TextDecoder().decode(uint8Array);
      const data = JSON.parse(text);
      if (data.records) return { kind: SOURCE_KIND.JSON, data };
    } catch {
      // not JSON — fall through to other detectors
    }
  }

  const header = asciiHeader(uint8Array);
  if (isGedcomFileName(sourceName) || looksLikeGedcomText(header)) {
    return { kind: SOURCE_KIND.GEDCOM, bytes: uint8Array, format: ext.replace('.', '') || 'gedcom' };
  }

  if (isZipBytes(uint8Array)) {
    return parseZipBundle(uint8Array, sourceName);
  }

  if (!isSQLiteBytes(uint8Array)) {
    if (ext === '.mft') throw new Error(LEGACY_MFT_BINARY_MESSAGE);
    throw new Error('Not a recognized file format. Import .mftpkg, .mftsql, SQLite database, GEDCOM, UTF GEDCOM, GedZip .zip, or .json export files.');
  }

  return { kind: SOURCE_KIND.SQLITE, bytes: uint8Array };
}

async function parseZipBundle(uint8Array, sourceName) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(uint8Array);

  // First check for a cloudtreeweb-style JSON export inside the archive.
  const jsonEntry = zip.file('database.json') || zip.file('cloudtreeweb-backup.json') || zip.file('family-data.json');
  if (jsonEntry) {
    const data = JSON.parse(await jsonEntry.async('string'));
    if (data.records) return { kind: SOURCE_KIND.JSON, data };
  }

  // Then look for the SQLite `database` file (mftpkg layout).
  let dbEntry = null;
  const resourceEntries = [];
  zip.forEach((path, entry) => {
    if (!entry.dir && (path.endsWith('/database') || path === 'database')) {
      dbEntry = entry;
    } else if (!entry.dir && path.includes('/resources/')) {
      resourceEntries.push({ path, entry });
    }
  });
  if (!dbEntry) dbEntry = zip.file('database');

  if (dbEntry) {
    const dbBytes = await dbEntry.async('uint8array');
    const resourceFiles = [];
    for (const { path, entry } of resourceEntries) {
      resourceFiles.push({ path, name: path.split('/').pop(), bytes: await entry.async('uint8array') });
    }
    return {
      kind: SOURCE_KIND.ZIP_DATABASE,
      dbBytes,
      resourceFiles,
      sourceName: sourceName.replace(/\.zip$/i, ''),
    };
  }

  // Otherwise look for a GEDCOM inside (GedZip).
  const gedEntry = await findGedcomEntryInZip(zip);
  if (gedEntry) {
    const gedBytes = await gedEntry.async('uint8array');
    const resourceFiles = await collectGedcomResourceFiles(zip, gedEntry.name);
    return {
      kind: SOURCE_KIND.ZIP_GEDCOM,
      gedBytes,
      resourceFiles,
      sourceName: `${sourceName}:${gedEntry.name}`,
      format: 'gedzip',
    };
  }

  const files = [];
  zip.forEach((path) => files.push(path));
  throw new Error('ZIP/GedZip does not contain a MacFamilyTree database or GEDCOM file. Found: ' + files.slice(0, 10).join(', '));
}
