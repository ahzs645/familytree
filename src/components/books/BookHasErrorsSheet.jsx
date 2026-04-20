import React from 'react';

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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{hasErrors ? 'Book has errors' : 'Book has warnings'}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {hasErrors
              ? 'Fix the errors below before exporting.'
              : 'The book will export, but these items may need your attention.'}
          </p>
        </header>
        <div className="p-4 space-y-3 text-xs max-h-[60vh] overflow-auto">
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
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Close</button>
          {!hasErrors && warnings.length > 0 && onProceedAnyway && (
            <button type="button" onClick={onProceedAnyway} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90">
              Export anyway
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export default BookHasErrorsSheet;
