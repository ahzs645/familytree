/**
 * Top-right "Add X" dropdown used in section headers. Splits options into
 * "Common" and "More" groups when items have a `common` flag.
 */
import React from 'react';
import { groupedTypeOptions, localizeTypeOptions } from '../../lib/catalogs.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function TypePicker({ placeholder, options, onPick, ariaLabel }) {
  const { t } = useTranslation();
  const label = placeholder || t('common.add', { defaultValue: 'Add' });
  const { common, rest } = groupedTypeOptions(localizeTypeOptions(options));
  return (
    <select
      value=""
      aria-label={ariaLabel || label}
      onChange={(e) => {
        if (e.target.value) {
          onPick(e.target.value);
          e.target.value = '';
        }
      }}
      className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-xs cursor-pointer outline-none"
    >
      <option value="" disabled>{label}</option>
      {common.length > 0 && (
        <optgroup label={t('editor.commonTypes', { defaultValue: 'Common' })}>
          {common.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </optgroup>
      )}
      {rest.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}

export default TypePicker;
