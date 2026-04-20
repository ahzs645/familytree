import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatInteger, getCurrentLocalization, localeWithExtensions } from '../../lib/i18n.js';
import { cn } from '../../lib/utils.js';
import {
  PREFIX,
  PREFIX_LABELS,
  ERA,
  isRangePrefix,
  parseQualifiedDate,
  formatQualifiedDate,
} from '../../lib/dateQualifiers.js';

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

function formatDisplay(raw, locale) {
  if (!raw) return '';
  const parts = parseQualifiedDate(raw);
  const fmtAtomic = (atomic) => {
    const iso = parseISO(atomic);
    if (iso) {
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(iso);
    }
    return atomic;
  };
  const { prefix, date1, date2, era, phrase } = parts;
  const d1 = date1 ? fmtAtomic(date1) : '';
  const d2 = date2 ? fmtAtomic(date2) : '';
  let body;
  if (isRangePrefix(prefix)) {
    const sep = prefix === PREFIX.BET ? 'and' : 'to';
    body = [d1, sep, d2].filter(Boolean).join(' ');
    body = `${prefix.toLowerCase() === 'bet' ? 'between' : 'from'} ${body}`.trim();
  } else if (prefix) {
    body = `${(PREFIX_LABELS[prefix] || prefix).replace(/\s*\(.*\)\s*$/, '').toLowerCase()} ${d1}`.trim();
  } else {
    body = d1;
  }
  if (era === ERA.BC && body) body = `${body} BC`;
  if (phrase) body = body ? `${body} (${phrase})` : `(${phrase})`;
  return body;
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * DatePicker — calendar popover with optional GEDCOM qualifier controls
 * (ABT, BEF, AFT, BET…AND, FROM…TO, CAL, EST, INT + BC era + phrase).
 *
 * value/onChange transport a single GEDCOM-style token string
 * ("", "1820", "ABT 1820", "BET 1701 AND 1704"). When `qualifiers` is false
 * the picker degrades to the plain ISO-date behavior of earlier releases.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className,
  ariaLabel,
  id,
  disabled = false,
  qualifiers = true,
}) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseQualifiedDate(value), [value]);
  const activeDateField = useRef('date1');
  const primary = parseISO(parsed.date1);
  const [viewYear, setViewYear] = useState(() => (primary || new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (primary || new Date()).getMonth());
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
    if (open && primary) {
      setViewYear(primary.getFullYear());
      setViewMonth(primary.getMonth());
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

  const commit = (next) => {
    onChange?.(formatQualifiedDate(next));
  };

  const pickCalendarDate = (date) => {
    const iso = formatISO(date);
    const target = activeDateField.current === 'date2' ? 'date2' : 'date1';
    commit({ ...parsed, [target]: iso });
    if (!qualifiers || !isRangePrefix(parsed.prefix)) {
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  const today = new Date();
  const rangeActive = qualifiers && isRangePrefix(parsed.prefix);

  const displayText = formatDisplay(value, locale);

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
        <span className={cn('truncate flex-1', !value && 'text-muted-foreground')}>
          {displayText || placeholder}
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
          className="absolute z-40 mt-1 w-80 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-3"
        >
          {qualifiers ? (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-muted-foreground w-14">Qualifier</label>
                <select
                  value={parsed.prefix}
                  onChange={(e) => {
                    const next = { ...parsed, prefix: e.target.value };
                    if (!isRangePrefix(next.prefix)) next.date2 = '';
                    commit(next);
                  }}
                  className="flex-1 h-8 rounded-md border border-border bg-secondary text-xs px-2"
                >
                  {Object.values(PREFIX).map((p) => (
                    <option key={p || 'exact'} value={p}>{PREFIX_LABELS[p]}</option>
                  ))}
                </select>
                <select
                  value={parsed.era}
                  onChange={(e) => commit({ ...parsed, era: e.target.value })}
                  className="h-8 rounded-md border border-border bg-secondary text-xs px-2"
                  aria-label="Era"
                >
                  <option value={ERA.AD}>AD/CE</option>
                  <option value={ERA.BC}>BC/BCE</option>
                </select>
              </div>
              {rangeActive ? (
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => { activeDateField.current = 'date1'; }}
                    className={cn(
                      'flex-1 h-8 rounded-md border text-start px-2 truncate',
                      activeDateField.current === 'date1'
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary'
                    )}
                  >
                    {parsed.date1 || (parsed.prefix === PREFIX.BET ? 'from…' : 'start…')}
                  </button>
                  <span className="text-muted-foreground">{parsed.prefix === PREFIX.BET ? 'AND' : 'TO'}</span>
                  <button
                    type="button"
                    onClick={() => { activeDateField.current = 'date2'; }}
                    className={cn(
                      'flex-1 h-8 rounded-md border text-start px-2 truncate',
                      activeDateField.current === 'date2'
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary'
                    )}
                  >
                    {parsed.date2 || 'end…'}
                  </button>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={activeDateField.current === 'date2' ? parsed.date2 : parsed.date1}
                  onChange={(e) => {
                    const field = activeDateField.current === 'date2' ? 'date2' : 'date1';
                    commit({ ...parsed, [field]: e.target.value });
                  }}
                  placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
                  className="flex-1 h-8 rounded-md border border-border bg-secondary text-xs px-2"
                />
              </div>
              {parsed.prefix === PREFIX.INT ? (
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-muted-foreground w-14">Phrase</label>
                  <input
                    type="text"
                    value={parsed.phrase}
                    onChange={(e) => commit({ ...parsed, phrase: e.target.value })}
                    placeholder="e.g. census entry"
                    className="flex-1 h-8 rounded-md border border-border bg-secondary text-xs px-2"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

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
              const activeField = activeDateField.current === 'date2' ? parsed.date2 : parsed.date1;
              const isSelected = sameDay(date, parseISO(activeField));
              const isToday = sameDay(date, today);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => pickCalendarDate(date)}
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
              onClick={() => pickCalendarDate(today)}
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
            {qualifiers ? (
              <button
                type="button"
                onClick={() => { setOpen(false); buttonRef.current?.focus(); }}
                className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
              >
                Done
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default DatePicker;
