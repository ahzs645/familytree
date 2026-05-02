import React from 'react';
import { ColumnChooser } from './ColumnChooser.jsx';
import { SortableListTable } from './SortableListTable.jsx';
import { useColumnVisibility } from './useColumnVisibility.js';

export function ConfigurableListTable({
  listId,
  columns,
  toolbar,
  sortProfile,
  columnChooserLabel,
  ...tableProps
}) {
  const columnVisibility = useColumnVisibility(listId, columns);
  const controls = (
    <>
      {toolbar}
      {sortProfile?.sortOptions?.length ? (
        <>
          <label className="text-xs text-muted-foreground">{sortProfile.label || 'Sort profile'}</label>
          <select
            value={sortProfile.sortKey}
            onChange={(event) => sortProfile.setSortKey(event.target.value)}
            className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm"
          >
            {sortProfile.sortOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </>
      ) : null}
      <ColumnChooser
        columns={columns}
        isVisible={columnVisibility.isVisible}
        onToggle={columnVisibility.toggle}
        onReset={columnVisibility.resetToDefaults}
        label={columnChooserLabel}
      />
    </>
  );
  return (
    <SortableListTable
      {...tableProps}
      columns={columnVisibility.visibleColumns}
      sortColumns={columns}
      initialSortKey={sortProfile?.sortKey || tableProps.initialSortKey}
      toolbar={controls}
    />
  );
}

export default ConfigurableListTable;
