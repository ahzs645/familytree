import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatInteger, getCurrentLocalization, localeWithExtensions } from '../../lib/i18n.js';
import { cn } from '../../lib/utils.js';

function pad(n) { return String(n).padStart(2, '0'); }

function parseISO(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  const [_, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatISO(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDisplay(date, locale) {
  if (!date) return '';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * DatePicker — custom calendar popover. Accepts ISO date strings (YYYY-MM-DD)
 * via value/onChange. onChange is called with the ISO string, or '' when cleared.
 */
export function DatePicker({ value, onChange, placeholder = 'Select date', className, ariaLabel, id, disabled = false }) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [viewYear, setViewYear] = useState(() => (selected || new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (selected || new Date()).getMonth());
  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const localization = getCurrentLocalization();
  const locale = localeWithExtensions(localization);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => (
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2020, 5, 7 + index))
  )), [locale]);
  const monthTitle = useMemo(() => (
    new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(viewYear, viewMonth, 1))
  ), [locale, viewMonth, viewYear]);

  useEffect(() => {
    if (open && selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event) => {
      if (buttonRef.current?.contains(event.target)) return;
      if (popRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDay; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(viewYear, viewMonth, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const stepMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const pick = (date) => {
    onChange?.(formatISO(date));
    setOpen(false);
    buttonRef.current?.focus();
  };

  const today = new Date();

  return (
    <div className={cn('relative', className)}>
      <button
        id={id}
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'w-full h-10 rounded-md border border-border bg-secondary text-foreground text-sm ps-3 pe-10 text-start inline-flex items-center relative',
          'outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
          'hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        <span className={cn('truncate flex-1', !selected && 'text-muted-foreground')}>
          {selected ? formatDisplay(selected, locale) : placeholder}
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground">
          <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm-2 6h12v8H4V8z" />
        </svg>
      </button>
      {open ? (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Choose date"
          className="absolute z-40 mt-1 w-72 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => stepMonth(-1)} className="h-8 w-8 rounded-md hover:bg-accent inline-flex items-center justify-center" aria-label="Previous month">‹</button>
            <div className="flex-1 text-center text-sm font-semibold">{monthTitle}</div>
            <button type="button" onClick={() => stepMonth(1)} className="h-8 w-8 rounded-md hover:bg-accent inline-flex items-center justify-center" aria-label="Next month">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {weekdays.map((d) => (
              <div key={d} className="text-[11px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((date, index) => {
              if (!date) return <div key={index} />;
              const isSelected = sameDay(date, selected);
              const isToday = sameDay(date, today);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => pick(date)}
                  className={cn(
                    'h-9 rounded-md text-sm inline-flex items-center justify-center',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : isToday
                        ? 'border border-primary text-foreground'
                        : 'text-foreground hover:bg-accent'
                  )}
                >
                  {formatInteger(date.getDate(), localization)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => pick(today)}
              className="h-9 flex-1 rounded-md border border-border text-sm hover:bg-accent"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => { onChange?.(''); setOpen(false); }}
              className="h-9 flex-1 rounded-md border border-border text-sm hover:bg-accent"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DatePicker;
