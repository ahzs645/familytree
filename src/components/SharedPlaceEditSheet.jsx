import React, { useEffect, useRef } from 'react';
import { Sheet } from './ui/Sheet.jsx';
import { Button } from './ui/Button.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

/**
 * Decision shown when an inline event edit would rename a shared Place.
 * Escape is always cancel, and initial focus lands on the event-only option so
 * an accidental confirmation cannot rename other events.
 */
export function SharedPlaceEditSheet({ oldName, newName, otherReferenceCount, onRename, onCreateNew, onCancel }) {
  const { t } = useTranslation();
  const createButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    createButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onCancel]);

  const title = t('eventEditor.sharedPlace.title');
  return (
    <Sheet
      title={title}
      ariaLabel={title}
      maxWidth="max-w-lg"
      align="center"
      bodyClassName="p-4 space-y-3 text-sm"
      footer={(
        <>
          <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
            {t('common.cancel')}
          </button>
          <Button variant="outline" size="sm" onClick={onRename}>
            {t('eventEditor.sharedPlace.renameEverywhere')}
          </Button>
          <Button ref={createButtonRef} variant="primary" size="sm" onClick={onCreateNew}>
            {t('eventEditor.sharedPlace.createForEvent')}
          </Button>
        </>
      )}
    >
      <p dir="auto">
        {t('eventEditor.sharedPlace.explanation', {
          oldName,
          newName,
          count: otherReferenceCount,
        })}
      </p>
      <p className="text-xs text-muted-foreground">
        {t('eventEditor.sharedPlace.referenceCount', { count: otherReferenceCount })}
      </p>
    </Sheet>
  );
}

export default SharedPlaceEditSheet;
