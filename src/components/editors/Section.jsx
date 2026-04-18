/**
 * Card-style section used by every editor. Header has a MacFamilyTree-style
 * content icon when one is known, then the title and an optional right-side
 * control (usually a TypePicker dropdown).
 */
import React from 'react';

const ICON_BASE = '/ctw-icons/content-controller-icons/';

const DEFAULT_SECTION_ICONS = [
  [/^Parents$/, 'EditFamilyChildRelationsContentControllerIcon.png'],
  [/^Partners$/, 'EditFamilyChildRelationsContentControllerIcon.png'],
  [/^Man$/, 'EditFamilyEditManContentControllerIcon.png'],
  [/^Woman$/, 'EditFamilyEditWomanContentControllerIcon.png'],
  [/^Children\b/, 'EditFamilyChildRelationsContentControllerIcon.png'],
  [/^Name & Gender$/, 'EditPersonNameContentControllerIcon.png'],
  [/^Additional Names$/, 'EditPersonAdditionalNamesContentControllerIcon.png'],
  [/^(Events|Family Events)$/, 'EditEventGeneralContentControllerIcon.png'],
  [/^Facts$/, 'EditPersonFactsContentControllerIcon.png'],
  [/^Media$/, 'EditMediaContentControllerIcon.png'],
  [/^Notes$/, 'EditNotesContentControllerIcon.png'],
  [/^Source Citations$/, 'EditSourceRelationsContentControllerIcon.png'],
  [/^Referenced Entries$/, 'EditSourceReferencedEntriesContentControllerIcon.png'],
  [/^Influential Persons$/, 'EditAssociatesContentControllerIcon.png'],
  [/^Labels$/, 'EditLabelsContentControllerIcon.png'],
  [/^Reference Numbers$/, 'EditReferenceNumbersContentControllerIcon.png'],
  [/^Bookmarks$/, 'EditBookmarkContentControllerIcon.png'],
  [/^Private$/, 'EditPrivateContentControllerIcon.png'],
  [/^Last Edited$/, 'EditCreationAndChangeDateContentControllerIcon.png'],
  [/^Place Name$/, 'EditPlaceNameContentControllerIcon.png'],
  [/^Place Details\b/, 'EditPlaceDetailsContentControllerIcon.png'],
  [/^Coordinate$/, 'EditEventCoordinateContentControllerIcon.png'],
  [/^Source Information$/, 'EditSourceGeneralContentControllerIcon.png'],
  [/^Template Fields$/, 'EditSourceGeneralContentControllerIcon.png'],
  [/^Source Text$/, 'EditSourceTextContentControllerIcon.png'],
  [/^ToDos, Stories & Groups$/, 'EditSourceReferencedEntriesContentControllerIcon.png'],
];

function defaultIconForTitle(title) {
  if (typeof title !== 'string') return null;
  const match = DEFAULT_SECTION_ICONS.find(([pattern]) => pattern.test(title));
  return match ? `${ICON_BASE}${match[1]}` : null;
}

export function Section({ title, accent = 'hsl(var(--primary))', icon, controls, children }) {
  const iconSrc = icon || defaultIconForTitle(title);

  return (
    <div className="rounded-lg border border-border bg-card mb-4 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/40">
        {iconSrc ? (
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border bg-background/70">
            <img src={iconSrc} alt="" className="h-5 w-5 object-contain" />
          </span>
        ) : (
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ background: accent }}
          />
        )}
        <h3 className="text-sm font-semibold text-foreground flex-1">{title}</h3>
        {controls && <div className="ml-auto">{controls}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default Section;
