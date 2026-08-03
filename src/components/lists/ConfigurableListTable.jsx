import React from 'react';
import { ColumnChooser } from './ColumnChooser.jsx';
import { SortableListTable } from './SortableListTable.jsx';
import { useColumnVisibility } from './useColumnVisibility.js';
import { ListReportToolbar, useListReportOptions } from './ListReportWorkbench.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { Select } from '../ui/Select.jsx';
import { listToolbarSelectTriggerClass } from './listToolbarClasses.js';
import { GroupBySelect } from './GroupBySelect.jsx';
import { useGroupProfile } from './useGroupProfile.js';
import { useIsMobile } from '../../lib/useIsMobile.js';

export function ConfigurableListTable({
  listId,
  columns,
  toolbar,
  sortProfile,
  groupOptions = [],
  defaultGroupKey = 'none',
  columnChooserLabel,
  ...tableProps
}) {
  const { t } = useTranslation();
  const columnVisibility = useColumnVisibility(listId, columns);
  const report = useListReportOptions();
  const groupProfile = useGroupProfile(listId, groupOptions, defaultGroupKey);
  // The report workbench and column chooser are desktop-width tools; on a
  // phone they overflow the toolbar, so sorting and grouping carry the row.
  const isMobile = useIsMobile();
  const controls = (
    <>
      {toolbar}
      {!isMobile && (
        <ListReportToolbar
          title={tableProps.reportTitle || tableProps.title || t('lists.report')}
          rows={tableProps.rows || []}
          columns={columns}
          options={report.options}
          update={report.update}
          updateInfoColumn={report.updateInfoColumn}
          onPreviewChange={(previewMode) => report.update('previewMode', previewMode)}
        />
      )}
      {sortProfile?.sortOptions?.length ? (
        <div className="inline-flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{sortProfile.label || t('sortProfiles.label')}</span>
          <Select
            value={sortProfile.sortKey}
            onChange={sortProfile.setSortKey}
            ariaLabel={sortProfile.label || t('sortProfiles.label')}
            options={sortProfile.sortOptions.map((option) => ({
              value: option.key,
              label: t(`sortProfiles.${option.key}`, { defaultValue: option.label }),
            }))}
            className="min-w-0"
            triggerClassName={listToolbarSelectTriggerClass}
          />
        </div>
      ) : null}
      <GroupBySelect
        value={groupProfile.groupKey}
        onChange={groupProfile.setGroupKey}
        options={groupOptions}
      />
      {!isMobile && (
        <ColumnChooser
          columns={columns}
          isVisible={columnVisibility.isVisible}
          onToggle={columnVisibility.toggle}
          onReset={columnVisibility.resetToDefaults}
          label={columnChooserLabel}
        />
      )}
    </>
  );
  return (
    <SortableListTable
      {...tableProps}
      columns={columnVisibility.visibleColumns}
      sortColumns={columns}
      initialSortKey={sortProfile?.sortKey || tableProps.initialSortKey}
      groupBy={groupProfile.activeGroup?.key === 'none' ? null : groupProfile.activeGroup}
      toolbar={controls}
      reportPreview={{
        enabled: report.options.previewMode,
        title: tableProps.reportTitle || t('lists.report'),
        columns,
        options: report.options,
      }}
    />
  );
}

export default ConfigurableListTable;
