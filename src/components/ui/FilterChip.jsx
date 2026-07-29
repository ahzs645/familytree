import React from 'react';
import { cn } from '../../lib/utils.js';
import { Button } from './Button.jsx';

/**
 * Canonical pressed/unpressed filter control.
 *
 * Keeping the visual state in Button variants avoids conflicting Tailwind
 * background and foreground utilities, while aria-pressed exposes that state
 * to assistive technology.
 */
export function FilterChip({ active = false, className, children, ...props }) {
  return (
    <Button
      {...props}
      variant={active ? 'primary' : 'secondary'}
      size="sm"
      aria-pressed={active}
      className={cn('h-8', className)}
    >
      {children}
    </Button>
  );
}

export default FilterChip;
