import { useCallback } from 'react';
import { saveWithChangeLog } from './changeLog.js';
import { isRecordLocked, setRecordLocked } from './recordLock.js';

export function useRecordLock({ record, setRecord, setSaving, setStatus, reload }) {
  return useCallback(async () => {
    if (!record) return;
    const next = setRecordLocked(record, !isRecordLocked(record));
    setRecord?.(next);
    setSaving?.(true);
    try {
      await saveWithChangeLog(next);
      setStatus?.(isRecordLocked(next) ? 'Locked' : 'Unlocked');
      setTimeout(() => setStatus?.(null), 1500);
      await reload?.();
    } finally {
      setSaving?.(false);
    }
  }, [record, reload, setRecord, setSaving, setStatus]);
}
