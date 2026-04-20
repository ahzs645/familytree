export const SUPPORTED_IMPORT_EXTENSIONS = [
  '.mftpkg',
  '.mftsql',
  '.mft',
  '.ged',
  '.uged',
  '.uged16',
  '.zip',
  '.json',
];

export const IMPORT_ACCEPT = SUPPORTED_IMPORT_EXTENSIONS.join(',');
export const GEDCOM_ACCEPT = '.ged,.uged,.uged16,.gedcom,.zip,text/plain';

export const LEGACY_MFT_BINARY_MESSAGE =
  'Legacy .mft binary files are recognized, but this browser importer cannot safely parse that proprietary binary format yet. Export the file from MacFamilyTree as .mftpkg, .mftsql, GEDCOM, UTF GEDCOM, or GedZip and import that file here.';

const GEDCOM_EXTENSIONS = new Set(['.ged', '.uged', '.uged16', '.gedcom']);

export function fileExtension(fileName = '') {
  const base = String(fileName).toLowerCase().split(/[\\/]/).pop() || '';
  const dot = base.lastIndexOf('.');
  return dot >= 0 ? base.slice(dot) : '';
}

export function isGedcomFileName(fileName = '') {
  return GEDCOM_EXTENSIONS.has(fileExtension(fileName));
}

export function isSQLiteBytes(bytes) {
  return asciiHeader(bytes).startsWith('SQLite format 3');
}

export function isZipBytes(bytes) {
  return bytes?.[0] === 0x50 && bytes?.[1] === 0x4b;
}

export function looksLikeGedcomText(text = '') {
  return /(^|\n)\s*0\s+HEAD\b/.test(text) || /(^|\n)\s*0\s+@[^@]+@\s+(INDI|FAM|SOUR|NOTE)\b/.test(text);
}

export const GEDCOM_ENCODINGS = [
  { id: 'auto', label: 'Auto-detect' },
  { id: 'utf-8', label: 'UTF-8 (modern, default)' },
  { id: 'utf-16le', label: 'UTF-16 LE' },
  { id: 'utf-16be', label: 'UTF-16 BE' },
  { id: 'windows-1252', label: 'Windows-1252 (legacy Windows)' },
  { id: 'macroman', label: 'MacRoman (legacy Mac)' },
  { id: 'ansel', label: 'ANSEL (legacy GEDCOM)' },
];

export function extractGedcomCharTag(bytes, limit = 4096) {
  try {
    const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, limit));
    const match = head.match(/(^|\n)\s*1\s+CHAR\s+([^\r\n]+)/i);
    return match ? match[2].trim() : null;
  } catch {
    return null;
  }
}

export function gedcomEncodingFromCharTag(tag) {
  if (!tag) return null;
  const normalized = tag.toLowerCase().replace(/[\s_]/g, '-');
  if (/^utf-?8$/.test(normalized)) return 'utf-8';
  if (/^utf-?16(le)?$/.test(normalized)) return 'utf-16le';
  if (/^utf-?16be$/.test(normalized)) return 'utf-16be';
  if (/^ansi$|windows|cp1252|ibmpc|ibm-pc/.test(normalized)) return 'windows-1252';
  if (/macintosh|macroman|mac-roman/.test(normalized)) return 'macroman';
  if (/^ansel$/.test(normalized)) return 'ansel';
  return null;
}

export function decodeGedcomBytes(bytes, fileName = '', { encoding = 'auto' } = {}) {
  const ext = fileExtension(fileName);
  if (encoding && encoding !== 'auto') {
    return stripBom(decodeWithEncoding(bytes, encoding));
  }
  if (bytes?.[0] === 0xff && bytes?.[1] === 0xfe) return stripBom(new TextDecoder('utf-16le').decode(bytes));
  if (bytes?.[0] === 0xfe && bytes?.[1] === 0xff) return stripBom(decodeUtf16BE(bytes.slice(2)));
  if (bytes?.[0] === 0xef && bytes?.[1] === 0xbb && bytes?.[2] === 0xbf) return stripBom(new TextDecoder('utf-8').decode(bytes));
  if (ext === '.uged16') return stripBom(new TextDecoder('utf-16le').decode(bytes));
  const charTag = extractGedcomCharTag(bytes);
  const fromTag = gedcomEncodingFromCharTag(charTag);
  if (fromTag && fromTag !== 'utf-8') {
    return stripBom(decodeWithEncoding(bytes, fromTag));
  }
  return stripBom(new TextDecoder('utf-8').decode(bytes));
}

function decodeWithEncoding(bytes, encoding) {
  if (encoding === 'utf-16be') return decodeUtf16BE(bytes);
  if (encoding === 'ansel') return decodeAnsel(bytes);
  if (encoding === 'macroman') {
    try { return new TextDecoder('macintosh').decode(bytes); }
    catch { return new TextDecoder('windows-1252').decode(bytes); }
  }
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

// ANSEL → Unicode fallback. Full ANSEL support requires a combining-diacritic
// mapping; for our purposes this covers ASCII passthrough plus a handful of
// the most common extended points so the text is legible without mojibake.
const ANSEL_FALLBACK = {
  0xA1: '\u0141', 0xA2: '\u00D8', 0xA3: '\u0110', 0xA4: '\u00DE', 0xA5: '\u00C6', 0xA6: '\u0152', 0xA7: '\u02B9',
  0xA8: '\u00B7', 0xA9: '\u266D', 0xAA: '\u00AE', 0xAB: '\u00B1', 0xAC: '\u01A0', 0xAD: '\u01AF', 0xAE: '\u02BC',
  0xB0: '\u02BB', 0xB1: '\u0142', 0xB2: '\u00F8', 0xB3: '\u0111', 0xB4: '\u00FE', 0xB5: '\u00E6', 0xB6: '\u0153',
  0xB7: '\u02BA', 0xB8: '\u0131', 0xB9: '\u00A3', 0xBA: '\u00F0', 0xBC: '\u01A1', 0xBD: '\u01B0',
  0xC0: '\u00B0', 0xC1: '\u2113', 0xC2: '\u2117', 0xC3: '\u00A9', 0xC4: '\u266F', 0xC5: '\u00BF', 0xC6: '\u00A1',
  0xCF: '\u00DF',
};

function decodeAnsel(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (ANSEL_FALLBACK[b]) out += ANSEL_FALLBACK[b];
    else out += '?';
  }
  return out;
}

export async function readGedcomTextFromFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isZipBytes(bytes)) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes);
    const entry = await findGedcomEntryInZip(zip);
    if (!entry) throw new Error('ZIP/GedZip does not contain a GEDCOM file.');
    const entryBytes = await entry.async('uint8array');
    const resourceFiles = await collectGedcomResourceFiles(zip, entry.name);
    return {
      text: decodeGedcomBytes(entryBytes, entry.name),
      sourceName: `${file.name}:${entry.name}`,
      format: 'gedzip',
      entryName: entry.name,
      resourceFiles,
    };
  }
  return {
    text: decodeGedcomBytes(bytes, file.name),
    sourceName: file.name,
    format: fileExtension(file.name).replace('.', '') || 'gedcom',
    resourceFiles: [],
  };
}

export async function findGedcomEntryInZip(zip) {
  const entries = [];
  zip.forEach((path, entry) => {
    if (!entry.dir) entries.push({ path, entry });
  });
  const byName = entries.find(({ path }) => isGedcomFileName(path));
  if (byName) return byName.entry;

  for (const { entry } of entries) {
    if ((entry._data?.uncompressedSize || 0) > 20 * 1024 * 1024) continue;
    try {
      const bytes = await entry.async('uint8array');
      const text = decodeGedcomBytes(bytes, entry.name).slice(0, 4096);
      if (looksLikeGedcomText(text)) return entry;
    } catch {
      // Try the next file.
    }
  }
  return null;
}

export async function collectGedcomResourceFiles(zip, gedcomEntryName = '') {
  const resources = [];
  const gedcomPath = normalizeZipPath(gedcomEntryName);
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    const normalized = normalizeZipPath(path);
    if (normalized === gedcomPath) return;
    if (isGedcomFileName(path)) return;
    const name = path.split('/').pop();
    if (!name || name.startsWith('.')) return;
    resources.push({ path, name, entry });
  });

  const files = [];
  for (const resource of resources) {
    files.push({
      path: resource.path,
      name: resource.name,
      size: resource.entry._data?.uncompressedSize || 0,
      bytes: await resource.entry.async('uint8array'),
    });
  }
  return files;
}

export function asciiHeader(bytes, length = 64) {
  return new TextDecoder('utf-8').decode(bytes.slice(0, length));
}

function normalizeZipPath(path = '') {
  return String(path).replace(/^\/+/, '').replace(/\\/g, '/');
}

function stripBom(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

function decodeUtf16BE(bytes) {
  const swapped = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 2) {
    swapped[i] = bytes[i + 1] || 0;
    swapped[i + 1] = bytes[i] || 0;
  }
  return new TextDecoder('utf-16le').decode(swapped);
}
