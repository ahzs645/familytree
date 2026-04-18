import React, { useEffect, useRef, useState } from 'react';
import { getCurrentLocalization, localeWithExtensions } from '../../lib/i18n.js';
import { cn } from '../../lib/utils.js';

function pad(n) { return String(n).padStart(2, '0'); }

function parseTime(value) {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(value).trim());
  if (!match) return null;
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  return { h, m };
}

function formatTime(time, use24, locale) {
  if (!time) return '';
  const { h, m } = time;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: !use24 }).format(new Date(2000, 0, 1, h, m));
}

function formatPart(value, locale, minDigits = 2) {
  return new Intl.NumberFormat(locale, { minimumIntegerDigits: minDigits, useGrouping: false }).format(value);
}

/**
 * TimePicker — custom time picker popover. Value is a string "HH:MM" (24h).
 * Displays in 12h format by default (use24=false). Minute step configurable.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = 'Select time',
  className,
  ariaLabel,
  id,
  disabled = false,
  use24 = false,
  minuteStep = 5,
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const current = parseTime(value) || { h: 9, m: 0 };
  const localization = getCurrentLocalization();
  const locale = localeWithExtensions(localization);

  const [h, setH] = useState(current.h);
  const [m, setM] = useState(current.m);

  useEffect(() => {
    if (open) {
      const parsed = parseTime(value);
      setH(parsed ? parsed.h : 9);
      setM(parsed ? parsed.m : 0);
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

  const commit = (nextH, nextM) => {
    onChange?.(`${pad(nextH)}:${pad(nextM)}`);
  };

  const bumpH = (delta) => {
    const next = (h + delta + 24) % 24;
    setH(next);
    commit(next, m);
  };
  const bumpM = (delta) => {
    const next = (m + delta + 60) % 60;
    setM(next);
    commit(h, next);
  };
  const togglePeriod = () => {
    const next = (h + 12) % 24;
    setH(next);
    commit(next, m);
  };

  const displayHour = use24 ? formatPart(h, locale) : formatPart(((h + 11) % 12) + 1, locale, 1);
  const period = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true }).formatToParts(new Date(2000, 0, 1, h, 0)).find((part) => part.type === 'dayPeriod')?.value || (h >= 12 ? 'PM' : 'AM');

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
        <span className={cn('truncate flex-1', !parseTime(value) && 'text-muted-foreground')}>
          {parseTime(value) ? formatTime(parseTime(value), use24, locale) : placeholder}
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-12.25a.75.75 0 00-1.5 0V10c0 .2.08.39.22.53l2.5 2.5a.75.75 0 101.06-1.06l-2.28-2.28V5.75z" clipRule="evenodd" />
        </svg>
      </button>
      {open ? (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Choose time"
          className="absolute z-40 mt-1 rounded-md border border-border bg-popover text-popover-foreground shadow-lg p-3"
          style={{ minWidth: 220 }}
        >
          <div className="flex items-center justify-center gap-3">
            <Stepper label={use24 ? 'Hours' : 'Hour'} value={displayHour} onUp={() => bumpH(1)} onDown={() => bumpH(-1)} />
            <div className="text-2xl font-semibold pt-6">:</div>
            <Stepper label="Minutes" value={formatPart(m, locale)} onUp={() => bumpM(minuteStep)} onDown={() => bumpM(-minuteStep)} />
            {!use24 && (
              <div className="flex flex-col items-center pt-5">
                <button
                  type="button"
                  onClick={togglePeriod}
                  className="h-10 w-12 rounded-md border border-border bg-secondary hover:bg-accent text-sm font-semibold"
                  aria-label="Toggle AM/PM"
                >
                  {period}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={() => { const now = new Date(); const nh = now.getHours(); const nm = Math.round(now.getMinutes()/minuteStep)*minuteStep % 60; setH(nh); setM(nm); commit(nh, nm); }}
              className="h-9 flex-1 rounded-md border border-border text-sm hover:bg-accent"
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => { onChange?.(''); setOpen(false); }}
              className="h-9 flex-1 rounded-md border border-border text-sm hover:bg-accent"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 flex-1 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stepper({ label, value, onUp, onDown }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <button type="button" onClick={onUp} aria-label={`Increase ${label}`} className="h-8 w-14 rounded-md hover:bg-accent inline-flex items-center justify-center">▲</button>
      <div className="h-10 w-14 rounded-md border border-border bg-secondary inline-flex items-center justify-center text-xl font-semibold tabular-nums">{value}</div>
      <button type="button" onClick={onDown} aria-label={`Decrease ${label}`} className="h-8 w-14 rounded-md hover:bg-accent inline-flex items-center justify-center">▼</button>
    </div>
  );
}

export default TimePicker;
