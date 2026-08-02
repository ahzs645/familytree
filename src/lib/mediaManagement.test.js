import { describe, expect, it } from 'vitest';
import {
  groupMediaRecords,
  mediaExportEntries,
  normalizeMediaGalleryPreferences,
  safeMediaFilename,
} from './mediaManagement.js';

function media(recordName, recordType, caption, timestamp) {
  return {
    recordName,
    recordType,
    fields: {
      caption: { value: caption, type: 'STRING' },
      mft_creationDate: { value: timestamp, type: 'TIMESTAMP' },
    },
  };
}

describe('media gallery management', () => {
  it('normalizes persisted gallery preferences', () => {
    expect(normalizeMediaGalleryPreferences({ sortBy: 'bogus', groupBy: 'decade', thumbnailSize: 'huge' })).toEqual({
      sortBy: 'title',
      groupBy: 'decade',
      thumbnailSize: 'medium',
    });
  });

  it('sorts by title and groups media by type', () => {
    const records = [
      media('b', 'MediaPDF', 'Zulu', '2021-02-03T00:00:00Z'),
      media('a', 'MediaPicture', 'Alpha', '2024-01-01T00:00:00Z'),
      media('c', 'MediaPDF', 'Bravo', '2018-01-01T00:00:00Z'),
    ];
    const groups = groupMediaRecords(records, { sortBy: 'title', groupBy: 'type' });
    expect(groups.map((group) => group.value)).toEqual(['MediaPicture', 'MediaPDF']);
    expect(groups[1].records.map((record) => record.recordName)).toEqual(['c', 'b']);
  });

  it('sorts newest first and creates year and decade buckets', () => {
    const records = [
      media('old', 'MediaPicture', 'Old', '1998-01-01T00:00:00Z'),
      media('new', 'MediaPicture', 'New', '2024-03-01T00:00:00Z'),
      media('middle', 'MediaPicture', 'Middle', '2021-05-01T00:00:00Z'),
    ];
    expect(groupMediaRecords(records, { sortBy: 'date', groupBy: 'year' }).map((group) => group.value)).toEqual([2024, 2021, 1998]);
    expect(groupMediaRecords(records, { sortBy: 'date', groupBy: 'decade' }).map((group) => group.value)).toEqual([2020, 1990]);
    expect(groupMediaRecords(records, { sortBy: 'title', groupBy: 'year' }).map((group) => group.value)).toEqual([2024, 2021, 1998]);
  });

  it('builds unique, safe filenames for files and URL records', () => {
    const records = [
      media('one', 'MediaPicture', 'Portrait', '2024-01-01T00:00:00Z'),
      media('two', 'MediaPicture', 'Portrait 2', '2024-01-01T00:00:00Z'),
      { recordName: 'link', recordType: 'MediaURL', fields: { caption: { value: 'Research/site' }, url: { value: 'https://example.test' } } },
    ];
    const entries = mediaExportEntries(records, {
      one: [{ filename: 'photo?.jpg', mimeType: 'image/jpeg', dataBase64: 'YQ==' }],
      two: [{ filename: 'photo?.jpg', mimeType: 'image/jpeg', dataBase64: 'Yg==' }],
    });
    expect(entries.map((entry) => entry.filename)).toEqual(['photo-.jpg', 'photo- (2).jpg', 'Research-site.url']);
    expect(entries[2].text).toContain('URL=https://example.test');
    expect(safeMediaFilename('../bad:name ')).toBe('-bad-name');
  });
});
