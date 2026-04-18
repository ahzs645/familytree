/**
 * GEDCOM 5.5 / 5.5.1 importer (subset). Parses INDI / FAM / SOUR / NOTE
 * records and the most common event tags into our IndexedDB record shape.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refValue } from './recordRef.js';
import { Gender } from '../models/index.js';

function tokenizeLine(line) {
  // "level [@xref@] tag [value]"
  const m = line.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
  if (!m) return null;
  return { level: +m[1], xref: m[2] || null, tag: m[3], value: m[4] || '' };
}

function parseGedcomTree(text) {
  const lines = text.split(/\r?\n/);
  const root = { children: [] };
  const stack = [root];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const t = tokenizeLine(raw);
    if (!t) continue;
    while (stack.length > t.level + 1) stack.pop();
    const node = { ...t, children: [] };
    const parent = stack[stack.length - 1] || root;
    parent.children.push(node);
    stack.push(node);
  }
  return root.children;
}

function child(node, tag) { return node.children.find((c) => c.tag === tag); }
function children(node, tag) { return node.children.filter((c) => c.tag === tag); }

const EVENT_TAG_TO_NAME = {
  BIRT: 'Birth', DEAT: 'Death', BURI: 'Burial', BAPM: 'Baptism', CHR: 'Christening',
  MARR: 'Marriage', DIV: 'Divorced', ENGA: 'Engagement', ANUL: 'Annuled',
  NATU: 'Naturalization', EMIG: 'Emigration', IMMI: 'Immigration', CENS: 'Census',
  GRAD: 'Graduation', OCCU: 'Occupation', RESI: 'Residence', RELI: 'Religion',
  WILL: 'Will', PROB: 'Probate', ADOP: 'Adoption', EVEN: 'GenericEvent',
};

let _seq = 0;
function uuid(prefix) {
  _seq++;
  return `${prefix}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

export function parseGedcom(text, options = {}) {
  return parseGedcomParts(text, options).records;
}

function parseGedcomParts(text, { mediaFiles = [], resourceFiles = [] } = {}) {
  const tree = parseGedcomTree(text);
  const records = [];
  const assets = [];
  const personByXref = new Map();
  const familyByXref = new Map();
  const sourceByXref = new Map();
  const mediaByXref = new Map();
  const mediaById = new Map();
  const resourceIndex = buildResourceIndex([...mediaFiles, ...resourceFiles]);

  const addMedia = (node, xref = null) => {
    const created = mediaRecordFromObje(node, resourceIndex);
    if (!created) return null;
    records.push(created.record);
    mediaById.set(created.record.recordName, created.record);
    if (created.asset) assets.push(created.asset);
    if (xref) mediaByXref.set(xref, created.record.recordName);
    return created.record.recordName;
  };

  // First pass: stub records for every top-level entity
  for (const top of tree) {
    if (top.tag === 'INDI' && top.xref) {
      const id = uuid('person-imp');
      personByXref.set(top.xref, id);
      records.push(stubPerson(id, top));
    } else if (top.tag === 'FAM' && top.xref) {
      const id = uuid('family-imp');
      familyByXref.set(top.xref, id);
      records.push(stubFamily(id, top));
    } else if (top.tag === 'SOUR' && top.xref) {
      const id = uuid('source-imp');
      sourceByXref.set(top.xref, id);
      records.push(stubSource(id, top));
    } else if (top.tag === 'OBJE' && top.xref) {
      addMedia(top, top.xref);
    }
  }

  // Second pass: events + relationships
  const families = new Map(records.filter((r) => r.recordType === 'Family').map((r) => [r.recordName, r]));
  const sources = new Map(records.filter((r) => r.recordType === 'Source').map((r) => [r.recordName, r]));
  for (const top of tree) {
    if (top.tag === 'INDI') {
      const personId = personByXref.get(top.xref);
      if (!personId) continue;
      const person = records.find((r) => r.recordName === personId);
      addMediaRelations(records, resolveObjeMediaIds(children(top, 'OBJE'), { addMedia, mediaByXref }), personId, 'Person', mediaById);
      // Events
      for (const ev of top.children) {
        const name = EVENT_TAG_TO_NAME[ev.tag];
        if (!name) continue;
        const eventRec = {
          recordName: uuid('pe-imp'),
          recordType: 'PersonEvent',
          fields: {
            person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
            conclusionType: { value: name, type: 'STRING' },
          },
        };
        const date = child(ev, 'DATE')?.value;
        const place = child(ev, 'PLAC')?.value;
        const note = child(ev, 'NOTE')?.value;
        if (date) eventRec.fields.date = { value: date, type: 'STRING' };
        if (place) eventRec.fields.placeName = { value: place, type: 'STRING' };
        if (note) eventRec.fields.description = { value: note, type: 'STRING' };
        records.push(eventRec);
        addMediaRelations(records, resolveObjeMediaIds(children(ev, 'OBJE'), { addMedia, mediaByXref }), eventRec.recordName, 'PersonEvent', mediaById);
        // Cache shortcuts on the person record
        if (name === 'Birth' && date) person.fields.cached_birthDate = { value: date, type: 'STRING' };
        if (name === 'Death' && date) person.fields.cached_deathDate = { value: date, type: 'STRING' };
      }
      // Notes
      for (const n of children(top, 'NOTE')) {
        if (n.value) records.push({
          recordName: uuid('note-imp'),
          recordType: 'Note',
          fields: {
            person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
            text: { value: n.value, type: 'STRING' },
          },
        });
      }
    } else if (top.tag === 'FAM') {
      const familyId = familyByXref.get(top.xref);
      if (!familyId) continue;
      const fam = families.get(familyId);
      addMediaRelations(records, resolveObjeMediaIds(children(top, 'OBJE'), { addMedia, mediaByXref }), familyId, 'Family', mediaById);
      const husb = child(top, 'HUSB')?.value;
      const wife = child(top, 'WIFE')?.value;
      const husbRecord = husb && personByXref.get(husb);
      const wifeRecord = wife && personByXref.get(wife);
      if (husbRecord) fam.fields.man = { value: refValue(husbRecord, 'Person'), type: 'REFERENCE' };
      if (wifeRecord) fam.fields.woman = { value: refValue(wifeRecord, 'Person'), type: 'REFERENCE' };

      const marr = child(top, 'MARR');
      if (marr) {
        const date = child(marr, 'DATE')?.value;
        if (date) fam.fields.cached_marriageDate = { value: date, type: 'STRING' };
        const eventRec = {
          recordName: uuid('fe-imp'),
          recordType: 'FamilyEvent',
          fields: {
            family: { value: refValue(familyId, 'Family'), type: 'REFERENCE' },
            conclusionType: { value: 'Marriage', type: 'STRING' },
            ...(date ? { date: { value: date, type: 'STRING' } } : {}),
          },
        };
        records.push(eventRec);
        addMediaRelations(records, resolveObjeMediaIds(children(marr, 'OBJE'), { addMedia, mediaByXref }), eventRec.recordName, 'FamilyEvent', mediaById);
      }

      let order = 0;
      for (const c of children(top, 'CHIL')) {
        const childId = personByXref.get(c.value);
        if (!childId) continue;
        records.push({
          recordName: uuid('cr-imp'),
          recordType: 'ChildRelation',
          fields: {
            family: { value: refValue(familyId, 'Family'), type: 'REFERENCE' },
            child: { value: refValue(childId, 'Person'), type: 'REFERENCE' },
            order: { value: order++, type: 'NUMBER' },
          },
        });
      }
    } else if (top.tag === 'SOUR') {
      const sourceId = sourceByXref.get(top.xref);
      if (!sourceId || !sources.has(sourceId)) continue;
      addMediaRelations(records, resolveObjeMediaIds(children(top, 'OBJE'), { addMedia, mediaByXref }), sourceId, 'Source', mediaById);
    }
  }

  return { records, assets };
}

function resolveObjeMediaIds(objeNodes, { addMedia, mediaByXref }) {
  const ids = [];
  for (const node of objeNodes || []) {
    const linked = node.value?.match(/^@[^@]+@$/) ? mediaByXref.get(node.value) : null;
    const mediaId = linked || addMedia(node);
    if (mediaId) ids.push(mediaId);
  }
  return ids;
}

function addMediaRelations(records, mediaIds, targetId, targetType, mediaById) {
  let order = 0;
  for (const mediaId of mediaIds || []) {
    const media = mediaById.get(mediaId);
    records.push({
      recordName: uuid('mr-imp'),
      recordType: 'MediaRelation',
      fields: {
        media: { value: refValue(mediaId, media?.recordType || 'MediaPicture'), type: 'REFERENCE' },
        target: { value: refValue(targetId, targetType), type: 'REFERENCE' },
        targetType: { value: targetType, type: 'STRING' },
        order: { value: order++, type: 'DOUBLE' },
      },
    });
  }
}

function mediaRecordFromObje(node, resourceIndex) {
  const fileNode = child(node, 'FILE');
  const formatNode = child(node, 'FORM') || child(fileNode || { children: [] }, 'FORM');
  const title = nodeText(child(node, 'TITL')) || nodeText(child(fileNode || { children: [] }, 'TITL')) || '';
  const fileValue = nodeText(fileNode) || (node.value && !/^@[^@]+@$/.test(node.value) ? node.value : '');
  const fileName = fileValue ? basename(fileValue) : '';
  const caption = title || fileName.replace(/\.[^.]+$/, '') || node.value || '';
  if (!fileValue && !caption) return null;

  if (/^https?:\/\//i.test(fileValue)) {
    const record = {
      recordName: uuid('mediaurl-imp'),
      recordType: 'MediaURL',
      fields: {
        url: { value: fileValue, type: 'STRING' },
        caption: { value: caption || fileValue, type: 'STRING' },
      },
    };
    return { record, asset: null };
  }

  const recordType = mediaTypeForGedcomFile(fileName, formatNode?.value);
  const identifierField = identifierFieldForType(recordType);
  const match = findResourceForMediaPath(fileValue || fileName, resourceIndex);
  const recordName = uuid(recordType.toLowerCase() + '-imp');
  const fields = {
    caption: { value: caption || fileName || recordName, type: 'STRING' },
    ...(fileName ? {
      filename: { value: fileName, type: 'STRING' },
      fileName: { value: fileName, type: 'STRING' },
    } : {}),
  };
  if (identifierField && fileName) fields[identifierField] = { value: fileName, type: 'STRING' };

  let asset = null;
  if (match?.bytes?.length) {
    const assetId = `asset-${recordName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    fields.assetIds = { value: [assetId], type: 'LIST' };
    asset = {
      assetId,
      ownerRecordName: recordName,
      sourceIdentifier: match.path || match.name || fileName,
      filename: match.name || fileName,
      mimeType: mimeTypeForName(match.name || fileName),
      size: match.bytes.length,
      dataBase64: bytesToBase64(match.bytes),
    };
  }

  return {
    record: {
      recordName,
      recordType,
      fields,
    },
    asset,
  };
}

function buildResourceIndex(files) {
  const byPath = new Map();
  const byName = new Map();
  for (const file of files || []) {
    if (!file?.bytes?.length) continue;
    const path = normalizePath(file.path || file.webkitRelativePath || file.name || '');
    const name = basename(file.name || path);
    const resource = { ...file, path, name };
    if (path) byPath.set(path.toLowerCase(), resource);
    if (name) byName.set(name.toLowerCase(), resource);
  }
  return { byPath, byName };
}

function findResourceForMediaPath(value, resourceIndex) {
  const path = normalizePath(value);
  if (!path) return null;
  return resourceIndex.byPath.get(path.toLowerCase()) || resourceIndex.byName.get(basename(path).toLowerCase()) || null;
}

function nodeText(node) {
  if (!node) return '';
  let value = node.value || '';
  for (const c of node.children || []) {
    if (c.tag === 'CONC') value += c.value || '';
    if (c.tag === 'CONT') value += `\n${c.value || ''}`;
  }
  return value.trim();
}

function normalizePath(path = '') {
  return String(path).trim().replace(/\\/g, '/').replace(/^file:\/+/, '').replace(/^\/+/, '');
}

function basename(path = '') {
  return normalizePath(path).split('/').pop() || '';
}

function mediaTypeForGedcomFile(fileName = '', format = '') {
  const value = `${fileName} ${format}`.toLowerCase();
  if (/\b(pdf)\b|\.(pdf)$/.test(value)) return 'MediaPDF';
  if (/\b(mp3|wav|m4a|aac|aiff?|ogg|flac)\b|\.(mp3|m4a|aac|wav|aiff?|ogg|flac)$/.test(value)) return 'MediaAudio';
  if (/\b(mp4|mov|m4v|webm|avi)\b|\.(mov|mp4|m4v|webm|avi)$/.test(value)) return 'MediaVideo';
  return 'MediaPicture';
}

function identifierFieldForType(recordType) {
  return {
    MediaPicture: 'pictureFileIdentifier',
    MediaPDF: 'pdfFileIdentifier',
    MediaAudio: 'audioFileIdentifier',
    MediaVideo: 'videoFileIdentifier',
  }[recordType] || null;
}

function mimeTypeForName(fileName) {
  const name = String(fileName || '').toLowerCase();
  if (/\.(png)$/.test(name)) return 'image/png';
  if (/\.(jpe?g)$/.test(name)) return 'image/jpeg';
  if (/\.(gif)$/.test(name)) return 'image/gif';
  if (/\.(webp)$/.test(name)) return 'image/webp';
  if (/\.(pdf)$/.test(name)) return 'application/pdf';
  if (/\.(mp3)$/.test(name)) return 'audio/mpeg';
  if (/\.(wav)$/.test(name)) return 'audio/wav';
  if (/\.(m4a|aac)$/.test(name)) return 'audio/mp4';
  if (/\.(mp4|m4v)$/.test(name)) return 'video/mp4';
  if (/\.(mov)$/.test(name)) return 'video/quicktime';
  if (/\.(webm)$/.test(name)) return 'video/webm';
  return 'application/octet-stream';
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

export function analyzeGedcomText(text) {
  const lines = String(text || '').split(/\r?\n/);
  const issues = [];
  const counts = { INDI: 0, FAM: 0, SOUR: 0, NOTE: 0, OBJE: 0, unsupportedEvents: 0 };
  let hasHead = false;
  let hasTrailer = false;
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const token = tokenizeLine(line);
    if (!token) {
      issues.push(issue('error', index + 1, 'Line does not match GEDCOM level/tag syntax.'));
      continue;
    }
    if (token.level === 0 && token.tag === 'HEAD') hasHead = true;
    if (token.level === 0 && token.tag === 'TRLR') hasTrailer = true;
    if (token.level === 0 && counts[token.tag] !== undefined && token.tag !== 'OBJE') counts[token.tag] += 1;
    if (token.tag === 'OBJE') counts.OBJE += 1;
    if (token.level > 0 && /^[A-Z0-9_]+$/.test(token.tag) && token.tag.length >= 3 && !EVENT_TAG_TO_NAME[token.tag] && eventLikeTag(token.tag)) {
      counts.unsupportedEvents += 1;
      issues.push(issue('warning', index + 1, `Event-like tag ${token.tag} is not mapped by the importer.`));
    }
  }
  if (!hasHead) issues.push(issue('warning', 0, 'Missing HEAD record.'));
  if (!hasTrailer) issues.push(issue('warning', 0, 'Missing TRLR record.'));
  if (counts.OBJE > 0) issues.push(issue('warning', 0, `${counts.OBJE} media object reference(s) found; matching GedZip resources or an attached media folder will be imported as media assets.`));
  return {
    counts,
    issues,
    canImport: !issues.some((item) => item.severity === 'error'),
  };
}

export function buildGedcomDataset(text, { sourceName = 'GEDCOM import', mediaFiles = [], resourceFiles = [] } = {}) {
  const { records, assets } = parseGedcomParts(text, { mediaFiles, resourceFiles });
  const recordMap = Object.fromEntries(records.map((record) => [record.recordName, record]));
  const counts = records.reduce((acc, record) => {
    acc[record.recordType] = (acc[record.recordType] || 0) + 1;
    return acc;
  }, {});
  const analysis = analyzeGedcomText(text);
  return {
    records: recordMap,
    assets,
    counts,
    treeName: sourceName.replace(/\.(ged|uged|uged16|gedcom)$/i, '') || 'GEDCOM import',
    meta: {
      sourceName,
      importFormat: 'gedcom',
      importedAt: new Date().toISOString(),
      gedcom: analysis,
    },
  };
}

function stubPerson(id, indi) {
  const fields = {};
  const name = child(indi, 'NAME')?.value || '';
  // GEDCOM name format: "Given /Surname/"
  const m = name.match(/^([^/]*?)\s*\/([^/]*)\//);
  const given = m ? m[1].trim() : name.trim();
  const surname = m ? m[2].trim() : '';
  if (given) fields.firstName = { value: given.split(' ')[0], type: 'STRING' };
  const middle = given.split(' ').slice(1).join(' ');
  if (middle) fields.nameMiddle = { value: middle, type: 'STRING' };
  if (surname) fields.lastName = { value: surname, type: 'STRING' };
  if (given || surname) fields.cached_fullName = { value: `${given} ${surname}`.trim(), type: 'STRING' };
  const sex = child(indi, 'SEX')?.value;
  if (sex === 'M') fields.gender = { value: Gender.Male, type: 'NUMBER' };
  else if (sex === 'F') fields.gender = { value: Gender.Female, type: 'NUMBER' };
  return { recordName: id, recordType: 'Person', fields };
}
function stubFamily(id) { return { recordName: id, recordType: 'Family', fields: {} }; }
function stubSource(id, sour) {
  const fields = {};
  const title = child(sour, 'TITL')?.value;
  const author = child(sour, 'AUTH')?.value;
  const text = child(sour, 'TEXT')?.value;
  if (title) {
    fields.title = { value: title, type: 'STRING' };
    fields.cached_title = { value: title, type: 'STRING' };
  }
  if (author) fields.author = { value: author, type: 'STRING' };
  if (text) fields.text = { value: text, type: 'STRING' };
  return { recordName: id, recordType: 'Source', fields };
}

export async function importGedcomText(text, { replace = false, sourceName = 'GEDCOM import', mediaFiles = [], resourceFiles = [] } = {}) {
  const db = getLocalDatabase();
  if (replace) {
    const dataset = buildGedcomDataset(text, { sourceName, mediaFiles, resourceFiles });
    return db.importDataset(dataset);
  }
  const { records, assets } = parseGedcomParts(text, { mediaFiles, resourceFiles });
  await db.applyRecordTransaction({ saveRecords: records, saveAssets: assets });
  return records.length;
}

function eventLikeTag(tag) {
  return ['BIRT', 'DEAT', 'MARR', 'DIV', 'EVEN', 'FACT', 'ADOP', 'BURI', 'RESI', 'OCCU', 'CENS', 'IMMI', 'EMIG', 'NATU'].includes(tag);
}

function issue(severity, line, message) {
  return { severity, line, message };
}
