/**
 * Card-style section used by every editor. Header has a MacFamilyTree-style
 * content icon when one is known, then the title and an optional right-side
 * control (usually a TypePicker dropdown).
 *
 * Pass `collapsible` to let users fold the section away (header turns into a
 * button with a chevron). `defaultCollapsed` sets the initial state for
 * rarely-touched sections so the editor scans short on first open. When
 * `persistKey` is provided, the per-section open/closed state is stored in
 * localStorage so the user's choices stick across reloads.
 */
import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { useEditorSection } from './EditorSectionNav.jsx';

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

function sectionStorageKey(persistKey, title) {
  if (!persistKey) return null;
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `editor.section.${persistKey}.${slug || 'untitled'}`;
}

export function Section({
  title,
  accent = 'hsl(var(--primary))',
  icon,
  controls,
  children,
  collapsible = false,
  defaultCollapsed = false,
  persistKey,
}) {
  const iconSrc = icon || defaultIconForTitle(title);
  const storageKey = sectionStorageKey(persistKey, title);
  // Register with the in-page section nav when an editor provides one.
  const { id: sectionId, ref: sectionRef } = useEditorSection(typeof title === 'string' ? title : '');

  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible) return false;
    if (storageKey && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (stored != null) return stored === '1';
      } catch {
        /* localStorage can be unavailable in private mode */
      }
    }
    return defaultCollapsed;
  });

  useEffect(() => {
    if (!collapsible || !storageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, collapsed ? '1' : '0');
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [collapsible, storageKey, collapsed]);

  // The header doubles as the collapse toggle when collapsible. Wrapping the
  // header in a <button> would also stretch the controls slot weirdly, so we
  // keep a div and add the right ARIA attributes by hand.
  const onHeaderClick = collapsible ? () => setCollapsed((v) => !v) : undefined;
  const onHeaderKeyDown = collapsible
    ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setCollapsed((v) => !v);
        }
      }
    : undefined;

  return (
    <div ref={sectionRef} id={sectionId} className="rounded-lg border border-border bg-card mb-4 overflow-hidden scroll-mt-24">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 bg-secondary/40',
          collapsed ? 'border-b border-transparent' : 'border-b border-border',
          collapsible && 'cursor-pointer select-none hover:bg-secondary/60'
        )}
        onClick={onHeaderClick}
        onKeyDown={onHeaderKeyDown}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? !collapsed : undefined}
      >
        {iconSrc ? (
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border bg-background/70">
            {/* Source icons are white glyphs (built for a dark toolbar); invert
                in light mode so they're not invisible, keep as-is in dark. */}
            <img src={iconSrc} alt="" className="h-5 w-5 object-contain invert dark:invert-0" />
          </span>
        ) : (
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ background: accent }}
          />
        )}
        <h3 className="text-sm font-semibold text-foreground flex-1">{title}</h3>
        {controls && (
          // Stop clicks inside the controls slot from toggling the section —
          // a button inside the header (e.g. TypePicker) should fire its own
          // action, not collapse the panel underneath it.
          <div className="ms-auto" onClick={(event) => event.stopPropagation()}>
            {controls}
          </div>
        )}
        {collapsible && (
          <ChevronRight
            size={16}
            className="text-muted-foreground flex-shrink-0"
            style={{
              transform: collapsed ? 'none' : 'rotate(90deg)',
              transition: 'transform 150ms ease',
            }}
            aria-hidden="true"
          />
        )}
      </div>
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}

export default Section;
