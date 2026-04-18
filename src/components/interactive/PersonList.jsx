/**
 * Left-pane sectioned person list for the Interactive Tree.
 * Groups persons alphabetically by last-name initial. Supports search filtering.
 */
import React, { useMemo, useState } from 'react';
import { lifeSpanLabel } from '../../models/index.js';

export function PersonList({ persons, activeId, onPick }) {
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? persons.filter((p) => p.fullName.toLowerCase().includes(q))
      : persons;
    const groups = new Map();
    for (const p of filtered) {
      const initial = (p.lastName || p.fullName || '#')[0]?.toUpperCase() || '#';
      if (!groups.has(initial)) groups.set(initial, []);
      groups.get(initial).push(p);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [persons, query]);

  return (
    <div style={shell}>
      <div style={searchBar}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search persons…"
          style={search}
        />
      </div>
      <div style={list}>
        {sections.map(([letter, group]) => (
          <div key={letter}>
            <div style={sectionHeader}>{letter}</div>
            {group.map((p) => (
              <div
                key={p.recordName}
                onClick={() => onPick(p.recordName)}
                style={{
                  ...row,
                  background: p.recordName === activeId ? 'hsl(var(--secondary))' : 'transparent',
                  borderLeft: p.recordName === activeId ? '3px solid hsl(var(--primary))' : '3px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (p.recordName !== activeId) e.currentTarget.style.background = 'hsl(var(--muted))';
                }}
                onMouseLeave={(e) => {
                  if (p.recordName !== activeId) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ color: 'hsl(var(--foreground))', fontSize: 13 }}>{p.fullName}</div>
                {(p.birthDate || p.deathDate) && (
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11 }}>
                    {lifeSpanLabel(p)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
        {sections.length === 0 && (
          <div style={{ padding: 20, color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>No matches.</div>
        )}
      </div>
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const searchBar = { padding: 10, borderBottom: '1px solid hsl(var(--border))' };
const search = {
  width: '100%',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '7px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
};
const list = { flex: 1, overflow: 'auto' };
const sectionHeader = {
  background: 'hsl(var(--muted))',
  color: 'hsl(var(--muted-foreground))',
  fontSize: 11,
  fontWeight: 600,
  padding: '6px 12px',
  letterSpacing: 0.5,
  borderBottom: '1px solid hsl(var(--border))',
  position: 'sticky',
  top: 0,
};
const row = { padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border))' };

export default PersonList;
