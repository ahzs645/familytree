/**
 * GEDCOM 5.5.1 export. Walks the IndexedDB and emits a .ged document.
 * Subset focus: INDI / FAM / EVENT / PLAC / SOUR / NOTE.
 */
import { getLocalDatabase } from './LocalDatabase.js';
import { refToRecordName } from './recordRef.js';
import { isPublicRecord, isLiving, maskLivingDetails, DEFAULT_PRIVACY_POLICY } from './privacy.js';
import { getAuthorInfo } from './authorInfo.js';
import { Gender } from '../models/index.js';

function escape(text) {
  return String(text == null ? '' : text).replace(/\r?\n/g, ' / ');
}

function escapeText(text) {
  return String(text == null ? '' : text).replace(/\r/g, '');
}

export function formatGedcomTextLines(level, tag, value) {
  const text = escapeText(value);
  if (!text) return [];

  const lines = [];
  const paragraphs = text.split('\n');
  appendGedcomChunks(lines, level, tag, paragraphs[0]);
  for (const paragraph of paragraphs.slice(1)) {
    appendGedcomChunks(lines, level + 1, 'CONT', paragraph);
  }
  return lines;
}

function appendGedcomChunks(lines, level, tag, value) {
  const chunks = splitGedcomValue(value);
  lines.push(`${level} ${tag}${chunks[0] ? ` ${chunks[0]}` : ''}`);
  for (const chunk of chunks.slice(1)) {
    lines.push(`${level + 1} CONC ${chunk}`);
  }
}

function splitGedcomValue(value, maxLength = 220) {
  const text = escapeText(value);
  if (!text) return [''];
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks.length ? chunks : [''];
}

function pushText(lines, level, tag, value) {
  lines.push(...formatGedcomTextLines(level, tag, value));
}

export function formatGedcomExtensions(extensions, baseLevel = 1, pointerMap = new Map()) {
  const lines = [];
  for (const extension of normalizeGedcomExtensions(extensions)) {
    appendGedcomExtension(lines, extension, baseLevel, pointerMap);
  }
  return lines;
}

function appendGedcomExtensions(lines, record, baseLevel, pointerMap) {
  lines.push(...formatGedcomExtensions(record?.fields?.gedcomExtensions?.value, baseLevel, pointerMap));
}

function appendGedcomExtension(lines, extension, level, pointerMap) {
  if (!extension?.tag || extension.tag === 'CONC' || extension.tag === 'CONT') return;
  const value = rewritePointer(extension.value || '', pointerMap);
  const xref = extension.xref ? `${extension.xref} ` : '';
  lines.push(`${level} ${xref}${extension.tag}${value ? ` ${escapeText(value)}` : ''}`);
  for (const child of normalizeGedcomExtensions(extension.children)) {
    appendGedcomExtension(lines, child, level + 1, pointerMap);
  }
}

function normalizeGedcomExtensions(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && item.tag);
}

function rewritePointer(value, pointerMap) {
  const text = String(value || '');
  return pointerMap.has(text) ? pointerMap.get(text) : text;
}

function id(prefix, n) { return `@${prefix}${n}@`; }

const EVENT_TAG = {
  Birth: 'BIRT', Death: 'DEAT', Burial: 'BURI', Christening: 'CHR', Baptism: 'BAPM',
  Adoption: 'ADOP', Naturalization: 'NATU', Emigration: 'EMIG', Immigration: 'IMMI',
  Census: 'CENS', Graduation: 'GRAD', Occupation: 'OCCU', Residence: 'RESI',
  Religion: 'RELI', Will: 'WILL', Probate: 'PROB',
};
const FAMILY_EVENT_TAG = {
  Marriage: 'MARR', MarriageCivil: 'MARR', MarriageReligion: 'MARR',
  Divorced: 'DIV', Engagement: 'ENGA', Annuled: 'ANUL',
};

function eventTag(conclusion) {
  return EVENT_TAG[conclusion] || FAMILY_EVENT_TAG[conclusion] || 'EVEN';
}

export async function buildGedcom(exportOptions = {}) {
  const policy = {
    ...DEFAULT_PRIVACY_POLICY,
    hideLivingPersons: !!exportOptions.hideLiving,
    hideLivingDetailsOnly: !!exportOptions.hideLivingDetailsOnly,
    livingPersonThresholdYears: Number.isFinite(+exportOptions.livingThresholdYears) ? +exportOptions.livingThresholdYears : DEFAULT_PRIVACY_POLICY.livingPersonThresholdYears,
  };
  const passesLiving = (record) => !policy.hideLivingPersons || policy.hideLivingDetailsOnly || !isLiving(record, policy.livingPersonThresholdYears);
  const maskIfNeeded = (record) => (policy.hideLivingDetailsOnly ? maskLivingDetails(record, policy) : record);

  const db = getLocalDatabase();
  const rawPersons = (await db.query('Person', { limit: 100000 })).records;
  const rawFamilies = (await db.query('Family', { limit: 100000 })).records;
  const rawPlaces = (await db.query('Place', { limit: 100000 })).records;
  const rawSources = (await db.query('Source', { limit: 100000 })).records;
  const rawPersonEvents = (await db.query('PersonEvent', { limit: 100000 })).records;
  const rawFamilyEvents = (await db.query('FamilyEvent', { limit: 100000 })).records;
  const rawNotes = (await db.query('Note', { limit: 100000 })).records;
  const rawChildRels = (await db.query('ChildRelation', { limit: 100000 })).records;

  const persons = rawPersons.filter((record) => isPublicRecord(record) && passesLiving(record)).map(maskIfNeeded);
  const publicPersonIds = new Set(persons.map((p) => p.recordName));
  const families = rawFamilies.filter((fam) => isPublicRecord(fam) && familyHasPublicMember(fam, rawChildRels, publicPersonIds));
  const publicFamilyIds = new Set(families.map((f) => f.recordName));
  const places = rawPlaces.filter(isPublicRecord);
  const sources = rawSources.filter(isPublicRecord);
  const personEvents = rawPersonEvents.filter((event) => (
    isPublicRecord(event) && publicPersonIds.has(refToRecordName(event.fields?.person?.value))
  ));
  const familyEvents = rawFamilyEvents.filter((event) => (
    isPublicRecord(event) && publicFamilyIds.has(refToRecordName(event.fields?.family?.value))
  ));
  const notes = rawNotes.filter(isPublicRecord);
  const childRels = rawChildRels.filter((rel) => {
    const family = refToRecordName(rel.fields?.family?.value);
    const child = refToRecordName(rel.fields?.child?.value);
    return family && child && publicFamilyIds.has(family) && publicPersonIds.has(child);
  });

  const personIdx = new Map(persons.map((p, i) => [p.recordName, i + 1]));
  const familyIdx = new Map(families.map((f, i) => [f.recordName, i + 1]));
  const sourceIdx = new Map(sources.map((s, i) => [s.recordName, i + 1]));
  const placeIdx = new Map(places.map((p, i) => [p.recordName, i + 1]));
  const pointerMap = buildGedcomPointerMap({ persons, families, sources, personIdx, familyIdx, sourceIdx });

  const author = await safeGetAuthorInfo();

  const lines = [];
  // Header
  lines.push('0 HEAD');
  lines.push('1 SOUR CloudTreeWeb');
  if (author?.organization) lines.push(`2 CORP ${escape(author.organization)}`);
  lines.push('1 GEDC');
  lines.push('2 VERS 5.5.1');
  lines.push('2 FORM LINEAGE-LINKED');
  lines.push('1 CHAR UTF-8');
  lines.push('1 DATE ' + new Date().toISOString().slice(0, 10));
  if (author?.treeName) lines.push(`1 FILE ${escape(author.treeName)}`);
  if (author?.copyright) lines.push(`1 COPR ${escape(author.copyright)}`);
  if (author?.notes) pushText(lines, 1, 'NOTE', author.notes);
  // Submitter pointer — SUBM record is required by GEDCOM 5.5.1 when author info is present.
  const hasSubmitter = !!(author && (author.authorName || author.email || author.address1 || author.city || author.phone || author.website));
  if (hasSubmitter) lines.push('1 SUBM @SUBM1@');

  // Submitter record (GEDCOM 5.5.1: HEAD.SUBM points here)
  if (hasSubmitter) {
    lines.push('0 @SUBM1@ SUBM');
    lines.push(`1 NAME ${escape(author.authorName || author.organization || 'Submitter')}`);
    const addrLines = [author.address1, author.address2].filter(Boolean);
    if (addrLines.length || author.city || author.region || author.postalCode || author.country) {
      const primary = addrLines[0] || '';
      pushText(lines, 1, 'ADDR', primary);
      if (addrLines[1]) pushText(lines, 2, 'CONT', addrLines[1]);
      if (author.city) lines.push(`2 CITY ${escape(author.city)}`);
      if (author.region) lines.push(`2 STAE ${escape(author.region)}`);
      if (author.postalCode) lines.push(`2 POST ${escape(author.postalCode)}`);
      if (author.country) lines.push(`2 CTRY ${escape(author.country)}`);
    }
    if (author.phone) lines.push(`1 PHON ${escape(author.phone)}`);
    if (author.email) lines.push(`1 EMAIL ${escape(author.email)}`);
    if (author.website) lines.push(`1 WWW ${escape(author.website)}`);
  }

  // Persons
  for (const p of persons) {
    const f = p.fields || {};
    lines.push(`0 ${id('I', personIdx.get(p.recordName))} INDI`);
    const first = f.firstName?.value || '';
    const middle = f.nameMiddle?.value || '';
    const last = f.lastName?.value || '';
    const given = [first, middle].filter(Boolean).join(' ');
    lines.push(`1 NAME ${escape(given)} /${escape(last)}/`);
    if (given) lines.push(`2 GIVN ${escape(given)}`);
    if (last) lines.push(`2 SURN ${escape(last)}`);
    const g = f.gender?.value;
    if (g === Gender.Male) lines.push('1 SEX M');
    else if (g === Gender.Female) lines.push('1 SEX F');
    appendGedcomExtensions(lines, p, 1, pointerMap);

    // Birth/death from cached fields
    if (f.cached_birthDate?.value) {
      lines.push('1 BIRT');
      lines.push(`2 DATE ${escape(f.cached_birthDate.value)}`);
    }
    if (f.cached_deathDate?.value) {
      lines.push('1 DEAT');
      lines.push(`2 DATE ${escape(f.cached_deathDate.value)}`);
    }

    // Person events
    for (const ev of personEvents.filter((e) => refToRecordName(e.fields?.person?.value) === p.recordName)) {
      const tag = eventTag(refToRecordName(ev.fields?.conclusionType?.value) || ev.fields?.eventType?.value);
      lines.push(`1 ${tag}`);
      if (ev.fields?.date?.value) lines.push(`2 DATE ${escape(ev.fields.date.value)}`);
      const placeRef = refToRecordName(ev.fields?.place?.value) || refToRecordName(ev.fields?.assignedPlace?.value);
      const place = placeRef && places.find((x) => x.recordName === placeRef);
      if (place) {
        const name = place.fields?.cached_normallocationString?.value || place.fields?.placeName?.value;
        if (name) lines.push(`2 PLAC ${escape(name)}`);
      }
      if (ev.fields?.description?.value) pushText(lines, 2, 'NOTE', ev.fields.description.value);
      appendGedcomExtensions(lines, ev, 2, pointerMap);
    }

    // Family pointers
    for (const fam of families) {
      const manRef = refToRecordName(fam.fields?.man?.value);
      const womanRef = refToRecordName(fam.fields?.woman?.value);
      if (manRef === p.recordName || womanRef === p.recordName) {
        lines.push(`1 FAMS ${id('F', familyIdx.get(fam.recordName))}`);
      }
    }
    for (const cr of childRels) {
      const child = refToRecordName(cr.fields?.child?.value);
      const fam = refToRecordName(cr.fields?.family?.value);
      if (child === p.recordName && familyIdx.has(fam)) {
        lines.push(`1 FAMC ${id('F', familyIdx.get(fam))}`);
      }
    }

    // Notes
    for (const n of notes.filter((x) => refToRecordName(x.fields?.person?.value) === p.recordName)) {
      const text = n.fields?.text?.value || '';
      if (text) pushText(lines, 1, 'NOTE', text);
    }
  }

  // Families
  for (const fam of families) {
    lines.push(`0 ${id('F', familyIdx.get(fam.recordName))} FAM`);
    const m = refToRecordName(fam.fields?.man?.value);
    const w = refToRecordName(fam.fields?.woman?.value);
    if (m && personIdx.has(m)) lines.push(`1 HUSB ${id('I', personIdx.get(m))}`);
    if (w && personIdx.has(w)) lines.push(`1 WIFE ${id('I', personIdx.get(w))}`);
    appendGedcomExtensions(lines, fam, 1, pointerMap);
    for (const cr of childRels.filter((cr) => refToRecordName(cr.fields?.family?.value) === fam.recordName)) {
      const c = refToRecordName(cr.fields?.child?.value);
      if (c && personIdx.has(c)) lines.push(`1 CHIL ${id('I', personIdx.get(c))}`);
    }
    if (fam.fields?.cached_marriageDate?.value) {
      lines.push('1 MARR');
      lines.push(`2 DATE ${escape(fam.fields.cached_marriageDate.value)}`);
    }
    for (const ev of familyEvents.filter((e) => refToRecordName(e.fields?.family?.value) === fam.recordName)) {
      const tag = eventTag(refToRecordName(ev.fields?.conclusionType?.value) || ev.fields?.eventType?.value);
      lines.push(`1 ${tag}`);
      if (ev.fields?.date?.value) lines.push(`2 DATE ${escape(ev.fields.date.value)}`);
      appendGedcomExtensions(lines, ev, 2, pointerMap);
    }
  }

  // Sources
  for (const s of sources) {
    lines.push(`0 ${id('S', sourceIdx.get(s.recordName))} SOUR`);
    if (s.fields?.title?.value) lines.push(`1 TITL ${escape(s.fields.title.value)}`);
    if (s.fields?.author?.value) lines.push(`1 AUTH ${escape(s.fields.author.value)}`);
    if (s.fields?.publication?.value) pushText(lines, 1, 'PUBL', s.fields.publication.value);
    if (s.fields?.text?.value) pushText(lines, 1, 'TEXT', s.fields.text.value);
    appendGedcomExtensions(lines, s, 1, pointerMap);
  }

  lines.push('0 TRLR');
  return lines.join('\n');
}

function buildGedcomPointerMap({ persons, families, sources, personIdx, familyIdx, sourceIdx }) {
  const pointerMap = new Map();
  for (const person of persons) {
    const xref = person.fields?.gedcomXref?.value;
    if (xref) pointerMap.set(xref, id('I', personIdx.get(person.recordName)));
  }
  for (const family of families) {
    const xref = family.fields?.gedcomXref?.value;
    if (xref) pointerMap.set(xref, id('F', familyIdx.get(family.recordName)));
  }
  for (const source of sources) {
    const xref = source.fields?.gedcomXref?.value;
    if (xref) pointerMap.set(xref, id('S', sourceIdx.get(source.recordName)));
  }
  return pointerMap;
}

async function safeGetAuthorInfo() {
  try {
    return await getAuthorInfo();
  } catch {
    return null;
  }
}

function familyHasPublicMember(family, childRels, publicPersonIds) {
  const man = refToRecordName(family.fields?.man?.value);
  const woman = refToRecordName(family.fields?.woman?.value);
  if ((man && publicPersonIds.has(man)) || (woman && publicPersonIds.has(woman))) return true;
  return childRels.some((rel) => (
    refToRecordName(rel.fields?.family?.value) === family.recordName &&
    publicPersonIds.has(refToRecordName(rel.fields?.child?.value))
  ));
}

export async function downloadGedcom() {
  const text = await buildGedcom();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudtreeweb-${new Date().toISOString().slice(0, 10)}.ged`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
