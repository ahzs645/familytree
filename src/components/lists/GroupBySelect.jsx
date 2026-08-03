import React from 'react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { Select } from '../ui/Select.jsx';
import { listToolbarSelectTriggerClass } from './listToolbarClasses.js';

export function GroupBySelect({ value, onChange, options, label, className = '' }) {
  const { t } = useTranslation();
  if (!options?.length) return null;
  const resolvedLabel = label || t('lists.groupBy');
  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{resolvedLabel}</span>
      <Select
        value={value}
        onChange={onChange}
        ariaLabel={resolvedLabel}
        options={options.map((option) => ({ value: option.key, label: option.label }))}
        className="min-w-0"
        triggerClassName={listToolbarSelectTriggerClass}
      />
    </label>
  );
}

export default GroupBySelect;
