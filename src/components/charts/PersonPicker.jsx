/**
 * Searchable dropdown for picking the chart's start person.
 */
import React, { useState, useMemo } from 'react';
import { BdiText } from '../BdiText.jsx';
import { matchesSearchText } from '../../lib/i18n.js';
import { lifeSpanLabel } from '../../models/index.js';

export function PersonPicker({ persons, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return persons.slice(0, 200);
    return persons.filter((p) => matchesSearchText(p.fullName, query)).slice(0, 200);
  }, [persons, query]);

  const selected = persons.find((p) => p.recordName === value);

  return (
    <div style={{ position: 'relative', minWidth: 260 }}>
      <button onClick={() => setOpen((v) => !v)} style={triggerStyle}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? <BdiText>{selected.fullName}</BdiText> : 'Choose person…'}
        </span>
        <span style={{ color: 'hsl(var(--muted-foreground))', marginInlineStart: 8 }}>▾</span>
      </button>
      {open && (
        <div style={popoverStyle}>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            style={inputStyle}
          />
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 12, color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>No matches.</div>
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
                <div style={{ color: 'hsl(var(--foreground))', fontSize: 14 }}><BdiText>{p.fullName}</BdiText></div>
                {(p.birthDate || p.deathDate) && (
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                    {lifeSpanLabel(p)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
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

const popoverStyle = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  insetInlineStart: 0,
  insetInlineEnd: 0,
  background: 'hsl(var(--muted))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  zIndex: 50,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
};

const inputStyle = {
  width: '100%',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  border: 'none',
  borderBottom: '1px solid hsl(var(--border))',
  padding: '10px 12px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
  direction: 'auto',
};

export default PersonPicker;
