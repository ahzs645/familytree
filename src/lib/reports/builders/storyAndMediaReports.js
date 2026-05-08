/**
 * Story-format and media-centric reports — story details with sections
 * and relations, the global media gallery, and the merged person+family
 * timeline.
 */
import { compareStrings } from '../../i18n.js';
import { block, emptyReport } from '../ast.js';
import {
  appendTextParagraphs,
  eventOwnerLabel,
  getLocalDatabase,
  placeLabel,
  readConclusionType,
  readField,
  readRef,
  storySectionTitle,
  storyTitle,
  storyRelationRow,
  trimText,
} from './_helpers.js';

/**
 * STORY REPORT — metadata, narrative sections, and related records.
 */
export async function buildStoryReport(recordName) {
  const db = getLocalDatabase();
  const story = recordName ? await db.getRecord(recordName) : null;
  if (!story || story.recordType !== 'Story') return emptyReport('Story not found');

  const title = storyTitle(story);
  const report = emptyReport(`Story Report — ${title}`);
  report.blocks.push(block.title(report.title, 1));

  report.blocks.push(block.title('Metadata', 2));
  report.blocks.push(
    block.table(
      ['Field', 'Value'],
      [
        ['Title', title],
        ['Subtitle', readField(story, ['subtitle'])],
        ['Author', readField(story, ['author', 'authorName'])],
        ['Date', readField(story, ['date', 'dateString'])],
        ['Record ID', story.recordName],
        ['Unique ID', readField(story, ['uniqueID', 'identifier'])],
      ]
    )
  );

  const storyText = readField(story, ['text', 'description', 'userDescription'], '');
  if (storyText) {
    report.blocks.push(block.title('Story Text', 2));
    appendTextParagraphs(report, storyText);
  }

  const { records: sectionRecords } = await db.query('StorySection', {
    referenceField: 'story',
    referenceValue: story.recordName,
    limit: 100000,
  });
  const sections = (sectionRecords || []).sort((a, b) => Number(readField(a, ['order'], 0)) - Number(readField(b, ['order'], 0)));

  report.blocks.push(block.title('Sections', 2));
  if (sections.length === 0) {
    report.blocks.push(block.paragraph('No story sections recorded.'));
  } else {
    sections.forEach((section, index) => {
      report.blocks.push(block.title(storySectionTitle(section, index), 3));
      appendTextParagraphs(report, readField(section, ['text', 'description'], ''), 'No section text recorded.');
    });
  }

  const relationRows = [];
  const { records: storyRelations } = await db.query('StoryRelation', {
    referenceField: 'story',
    referenceValue: story.recordName,
    limit: 100000,
  });
  for (const relation of storyRelations || []) {
    relationRows.push(await storyRelationRow(db, relation, 'Story'));
  }

  for (const [index, section] of sections.entries()) {
    const { records: sectionRelations } = await db.query('StorySectionRelation', {
      referenceField: 'storySection',
      referenceValue: section.recordName,
      limit: 100000,
    });
    const scope = `Section: ${storySectionTitle(section, index)}`;
    for (const relation of sectionRelations || []) {
      relationRows.push(await storyRelationRow(db, relation, scope));
    }
  }

  relationRows.sort(
    (a, b) =>
      compareStrings(a[0], b[0]) ||
      compareStrings(a[1], b[1]) ||
      compareStrings(a[2], b[2])
  );

  report.blocks.push(block.title('Relations', 2));
  report.blocks.push(block.table(['Scope', 'Target Type', 'Target', 'Record ID'], relationRows));
  return report;
}

export async function buildMediaGalleryReport() {
  const db = getLocalDatabase();
  const mediaTypes = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];
  const rows = [];
  for (const type of mediaTypes) {
    const { records } = await db.query(type, { limit: 100000 });
    for (const media of records) {
      rows.push([
        type.replace('Media', ''),
        readField(media, ['title', 'caption', 'filename'], media.recordName),
        readField(media, ['date'], ''),
        readField(media, ['url', 'pictureFileIdentifier', 'thumbnailFileIdentifier', 'pdfFileIdentifier', 'audioFileIdentifier', 'videoFileIdentifier'], ''),
      ]);
    }
  }
  const report = emptyReport('Media Gallery Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Type', 'Title', 'Date', 'File / URL'], rows.sort((a, b) => compareStrings(a[1], b[1]))));
  return report;
}

export async function buildTimelineReport() {
  const db = getLocalDatabase();
  const [personEvents, familyEvents] = await Promise.all([
    db.query('PersonEvent', { limit: 100000 }),
    db.query('FamilyEvent', { limit: 100000 }),
  ]);
  const rows = [];
  for (const event of [...personEvents.records, ...familyEvents.records]) {
    rows.push([
      readField(event, ['date'], ''),
      readConclusionType(event) || 'Event',
      await eventOwnerLabel(db, event),
      await placeLabel(db, readRef(event.fields?.place) || readRef(event.fields?.assignedPlace)),
      trimText(readField(event, ['description', 'text'], ''), 90),
    ]);
  }
  const report = emptyReport('Timeline Report');
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.table(['Date', 'Type', 'Owner', 'Place', 'Description'], rows.sort((a, b) => compareStrings(a[0], b[0]))));
  return report;
}
