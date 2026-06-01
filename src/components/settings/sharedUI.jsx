/**
 * Shared visual primitives used by every Settings panel:
 * - Panel: titled card
 * - Grid: 1- or 2-column responsive grid
 * - Field: labelled column (with optional hint)
 * - Switch: labelled checkbox row
 * - CheckButton: pill-style toggle (used by FunctionsPanel)
 * - NameFormatPreview / vitalPreview: small inline previews
 *
 * Plus the three shared className strings for inputs and buttons.
 */
import React from 'react';
import { formatName } from '../../lib/nameFormat.js';
import { Select } from '../ui/Select.jsx';

export function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

export function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground mt-1">{hint}</span>}
    </label>
  );
}

export function Switch({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-sm">{label}</span>
      <input type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function CheckButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary text-foreground'}`}
    >
      {children}
    </button>
  );
}

export function SettingsSelect({ className, triggerClassName, ...props }) {
  return (
    <Select
      {...props}
      className={className || 'w-full'}
      triggerClassName={`bg-background ${triggerClassName || ''}`}
    />
  );
}

const SAMPLE_NAME_PARTS = { title: 'Dr.', first: 'Maria', middle: 'Eleanor', last: 'García', suffix: 'Jr.' };

export function NameFormatPreview({ preset, t }) {
  const rendered = formatName(SAMPLE_NAME_PARTS, preset) || '—';
  return (
    <div className="mt-1 text-[11px] text-muted-foreground">
      {t ? t('settingsPage.preview') : 'Preview'}: <span className="font-mono text-foreground">{rendered}</span>
    </div>
  );
}

export function vitalPreview(markerStyle = 'range') {
  if (markerStyle === 'symbols') return '* 1901  ◆ 1989';
  if (markerStyle === 'arabic-labels') return 'ميلاد 1901  وفاة 1989';
  return '1901 – 1989';
}

export const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';
export const primaryButton = 'rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60';
export const secondaryButton = 'rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60';
