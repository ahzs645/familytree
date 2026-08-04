import React, {
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils.js';

const DEFAULT_GAP = 4;
const DEFAULT_VIEWPORT_PADDING = 8;

function assignRef(ref, value) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function resolveHeightCap(value, viewportHeight) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().endsWith('vh')) {
    const amount = Number.parseFloat(value);
    if (Number.isFinite(amount)) return viewportHeight * (amount / 100);
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * A body-portaled popover anchored to a trigger element.
 *
 * Rendering outside the trigger's DOM subtree prevents overflow containers
 * (drawers, editor scrollers, canvases) from clipping the popover. Positioning
 * follows the trigger on nested scroll/resize, clamps to the viewport, uses
 * logical start/end alignment, and flips above when that side has more room.
 */
export const AnchoredPopover = forwardRef(function AnchoredPopover({
  anchorRef,
  align = 'start',
  gap = DEFAULT_GAP,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  maxHeight,
  className,
  style,
  onMouseDown,
  children,
  ...props
}, forwardedRef) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState(null);

  const setPopoverRef = useCallback((node) => {
    popoverRef.current = node;
    assignRef(forwardedRef, node);
  }, [forwardedRef]);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) return;

    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const maximumWidth = Math.max(0, viewportWidth - (viewportPadding * 2));
    const measuredWidth = popoverRect.width || popover.offsetWidth || anchorRect.width;
    const renderedWidth = Math.min(measuredWidth, maximumWidth);
    const direction = window.getComputedStyle(anchor).direction;
    const alignToLeft = (align === 'start' && direction !== 'rtl') || (align === 'end' && direction === 'rtl');
    const preferredLeft = alignToLeft ? anchorRect.left : anchorRect.right - renderedWidth;
    const left = Math.min(
      Math.max(viewportPadding, preferredLeft),
      Math.max(viewportPadding, viewportWidth - viewportPadding - renderedWidth),
    );

    const naturalHeight = popover.scrollHeight || popoverRect.height || popover.offsetHeight;
    const roomBelow = Math.max(0, viewportHeight - viewportPadding - anchorRect.bottom - gap);
    const roomAbove = Math.max(0, anchorRect.top - viewportPadding - gap);
    const placeAbove = roomBelow < naturalHeight && roomAbove > roomBelow;
    const availableHeight = placeAbove ? roomAbove : roomBelow;
    const heightCap = resolveHeightCap(maxHeight, viewportHeight);
    const renderedHeight = Math.min(naturalHeight, availableHeight, heightCap);
    const top = placeAbove
      ? Math.max(viewportPadding, anchorRect.top - gap - renderedHeight)
      : Math.min(anchorRect.bottom + gap, Math.max(viewportPadding, viewportHeight - viewportPadding));

    const next = {
      top,
      left,
      maxWidth: maximumWidth,
      maxHeight: Math.min(availableHeight, heightCap),
      placement: placeAbove ? 'top' : 'bottom',
    };
    setPosition((current) => (
      current
      && current.top === next.top
      && current.left === next.left
      && current.maxWidth === next.maxWidth
      && current.maxHeight === next.maxHeight
      && current.placement === next.placement
        ? current
        : next
    ));
  }, [align, anchorRef, gap, maxHeight, viewportPadding]);

  useLayoutEffect(() => {
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(updatePosition)
      : null;
    if (anchorRef?.current) observer?.observe(anchorRef.current);
    if (popoverRef.current) observer?.observe(popoverRef.current);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      observer?.disconnect();
    };
  }, [anchorRef, updatePosition]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={setPopoverRef}
      className={cn('fixed z-[1000] overscroll-contain', className)}
      style={{
        ...style,
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxWidth: position?.maxWidth ?? `calc(100vw - ${viewportPadding * 2}px)`,
        maxHeight: position?.maxHeight ?? maxHeight,
        visibility: position ? 'visible' : 'hidden',
        overflowY: 'auto',
      }}
      data-placement={position?.placement}
      onMouseDown={(event) => {
        // Click-away listeners live on document. A portaled popover is outside
        // its trigger's DOM subtree, so keep inside presses from reaching them.
        event.stopPropagation();
        onMouseDown?.(event);
      }}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
});

export default AnchoredPopover;
