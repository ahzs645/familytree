import React from 'react';
import { cn } from '../../lib/utils.js';

/**
 * Sheet — shared modal shell for the app's `*Sheet` dialogs.
 *
 * Owns the invariant chrome that was copy-pasted across ~10 sheets: the fixed
 * overlay, the centered card (border / rounded / shadow / popover surface), and
 * the bordered header / footer regions. Sheet contents stay as `children`;
 * header and footer accept arbitrary nodes so each sheet keeps its exact layout.
 *
 * This is purely presentational — it adds no open/close, backdrop-click, or
 * Escape behavior, so migrated callers keep their original semantics.
 *
 * Props:
 *   title, subtitle      — common header (h2 + muted paragraph)
 *   headerExtra          — extra node appended inside <header> (e.g. summary row)
 *   headerClassName      — extra classes on <header> (e.g. 'flex items-center justify-between')
 *   footer               — footer node (buttons); omit to render no footer
 *   footerClassName      — layout classes on <footer> (default: right-aligned row)
 *   bodyClassName        — classes on the body wrapper (default: 'p-4 space-y-3')
 *   maxWidth             — card width class (default: 'max-w-lg')
 *   backdrop             — overlay background class (default: 'bg-black/50')
 *   align                — 'top' (default) | 'center'
 *   offset               — top offset when align='top' (default: 'pt-[10vh]')
 *   scroll               — false (default) | 'card' | 'body'
 *   maxHeight            — height cap used by scroll modes (default: 'max-h-[80vh]')
 *   ariaLabel            — optional aria-label on the dialog
 */
export function Sheet({
  title,
  subtitle,
  headerExtra,
  headerClassName,
  footer,
  footerClassName = 'flex items-center justify-end gap-2',
  children,
  bodyClassName = 'p-4 space-y-3',
  maxWidth = 'max-w-lg',
  backdrop = 'bg-black/50',
  align = 'top',
  offset = 'pt-[10vh]',
  scroll = false,
  maxHeight = 'max-h-[80vh]',
  ariaLabel,
}) {
  const alignClasses = align === 'center'
    ? 'items-center justify-center'
    : cn('items-start justify-center', offset);

  return (
    <div
      className={cn('fixed inset-0 z-50 flex p-4', backdrop, alignClasses)}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'w-full rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden',
          maxWidth,
          scroll === 'card' && cn('flex flex-col', maxHeight),
        )}
      >
        {title != null && (
          <header className={cn('px-4 py-3 border-b border-border', headerClassName)}>
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle != null && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {headerExtra}
          </header>
        )}
        <div
          className={cn(
            scroll === 'card' && 'flex-1 overflow-y-auto',
            bodyClassName,
            scroll === 'body' && cn(maxHeight, 'overflow-auto'),
          )}
        >
          {children}
        </div>
        {footer != null && (
          <footer className={cn('px-4 py-3 border-t border-border', footerClassName)}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export default Sheet;
