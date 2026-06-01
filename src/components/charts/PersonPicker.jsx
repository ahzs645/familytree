/**
 * Searchable dropdown for picking the chart's start person.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BdiText, LtrText } from '../BdiText.jsx';
import { getCurrentLocalization } from '../../lib/i18n.js';
import { comparePersonSearchResults, matchesPersonLineageSearch } from '../../lib/personLineage.js';
import { personDisplayName } from '../../lib/personDisplayName.js';
import { lifeSpanLabel } from '../../models/index.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function PersonPicker({ persons, value, onChange }) {
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
    <div style={{ position: 'relative', width: '100%', minWidth: 0, maxWidth: 260 }}>
      <button ref={triggerRef} onClick={() => setOpen((v) => !v)} style={triggerStyle}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? <BdiText>{personDisplayName(selected)}</BdiText> : t('persons.choosePerson')}
        </span>
        <span style={{ color: 'hsl(var(--muted-foreground))', marginInlineStart: 8 }}>▾</span>
      </button>
      {open && rect && createPortal(
        <div ref={popoverRef} style={popoverStyle(rect)}>
          <input
            autoFocus
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('persons.search')}
            style={inputStyle}
          />
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 12, color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>{t('common.noMatches')}</div>
            )}
            {filtered.map((p) => (
              <div
                key={p.recordName}
                onClick={() => {
                  onChange(p.recordName);
                  setOpen(false);
                  setQuery('');
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid hsl(var(--border))',
                  background: p.recordName === value ? 'hsl(var(--secondary))' : 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--secondary))')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = p.recordName === value ? 'hsl(var(--secondary))' : 'transparent')
                }
              >
                <div style={{ color: 'hsl(var(--foreground))', fontSize: 14 }}><BdiText>{personDisplayName(p)}</BdiText></div>
                {(p.birthDate || p.deathDate) && (
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                    <LtrText>{lifeSpanLabel(p)}</LtrText>
                  </div>
                )}
                {query.trim() && p.lineageSearchText ? (
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10, marginTop: 2 }}>
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

const triggerStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  padding: '8px 12px',
  font: '13px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
};

// Fixed-position popover anchored to the trigger's viewport rect. Rendered in
// a body portal, so it overlays the whole page rather than living inside (and
// being clipped by) the trigger's section.
const popoverStyle = (rect) => ({
  position: 'fixed',
  top: rect.bottom + 6,
  left: rect.left,
  width: rect.width,
  background: 'hsl(var(--muted))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  zIndex: 1000,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
});

const inputStyle = {
  width: '100%',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  border: 'none',
  borderBottom: '1px solid hsl(var(--border))',
  padding: '10px 12px',
  font: '13px -apple-system, system-ui, sans-serif',
};

export default PersonPicker;
