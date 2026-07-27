/**
 * Generic form-field primitives used across the ChartsApp UI.
 * - Field: column wrapper with a small caption
 * - RangeField / CheckOption / SelectOption: settings-panel inputs
 * - Section: titled group with a small label
 */
import React from 'react';
import { Select } from '../../ui/Select.jsx';
import { cn } from '../../../lib/utils.js';

// A real <label> around the control — as a bare <span> the caption was visible
// but named nothing.
export function Field({ label, children, hideOnNarrow }) {
  return (
    <label className={cn(hideOnNarrow ? 'hidden sm:flex' : 'flex', 'flex-col me-3')}>
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

export function RangeField({ label, value, min, max, onChange }) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span>{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function CheckOption({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function SelectOption({ label, value, onChange, options }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <Select
        value={value}
        onChange={onChange}
        options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))}
        triggerClassName="h-8 ps-2 text-xs"
      />
    </label>
  );
}

export function Section({ label, children }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-muted-foreground mb-1 tracking-wide">{label}</div>
      {children}
    </div>
  );
}
