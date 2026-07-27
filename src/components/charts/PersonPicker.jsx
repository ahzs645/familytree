/**
 * Searchable dropdown for picking the chart's start person.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BdiText, LtrText } from '../BdiText.jsx';
import { cn } from '../../lib/utils.js';
import { getCurrentLocalization } from '../../lib/i18n.js';
import { comparePersonSearchResults, matchesPersonLineageSearch } from '../../lib/personLineage.js';
import { personDisplayName } from '../../lib/personDisplayName.js';
import { lifeSpanLabel } from '../../models/index.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function PersonPicker({ persons, value, onChange, triggerClassName }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const localization = getCurrentLocalization();

  // The popover is portaled to <body> so it overlays everything and isn't
  // clipped by an ancestor's overflow:hidden (e.g. the editor Section card).
  // We anchor it to the trigger with fixed coordinates, refreshed on
  // open/scroll/resize.
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [rect, setRect] = useState(null);

  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    const onReflow = () => updateRect();
    // capture:true so we also catch scrolls inside nested overflow containers.
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    const onDocPointer = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
      document.removeEventListener('mousedown', onDocPointer);
    };
  }, [open, updateRect]);

  const filtered = useMemo(() => {
    if (!query.trim()) return persons.slice(0, 200);
    return persons
      .filter((p) => matchesPersonLineageSearch(p, query, localization))
      .sort((a, b) => comparePersonSearchResults(a, b, query, localization))
      .slice(0, 200);
  }, [persons, query, localization.locale, localization.direction, localization.numberingSystem, localization.calendar]);

  const selected = persons.find((p) => p.recordName === value);

  return (
    <div className="relative w-full min-w-0 max-w-[260px]">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full h-10 rounded-md border border-border bg-secondary text-foreground text-sm ps-3 pe-8 text-start outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 hover:bg-accent inline-flex items-center relative',
          triggerClassName
        )}
      >
        <span className={cn('truncate flex-1', !selected && 'text-muted-foreground')}>
          {selected ? <BdiText>{personDisplayName(selected)}</BdiText> : t('persons.choosePerson')}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={cn('absolute end-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && rect && createPortal(
        // Fixed-position popover anchored to the trigger's viewport rect
        // (which is why top/left/width stay inline). Rendered in a body
        // portal, so it overlays the whole page rather than living inside
        // (and being clipped by) the trigger's section.
        <div
          ref={popoverRef}
          className="fixed z-[1000] overflow-hidden rounded-md border border-border bg-muted shadow-xl"
          style={{ top: rect.bottom + 6, left: rect.left, width: rect.width }}
        >
          <input
            autoFocus
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('persons.search')}
            className="w-full border-0 border-b border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none"
          />
          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">{t('common.noMatches')}</div>
            )}
            {filtered.map((p) => (
              <div
                key={p.recordName}
                onClick={() => {
                  onChange(p.recordName);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'cursor-pointer border-b border-border px-3 py-2 hover:bg-secondary',
                  p.recordName === value && 'bg-secondary'
                )}
              >
                <div className="text-sm text-foreground"><BdiText>{personDisplayName(p)}</BdiText></div>
                {(p.birthDate || p.deathDate) && (
                  <div className="text-xs text-muted-foreground">
                    <LtrText>{lifeSpanLabel(p)}</LtrText>
                  </div>
                )}
                {query.trim() && p.lineageSearchText ? (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    <BdiText>{p.lineageSearchText}</BdiText>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default PersonPicker;
