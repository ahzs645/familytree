import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils.js';

const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 256;
const VIEWPORT_PADDING = 8;
const OPTION_ESTIMATED_HEIGHT = 36;

/**
 * Custom select dropdown with consistent styling. Drop-in replacement for
 * native <select> that matches the app's control height and theme.
 *
 * Usage:
 *   <Select value={value} onChange={setValue} options={[{value, label}, ...]} />
 */
export function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  className,
  triggerClassName,
  style,
  triggerStyle,
  ariaLabel,
  id,
  disabled = false,
  align = 'start',
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const autoId = useId();
  const buttonId = id || `select-${autoId}`;
  const menuId = `${buttonId}-listbox`;

  const currentIndex = options.findIndex((option) => option.value === value);
  const selected = currentIndex >= 0 ? options[currentIndex] : null;

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const maximumWidth = Math.max(0, viewportWidth - (VIEWPORT_PADDING * 2));
    const minimumWidth = Math.min(rect.width, maximumWidth);
    const measuredWidth = menuRef.current?.offsetWidth || minimumWidth;
    const menuWidth = Math.min(Math.max(minimumWidth, measuredWidth), maximumWidth);
    const direction = window.getComputedStyle(button).direction;
    const alignToLeft = (align === 'start' && direction !== 'rtl') || (align === 'end' && direction === 'rtl');
    const preferredLeft = alignToLeft ? rect.left : rect.right - menuWidth;
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, preferredLeft),
      Math.max(VIEWPORT_PADDING, viewportWidth - VIEWPORT_PADDING - menuWidth)
    );

    const estimatedHeight = Math.min(
      MENU_MAX_HEIGHT,
      menuRef.current?.scrollHeight || ((options.length * OPTION_ESTIMATED_HEIGHT) + 8)
    );
    const roomBelow = Math.max(0, viewportHeight - VIEWPORT_PADDING - rect.bottom - MENU_GAP);
    const roomAbove = Math.max(0, rect.top - VIEWPORT_PADDING - MENU_GAP);
    const placeAbove = roomBelow < estimatedHeight && roomAbove > roomBelow;
    const availableHeight = placeAbove ? roomAbove : roomBelow;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, availableHeight);
    const renderedHeight = Math.min(estimatedHeight, maxHeight);
    const top = placeAbove
      ? Math.max(VIEWPORT_PADDING, rect.top - MENU_GAP - renderedHeight)
      : rect.bottom + MENU_GAP;

    setMenuPosition({
      top,
      left,
      minWidth: minimumWidth,
      maxWidth: maximumWidth,
      maxHeight,
    });
  }, [align, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event) => {
      if (buttonRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return undefined;
    }

    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (open) setActiveIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [open, currentIndex]);

  const commit = (index) => {
    const option = options[index];
    if (!option) return;
    onChange?.(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (disabled) return;
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(activeIndex);
    }
  };

  return (
    <div className={cn('relative', className)} style={style}>
      <button
        id={buttonId}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        className={cn(
          'w-full h-10 rounded-md border border-border bg-secondary text-foreground text-sm ps-3 pe-8 text-start',
          'outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
          'hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed',
          'inline-flex items-center relative',
          triggerClassName
        )}
        style={triggerStyle}
      >
        <span className={cn('truncate flex-1', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn(
            'absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open ? createPortal(
        <div
          id={menuId}
          ref={menuRef}
          role="listbox"
          aria-labelledby={buttonId}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onMouseDown={(event) => {
            // The menu lives outside its visual parent's DOM subtree. Keep
            // ancestor click-away handlers from closing before an option click
            // can commit, while retaining focus on the select trigger.
            event.preventDefault();
            event.stopPropagation();
          }}
          className={cn(
            'fixed z-[1000] w-max overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1',
            !menuPosition && 'invisible'
          )}
          style={{
            top: menuPosition?.top ?? 0,
            left: menuPosition?.left ?? 0,
            minWidth: menuPosition?.minWidth ?? buttonRef.current?.getBoundingClientRect().width ?? 0,
            maxWidth: menuPosition?.maxWidth ?? `calc(100vw - ${VIEWPORT_PADDING * 2}px)`,
            maxHeight: menuPosition?.maxHeight ?? MENU_MAX_HEIGHT,
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <div
                key={String(option.value)}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm flex items-center gap-2',
                  isActive ? 'bg-accent text-foreground' : 'text-foreground',
                  isSelected && 'font-semibold'
                )}
              >
                <span className="flex-1 truncate">{option.label}</span>
                {isSelected ? (
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-interactive">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </div>,
        document.body
      ) : null}
    </div>
  );
}

export default Select;
