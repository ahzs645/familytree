/**
 * Reusable UI primitives shared across the PersonEditor sections.
 *
 * Field — labelled column with optional hint
 * Empty — friendly placeholder for "no items yet" lists
 * ReadOnly — small label/value pair for read-only data
 * RemoveBtn — circular destructive button used by editable lists
 * EvidenceMetric / EvidenceBadge — research-completeness indicators
 * RelatedList — read-only summary of related records (sources, etc.)
 *
 * Pure presentation; no DB or routing imports here.
 */
import React from 'react';
import { readRef } from '../../lib/schema.js';

export function inputClass() {
  return 'w-full bg-background text-foreground border border-border rounded-md px-2.5 py-2 text-sm outline-none focus:border-primary';
}

export function Field({ label, children, hint }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export function Empty({ title, hint }) {
  return (
    <div className="text-center py-6">
      <div className="text-sm text-foreground">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

export function ReadOnly({ label, value }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

export function RemoveBtn({ onClick }) {
  return (
    <button onClick={onClick} className="text-destructive border border-border rounded-md h-9 w-9 sm:h-7 sm:w-7 text-xs hover:bg-destructive/10">×</button>
  );
}

export function EvidenceMetric({ label, value, tone }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className={`text-sm font-semibold ${toneClass(tone)}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

export function EvidenceBadge({ evidence }) {
  if (!evidence) return null;
  return (
    <span className={`ms-auto shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${toneClass(evidence.state)} ${borderToneClass(evidence.state)}`}>
      {evidence.state}
    </span>
  );
}

export function toneClass(tone) {
  if (tone === 'Supported') return 'text-emerald-600';
  if (tone === 'Weak' || tone === 'Medium') return 'text-amber-500';
  if (tone === 'Unsourced' || tone === 'High') return 'text-destructive';
  return 'text-foreground';
}

export function borderToneClass(tone) {
  if (tone === 'Supported') return 'border-emerald-600/40';
  if (tone === 'Weak') return 'border-amber-500/40';
  return 'border-destructive/40';
}

export function RelatedList({ items, emptyTitle, emptyHint }) {
  if (!items?.length) return <Empty title={emptyTitle} hint={emptyHint} />;
  return (
    <div className="space-y-2">
      {items.map(({ rel, target, type }) => (
        <div key={rel.recordName} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md">
          <span className="text-sm truncate">
            <span className="text-xs text-muted-foreground me-2">{type}</span>
            {target?.fields?.cached_fullName?.value
              || target?.fields?.title?.value
              || target?.fields?.name?.value
              || target?.recordName
              || readRef(rel.fields?.target)}
          </span>
        </div>
      ))}
    </div>
  );
}
