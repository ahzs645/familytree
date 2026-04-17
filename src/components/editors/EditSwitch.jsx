/**
 * Toggle switch used by Labels, Bookmarks, Private flags.
 */
import React from 'react';
import { cn } from '../../lib/utils.js';

export function EditSwitch({ checked, onChange, label, color }) {
  return (
    <label className="flex items-center gap-3 py-1.5 cursor-pointer select-none">
      <span
        className={cn(
          'relative inline-block w-9 h-5 rounded-full border transition-colors flex-shrink-0',
          checked ? 'bg-primary border-primary' : 'bg-secondary border-border'
        )}
      >
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-card transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </span>
      {color && (
        <span
          className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
          style={{ background: color }}
        />
      )}
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

export default EditSwitch;
