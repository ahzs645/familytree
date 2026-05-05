/**
 * GEDCOM 5.5 / 5.5.1 importer (subset). Parses INDI / FAM / SOUR / NOTE
 * records and the most common event tags into our IndexedDB record shape.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refValue } from './recordRef.js';
import { DATASET_SCHEMA_VERSION } from './datasetSchemaVersion.js';
import { compareIssues, hasBlockingIssues, makeValidationIssue } from './validationIssues.js';
import { Gender } from '../models/index.js';

function tokenizeLine(line) {
  // "level [@xref@] tag [value]"
  const m = line.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
  if (!m) return null;
  const tag = m[3];
  const xref = (tag === 'CONC' || tag === 'CONT') ? null : (m[2] || null);
  return { level: +m[1], xref, tag, value: (m[4] || '').replace(/@@/g, '@') };
}

export function tokenizeGedcomText(text) {
  const lines = String(text || '').split(/\r\n|\r|\n/);
  const tokens = [];
  const issues = [];
  let previousToken = null;

  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    if (!raw.trim()) continue;

    const token = tokenizeLine(raw);
    if (!token) {
      issues.push(issue('error', line, 'gedcom-syntax', 'Line does not match GEDCOM level/tag syntax.', { details: { raw } }));
      continue;
    }

    if (token.level > 99) {
      issues.push(issue('warning', line, 'excessive-level', `Level ${token.level} is unusually deep for GEDCOM.`, { details: { level: token.level } }));
    }

    if (previousToken && token.level > previousToken.level + 1) {
      issues.push(issue('error', line, 'level-jump', `Level jumps from ${previousToken.level} to ${token.level}; expected at most ${previousToken.level + 1}.`, {
        details: { previousLine: previousToken.line, previousLevel: previousToken.level, level: token.level },
      }));
    }

    if ((token.tag === 'CONC' || token.tag === 'CONT') && token.level === 0) {
      issues.push(issue('error', line, 'orphan-continuation', `${token.tag} cannot appear at level 0.`));
    }

    tokens.push({ ...token, line, raw });
    previousToken = { ...token, line };
  }

  return { tokens, issues };
}

function parseGedcomTree(text) {
  const { tokens } = tokenizeGedcomText(text);
  return parseGedcomTokens(tokens);
}

function parseGedcomTokens(tokens) {
  const root = { children: [] };
  const stack = [root];
  for (const t of tokens) {
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
  EDUC: 'Education', PROP: 'Possession', TITL: 'NobilityTypeTitle', BARM: 'BarMitzvah',
  BASM: 'BasMitzvah', BLES: 'Blessing', CONF: 'Confirmation', CREM: 'Cremation',
  FCOM: 'FirstCommunion', ORDN: 'Ordination', RETI: 'Retirement', CAST: 'CasteName',
};

const CUSTOM_EVENT_TAG_TO_NAME = {
  _SEPR: 'Separation',
  _MILT: 'MilitaryService',
  _DEG: 'Degree',
  _MDCL: 'MedicalInformation',
  _ELEC: 'Elected',
  _CIRC: 'Circumcision',
};

const ATTRIBUTE_TAG_TO_FACT = {
  CAST: 'CasteName',
  DSCR: 'PhysicalDescription',
  FACT: 'Other',
  IDNO: 'NationalID',
  NATI: 'NationalOrTribalOrigin',
  NCHI: 'ChildrenCount',
  NMR: 'MarriageCount',
  SSN: 'SocialSecurityNumber',
};

const CONTACT_TAG_TO_FACT = {
  PHON: 'Phone',
  EMAIL: 'Email',
  EMAI: 'Email',
  WWW: 'Website',
  URL: 'Website',
};

const TOP_LEVEL_TAGS = new Set(['HEAD', 'TRLR', 'INDI', 'FAM', 'SOUR', 'NOTE', 'OBJE', 'SUBM', 'REPO']);
const PERSON_HANDLED_TAGS = new Set(['NAME', 'SEX', 'OBJE', 'NOTE', 'SOUR', 'ALIA', 'ASSO', 'ADDR', 'ADR1', 'ADR2', 'CITY', 'STAE', 'POST', 'CTRY', ...Object.keys(CONTACT_TAG_TO_FACT), ...Object.keys(ATTRIBUTE_TAG_TO_FACT), ...Object.keys(EVENT_TAG_TO_NAME)]);
const FAMILY_HANDLED_TAGS = new Set(['HUSB', 'WIFE', 'CHIL', 'MARR', 'OBJE', 'ADDR', ...Object.keys(CONTACT_TAG_TO_FACT), ...Object.keys(EVENT_TAG_TO_NAME)]);
const SOURCE_HANDLED_TAGS = new Set(['TITL', 'AUTH', 'TEXT', 'OBJE', 'REPO', 'PUBL', 'ABBR', 'NOTE']);
const EVENT_HANDLED_TAGS = new Set(['DATE', 'PLAC', 'NOTE', 'OBJE', 'TYPE', 'SOUR', 'ADDR', ...Object.keys(CONTACT_TAG_TO_FACT)]);
const REPOSITORY_HANDLED_TAGS = new Set(['NAME', 'ADDR', 'ADR1', 'ADR2', 'CITY', 'STAE', 'POST', 'CTRY', 'NOTE', ...Object.keys(CONTACT_TAG_TO_FACT)]);

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
  const placeForm = placeFormFromHead(tree);
  const personByXref = new Map();
  const familyByXref = new Map();
  const sourceByXref = new Map();
  const repositoryByXref = new Map();
  const mediaByXref = new Map();
  const noteByXref = new Map();
  const mediaById = new Map();
  const placeByKey = new Map();
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

  const ensurePlace = (value) => {
    const placeText = String(value || '').trim();
    if (!placeText) return null;
    const key = placeText.toLowerCase();
    if (placeByKey.has(key)) return placeByKey.get(key);
    const id = uuid('place-imp');
    const record = placeRecordFromGedcomPlace(id, placeText, placeForm);
    records.push(record);
    placeByKey.set(key, id);
    return id;
  };

  const ensureInlineSource = (value) => {
    const title = String(value || '').trim();
    if (!title || /^@[^@]+@$/.test(title)) return null;
    const key = title.toLowerCase();
    for (const [xref, sourceId] of sourceByXref.entries()) {
      if (xref === `inline:${key}`) return sourceId;
    }
    const id = uuid('source-inline');
    records.push({
      recordName: id,
      recordType: 'Source',
      fields: {
        title: { value: title, type: 'STRING' },
        cached_title: { value: title, type: 'STRING' },
      },
    });
    sourceByXref.set(`inline:${key}`, id);
    return id;
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
    } else if (top.tag === 'REPO' && top.xref) {
      const id = uuid('repo-imp');
      repositoryByXref.set(top.xref, id);
      records.push(stubRepository(id, top));
    } else if (top.tag === 'OBJE' && top.xref) {
      addMedia(top, top.xref);
    } else if (top.tag === 'NOTE' && top.xref) {
      noteByXref.set(top.xref, nodeText(top));
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
      addContactFacts(records, top, personId);
      addAddressFact(records, top, personId);
      addAttributeFacts(records, top, personId);
      addAliasNames(records, top, personId);
      addAssociateRelations(records, top, personId, personByXref);
      addSourceRelations(records, children(top, 'SOUR'), personId, 'Person', { sourceByXref, ensureInlineSource });
      // Events
      for (const ev of top.children) {
        const name = eventNameForNode(ev);
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
        const placeId = ensurePlace(place);
        const note = nodeText(child(ev, 'NOTE'), noteByXref);
        const type = nodeText(child(ev, 'TYPE'));
        if (date) eventRec.fields.date = { value: date, type: 'STRING' };
        if (place) eventRec.fields.placeName = { value: place, type: 'STRING' };
        if (placeId) eventRec.fields.place = { value: refValue(placeId, 'Place'), type: 'REFERENCE' };
        if (type && name === 'GenericEvent') eventRec.fields.conclusionType = { value: typeToIdentifier(type), type: 'STRING' };
        if (note || ev.value) eventRec.fields.description = { value: [ev.value, note].filter(Boolean).join('\n'), type: 'STRING' };
        preserveExtensions(eventRec, ev, EVENT_HANDLED_TAGS);
        records.push(eventRec);
        addMediaRelations(records, resolveObjeMediaIds(children(ev, 'OBJE'), { addMedia, mediaByXref }), eventRec.recordName, 'PersonEvent', mediaById);
        addSourceRelations(records, children(ev, 'SOUR'), eventRec.recordName, 'PersonEvent', { sourceByXref, ensureInlineSource });
        // Cache shortcuts on the person record
        if (name === 'Birth' && date) person.fields.cached_birthDate = { value: date, type: 'STRING' };
        if (name === 'Death' && date) person.fields.cached_deathDate = { value: date, type: 'STRING' };
      }
      // Notes
      for (const n of children(top, 'NOTE')) {
        const text = nodeText(n, noteByXref);
        if (text) records.push({
          recordName: uuid('note-imp'),
          recordType: 'Note',
          fields: {
            person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
            text: { value: text, type: 'STRING' },
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

      for (const marr of familyEventNodes(top)) {
        const date = child(marr, 'DATE')?.value;
        const eventName = eventNameForNode(marr, 'FamilyEvent');
        if (date && eventName === 'Marriage') fam.fields.cached_marriageDate = { value: date, type: 'STRING' };
        const eventRec = {
          recordName: uuid('fe-imp'),
          recordType: 'FamilyEvent',
          fields: {
            family: { value: refValue(familyId, 'Family'), type: 'REFERENCE' },
            conclusionType: { value: eventName, type: 'STRING' },
            ...(date ? { date: { value: date, type: 'STRING' } } : {}),
          },
        };
        const place = child(marr, 'PLAC')?.value;
        const placeId = ensurePlace(place);
        const note = nodeText(child(marr, 'NOTE'), noteByXref);
        const type = nodeText(child(marr, 'TYPE'));
        if (place) eventRec.fields.placeName = { value: place, type: 'STRING' };
        if (placeId) eventRec.fields.place = { value: refValue(placeId, 'Place'), type: 'REFERENCE' };
        if (note) eventRec.fields.description = { value: note, type: 'STRING' };
        if (type) eventRec.fields.type = { value: type, type: 'STRING' };
        preserveExtensions(eventRec, marr, EVENT_HANDLED_TAGS);
        records.push(eventRec);
        addMediaRelations(records, resolveObjeMediaIds(children(marr, 'OBJE'), { addMedia, mediaByXref }), eventRec.recordName, 'FamilyEvent', mediaById);
        addSourceRelations(records, children(marr, 'SOUR'), eventRec.recordName, 'FamilyEvent', { sourceByXref, ensureInlineSource });
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
            ...childRelationFields(c),
          },
        });
      }
    } else if (top.tag === 'SOUR') {
      const sourceId = sourceByXref.get(top.xref);
      if (!sourceId || !sources.has(sourceId)) continue;
      const source = sources.get(sourceId);
      const repoRef = child(top, 'REPO')?.value;
      const repoId = repositoryByXref.get(repoRef);
      if (repoId) source.fields.sourceRepository = { value: refValue(repoId, 'SourceRepository'), type: 'REFERENCE' };
      addMediaRelations(records, resolveObjeMediaIds(children(top, 'OBJE'), { addMedia, mediaByXref }), sourceId, 'Source', mediaById);
    }
  }

  return { records, assets };
}

function addAliasNames(records, personNode, personId) {
  for (const node of children(personNode, 'ALIA')) {
    const value = nodeText(node);
    if (!value || /^@[^@]+@$/.test(value)) continue;
    records.push({
      recordName: uuid('an-imp'),
      recordType: 'AdditionalName',
      fields: {
        person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
        conclusionType: { value: 'NameVariation', type: 'STRING' },
        name: { value, type: 'STRING' },
      },
    });
  }
}

function addAssociateRelations(records, personNode, personId, personByXref) {
  for (const node of children(personNode, 'ASSO')) {
    const targetId = personByXref.get(node.value);
    if (!targetId) continue;
    const relation = nodeText(child(node, 'RELA')) || 'Associate';
    records.push({
      recordName: uuid('assoc-imp'),
      recordType: 'AssociateRelation',
      fields: {
        sourcePerson: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
        targetPerson: { value: refValue(targetId, 'Person'), type: 'REFERENCE' },
        relationType: { value: typeToIdentifier(relation), type: 'STRING' },
      },
    });
  }
}

function addAttributeFacts(records, personNode, personId) {
  for (const node of personNode.children || []) {
    const factType = ATTRIBUTE_TAG_TO_FACT[node.tag];
    if (!factType) continue;
    const description = nodeText(node);
    const type = nodeText(child(node, 'TYPE'));
    records.push(makePersonFact(personId, type ? typeToIdentifier(type) : factType, description, child(node, 'DATE')?.value));
  }
}

function addContactFacts(records, node, personId) {
  for (const tag of Object.keys(CONTACT_TAG_TO_FACT)) {
    for (const childNode of children(node, tag)) {
      const value = nodeText(childNode);
      if (value) records.push(makePersonFact(personId, CONTACT_TAG_TO_FACT[tag], value));
    }
  }
}

function addAddressFact(records, node, personId) {
  const address = addressFromNode(node);
  if (address) records.push(makePersonFact(personId, 'Address', address));
}

function eventNameForNode(node, scope = 'PersonEvent') {
  if (!node?.tag) return null;
  const known = EVENT_TAG_TO_NAME[node.tag];
  if (known) return known;
  if (!node.tag.startsWith('_')) return null;
  if (!eventLikeNode(node)) return null;
  const typed = nodeText(child(node, 'TYPE'));
  if (typed) return typeToIdentifier(typed);
  const customKnown = CUSTOM_EVENT_TAG_TO_NAME[node.tag];
  if (customKnown) return customKnown;
  return typeToIdentifier(node.tag.replace(/^_+/, ''));
}

function eventLikeNode(node) {
  if (!node) return false;
  return (node.children || []).some((childNode) => ['DATE', 'PLAC', 'TYPE', 'NOTE', 'SOUR', 'ADDR'].includes(childNode.tag));
}

function familyEventNodes(familyNode) {
  return (familyNode.children || []).filter((node) => eventNameForNode(node, 'FamilyEvent'));
}

function childRelationFields(node) {
  const out = {};
  const fatherRel = nodeText(child(node, '_FREL'));
  const motherRel = nodeText(child(node, '_MREL'));
  if (fatherRel) out.fatherRelationType = { value: typeToIdentifier(fatherRel), type: 'STRING' };
  if (motherRel) out.motherRelationType = { value: typeToIdentifier(motherRel), type: 'STRING' };
  return out;
}

function addSourceRelations(records, sourceNodes, targetId, targetType, { sourceByXref, ensureInlineSource }) {
  for (const node of sourceNodes || []) {
    const sourceId = sourceByXref.get(node.value) || ensureInlineSource?.(node.value);
    if (!sourceId) continue;
    const fields = {
      source: { value: refValue(sourceId, 'Source'), type: 'REFERENCE' },
      target: { value: refValue(targetId, targetType), type: 'REFERENCE' },
      targetType: { value: targetType, type: 'STRING' },
    };
    const page = nodeText(child(node, 'PAGE'));
    const text = nodeText(child(node, 'TEXT'));
    const note = nodeText(child(node, 'NOTE'));
    if (page) fields.page = { value: page, type: 'STRING' };
    if (text) fields.text = { value: text, type: 'STRING' };
    if (note) fields.note = { value: note, type: 'STRING' };
    records.push({ recordName: uuid('sr-imp'), recordType: 'SourceRelation', fields });
  }
}

function makePersonFact(personId, conclusionType, description, date = '') {
  return {
    recordName: uuid('pf-imp'),
    recordType: 'PersonFact',
    fields: {
      person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
      conclusionType: { value: conclusionType, type: 'STRING' },
      ...(description ? { description: { value: description, type: 'STRING' } } : {}),
      ...(date ? { date: { value: date, type: 'STRING' } } : {}),
    },
  };
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

function nodeText(node, noteByXref = null) {
  if (!node) return '';
  if (noteByXref && /^@[^@]+@$/.test(String(node.value || '').trim())) {
    return noteByXref.get(String(node.value).trim()) || '';
  }
  let value = node.value || '';
  for (const c of node.children || []) {
    if (c.tag === 'CONC') value += c.value || '';
    if (c.tag === 'CONT') value += `\n${c.value || ''}`;
  }
  return value.trim();
}

function addressFromNode(node) {
  const addr = child(node, 'ADDR');
  const container = addr || node;
  const direct = nodeText(addr);
  const parts = [
    nodeText(child(container, 'ADR1')),
    nodeText(child(container, 'ADR2')),
    nodeText(child(container, 'CITY')),
    nodeText(child(container, 'STAE')),
    nodeText(child(container, 'POST')),
    nodeText(child(container, 'CTRY')),
  ].filter(Boolean);
  return [direct, ...parts.filter((part) => part !== direct)].filter(Boolean).join('\n').trim();
}

function placeFormFromHead(tree) {
  const head = (tree || []).find((node) => node.tag === 'HEAD');
  const form = child(child(head || { children: [] }, 'PLAC') || { children: [] }, 'FORM');
  return parsePlaceForm(form?.value);
}

function parsePlaceForm(value) {
  return String(value || '')
    .split(',')
    .map((part) => normalizePlaceFormSlot(part))
    .filter(Boolean);
}

function normalizePlaceFormSlot(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (['addr', 'addr1', 'adr1', 'street', 'subdivision'].includes(text)) return 'street';
  if (['addr2', 'adr2', 'locality', 'neighborhood'].includes(text)) return 'locality';
  if (['city', 'town', 'village', 'place'].includes(text)) return 'place';
  if (text === 'county') return 'county';
  if (['state', 'state/province', 'province', 'region'].includes(text)) return 'state';
  if (['country', 'nation'].includes(text)) return 'country';
  if (['area code', 'post code', 'postal code', 'zip code'].includes(text)) return 'postalCode';
  return typeToIdentifier(text).replace(/^./, (ch) => ch.toLowerCase());
}

function placeRecordFromGedcomPlace(recordName, placeText, placeForm = []) {
  const parts = String(placeText || '').split(',').map((part) => part.trim()).filter(Boolean);
  const fields = {
    placeName: { value: placeText, type: 'STRING' },
    cached_normallocationString: { value: placeText, type: 'STRING' },
    cached_normalLocationString: { value: placeText, type: 'STRING' },
    cached_standardizedLocationString: { value: parts.join(','), type: 'STRING' },
    cached_shortLocationString: { value: placeText, type: 'STRING' },
  };
  const slots = placeForm.length === parts.length ? placeForm : defaultPlaceSlots(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const slot = slots[i];
    if (slot && parts[i] && !fields[slot]) fields[slot] = { value: parts[i], type: 'STRING' };
  }
  return { recordName, recordType: 'Place', fields };
}

function defaultPlaceSlots(count) {
  if (count <= 1) return ['place'];
  if (count === 2) return ['place', 'country'];
  if (count === 3) return ['place', 'state', 'country'];
  return ['place', 'county', 'state', 'country'];
}

function typeToIdentifier(value) {
  const text = String(value || '').trim();
  if (!text) return 'Other';
  return text
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
    .replace(/[^A-Za-z0-9]+(.)/g, (_, ch) => ch.toUpperCase())
    .replace(/^./, (ch) => ch.toUpperCase()) || 'Other';
}

function preserveExtensions(record, node, handledTags) {
  const extensions = (node?.children || [])
    .filter((childNode) => shouldPreserveNode(childNode, handledTags))
    .map(nodeToExtension);
  if (extensions.length) {
    record.fields.gedcomExtensions = { value: extensions, type: 'LIST' };
  }
  if (node?.xref) {
    record.fields.gedcomXref = { value: node.xref, type: 'STRING' };
  }
  return record;
}

function shouldPreserveNode(node, handledTags = new Set()) {
  if (!node?.tag) return false;
  if (node.tag === 'CONC' || node.tag === 'CONT') return false;
  if (node.tag.startsWith('_')) return true;
  return !handledTags.has(node.tag);
}

function nodeToExtension(node) {
  return {
    tag: node.tag,
    value: node.value || '',
    xref: node.xref || null,
    line: node.line || 0,
    children: (node.children || []).map(nodeToExtension),
  };
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

export function buildGedcomDataset(text, { sourceName = 'GEDCOM import', mediaFiles = [], resourceFiles = [] } = {}) {
  const { records, assets } = parseGedcomParts(text, { mediaFiles, resourceFiles });
  const recordMap = Object.fromEntries(records.map((record) => [record.recordName, record]));
  const counts = records.reduce((acc, record) => {
    acc[record.recordType] = (acc[record.recordType] || 0) + 1;
    return acc;
  }, {});
  const analysis = analyzeGedcomText(text);
  return {
    datasetSchemaVersion: DATASET_SCHEMA_VERSION,
    records: recordMap,
    assets,
    counts,
    treeName: sourceName.replace(/\.(ged|uged|uged16|gedcom)$/i, '') || 'GEDCOM import',
    meta: {
      sourceName,
      datasetSchemaVersion: DATASET_SCHEMA_VERSION,
      importFormat: 'gedcom',
      importedAt: new Date().toISOString(),
      gedcom: analysis,
    },
  };
}

function stubPerson(id, indi) {
  const fields = {};
  if (indi.xref) fields.gedcomXref = { value: indi.xref, type: 'STRING' };
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
  return preserveExtensions({ recordName: id, recordType: 'Person', fields }, indi, PERSON_HANDLED_TAGS);
}
function stubFamily(id, fam = null) {
  const fields = {};
  if (fam?.xref) fields.gedcomXref = { value: fam.xref, type: 'STRING' };
  return preserveExtensions({ recordName: id, recordType: 'Family', fields }, fam || { children: [] }, FAMILY_HANDLED_TAGS);
}
function stubSource(id, sour) {
  const fields = {};
  if (sour.xref) fields.gedcomXref = { value: sour.xref, type: 'STRING' };
  const title = nodeText(child(sour, 'TITL'));
  const author = nodeText(child(sour, 'AUTH'));
  const text = nodeText(child(sour, 'TEXT'));
  const publication = nodeText(child(sour, 'PUBL'));
  const abbreviation = nodeText(child(sour, 'ABBR'));
  const note = nodeText(child(sour, 'NOTE'));
  if (title) {
    fields.title = { value: title, type: 'STRING' };
    fields.cached_title = { value: title, type: 'STRING' };
  }
  if (author) fields.author = { value: author, type: 'STRING' };
  if (text) fields.text = { value: text, type: 'STRING' };
  if (publication) fields.publication = { value: publication, type: 'STRING' };
  if (abbreviation) fields.abbreviation = { value: abbreviation, type: 'STRING' };
  if (note) fields.note = { value: note, type: 'STRING' };
  return preserveExtensions({ recordName: id, recordType: 'Source', fields }, sour, SOURCE_HANDLED_TAGS);
}

function stubRepository(id, repo) {
  const fields = {};
  if (repo.xref) fields.gedcomXref = { value: repo.xref, type: 'STRING' };
  const name = nodeText(child(repo, 'NAME'));
  const address = addressFromNode(repo);
  const note = nodeText(child(repo, 'NOTE'));
  if (name) fields.name = { value: name, type: 'STRING' };
  if (address) fields.address = { value: address, type: 'STRING' };
  if (note) fields.note = { value: note, type: 'STRING' };
  const fieldForTag = { PHON: 'phone', EMAIL: 'email', EMAI: 'email', WWW: 'website', URL: 'website' };
  for (const [tag, fieldName] of Object.entries(fieldForTag)) {
    const value = nodeText(child(repo, tag));
    if (value) fields[fieldName] = { value, type: 'STRING' };
  }
  return preserveExtensions({ recordName: id, recordType: 'SourceRepository', fields }, repo, REPOSITORY_HANDLED_TAGS);
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
  return tag.startsWith('_') || ['BIRT', 'DEAT', 'MARR', 'DIV', 'EVEN', 'FACT', 'ADOP', 'BURI', 'RESI', 'OCCU', 'CENS', 'IMMI', 'EMIG', 'NATU', 'EDUC', 'PROP'].includes(tag);
}

function isPointerValue(value) {
  return /^@[^@]+@$/.test(String(value || '').trim());
}

function issue(severity, line, code, message, extra = {}) {
  return makeValidationIssue({
    scope: 'gedcom-import',
    severity,
    line,
    code,
    message,
    ...extra,
  });
}
