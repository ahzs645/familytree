import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({ records: [] }));

vi.mock('./data/AppDataClient.js', () => ({
  getAppDataClient: () => ({
    records: {
      get: async (id) => mockState.records.find((record) => record.recordName === id) || null,
      query: async (type, options = {}) => ({
        records: mockState.records.filter((record) => (
          record.recordType === type
          && (!options.referenceField || String(record.fields?.[options.referenceField]?.value || '').split('---')[0] === options.referenceValue)
        )),
      }),
      personsParents: async () => [],
      childrenInformation: async () => [],
    },
  }),
}));

import { compileBook } from './books.js';

describe('localized book report sections', () => {
  beforeEach(() => {
    mockState.records = [{
      recordName: 'p1',
      recordType: 'Person',
      fields: {
        cached_fullName: { value: 'Jane Doe' },
        cached_birthDate: { value: '1900' },
        gender: { value: 1 },
      },
    }];
  });

  it('uses the book output locale for a generated report AST', async () => {
    const report = await compileBook({
      title: 'Family Book',
      outputLanguage: 'ar',
      sections: [{
        kind: 'person-summary',
        targetRecordName: 'p1',
        includeSources: false,
      }],
    });

    const title = report.blocks.find((entry) => entry.kind === 'title');
    const vital = report.blocks.find((entry) => entry.kind === 'list');
    expect(title.text).toBe('Jane Doe');
    expect(vital.items).toContain('ميلاد: 1900');
    expect(vital.items.some((item) => item.startsWith('الجنس:'))).toBe(true);
  });

  it('applies a list section scope and person filter during compilation', async () => {
    mockState.records.push({
      recordName: 'p2',
      recordType: 'Person',
      fields: {
        cached_fullName: { value: 'John Doe' },
        cached_birthDate: { value: '1890' },
        cached_deathDate: { value: '1970' },
        isPrivate: { value: true },
      },
    });
    const report = await compileBook({
      title: 'Filtered Book',
      sections: [{
        kind: 'persons-list',
        targetRecordName: 'p2',
        scope: 'selected',
        personFilter: 'deceased',
        sort: 'birth-desc',
        includePrivate: true,
      }],
    });

    const table = report.blocks.find((entry) => entry.kind === 'table');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0][0]).toBe('John Doe');
  });
});
