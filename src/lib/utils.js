/**
 * cn — conditional class name composer (clsx + tailwind-merge).
 * The same helper used by every shadcn-style component.
 */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
