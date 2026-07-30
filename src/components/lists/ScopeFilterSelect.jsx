import React from 'react';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { listToolbarSelectTriggerClass } from './listToolbarClasses.js';

export function ScopeFilterSelect({
  value,
  onChange,
  scopes,
  loading = false,
  error = '',
  label,
  className = '',
}) {
  const { t } = useTranslation();
  if (!loading && (!scopes || scopes.length === 0)) return null;
  const resolvedLabel = label || t('smartScopes.smartFilter');
  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{resolvedLabel}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        className={`${listToolbarSelectTriggerClass} min-w-0`}
      >
        <option value="">{loading ? t('smartScopes.loading') : t('smartScopes.allRecords')}</option>
        {(scopes || []).map((scope) => {
          // Smart scopes have stable IDs (e.g. "persons-with-photo"); for
          // built-ins, look up the translation. Falls back to the bundled
          // English label for imported/custom scopes whose IDs aren't known.
          const localized = t(`smartScopes.${scope.id}`, { defaultValue: scope.label || scope.id });
          const suffix = scope.executable === false ? t('smartScopes.preservedOnly') : '';
          return (
            <option key={scope.id} value={scope.id} disabled={scope.executable === false}>
              {localized}{suffix}
            </option>
          );
        })}
      </select>
      {error ? <span className="text-xs text-destructive-text">{error}</span> : null}
    </label>
  );
}

export default ScopeFilterSelect;
