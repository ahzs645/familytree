import React, { useMemo } from 'react';
import { SUPPORTED_LOCALES } from '../lib/i18n.js';
import { Select } from './ui/Select.jsx';

export function LanguageSelect({
  value,
  onChange,
  ariaLabel,
  className,
  triggerClassName,
  align = 'end',
  id,
}) {
  const options = useMemo(() => SUPPORTED_LOCALES.map((locale) => ({
    value: locale.value,
    label: locale.nativeLabel,
  })), []);

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel={ariaLabel}
      className={className}
      triggerClassName={triggerClassName}
      align={align}
    />
  );
}

export default LanguageSelect;
