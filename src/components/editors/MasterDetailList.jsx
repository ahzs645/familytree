/**
 * Generic two-pane master/detail layout used by Places, Sources, Media, Events.
 * Left pane: search + list rows. Right pane: children (detail view).
 * On mobile (<768px) collapses to single pane; selecting an item pushes detail.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { Input } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { cn } from '../../lib/utils.js';

export function MasterDetailList({ items, activeId, onPick, renderRow, placeholder, detail, detailHeader = null, emptyTitle, emptyHint, selection = null, bulkBar = null }) {
  const { t } = useTranslation();
  const searchLabel = placeholder ?? t('common.search');
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
    <div className="flex h-full">
      {showList && (
        <aside
          className={cn(
            'bg-card text-card-foreground flex flex-col',
            isMobile ? 'w-full' : 'w-[300px] border-e border-border flex-shrink-0'
          )}
        >
          <div className="p-2.5 border-b border-border">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
            />
            <div className="text-muted-foreground text-xs mt-1.5">
              {filtered.length} of {items.length}
            </div>
          </div>
          {bulkBar ? <div className="px-2.5 py-2 border-b border-border">{bulkBar}</div> : null}
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center px-6 py-12">
                <div className="text-sm font-semibold text-foreground">
                  {emptyTitle || 'Nothing here yet'}
                </div>
                {emptyHint && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {emptyHint}
                  </div>
                )}
              </div>
            ) : (
              filtered.map((it) => {
                const itemId = it.recordName || it.id;
                // Name the row checkbox after the row's own rendered content.
                // renderRow is caller-supplied and each caller derives its
                // display name differently (placeSummary, sourceSummary, …), so
                // pointing at the rendered node is both simpler and more
                // accurate than guessing at field names — and it stays correct
                // when a caller changes what it renders.
                const rowLabelId = `mdl-row-${String(itemId).replace(/[^\w-]/g, '_')}`;
                return (
                  <div
                    key={itemId}
                    onClick={() => handlePick(itemId)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handlePick(itemId);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'px-3.5 py-2 cursor-pointer border-b border-border border-s-[3px]',
                      isMobile && 'min-h-[44px]',
                      selection && 'flex items-start gap-2',
                      itemId === activeId
                        ? 'bg-secondary border-s-primary'
                        : cn('border-s-transparent', selection?.isSelected(itemId) && 'bg-primary/5')
                    )}
                  >
                    {selection ? (
                      <input
                        type="checkbox"
                        checked={selection.isSelected(itemId)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => selection.toggle(itemId, { range: event.nativeEvent?.shiftKey })}
                        aria-labelledby={rowLabelId}
                        className="mt-0.5 flex-shrink-0"
                      />
                    ) : null}
                    <div id={rowLabelId} className={selection ? 'min-w-0 flex-1' : undefined}>{renderRow(it)}</div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}
      {showDetail && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {isMobile && (
            <div className="px-3 py-2 border-b border-border bg-card flex-shrink-0">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setMobileView('list')}
                className="text-interactive font-semibold min-h-[40px] px-1"
              >
                ← Back to list
              </Button>
            </div>
          )}
          {/* Optional pinned header (e.g. title + save + section nav) that
              stays put while the detail body scrolls underneath it. */}
          {detailHeader && <div className="flex-shrink-0">{detailHeader}</div>}
          <div className="flex-1 overflow-auto">{detail}</div>
        </div>
      )}
    </div>
  );
}

export default MasterDetailList;
