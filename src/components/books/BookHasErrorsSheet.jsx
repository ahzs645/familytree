import React from 'react';
import { Sheet } from '../ui/Sheet.jsx';

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
  const hasErrors = errors.length > 0;
  return (
    <Sheet
      title={hasErrors ? 'Book has errors' : 'Book has warnings'}
      subtitle={hasErrors
        ? 'Fix the errors below before exporting.'
        : 'The book will export, but these items may need your attention.'}
      bodyClassName="p-4 space-y-3 text-xs"
      scroll="body"
      maxHeight="max-h-[60vh]"
      footer={(
        <>
          <button type="button" onClick={onClose} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Close</button>
          {!hasErrors && warnings.length > 0 && onProceedAnyway && (
            <button type="button" onClick={onProceedAnyway} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90">
              Export anyway
            </button>
          )}
        </>
      )}
    >
      {hasErrors && (
            <div>
              <div className="text-destructive font-semibold mb-1">Errors ({errors.length})</div>
              <ul className="space-y-1">
                {errors.map((item, i) => (
                  <li key={`err-${i}`} className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <div className="flex-1">
                      <div>{item.message}</div>
                      {item.sectionIndex >= 0 && onJumpToSection && (
                        <button type="button" onClick={() => onJumpToSection(item.sectionIndex)} className="text-primary hover:underline">
                          Jump to section {item.sectionIndex + 1}
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
              <div className="text-amber-500 font-semibold mb-1">Warnings ({warnings.length})</div>
              <ul className="space-y-1">
                {warnings.map((item, i) => (
                  <li key={`warn-${i}`} className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <div className="flex-1">
                      <div>{item.message}</div>
                      {item.sectionIndex >= 0 && onJumpToSection && (
                        <button type="button" onClick={() => onJumpToSection(item.sectionIndex)} className="text-primary hover:underline">
                          Jump to section {item.sectionIndex + 1}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!hasErrors && warnings.length === 0 && (
            <div className="text-muted-foreground">No issues found.</div>
          )}
    </Sheet>
  );
}

export default BookHasErrorsSheet;
