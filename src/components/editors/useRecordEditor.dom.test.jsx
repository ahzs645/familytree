// @vitest-environment jsdom
/**
 * DOM smoke tests for useRecordEditor — the shared master-detail controller.
 * Uses fake-indexeddb so the real Dexie-backed LocalDatabase runs in-process;
 * one hook test covers the scaffolding shared by all 11 CRUD routes.
 */
import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { invalidateRecords } from '../../lib/data/useRecords.js';
import { ModalProvider } from '../../contexts/ModalContext.jsx';
import { useRecordEditor } from './useRecordEditor.js';

const OPTS = {
  recordType: 'Label',
  noun: 'label',
  idPrefix: 'label',
  fields: ['title', 'note'],
  labelOf: (record) => record?.fields?.title?.value || record?.recordName || '',
};

function Harness({ onEditor }) {
  const editor = useRecordEditor(OPTS);
  onEditor(editor);
  return null;
}

function renderEditor() {
  const ref = { current: null };
  render(
    <MemoryRouter>
      <ModalProvider>
        <Harness onEditor={(editor) => { ref.current = editor; }} />
      </ModalProvider>
    </MemoryRouter>,
  );
  return ref;
}

async function seedLabel(recordName, title) {
  await getLocalDatabase().saveRecord({
    recordName,
    recordType: 'Label',
    fields: { title: { value: title, type: 'STRING' } },
  });
}

describe('useRecordEditor', () => {
  beforeEach(async () => {
    await getLocalDatabase().clearAll();
    invalidateRecords('*');
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads rows sorted by label and selects the first', async () => {
    await seedLabel('label-b', 'Beta');
    await seedLabel('label-a', 'Alpha');
    const editor = renderEditor();
    await waitFor(() => expect(editor.current.rows).toHaveLength(2));
    expect(editor.current.rows.map((r) => r.fields.title.value)).toEqual(['Alpha', 'Beta']);
    expect(editor.current.activeId).toBe('label-a');
    expect(editor.current.values.title).toBe('Alpha');
  });

  it('creates a record with a change-log entry and selects it', async () => {
    const editor = renderEditor();
    await waitFor(() => expect(editor.current.loading).toBe(false));
    await act(() => editor.current.onCreate());
    await waitFor(() => expect(editor.current.rows).toHaveLength(1));
    expect(editor.current.activeId).toBe(editor.current.rows[0].recordName);
    const log = await getLocalDatabase().query('ChangeLogEntry', { limit: 100 });
    expect(log.records.length).toBeGreaterThan(0);
  });

  it('saves edited values through the change log and clears dirty', async () => {
    await seedLabel('label-a', 'Alpha');
    const editor = renderEditor();
    await waitFor(() => expect(editor.current.activeId).toBe('label-a'));
    act(() => editor.current.setValues({ ...editor.current.values, title: 'Renamed' }));
    await waitFor(() => expect(editor.current.dirty).toBe(true));
    await act(() => editor.current.onSave());
    await waitFor(() => {
      const row = editor.current.rows.find((r) => r.recordName === 'label-a');
      expect(row?.fields?.title?.value).toBe('Renamed');
    });
    expect(editor.current.status).toBe('Saved');
    const log = await getLocalDatabase().query('ChangeLogEntry', { limit: 100 });
    expect(log.records.length).toBeGreaterThan(0);
  });

  it('refuses to save a locked record', async () => {
    await getLocalDatabase().saveRecord({
      recordName: 'label-a',
      recordType: 'Label',
      fields: { title: { value: 'Alpha', type: 'STRING' }, locked: { value: 1, type: 'INT64' } },
    });
    invalidateRecords('*');
    const editor = renderEditor();
    await waitFor(() => expect(editor.current.activeId).toBe('label-a'));
    await act(() => editor.current.onSave());
    expect(editor.current.status).toMatch(/Unlock this label/);
  });

  it('deletes after confirm and reselects the next row', async () => {
    await seedLabel('label-a', 'Alpha');
    await seedLabel('label-b', 'Beta');
    const editor = renderEditor();
    await waitFor(() => expect(editor.current.rows).toHaveLength(2));
    // modal.confirm resolves when the rendered dialog's OK button is clicked,
    // so start the delete without awaiting it, then click through the dialog.
    let deletePromise;
    act(() => { deletePromise = editor.current.onDelete(); });
    await waitFor(() => expect(document.body.textContent).toContain('Delete label'));
    const okButton = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Delete');
    expect(okButton).toBeTruthy();
    act(() => okButton.click());
    await deletePromise;
    await waitFor(() => expect(editor.current.rows).toHaveLength(1));
    expect(editor.current.activeId).toBe('label-b');
  });
});
