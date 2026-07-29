import React from 'react';
import { cn } from '../../lib/utils.js';

/**
 * Canonical boolean control. It keeps a native checkbox for form semantics and
 * accessibility while rendering the same themed switch in every browser.
 */
export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  className,
  ...props
}) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2',
        'transition-colors hover:bg-accent/60',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="text-sm text-foreground">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={Boolean(checked)}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
          {...props}
        />
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 rounded-full border border-border bg-muted transition-colors',
            'peer-checked:border-primary peer-checked:bg-primary',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring',
          )}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5"
        />
      </span>
    </label>
  );
}

export default Switch;
