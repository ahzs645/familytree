import React, { useEffect, useRef } from 'react';
import { Sheet } from '../ui/Sheet.jsx';
import { Button } from '../ui/Button.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

/**
 * BookHasErrorsSheet — modal listing a book's validation issues.
 *
 * Mac reference: BookHasErrorsSheet.nib.
 * Shown before export when validateBook() returns errors or warnings.
 *
 * Props:
 *   errors: [{ sectionIndex, message }]
 *   warnings: [{ sectionIndex, message }]
 *   onProceedAnyway() — only offered when there are warnings but no errors
 *   onJumpToSection(index)
 *   onClose()
 */
export function BookHasErrorsSheet({ errors = [], warnings = [], onProceedAnyway, onJumpToSection, onClose }) {
  const { t } = useTranslation();
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => previous?.focus?.());
    };
  }, [onClose]);
  const hasErrors = errors.length > 0;
  return (
    <Sheet
      title={hasErrors ? t('books.errors.title') : t('books.errors.warningTitle')}
      subtitle={hasErrors
        ? t('books.errors.fixBeforeExport')
        : t('books.errors.warningHelp')}
      bodyClassName="p-4 space-y-3 text-xs"
      scroll="body"
      maxHeight="max-h-[60vh]"
      footer={(
        <>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">{t('common.close')}</button>
          {!hasErrors && warnings.length > 0 && onProceedAnyway && (
            <Button variant="primary" size="sm" onClick={onProceedAnyway}>
              {t('books.errors.exportAnyway')}
            </Button>
          )}
        </>
      )}
    >
      {hasErrors && (
            <div>
              <div className="mb-1 font-semibold text-destructive-text">{t('books.errors.errorCount', { count: errors.length })}</div>
              <ul className="space-y-1">
                {errors.map((item, i) => (
                  <li key={`err-${i}`} className="flex items-start gap-2">
                    <span className="text-destructive-text">•</span>
                    <div className="flex-1">
                      <div>{item.message}</div>
                      {item.sectionIndex >= 0 && onJumpToSection && (
                        <button type="button" onClick={() => onJumpToSection(item.sectionIndex)} className="text-interactive hover:underline">
                          {t('books.errors.jumpToSection', { number: item.sectionIndex + 1 })}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <div className="mb-1 font-semibold text-warning-text">{t('books.errors.warningCount', { count: warnings.length })}</div>
              <ul className="space-y-1">
                {warnings.map((item, i) => (
                  <li key={`warn-${i}`} className="flex items-start gap-2">
                    <span className="text-warning-text">•</span>
                    <div className="flex-1">
                      <div>{item.message}</div>
                      {item.sectionIndex >= 0 && onJumpToSection && (
                        <button type="button" onClick={() => onJumpToSection(item.sectionIndex)} className="text-interactive hover:underline">
                          {t('books.errors.jumpToSection', { number: item.sectionIndex + 1 })}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasErrors && warnings.length === 0 && (
            <div className="text-muted-foreground">{t('books.errors.none')}</div>
          )}
    </Sheet>
  );
}

export default BookHasErrorsSheet;
