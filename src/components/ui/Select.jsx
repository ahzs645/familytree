import React, { useEffect, useId, useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';

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
  ariaLabel,
  id,
  disabled = false,
  align = 'start',
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const autoId = useId();
  const buttonId = id || `select-${autoId}`;

  const currentIndex = options.findIndex((option) => option.value === value);
  const selected = currentIndex >= 0 ? options[currentIndex] : null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target) &&
        menuRef.current && !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

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
    <div className={cn('relative', className)}>
      <button
        id={buttonId}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'w-full h-10 rounded-md border border-border bg-secondary text-foreground text-sm pl-3 pr-8 text-left',
          'outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
          'hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed',
          'inline-flex items-center relative'
        )}
      >
        <span className={cn('truncate flex-1', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn(
            'absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="listbox"
          aria-labelledby={buttonId}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={cn(
            'absolute z-40 mt-1 min-w-full max-h-64 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1',
            align === 'end' ? 'right-0' : 'left-0'
          )}
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
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(index)}
                className={cn(
                  'cursor-pointer px-3 py-2 text-sm flex items-center gap-2',
                  isActive ? 'bg-accent text-foreground' : 'text-foreground',
                  isSelected && 'font-semibold'
                )}
              >
                <span className="flex-1 truncate">{option.label}</span>
                {isSelected ? (
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-primary">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0l-3.5-3.5a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clipRule="evenodd" />
                  </svg>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default Select;
