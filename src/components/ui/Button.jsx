import React from 'react';
import { cn } from '../../lib/utils.js';

/**
 * Button — the app's canonical button. Every action button should be one of
 * these variants; do not hand-roll button styles with inline `style` objects
 * or ad-hoc class strings.
 *
 * Variants:
 *   primary            solid brand action (Save, Scan, Create)
 *   secondary          filled neutral (default; most toolbar/editor actions)
 *   outline            bordered, transparent background
 *   ghost              borderless, transparent; for icon/toolbar buttons
 *   destructive        solid red (confirm-delete actions)
 *   destructiveOutline red text on transparent (initiate-delete actions)
 *
 * Sizes: sm (dense lists/toolbars, default) · md (forms, dialogs) · icon
 * (square, for icon-only buttons — pass aria-label).
 *
 * `buttonClasses()` is exported for elements that must look like a button but
 * aren't one (e.g. <label> for file inputs, router <Link>).
 */
const VARIANTS = {
  primary: 'bg-primary text-primary-foreground border border-transparent hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-accent',
  outline: 'bg-transparent text-foreground border border-border hover:bg-accent',
  ghost: 'bg-transparent text-foreground border border-transparent hover:bg-accent',
  destructive: 'bg-destructive text-destructive-foreground border border-transparent hover:bg-destructive/90',
  destructiveOutline: 'bg-transparent text-destructive-text border border-border hover:bg-destructive/10',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md',
  md: 'px-3 py-2 text-sm rounded-md',
  icon: 'h-8 w-8 p-0 rounded-md',
};

export function buttonClasses({ variant = 'secondary', size = 'sm', className } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-1.5 font-medium select-none whitespace-nowrap',
    'cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    VARIANTS[variant] || VARIANTS.secondary,
    SIZES[size] || SIZES.sm,
    className,
  );
}

export const Button = React.forwardRef(function Button(
  { variant = 'secondary', size = 'sm', type = 'button', className, ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...props} />;
});

export default Button;
