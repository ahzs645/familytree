import React, { useMemo } from 'react';
import { SUPPORTED_LOCALES } from '../lib/i18n.js';
import { hasMessageCatalog } from '../lib/translate.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
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
  const { t } = useTranslation();
  // A locale with no message catalog still localizes dates, names, and
  // relationship terms — but the interface itself stays English. Say so in the
  // picker rather than letting the choice look like it did nothing.
  const options = useMemo(() => SUPPORTED_LOCALES.map((locale) => ({
    value: locale.value,
    label: hasMessageCatalog(locale.value)
      ? locale.nativeLabel
      : `${locale.nativeLabel} — ${t('settings.englishInterface', { defaultValue: 'English interface' })}`,
  })), [t]);

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
