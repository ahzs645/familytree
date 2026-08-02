import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Select } from '../ui/Select.jsx';
import { formClasses } from '../ui/formClasses.js';
import { Sheet } from '../ui/Sheet.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function CSVExportSheet({ onExport, onCancel }) {
  const { t } = useTranslation();
  const [options, setOptions] = useState({ delimiter: ',', newline: '\n', includeHeader: true });
  const firstRef = useRef(null);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);
  return (
    <Sheet
      title={t('reports.csv.title')}
      ariaLabel={t('reports.csv.title')}
      maxWidth="max-w-sm"
      align="center"
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => onExport(options)}>{t('reports.csv.export')}</Button>
        </>
      )}
    >
      <label className="block text-xs text-muted-foreground">
        {t('reports.csv.delimiter')}
        <select ref={firstRef} value={options.delimiter} onChange={(event) => setOptions((current) => ({ ...current, delimiter: event.target.value }))} className={formClasses.input}>
          <option value=",">{t('reports.csv.comma')}</option>
          <option value=";">{t('reports.csv.semicolon')}</option>
          <option value="\t">{t('reports.csv.tab')}</option>
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        {t('reports.csv.newline')}
        <Select
          value={options.newline}
          onChange={(newline) => setOptions((current) => ({ ...current, newline }))}
          ariaLabel={t('reports.csv.newline')}
          options={[
            { value: '\n', label: t('reports.csv.lf') },
            { value: '\r\n', label: t('reports.csv.crlf') },
          ]}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={options.includeHeader} onChange={(event) => setOptions((current) => ({ ...current, includeHeader: event.target.checked }))} />
        {t('reports.csv.includeHeader')}
      </label>
    </Sheet>
  );
}

export default CSVExportSheet;
