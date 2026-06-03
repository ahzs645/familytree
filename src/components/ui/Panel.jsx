import React from 'react';
import { cn } from '../../lib/utils.js';

/**
 * Panel — shared shell for the app's blurred-backdrop "panel" modals (the
 * `bg-background/80 backdrop-blur-sm` family: ChartBackground, ToDoWizard,
 * GEDCOM import review, FamilySearch sheets…).
 *
 * Sibling to {@link Sheet}: same idea, different surface. Sheet is the dark
 * `bg-popover` dialog; Panel is the lighter `bg-card rounded-xl` panel with an
 * inline-close header. Panel owns only the invariant chrome — overlay, card,
 * and the title/meta/close header row. Everything below the header (main,
 * footer, toolbars, tab navs, split grids) stays bespoke as `children`, since
 * those bodies differ too much to share.
 *
 * Purely presentational — adds no Escape/backdrop-close behavior, matching the
 * originals.
 *
 * Props:
 *   title       — header heading
 *   meta        — optional muted text shown next to the title
 *   onClose     — when set, renders the inline header close button
 *   closeLabel  — header close button text (default 'Close')
 *   maxWidth    — card width class (default 'max-w-lg')
 *   maxHeight   — when set, the card becomes a flex column capped at this height
 *                 (omit for content-sized cards)
 */
export function Panel({
  title,
  meta,
  onClose,
  closeLabel = 'Close',
  maxWidth = 'max-w-lg',
  maxHeight,
  children,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className={cn('w-full bg-card border border-border rounded-xl shadow-lg', maxWidth, maxHeight && cn('flex flex-col', maxHeight))}>
        <header className="px-5 py-3 border-b border-border flex items-center gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {meta != null && <span className="text-xs text-muted-foreground">{meta}</span>}
          {onClose && (
            <button onClick={onClose} className="ms-auto text-sm text-muted-foreground hover:text-foreground">{closeLabel}</button>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

export default Panel;
