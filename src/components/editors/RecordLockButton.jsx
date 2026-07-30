import React from 'react';
import { isRecordLocked } from '../../lib/recordLock.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function RecordLockButton({ record, saving = false, onToggle }) {
  const { t } = useTranslation();
  if (!record) return null;
  const locked = isRecordLocked(record);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      className={`border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60 ${locked ? 'bg-amber-500/10 text-warning-text' : ''}`}
      aria-pressed={locked}
      title={locked
        ? t('editor.lock.lockedHint', { defaultValue: 'Record is locked. Unlock it before editing.' })
        : t('editor.lock.unlockedHint', { defaultValue: 'Lock this record to prevent accidental edits.' })}
    >
      {locked
        ? t('editor.lock.locked', { defaultValue: 'Locked' })
        : t('editor.lock.unlocked', { defaultValue: 'Unlocked' })}
    </button>
  );
}

export default RecordLockButton;
