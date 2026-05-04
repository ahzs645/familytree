import { describe, expect, it } from 'vitest';
import { createSearchIndex, querySearchIndex } from './search.js';

describe('offline search index', () => {
  it('indexes nested record field values and intersects query tokens', () => {
    const index = createSearchIndex([
      {
        recordName: 'p1',
        recordType: 'Person',
        fields: {
          cached_fullName: { value: 'Jane Maria Doe' },
          notes: { value: [{ text: 'Baptized in Glasgow' }] },
        },
      },
      {
        recordName: 'p2',
        recordType: 'Person',
        fields: {
          cached_fullName: { value: 'John Doe' },
          notes: { value: [{ text: 'Moved to London' }] },
        },
      },
    ]);

    expect([...querySearchIndex(index, 'jane glasgow')]).toEqual(['p1']);
    expect([...querySearchIndex(index, 'doe')].sort()).toEqual(['p1', 'p2']);
  });

  it('folds accents for token search', () => {
    const index = createSearchIndex([
      { recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'José Núñez' } } },
    ]);

    expect([...querySearchIndex(index, 'Jose Nunez')]).toEqual(['p1']);
  });

  it('indexes Arabic names under English romanized variants', () => {
    const index = createSearchIndex([
      { recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'أحمد رعد الجليل' } } },
      { recordName: 'p2', recordType: 'Person', fields: { cached_fullName: { value: 'فاطمة الهاشمي' } } },
      { recordName: 'p3', recordType: 'Person', fields: { cached_fullName: { value: 'محمد عبد الله الهاشمي' } } },
      { recordName: 'p4', recordType: 'Person', fields: { cached_fullName: { value: 'علي حسين خالد' } } },
    ]);

    expect([...querySearchIndex(index, 'Ahmad raad jalil')]).toEqual(['p1']);
    expect([...querySearchIndex(index, 'Ahmed Raad Jalil')]).toEqual(['p1']);
    expect([...querySearchIndex(index, 'Mohamed Abdul Allah Hashemi')]).toEqual(['p3']);
    expect([...querySearchIndex(index, '3li Hussain Khaled')]).toEqual(['p4']);
  });
});
