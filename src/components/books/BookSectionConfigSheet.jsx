import React from 'react';
import { SectionEditor } from './SectionEditor.jsx';
import { Sheet } from '../ui/Sheet.jsx';

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
    <Sheet
      title={headerTitle}
      headerClassName="flex items-center justify-between"
      maxWidth="max-w-2xl"
      offset="pt-[8vh]"
      bodyClassName="p-4"
      scroll="body"
      maxHeight="max-h-[70vh]"
      footer={(
        <button type="button" onClick={onClose} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90">Done</button>
      )}
    >
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
    </Sheet>
  );
}

export default BookSectionConfigSheet;
