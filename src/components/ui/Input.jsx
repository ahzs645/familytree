import React from 'react';
import { cn } from '../../lib/utils.js';
import { formClasses } from './formClasses.js';

/**
 * Input / Textarea — canonical text controls. Wraps the shared formClasses
 * strings so fields stay visually identical everywhere. Use `compact` for
 * dense rows (related-record editors, list filters). For selects, use
 * ui/Select.jsx.
 */
export const Input = React.forwardRef(function Input({ compact = false, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(compact ? formClasses.inputCompact : formClasses.input, className)}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef(function Textarea({ compact = false, className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(compact ? formClasses.inputCompact : formClasses.textarea, className)}
      {...props}
    />
  );
});

export default Input;
