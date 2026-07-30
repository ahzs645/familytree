/**
 * Shared save-state indicator for record editors. Shows a transient status
 * message ("Saved", "Locked", …) when present, otherwise a steady
 * "Unsaved changes" / "All changes saved" state driven by the editor's dirty
 * flag. Pair with a Save button that disables when `!dirty` and `useSaveShortcut`.
 */
import React from 'react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function SaveStatus({ status, dirty }) {
  const { t } = useTranslation();
  if (status) return <span className="text-success-text text-xs">{status}</span>;
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-warning-text">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />
        {t('editor.unsavedChanges', { defaultValue: 'Unsaved changes' })}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{t('editor.allChangesSaved', { defaultValue: 'All changes saved' })}</span>;
}

export default SaveStatus;
