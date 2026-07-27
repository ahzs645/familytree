/**
 * useRecordEditor — the shared controller for master-detail record editors
 * (Labels, Sources, Events, DNA results, Stories, …).
 *
 * Every one of those screens used to reimplement the same reload/create/
 * save/delete/dirty/lock/status scaffolding with small unintentional
 * differences (some lost record locking, some lost dirty tracking). This
 * hook is the single implementation; routes provide the record shape and
 * render the fields.
 *
 * Contract:
 *   const editor = useRecordEditor({
 *     recordType: 'DNATestResult',
 *     noun: 'DNA result',            // used in status + confirm messages
 *     idPrefix: 'dna',               // new-record id prefix
 *     fields: ['testName', …],       // STRING fields mirrored into values
 *     refFields: { person: 'Person' }, // REFERENCE fields (name → recordType)
 *     labelOf: (record) => string,   // list label; default sort key
 *     sortRows,                      // optional (a, b) comparator override
 *     createValues: () => ({ … }),   // plain values for a new record
 *     toValues,                      // optional (record) => values override
 *     applyValues,                   // optional (record, values) => next override
 *   });
 *
 * Returns { rows, active, activeId, setActiveId, values, setValues, dirty,
 * saving, status, setStatus, loadSeq, reload, onCreate, onSave, onDelete,
 * onToggleLock }.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readRef } from '../../lib/schema.js';
import { saveWithChangeLog } from '../../lib/changeLog.js';
import { applyValuesToRecord, createRecordEnvelope, createWithChangeLog, deleteWithChangeLog } from '../../lib/recordWrite.js';
import { useRecords } from '../../lib/data/useRecords.js';
import { isRecordLocked } from '../../lib/recordLock.js';
import { useDirtyBaseline } from '../../lib/editorState.js';
import { useSaveShortcut } from '../../lib/useSaveShortcut.js';
import { useRecordLock } from '../../lib/useRecordLock.js';
import { useModal } from '../../contexts/ModalContext.jsx';

export function useRecordEditor({
  recordType,
  noun = 'record',
  idPrefix = 'rec',
  fields = [],
  refFields = {},
  labelOf = (record) => record?.recordName || '',
  sortRows,
  createValues,
  toValues,
  applyValues,
  selectFirst = true,
  savedMessage = 'Saved',
}) {
  const modal = useModal();
  const { records, loading, reload: invalidate } = useRecords(recordType);
  const [rows, setRows] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [loadSeq, setLoadSeq] = useState(0);
  const statusTimer = useRef(null);

  const compare = useMemo(
    () => sortRows || ((a, b) => labelOf(a).localeCompare(labelOf(b))),
    [sortRows, labelOf],
  );

  useEffect(() => {
    if (loading) return;
    const sorted = [...records].sort(compare);
    setRows(sorted);
    setActiveId((current) => {
      if (current && sorted.some((row) => row.recordName === current)) return current;
      return selectFirst && sorted.length > 0 ? sorted[0].recordName : null;
    });
    setLoadSeq((n) => n + 1);
  }, [records, loading, compare, selectFirst]);

  useEffect(() => () => clearTimeout(statusTimer.current), []);

  const flashStatus = useCallback((message) => {
    setStatus(message);
    clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), 1500);
  }, []);

  const active = rows.find((row) => row.recordName === activeId) || null;

  const defaultToValues = useCallback((record) => ({
    ...Object.fromEntries(fields.map((name) => [name, record.fields?.[name]?.value || ''])),
    ...Object.fromEntries(Object.keys(refFields).map((name) => [name, readRef(record.fields?.[name]) || ''])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [fields.join('|'), Object.keys(refFields).join('|')]);

  useEffect(() => {
    if (!active) return;
    setValues((toValues || defaultToValues)(active));
  }, [activeId, rows, toValues, defaultToValues]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => invalidate(), [invalidate]);

  const onCreate = useCallback(async () => {
    const record = createRecordEnvelope(recordType, idPrefix, createValues ? createValues() : {});
    await createWithChangeLog(record);
    setActiveId(record.recordName);
  }, [recordType, idPrefix, createValues]);

  const onSave = useCallback(async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus(`Unlock this ${noun} before saving.`);
      return;
    }
    setSaving(true);
    try {
      const next = applyValues
        ? applyValues(active, values)
        : applyValuesToRecord(active, values, { fields, refFields });
      await saveWithChangeLog(next);
      flashStatus(savedMessage);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, values, noun, applyValues, flashStatus, savedMessage]);

  const onDelete = useCallback(async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus(`Unlock this ${noun} before deleting.`);
      return;
    }
    const ok = await modal.confirm(`Delete this ${noun}?`, {
      title: `Delete ${noun}`,
      okLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    // No setActiveId here: the rows-sync effect drops the deleted id and
    // reselects the first remaining row once the cache refreshes.
    await deleteWithChangeLog(active.recordName, recordType);
  }, [active, noun, recordType, modal]);

  const onToggleLock = useRecordLock({
    record: active,
    setRecord: (next) => setRows((current) => current.map((row) => (row.recordName === next.recordName ? next : row))),
    setSaving,
    setStatus,
    reload,
  });

  const editableSnapshot = useMemo(() => ({ activeFields: active?.fields || {}, values }), [active, values]);
  const dirty = useDirtyBaseline(editableSnapshot, {
    recordKey: active?.recordName,
    reloadKey: loadSeq,
    enabled: !!active && !saving,
  });
  useSaveShortcut(onSave, { enabled: !!active && !saving && !isRecordLocked(active) && dirty });

  return {
    rows,
    loading,
    active,
    activeId,
    setActiveId,
    values,
    setValues,
    dirty,
    saving,
    status,
    setStatus,
    flashStatus,
    loadSeq,
    reload,
    onCreate,
    onSave,
    onDelete,
    onToggleLock,
  };
}

export default useRecordEditor;
