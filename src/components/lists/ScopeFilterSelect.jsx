import React from 'react';

export function ScopeFilterSelect({
  value,
  onChange,
  scopes,
  loading = false,
  error = '',
  label = 'Smart filter',
  className = '',
}) {
  if (!loading && (!scopes || scopes.length === 0)) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <label className="text-xs text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loading}
        className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm disabled:opacity-60"
      >
        <option value="">{loading ? 'Loading filters...' : 'All records'}</option>
        {(scopes || []).map((scope) => (
          <option key={scope.id} value={scope.id} disabled={scope.executable === false}>
            {scope.label || scope.id}{scope.executable === false ? ' (preserved only)' : ''}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

export default ScopeFilterSelect;
