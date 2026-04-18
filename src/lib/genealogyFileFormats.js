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

export function decodeGedcomBytes(bytes, fileName = '') {
  const ext = fileExtension(fileName);
  if (bytes?.[0] === 0xff && bytes?.[1] === 0xfe) return stripBom(new TextDecoder('utf-16le').decode(bytes));
  if (bytes?.[0] === 0xfe && bytes?.[1] === 0xff) return stripBom(decodeUtf16BE(bytes.slice(2)));
  if (bytes?.[0] === 0xef && bytes?.[1] === 0xbb && bytes?.[2] === 0xbf) return stripBom(new TextDecoder('utf-8').decode(bytes));
  if (ext === '.uged16') return stripBom(new TextDecoder('utf-16le').decode(bytes));
  return stripBom(new TextDecoder('utf-8').decode(bytes));
}

export async function readGedcomTextFromFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isZipBytes(bytes)) {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes);
    const entry = await findGedcomEntryInZip(zip);
    if (!entry) throw new Error('ZIP/GedZip does not contain a GEDCOM file.');
    const entryBytes = await entry.async('uint8array');
    return {
      text: decodeGedcomBytes(entryBytes, entry.name),
      sourceName: `${file.name}:${entry.name}`,
      format: 'gedzip',
      entryName: entry.name,
    };
  }
  return {
    text: decodeGedcomBytes(bytes, file.name),
    sourceName: file.name,
    format: fileExtension(file.name).replace('.', '') || 'gedcom',
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

export function asciiHeader(bytes, length = 64) {
  return new TextDecoder('utf-8').decode(bytes.slice(0, length));
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
