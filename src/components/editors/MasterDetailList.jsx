/**
 * Generic two-pane master/detail layout used by Places, Sources, Media, Events.
 * Left pane: search + list rows. Right pane: children (detail view).
 */
import React, { useMemo, useState } from 'react';

export function MasterDetailList({ items, activeId, onPick, renderRow, placeholder = 'Search…', detail }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const s = JSON.stringify(it).toLowerCase();
      return s.includes(q);
    });
  }, [items, query]);

  return (
    <div style={shell}>
      <aside style={left}>
        <div style={{ padding: 10, borderBottom: '1px solid #2e3345' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            style={search}
          />
          <div style={{ color: '#5b6072', fontSize: 11, marginTop: 6 }}>
            {filtered.length} of {items.length}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.map((it) => (
            <div
              key={it.recordName || it.id}
              onClick={() => onPick(it.recordName || it.id)}
              style={{
                ...row,
                background: (it.recordName || it.id) === activeId ? '#242837' : 'transparent',
                borderLeft: (it.recordName || it.id) === activeId ? '3px solid #6c8aff' : '3px solid transparent',
              }}
            >
              {renderRow(it)}
            </div>
          ))}
        </div>
      </aside>
      <main style={{ flex: 1, overflow: 'auto' }}>{detail}</main>
    </div>
  );
}

const shell = { display: 'flex', height: '100%' };
const left = { width: 300, borderRight: '1px solid #2e3345', background: '#13161f', display: 'flex', flexDirection: 'column', flexShrink: 0 };
const search = {
  width: '100%',
  background: '#0f1117',
  color: '#e2e4eb',
  border: '1px solid #2e3345',
  borderRadius: 6,
  padding: '7px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};
const row = { padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #1a1d27' };

export default MasterDetailList;
