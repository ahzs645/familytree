import React, { useMemo, useState } from 'react';
import { compareStrings, formatInteger, getCurrentLocalization, matchesSearchText } from '../../lib/i18n.js';

function defaultValue(row, column) {
  if (column.sortValue) return column.sortValue(row);
  if (column.key) return row[column.key];
  return '';
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return compareStrings(a, b);
}

function searchText(row, columns, rowSearchValue) {
  if (rowSearchValue) return String(rowSearchValue(row) || '');
  return columns
    .filter((column) => column.search !== false)
    .map((column) => {
      if (column.searchValue) return column.searchValue(row);
      return defaultValue(row, column);
    })
    .join(' ');
}

export function ListPageHeader({ title, subtitle, count, total, actions, children }) {
  const localization = getCurrentLocalization();
  return (
    <header className="flex flex-wrap items-end gap-3 px-5 py-3 border-b border-border bg-card">
      <div className="min-w-0 me-auto">
        <h1 className="text-base font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {typeof count === 'number' ? formatInteger(count, localization) : 0}
        {typeof total === 'number' && total !== count ? ` of ${formatInteger(total, localization)}` : ''} rows
      </div>
      {actions}
    </header>
  );
}

export function SortableListTable({
  rows,
  columns,
  rowKey = (row) => row.id,
  initialSortKey,
  initialSortDirection = 'asc',
  searchPlaceholder = 'Search list...',
  rowSearchValue,
  emptyTitle = 'No rows',
  emptyHint,
  toolbar,
  onRowClick,
}) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(initialSortKey || columns.find((column) => column.sortable !== false)?.key || '');
  const [sortDirection, setSortDirection] = useState(initialSortDirection);
  const localization = getCurrentLocalization();
  const localizationKey = `${localization.locale}|${localization.direction}|${localization.numberingSystem}|${localization.calendar}`;

  const visibleRows = useMemo(() => {
    let next = query.trim()
      ? rows.filter((row) => matchesSearchText(searchText(row, columns, rowSearchValue), query, localization))
      : [...rows];
    const sortColumn = columns.find((column) => column.key === sortKey);
    if (sortColumn && sortColumn.sortable !== false) {
      next = [...next].sort((a, b) => {
        const result = compareValues(defaultValue(a, sortColumn), defaultValue(b, sortColumn));
        return sortDirection === 'desc' ? -result : result;
      });
    }
    return next;
  }, [rows, columns, query, rowSearchValue, sortKey, sortDirection, localizationKey]);

  const toggleSort = (column) => {
    if (column.sortable === false) return;
    if (sortKey === column.key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(column.key);
    setSortDirection('asc');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-5 py-2 border-b border-border bg-background">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-64 max-w-full bg-background text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
        <span className="text-xs text-muted-foreground">
          {formatInteger(visibleRows.length, localization)} of {formatInteger(rows.length, localization)}
        </span>
        {toolbar}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {visibleRows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="text-sm font-semibold text-foreground">{emptyTitle}</div>
            {emptyHint && <div className="text-xs text-muted-foreground mt-1 max-w-lg">{emptyHint}</div>}
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-border">
            {visibleRows.map((row) => (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`px-4 py-3 text-sm ${onRowClick ? 'cursor-pointer active:bg-accent/70' : ''}`}
              >
                {columns.map((column) => {
                  const content = column.render ? column.render(row) : String(defaultValue(row, column) ?? '');
                  if (content === '' || content == null) return null;
                  return (
                    <div key={column.key} className="flex gap-2 py-0.5">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground min-w-20 shrink-0 pt-0.5">{column.label}</span>
                      <span className={`min-w-0 flex-1 ${column.cellClassName || ''}`}>{content}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <table className="hidden md:table w-full min-w-[760px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card border-b border-border">
              <tr>
                {columns.map((column) => {
                  const active = sortKey === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={`text-start text-[11px] uppercase font-semibold tracking-wide text-muted-foreground px-3 py-2 ${column.className || ''}`}
                    >
                      {column.sortable === false ? (
                        column.label
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {column.label}
                          {active && <span className="text-primary">{sortDirection === 'asc' ? '^' : 'v'}</span>}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-border/70 hover:bg-accent/60 ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`px-3 py-2 align-top text-foreground ${column.cellClassName || ''}`}>
                      {column.render ? column.render(row) : String(defaultValue(row, column) ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  );
}

export default SortableListTable;
