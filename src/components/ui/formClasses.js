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
  /** Standard full-width input / select / textarea. Height is explicit so it
   *  matches the Select trigger and Button `md` on the 40px rung. */
  input: 'w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary',
  /** Compact input for dense rows (e.g. related-record editors) — 32px rung. */
  inputCompact: 'w-full h-8 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary',
  /** Standard textarea — input styling plus a sane min height and vertical resize. */
  textarea: 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary min-h-20 resize-y',
  /** Neutral / secondary button. */
  buttonSecondary: 'inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs hover:bg-accent disabled:opacity-50',
  /** Filled neutral button used as the primary action in related-record editors. */
  buttonFilled: 'inline-flex h-8 items-center rounded-md border border-border bg-secondary px-3 text-xs hover:bg-accent disabled:opacity-50',
};

export default formClasses;
