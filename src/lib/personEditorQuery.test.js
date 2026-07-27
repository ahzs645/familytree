/**
 * Tests for loadPersonEditorModel — the PersonEditor route's hydration
 * pipeline. Uses fake-indexeddb so the real Dexie-backed LocalDatabase runs
 * in-process, mirroring useRecordEditor.dom.test.jsx.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { getLocalDatabase } from './LocalDatabase.js';
import { refValue } from './recordRef.js';
import { NAME_FIELDS, loadPersonEditorModel } from './personEditorQuery.js';

const PERSON_ID = 'person-editor-query-test';

async function seed(records) {
  const db = getLocalDatabase();
  for (const record of records) await db.saveRecord(record);
}

describe('loadPersonEditorModel', () => {
  beforeEach(async () => {
    await getLocalDatabase().clearAll();
  });

  it('returns null when the person record does not exist', async () => {
    expect(await loadPersonEditorModel('missing-person')).toBeNull();
  });

  it('hydrates the full editor model for a seeded person', async () => {
    await seed([
      {
        recordName: PERSON_ID,
        recordType: 'Person',
        fields: {
          firstName: { value: 'Ahmad', type: 'STRING' },
          lastName: { value: 'Jalil', type: 'STRING' },
          isBookmarked: { value: true, type: 'BOOLEAN' },
          cemetery: { value: 'Old Cemetery', type: 'STRING' },
        },
      },
      {
        recordName: 'an-1',
        recordType: 'AdditionalName',
        fields: {
          person: { value: refValue(PERSON_ID, 'Person'), type: 'REFERENCE' },
          conclusionType: { value: refValue('ConclusionAdditionalNameType_MaidenName', 'ConclusionAdditionalNameType'), type: 'REFERENCE' },
          name: { value: 'Umm Test', type: 'STRING' },
        },
      },
      {
        recordName: 'fact-1',
        recordType: 'PersonFact',
        fields: {
          person: { value: refValue(PERSON_ID, 'Person'), type: 'REFERENCE' },
          conclusionType: { value: refValue('ConclusionPersonFactType_Occupation', 'ConclusionPersonFactType'), type: 'REFERENCE' },
          description: { value: 'Engineer', type: 'STRING' },
          date: { value: '1999', type: 'STRING' },
        },
      },
      {
        recordName: 'note-1',
        recordType: 'Note',
        fields: {
          person: { value: refValue(PERSON_ID, 'Person'), type: 'REFERENCE' },
          text: { value: 'A note about this person', type: 'STRING' },
        },
      },
      {
        recordName: 'pe-1',
        recordType: 'PersonEvent',
        fields: {
          person: { value: refValue(PERSON_ID, 'Person'), type: 'REFERENCE' },
          conclusionType: { value: refValue('Birth', 'ConclusionPersonEventType'), type: 'REFERENCE' },
          date: { value: '1950', type: 'STRING' },
        },
      },
    ]);

    const model = await loadPersonEditorModel(PERSON_ID);

    expect(model).toBeTruthy();
    expect(model.record.recordName).toBe(PERSON_ID);
    expect(Object.keys(model.values).sort()).toEqual(NAME_FIELDS.map((field) => field.id).sort());
    expect(model.values).toMatchObject({ firstName: 'Ahmad', lastName: 'Jalil', nameMiddle: '' });
    expect(model.bookmarked).toBe(true);
    expect(model.isStartPerson).toBe(false);
    expect(model.isPrivate).toBe(false);
    expect(model.isDeceased).toBe(false);
    expect(model.outsideFamily).toBe(false);
    expect(model.grave).toEqual({ cemetery: 'Old Cemetery', cemeteryLocation: '', graveNumber: '' });

    expect(model.additionalNames).toEqual([{ recordName: 'an-1', type: 'MaidenName', value: 'Umm Test' }]);
    expect(model.facts).toEqual([{ recordName: 'fact-1', type: 'Occupation', value: 'Engineer', date: '1999' }]);
    expect(model.notes).toEqual([{ recordName: 'note-1', text: 'A note about this person' }]);
    expect(model.events.map((event) => event.recordName)).toEqual(['pe-1']);
    expect(model.associates).toEqual([]);

    expect(model.evidence.byRecord.has('pe-1')).toBe(true);
    expect(model.evidence.byRecord.has('fact-1')).toBe(true);
    expect(model.allPersons.some((person) => person.recordName === PERSON_ID)).toBe(true);
    expect(model.context?.selfSummary?.recordName).toBe(PERSON_ID);

    expect(model.related).toMatchObject({ media: [], sources: [], todos: [], stories: [], groups: [] });
    expect(model.milkKinships).toEqual([]);
    expect(model.tribalMemberships).toEqual([]);
    expect(Array.isArray(model.labelDefs)).toBe(true);
    expect(Object.values(model.labels).every((flag) => flag === false)).toBe(true);
    expect(model.refNumbers).toBeTypeOf('object');
  });
});
