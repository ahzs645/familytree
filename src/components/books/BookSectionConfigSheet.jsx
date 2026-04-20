import React from 'react';
import { SectionEditor } from './SectionEditor.jsx';

/**
 * BookSectionConfigSheet — modal wrapper around the inline SectionEditor so
 * that book section configuration can open as a dedicated sheet (parity with
 * Mac's per-section-kind configuration sheets: BookPersonSectionItem,
 * BookFamilySection, BookPersonBasedChartPage, BookRelationshipChartPage,
 * BookSavedChartPageReportBuilder, BookSavedReportSection,
 * BookBaseObjectsBasedReportBuilder, BookObjectBasedReportBuilder,
 * BookCustomTitle).
 *
 * Props mirror SectionEditor plus onClose.
 */
export function BookSectionConfigSheet({
  section,
  persons = [],
  groups = [],
  sources = [],
  onChange,
  onRemove,
  onClose,
  index = 0,
  total = 1,
  title,
}) {
  const headerTitle = title || `Configure section ${index + 1}`;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-[8vh]" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">{headerTitle}</h2>
        </header>
        <div className="p-4 max-h-[70vh] overflow-auto">
          <SectionEditor
            section={section}
            persons={persons}
            groups={groups}
            sources={sources}
            onChange={onChange}
            onRemove={() => { onRemove?.(); onClose?.(); }}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            index={index}
            total={total}
          />
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90">Done</button>
        </footer>
      </div>
    </div>
  );
}

export default BookSectionConfigSheet;
