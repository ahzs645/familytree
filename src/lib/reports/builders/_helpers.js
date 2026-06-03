/**
 * Internal helpers shared across the per-domain report builders.
 *
 * These are intentionally not part of the package's public surface — only
 * the builder files in this folder import them. Pure data shaping; no
 * IO in here, and no dependency on report AST shapes (that lives in
 * each builder).
 */
import { getLocalDatabase } from '../../LocalDatabase.js';
import { readConclusionType, readField, readRef, refType } from '../../schema.js';
import { personSummary, familySummary, placeSummary, sourceSummary, lifeSpanLabel, genderLabel } from '../../../models/index.js';
import { humanizeType } from '../../../utils/humanizeType.js';
import { block } from '../ast.js';

export function nameOf(summaryOrPerson) {
  return summaryOrPerson?.fullName || 'No name recorded';
}

export function nameOrFallback(summaryOrPerson, fallback) {
  return summaryOrPerson?.fullName || fallback || 'No name recorded';
}

export function spanAnnotated(summary) {
  const label = lifeSpanLabel(summary);
  return label ? `(${label})` : '';
}

// Re-exported from models so the builder files that import it from here keep working.
export { genderLabel };

export function relationNameAt(gen, path) {
  const last = path.slice(-1);
  const parent = last === 'F' ? 'Father' : last === 'M' ? 'Mother' : 'Parent';
  if (gen === 1) return parent;
  if (gen === 2) return `Grand${parent.toLowerCase()}`;
  if (gen === 3) return `Great-grand${parent.toLowerCase()}`;
  const greats = gen - 2;
  return `${greats}×-great-grand${parent.toLowerCase()}`;
}

export async function eventOwnerLabel(db, eventRecord) {
  const personId = readRef(eventRecord.fields?.person);
  if (personId) {
    const person = await db.getRecord(personId);
    return personSummary(person)?.fullName || personId;
  }
  const familyId = readRef(eventRecord.fields?.family);
  if (familyId) {
    const family = await db.getRecord(familyId);
    return familySummary(family)?.familyName || familyId;
  }
  return '';
}

export async function placeLabel(db, placeId) {
  if (!placeId) return '';
  const place = await db.getRecord(placeId);
  const summary = placeSummary(place);
  return summary?.displayName || summary?.name || placeId;
}

export function familyNameOf(summary) {
  return summary?.familyName || summary?.recordName || 'Family';
}

export function addFamilyContext(contexts, familyId, label) {
  if (!familyId) return;
  const current = contexts.get(familyId);
  if (!current) {
    contexts.set(familyId, label || 'Family event');
    return;
  }
  if (label && !current.split('; ').includes(label)) {
    contexts.set(familyId, `${current}; ${label}`);
  }
}

export function parentFamilyContextLabel(family) {
  const parents = [family.man, family.woman].filter(Boolean).map(nameOf).join(' and ');
  if (parents) return `Child in family of ${parents}`;
  return `Child in ${familyNameOf(family.familySummary)}`;
}

export function spouseFamilyContextLabel(family) {
  if (family.partner) return `Family with ${nameOf(family.partner)}`;
  return familyNameOf(family.familySummary);
}

export async function eventReportRow(db, event, context) {
  const place = await placeLabel(db, readRef(event.fields?.place) || readRef(event.fields?.assignedPlace));
  return [
    eventTypeLabel(event),
    eventDate(event),
    place,
    trimText(eventDescription(event), 140),
    context || '',
  ];
}

export function eventTypeLabel(event) {
  return humanizeType(readConclusionType(event) || readField(event, ['eventType', 'factType', 'type'], 'Event')) || 'Event';
}

export function eventDate(event) {
  return readField(event, ['date', 'cached_dateAsDate', 'dateString'], '');
}

export function eventDescription(event) {
  return readField(event, ['description', 'userDescription', 'text', 'note'], '');
}

export function storyTitle(record) {
  return readField(record, ['title', 'name'], record?.recordName || 'Story');
}

export function storySectionTitle(section, index) {
  return readField(section, ['title', 'name'], `Section ${index + 1}`);
}

export function appendTextParagraphs(report, text, fallback = '') {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    if (fallback) report.blocks.push(block.paragraph(fallback));
    return;
  }
  for (const paragraph of paragraphs) report.blocks.push(block.paragraph(paragraph));
}

export async function storyRelationRow(db, relation, scope) {
  const targetId = readRef(relation.fields?.target);
  const target = targetId ? await db.getRecord(targetId) : null;
  const targetType = readField(relation, ['targetType'], target?.recordType || refType(relation.fields?.target) || 'Record');
  return [
    scope,
    targetTypeLabel(targetType),
    recordDisplayLabel(target) || targetId || relation.recordName,
    targetId || '',
  ];
}

export function targetTypeLabel(type) {
  const labels = {
    Person: 'Person',
    Family: 'Family',
    PersonEvent: 'Person Event',
    FamilyEvent: 'Family Event',
    MediaPicture: 'Picture',
    MediaPDF: 'PDF',
    MediaURL: 'URL',
    MediaAudio: 'Audio',
    MediaVideo: 'Video',
  };
  return labels[type] || humanizeType(type) || 'Record';
}

export function recordDisplayLabel(record) {
  if (!record) return '';
  if (record.recordType === 'Person') return personSummary(record)?.fullName || record.recordName;
  if (record.recordType === 'Family') return familySummary(record)?.familyName || record.recordName;
  if (record.recordType === 'Place') return placeSummary(record)?.displayName || placeSummary(record)?.name || record.recordName;
  if (record.recordType === 'Source') return sourceSummary(record)?.title || record.recordName;
  if (record.recordType === 'Story') return storyTitle(record);
  if (record.recordType === 'PersonEvent' || record.recordType === 'FamilyEvent') {
    return [eventTypeLabel(record), eventDate(record)].filter(Boolean).join(' - ') || record.recordName;
  }
  if (String(record.recordType || '').startsWith('Media')) {
    return readField(record, ['title', 'caption', 'filename', 'url'], record.recordName);
  }
  return readField(record, ['title', 'name', 'cached_fullName', 'cached_familyName'], record.recordName);
}

export function pathEdgeLabel(edge) {
  switch (edge) {
    case 'parent': return 'Parent of previous';
    case 'child': return 'Child of previous';
    case 'spouse': return 'Spouse of previous';
    case 'self': return 'Self';
    default: return 'Related';
  }
}

export function addAnniversary(rows, person, type, rawDate) {
  const match = String(rawDate || '').match(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  if (!person || !match) return;
  const monthDay = `${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  rows.push([monthDay, type, person.fullName, match[1] || '']);
}

export function addTodayRow(rows, todayKey, person, type, rawDate) {
  const match = String(rawDate || '').match(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  if (!person || !match) return;
  const key = `${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  if (key === todayKey) rows.push([type, person.fullName, rawDate]);
}

export function trimText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export { getLocalDatabase, readField, readRef, refType, readConclusionType, personSummary, familySummary, placeSummary, sourceSummary, lifeSpanLabel, humanizeType };
