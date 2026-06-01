import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySourceRelationLineageFields,
  getCitationLineage,
  recordLineageEvent,
} from './sourceLineage.js';

const mockState = vi.hoisted(() => ({ db: null }));

vi.mock('./LocalDatabase.js', () => ({
  getLocalDatabase: () => mockState.db,
}));

describe('sourceLineage', () => {
  beforeEach(() => {
    mockState.db = createMockDb([
      { recordName: 's1', recordType: 'Source', fields: { title: { value: 'Census' } } },
      { recordName: 'p1', recordType: 'Person', fields: { cached_fullName: { value: 'Jane Doe' } } },
      { recordName: 'lb1', recordType: 'LineageBatch', fields: { kind: { value: 'manualEdit' }, summary: { value: 'Manual edit' } } },
      {
        recordName: 'sr1',
        recordType: 'SourceRelation',
        fields: {
          source: { value: 's1---Source', type: 'REFERENCE' },
          target: { value: 'p1---Person', type: 'REFERENCE' },
          targetType: { value: 'Person' },
          lineageBatch: { value: 'lb1---LineageBatch', type: 'REFERENCE' },
        },
      },
      {
        recordName: 'le1',
        recordType: 'LineageEvent',
        fields: {
          eventType: { value: 'created' },
          timestamp: { value: '2026-01-01T00:00:00.000Z' },
          sourceRelation: { value: 'sr1---SourceRelation', type: 'REFERENCE' },
          lineageBatch: { value: 'lb1---LineageBatch', type: 'REFERENCE' },
        },
      },
    ]);
  });

  it('hydrates a citation lineage path from relation to source target events and batch', async () => {
    const lineage = await getCitationLineage('sr1');
    expect(lineage.source.recordName).toBe('s1');
    expect(lineage.target.recordName).toBe('p1');
    expect(lineage.batch.recordName).toBe('lb1');
    expect(lineage.events.map((event) => event.recordName)).toEqual(['le1']);
  });

  it('records lineage events and applies SourceRelation lineage fields', async () => {
    const rel = { recordName: 'sr2', recordType: 'SourceRelation', fields: { source: { value: 's1---Source', type: 'REFERENCE' }, target: { value: 'p1---Person', type: 'REFERENCE' } } };
    const event = await recordLineageEvent({ eventType: 'created', operation: 'manualEdit', sourceRelation: rel, lineageBatch: 'lb1' });
    const stamped = applySourceRelationLineageFields(rel, { lineageBatch: 'lb1', operation: 'manualEdit', createdByEvent: event.recordName });
    expect(stamped.fields.lineageBatch.value).toBe('lb1---LineageBatch');
    expect(stamped.fields.lineageCreatedByEvent.value).toBe(`${event.recordName}---LineageEvent`);
    expect(mockState.db.records.has(event.recordName)).toBe(true);
  });
});

function createMockDb(records) {
  const map = new Map(records.map((record) => [record.recordName, record]));
  return {
    records: map,
    async getRecord(recordName) {
      return map.get(recordName) || null;
    },
    async saveRecord(record) {
      map.set(record.recordName, record);
      return record;
    },
    async query(recordType, options = {}) {
      let rows = [...map.values()].filter((record) => record.recordType === recordType);
      if (options.referenceField && options.referenceValue) {
        rows = rows.filter((record) => String(record.fields?.[options.referenceField]?.value || '').split('---')[0] === options.referenceValue);
      }
      return { records: rows.slice(0, options.limit || 500), hasMore: false };
    },
  };
}
