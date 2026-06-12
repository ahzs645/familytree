import React, { useCallback } from 'react';
import { BulkActionBar } from './BulkActionBar.jsx';
import { BulkLabelMenu } from './BulkLabelMenu.jsx';
import { deleteRecordsWithLog } from '../../lib/bulkActions.js';
import { useModal } from '../../contexts/ModalContext.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

/**
 * RecordBulkBar — standard bulk-action bar for record-backed lists: assign
 * label + delete selected (with confirm). Pass `onDelete(ids)` to override the
 * deletion itself (e.g. to also remove owned relation records); `onDeleted(ids)`
 * runs after deletion for reload/active-row cleanup. Extra buttons go in
 * `children`.
 */
export function RecordBulkBar({ selection, recordType, onDelete, onDeleted, children }) {
  const modal = useModal();
  const { t } = useTranslation();

  const handleDelete = useCallback(async () => {
    const ids = selection.selectedIds;
    if (!ids.length) return;
    if (!(await modal.confirm(t('lists.deleteConfirm', { count: ids.length }), {
      title: t('lists.deleteTitle'),
      okLabel: t('lists.deleteOk'),
      destructive: true,
    }))) return;
    if (onDelete) await onDelete(ids);
    else await deleteRecordsWithLog(ids, recordType);
    selection.clear();
    await onDeleted?.(ids);
  }, [modal, onDelete, onDeleted, recordType, selection, t]);

  if (!selection.count) return null;
  return (
    <BulkActionBar count={selection.count} onClear={selection.clear}>
      <BulkLabelMenu selectedIds={selection.selectedIds} recordType={recordType} onAssigned={selection.clear} />
      {children}
      <button
        type="button"
        onClick={handleDelete}
        className="border border-destructive text-destructive rounded-md px-2.5 py-1 text-xs hover:bg-destructive/10"
      >
        {t('common.delete')}
      </button>
    </BulkActionBar>
  );
}

export default RecordBulkBar;
