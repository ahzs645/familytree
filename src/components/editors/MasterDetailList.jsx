/**
 * Generic two-pane master/detail layout used by Places, Sources, Media, Events.
 * Left pane: search + list rows. Right pane: children (detail view).
 * On mobile (<768px) collapses to single pane; selecting an item pushes detail.
 */
import React, { useMemo, useState } from 'react';
import { useIsMobile } from '../../lib/useIsMobile.js';

export function MasterDetailList({ items, activeId, onPick, renderRow, placeholder = 'Search…', detail, detailHeader = null, emptyTitle, emptyHint }) {
  const [query, setQuery] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const isMobile = useIsMobile();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const s = JSON.stringify(it).toLowerCase();
      return s.includes(q);
    });
  }, [items, query]);

  const handlePick = (id) => {
    onPick(id);
    if (isMobile) setMobileView('detail');
  };

  const showList = !isMobile || mobileView === 'list';
  const showDetail = !isMobile || mobileView === 'detail';

  return (
    <div style={shell}>
      {showList && (
        <aside style={isMobile ? mobileFullPane : left}>
          <div style={{ padding: 10, borderBottom: '1px solid hsl(var(--border))' }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              style={search}
            />
            <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginTop: 6 }}>
              {filtered.length} of {items.length}
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={emptyState}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  {emptyTitle || 'Nothing here yet'}
                </div>
                {emptyHint && (
                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
                    {emptyHint}
                  </div>
                )}
              </div>
            ) : (
              filtered.map((it) => (
                <div
                  key={it.recordName || it.id}
                  onClick={() => handlePick(it.recordName || it.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handlePick(it.recordName || it.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    ...row,
                    ...(isMobile ? { minHeight: 44 } : null),
                    background: (it.recordName || it.id) === activeId ? 'hsl(var(--secondary))' : 'transparent',
                    borderInlineStart: (it.recordName || it.id) === activeId ? '3px solid hsl(var(--primary))' : '3px solid transparent',
                  }}
                >
                  {renderRow(it)}
                </div>
              ))
            )}
          </div>
        </aside>
      )}
      {showDetail && (
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {isMobile && (
            <div style={mobileBackBar}>
              <button type="button" onClick={() => setMobileView('list')} style={backButton}>
                ← Back to list
              </button>
            </div>
          )}
          {/* Optional pinned header (e.g. title + save + section nav) that
              stays put while the detail body scrolls underneath it. */}
          {detailHeader && <div style={{ flexShrink: 0 }}>{detailHeader}</div>}
          <div style={{ flex: 1, overflow: 'auto' }}>{detail}</div>
        </main>
      )}
    </div>
  );
}

const shell = { display: 'flex', height: '100%' };
const left = { width: 300, borderInlineEnd: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', display: 'flex', flexDirection: 'column', flexShrink: 0 };
const mobileFullPane = { width: '100%', background: 'hsl(var(--card))', display: 'flex', flexDirection: 'column' };
const mobileBackBar = {
  padding: '8px 12px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  flexShrink: 0,
};
const backButton = {
  background: 'transparent',
  border: 'none',
  color: 'hsl(var(--primary))',
  font: '600 14px -apple-system, system-ui, sans-serif',
  cursor: 'pointer',
  padding: '6px 4px',
  minHeight: 40,
};
const search = {
  width: '100%',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '7px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};
const row = { padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border))' };
const emptyState = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '48px 24px',
};

export default MasterDetailList;
