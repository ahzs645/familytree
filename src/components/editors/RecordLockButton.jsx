import React from 'react';
import { isRecordLocked } from '../../lib/recordLock.js';

export function RecordLockButton({ record, saving = false, onToggle }) {
  if (!record) return null;
  const locked = isRecordLocked(record);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      className={`border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60 ${locked ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : ''}`}
      aria-pressed={locked}
      title={locked ? 'Record is locked. Unlock it before editing.' : 'Lock this record to prevent accidental edits.'}
    >
      {locked ? 'Locked' : 'Unlocked'}
    </button>
  );
}

export default RecordLockButton;
