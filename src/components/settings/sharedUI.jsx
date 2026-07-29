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
import { formClasses } from '../ui/formClasses.js';
import { buttonClasses } from '../ui/Button.jsx';
import { FilterChip } from '../ui/FilterChip.jsx';
import { Switch as SwitchControl } from '../ui/Switch.jsx';

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

export function Switch(props) {
  return <SwitchControl {...props} />;
}

export function CheckButton({ active, onClick, children }) {
  return <FilterChip active={active} onClick={onClick}>{children}</FilterChip>;
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

export const inputClass = formClasses.input;
export const primaryButton = buttonClasses({ variant: 'primary', size: 'md' });
export const secondaryButton = buttonClasses({ variant: 'secondary', size: 'md' });
