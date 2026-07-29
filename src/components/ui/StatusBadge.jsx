import React from 'react';
import { cn } from '../../lib/utils.js';

const TONE_CLASSES = {
  destructive: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300',
  warning: 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  neutral: 'border-border bg-muted/50 text-muted-foreground',
};

const TONE_ALIASES = {
  high: 'destructive',
  medium: 'warning',
  low: 'neutral',
  supported: 'success',
  weak: 'warning',
  unsourced: 'destructive',
};

function normalizedTone(tone) {
  const key = String(tone || 'neutral').toLowerCase();
  return TONE_ALIASES[key] || (TONE_CLASSES[key] ? key : 'neutral');
}

/**
 * Compact semantic status label with contrast-safe light and dark treatments.
 * Common severity and evidence names are accepted directly as `tone` values.
 */
export function StatusBadge({ tone = 'neutral', className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[62px] shrink-0 items-center justify-center rounded border px-2 py-0.5',
        'text-[10px] font-bold uppercase tracking-wide',
        TONE_CLASSES[normalizedTone(tone)],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default StatusBadge;
