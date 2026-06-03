/**
 * formClasses — canonical Tailwind class strings for form controls.
 *
 * Each editor, settings panel, and route form used to re-declare its own
 * `inputClass` / button classes with small, unintentional differences (px-3 vs
 * px-2.5, redundant `text-foreground`, etc.). These are the shared, normalized
 * styles. Two input sizes are intentional: the default (text-sm) and a compact
 * (text-xs) variant for dense lists.
 */
export const formClasses = {
  /** Standard full-width input / select / textarea. */
  input: 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary',
  /** Compact input for dense rows (e.g. related-record editors). */
  inputCompact: 'w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary',
  /** Neutral / secondary button. */
  buttonSecondary: 'border border-border rounded-md px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50',
  /** Filled neutral button used as the primary action in related-record editors. */
  buttonPrimary: 'bg-secondary border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50',
};

export default formClasses;
