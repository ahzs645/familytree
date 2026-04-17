/**
 * Top-right "Add X" dropdown used in section headers. Splits options into
 * "Common" and "More" groups when items have a `common` flag.
 */
import React from 'react';
import { groupedTypeOptions } from '../../lib/catalogs.js';

export function TypePicker({ placeholder = 'Add', options, onPick }) {
  const { common, rest } = groupedTypeOptions(options);
  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) {
          onPick(e.target.value);
          e.target.value = '';
        }
      }}
      className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-xs cursor-pointer outline-none"
    >
      <option value="" disabled>{placeholder}</option>
      {common.length > 0 && (
        <optgroup label="Common">
          {common.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </optgroup>
      )}
      {rest.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}

export default TypePicker;
