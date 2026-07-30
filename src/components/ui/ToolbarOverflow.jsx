import React, { useRef } from 'react';
import { Ellipsis } from 'lucide-react';
import { cn } from '../../lib/utils.js';

/**
 * The "…" disclosure that holds a toolbar's secondary controls on small
 * screens.
 *
 * Page toolbars wrap rather than scroll — a scrolling strip once hid four of
 * the Heritage Tree's controls with nothing to suggest they existed. But
 * wrapping a dozen controls onto a phone costs rows: a crawl at 390px found
 * toolbars taking 64% of the screen on Maps and 28% on Slideshow, above pages
 * whose whole job is showing something. Keep the one or two controls that are
 * the page's purpose inline, and put the rest in here.
 *
 * Children are a render prop receiving `close`, because a <details> stays open
 * after a click and would otherwise cover the result of the action just taken.
 *
 * Use `MenuItem` for plain actions; settings that need a control (a select, a
 * toggle) can be laid out however the page needs.
 */
export function ToolbarOverflow({ label, children, className, align = 'end' }) {
  const ref = useRef(null);
  const close = () => { if (ref.current) ref.current.open = false; };

  return (
    <details ref={ref} className={cn('relative shrink-0', className)}>
      <summary
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-secondary text-foreground hover:bg-accent [&::-webkit-details-marker]:hidden"
        aria-label={label}
      >
        <Ellipsis size={18} />
      </summary>
      <div
        className={cn(
          'absolute top-full z-40 mt-2 w-[min(19rem,calc(100vw-1.5rem))] rounded-md border border-border bg-card p-2 shadow-xl',
          align === 'end' ? 'end-0' : 'start-0',
        )}
      >
        {typeof children === 'function' ? children({ close }) : children}
      </div>
    </details>
  );
}

/** A labelled action row inside a ToolbarOverflow. */
export function MenuItem({ icon: Icon, children, onClick, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start text-sm hover:bg-accent"
      {...props}
    >
      {Icon ? <Icon size={16} className="shrink-0 text-muted-foreground" /> : null}
      {children}
    </button>
  );
}

/** A labelled row for a control (select, toggle) inside a ToolbarOverflow. */
export function MenuRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export default ToolbarOverflow;
