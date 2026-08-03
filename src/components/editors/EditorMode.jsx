import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import {
  isEditModeShortcut,
  readAlwaysEditPreference,
  writeAlwaysEditPreference,
} from '../../lib/editorMode.js';

export function useEditorMode({ recordId, isNew = false, onFinish, disabled = false }) {
  const [alwaysEdit, setAlwaysEditState] = useState(readAlwaysEditPreference);
  const [editing, setEditing] = useState(() => isNew || readAlwaysEditPreference());
  const [finishing, setFinishing] = useState(false);
  const nextRecordIsNew = useRef(false);
  const previousRecordId = useRef(recordId);

  useEffect(() => {
    if (recordId === previousRecordId.current) return;
    previousRecordId.current = recordId;
    setEditing(isNew || nextRecordIsNew.current || readAlwaysEditPreference());
    nextRecordIsNew.current = false;
  }, [isNew, recordId]);

  useEffect(() => {
    if (disabled) setEditing(false);
  }, [disabled]);

  const setAlwaysEdit = useCallback((value) => {
    setAlwaysEditState(value);
    writeAlwaysEditPreference(value);
    if (value && !disabled) setEditing(true);
  }, [disabled]);

  const finishEditing = useCallback(async () => {
    if (disabled || finishing) return false;
    const invalidControl = document.querySelector('[data-editor-mode="edit"] :invalid');
    if (invalidControl) {
      invalidControl.reportValidity?.();
      invalidControl.focus?.();
      return false;
    }
    setFinishing(true);
    try {
      const result = await onFinish?.();
      if (result === false) return false;
      setEditing(false);
      return true;
    } finally {
      setFinishing(false);
    }
  }, [disabled, finishing, onFinish]);

  const toggleEditing = useCallback(() => {
    if (editing) return finishEditing();
    if (!disabled) setEditing(true);
    return Promise.resolve(true);
  }, [disabled, editing, finishEditing]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!isEditModeShortcut(event)) return;
      event.preventDefault();
      void toggleEditing();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggleEditing]);

  return {
    editing,
    finishing,
    alwaysEdit,
    setAlwaysEdit,
    beginEditing: () => !disabled && setEditing(true),
    markNextRecordNew: () => { nextRecordIsNew.current = true; },
    finishEditing,
    toggleEditing,
  };
}

export function EditorModeControls({ mode, locked = false }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={mode.alwaysEdit}
          disabled={locked}
          onChange={(event) => mode.setAlwaysEdit(event.target.checked)}
        />
        {t('editor.mode.alwaysEdit')}
      </label>
      {mode.editing ? (
        <Button
          variant="primary"
          size="md"
          disabled={locked || mode.finishing}
          onClick={mode.finishEditing}
          title={t('editor.mode.shortcut')}
        >
          {mode.finishing ? t('common.saving') : t('editor.mode.finish')}
        </Button>
      ) : (
        <Button
          variant="primary"
          size="md"
          disabled={locked}
          onClick={mode.beginEditing}
          title={t('editor.mode.shortcut')}
        >
          {t('editor.mode.edit')}
        </Button>
      )}
    </div>
  );
}

export function EditorModeBoundary({ editing, children, className = '' }) {
  return (
    <fieldset
      disabled={!editing}
      data-editor-mode={editing ? 'edit' : 'read'}
      className={`min-w-0 border-0 p-0 ${editing ? '' : 'record-editor-read'} ${className}`}
    >
      {children}
    </fieldset>
  );
}
