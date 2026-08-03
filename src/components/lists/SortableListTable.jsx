import React, { useEffect, useMemo, useState } from 'react';
import { compareStrings, formatInteger, getCurrentLocalization, matchesSearchText } from '../../lib/i18n.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { BulkActionBar } from './BulkActionBar.jsx';
import { ListReportPreview } from './ListReportWorkbench.jsx';
import { listToolbarCountClass, listToolbarInputClass } from './listToolbarClasses.js';
import { useListSelection } from './useListSelection.js';
import { PageTitle } from '../ui/PageTitle.jsx';
import { sectionRows } from '../../lib/listGrouping.js';

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
  const { t } = useTranslation();
  const localization = getCurrentLocalization();
  return (
    <header className="flex flex-wrap items-end gap-3 px-4 md:px-5 py-3 border-b border-border bg-card">
      <div className="min-w-0 me-auto">
        <PageTitle className="text-base font-semibold truncate">{title}</PageTitle>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {children}
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {typeof total === 'number' && total !== count
          ? t('lists.rowsOfTotal', {
            count: formatInteger(typeof count === 'number' ? count : 0, localization),
            total: formatInteger(total, localization),
            defaultValue: `${formatInteger(typeof count === 'number' ? count : 0, localization)} of ${formatInteger(total, localization)} rows`,
          })
          : t('lists.rowsTotal', {
            count: formatInteger(typeof count === 'number' ? count : 0, localization),
            defaultValue: `${formatInteger(typeof count === 'number' ? count : 0, localization)} rows`,
          })}
      </div>
      {actions}
    </header>
  );
}

export function SortableListTable({
  rows,
  columns,
  sortColumns = columns,
  rowKey = (row) => row.id,
  initialSortKey,
  initialSortDirection = 'asc',
  searchPlaceholder,
  rowSearchValue,
  emptyTitle,
  emptyHint,
  toolbar,
  onRowClick,
  reportPreview,
  selectable = false,
  renderBulkActions,
  groupBy = null,
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(initialSortKey || columns.find((column) => column.sortable !== false)?.key || '');
  const [sortDirection, setSortDirection] = useState(initialSortDirection);
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const localization = getCurrentLocalization();
  const localizationKey = `${localization.locale}|${localization.direction}|${localization.numberingSystem}|${localization.calendar}`;

  useEffect(() => {
    if (initialSortKey) setSortKey(initialSortKey);
  }, [initialSortKey]);

  const visibleRows = useMemo(() => {
    let next = query.trim()
      ? rows.filter((row) => matchesSearchText(searchText(row, columns, rowSearchValue), query, localization))
      : [...rows];
    const sortColumn = sortColumns.find((column) => column.key === sortKey);
    if (sortColumn && sortColumn.sortable !== false) {
      next = [...next].sort((a, b) => {
        const result = compareValues(defaultValue(a, sortColumn), defaultValue(b, sortColumn));
        return sortDirection === 'desc' ? -result : result;
      });
    }
    return next;
  }, [rows, columns, sortColumns, query, rowSearchValue, sortKey, sortDirection, localizationKey]);

  const toggleSort = (column) => {
    if (column.sortable === false) return;
    if (sortKey === column.key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(column.key);
    setSortDirection('asc');
  };

  const sections = useMemo(
    () => sectionRows(visibleRows, groupBy?.getGroup, t('lists.unknownGroup')),
    [visibleRows, groupBy, t]
  );
  const toggleGroup = (key) => setCollapsedGroups((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const visibleIds = useMemo(
    () => (selectable ? visibleRows.map((row) => rowKey(row)) : []),
    [selectable, visibleRows, rowKey]
  );
  const selection = useListSelection(visibleIds);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-5 py-2 border-b border-border bg-background">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder || t('common.search')}
          className={listToolbarInputClass}
        />
        <span className={listToolbarCountClass}>
          {formatInteger(visibleRows.length, localization)} of {formatInteger(rows.length, localization)}
        </span>
        {toolbar}
      </div>
      {selectable && selection.count > 0 ? (
        <div className="px-4 md:px-5 py-2 border-b border-border bg-background">
          <BulkActionBar count={selection.count} onClear={selection.clear}>
            {!selection.allSelected ? (
              <button type="button" onClick={selection.selectAll} className="border border-border rounded-md px-2.5 py-1 text-xs hover:bg-accent">
                {t('lists.selectAll')}
              </button>
            ) : null}
            {renderBulkActions ? renderBulkActions(selection.selectedIds, selection.clear) : null}
          </BulkActionBar>
        </div>
      ) : null}
      <div className="flex-1 min-h-0 overflow-auto">
        {reportPreview?.enabled ? (
          <ListReportPreview
            title={reportPreview.title || 'List Report'}
            rows={visibleRows}
            columns={reportPreview.columns || columns}
            options={reportPreview.options}
          />
        ) : visibleRows.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="text-sm font-semibold text-foreground">{emptyTitle || t('lists.noRows', { defaultValue: 'No rows' })}</div>
            {emptyHint && <div className="text-xs text-muted-foreground mt-1 max-w-lg">{emptyHint}</div>}
          </div>
        ) : (
          <>
          <div className="md:hidden divide-y divide-border">
            {sections.map((section) => (
              <React.Fragment key={section.key}>
              {groupBy ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(section.key)}
                  aria-expanded={!collapsedGroups.has(section.key)}
                  className="sticky top-0 z-[5] flex w-full items-center gap-2 bg-muted px-4 py-2 text-start text-xs font-semibold text-muted-foreground"
                >
                  <span aria-hidden="true">{collapsedGroups.has(section.key) ? '▸' : '▾'}</span>
                  <span className="min-w-0 flex-1 truncate">{section.label}</span>
                  <span>{section.rows.length}</span>
                </button>
              ) : null}
              {!collapsedGroups.has(section.key) && section.rows.map((row) => (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`px-4 py-3 text-sm ${onRowClick ? 'cursor-pointer active:bg-accent/70' : ''} ${selectable && selection.isSelected(rowKey(row)) ? 'bg-primary/5' : ''}`}
              >
                {selectable ? (
                  <label className="flex items-center gap-2 pb-1" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selection.isSelected(rowKey(row))}
                      onChange={() => selection.toggle(rowKey(row))}
                      aria-label={t('lists.selectRow')}
                    />
                  </label>
                ) : null}
                {columns.map((column) => {
                  const content = column.render ? column.render(row) : String(defaultValue(row, column) ?? '');
                  if (content === '' || content == null) return null;
                  return (
                    <div key={column.key} className="flex gap-2 py-0.5">
                      <span className="text-2xs uppercase tracking-wide text-muted-foreground min-w-20 shrink-0 pt-0.5">{column.label}</span>
                      <span className={`min-w-0 flex-1 ${column.cellClassName || ''}`}>{content}</span>
                    </div>
                  );
                })}
              </div>
              ))}
              </React.Fragment>
            ))}
          </div>
          <table className="hidden md:table w-full border-collapse text-sm" style={{ minWidth: `${columns.length * 140}px` }}>
            <thead className="sticky top-0 z-10 bg-card border-b border-border">
              <tr>
                {selectable ? (
                  <th scope="col" className="w-8 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selection.allSelected}
                      onChange={() => (selection.allSelected ? selection.clear() : selection.selectAll())}
                      aria-label={t('lists.selectAll')}
                    />
                  </th>
                ) : null}
                {columns.map((column) => {
                  const active = sortKey === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={`text-start text-2xs uppercase font-semibold tracking-wide text-muted-foreground px-3 py-2 ${column.className || ''}`}
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
                          {active && <span className="text-interactive">{sortDirection === 'asc' ? '^' : 'v'}</span>}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <React.Fragment key={section.key}>
                {groupBy ? (
                  <tr className="border-b border-border bg-muted/90">
                    <th colSpan={columns.length + (selectable ? 1 : 0)} className="p-0 text-start">
                      <button
                        type="button"
                        onClick={() => toggleGroup(section.key)}
                        aria-expanded={!collapsedGroups.has(section.key)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-semibold text-muted-foreground"
                      >
                        <span aria-hidden="true">{collapsedGroups.has(section.key) ? '▸' : '▾'}</span>
                        <span className="min-w-0 flex-1 truncate">{section.label}</span>
                        <span>{section.rows.length}</span>
                      </button>
                    </th>
                  </tr>
                ) : null}
                {!collapsedGroups.has(section.key) && section.rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-border/70 hover:bg-accent/60 ${onRowClick ? 'cursor-pointer' : ''} ${selectable && selection.isSelected(rowKey(row)) ? 'bg-primary/5' : ''}`}
                >
                  {selectable ? (
                    <td className="w-8 px-3 py-2 align-top" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selection.isSelected(rowKey(row))}
                        onChange={(event) => selection.toggle(rowKey(row), { range: event.nativeEvent?.shiftKey })}
                        aria-label={t('lists.selectRow')}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td key={column.key} className={`px-3 py-2 align-top text-foreground ${column.cellClassName || ''}`}>
                      {column.render ? column.render(row) : String(defaultValue(row, column) ?? '')}
                    </td>
                  ))}
                </tr>
                ))}
                </React.Fragment>
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
