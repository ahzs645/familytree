/**
 * Generic form-field primitives used across the ChartsApp UI.
 * - Field: column wrapper with a small caption
 * - RangeField / CheckOption / SelectOption: settings-panel inputs
 * - Section: titled group with a small label
 */
import React from 'react';
import { Select } from '../../ui/Select.jsx';
import { optionSelect } from './styles.js';

export function Field({ label, children, hideOnNarrow }) {
  return (
    <div
      className={hideOnNarrow ? 'hidden sm:flex' : 'flex'}
      style={{ flexDirection: 'column', marginInlineEnd: 12 }}
    >
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

export function RangeField({ label, value, min, max, onChange }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', color: 'hsl(var(--muted-foreground))' }}>
        <span>{label}</span>
        <span>{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function CheckOption({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function SelectOption({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
      <span>{label}</span>
      <Select
        value={value}
        onChange={onChange}
        options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))}
        triggerStyle={{ ...optionSelect, paddingInlineEnd: 30 }}
      />
    </label>
  );
}

export function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 4, letterSpacing: 0.3 }}>{label}</div>
      {children}
    </div>
  );
}
