/**
 * One row of a multi-criteria filter: field + op + value(s) + remove button.
 */
import React from 'react';
import { SEARCH_FIELDS, FILTER_OPS } from '../../lib/search.js';
import { DatePicker } from '../ui/DatePicker.jsx';
import { Select } from '../ui/Select.jsx';

export function FilterRow({ entityType, filter, onChange, onRemove }) {
  const fields = SEARCH_FIELDS[entityType] || [];
  const fieldDef = fields.find((f) => f.id === filter.field) || fields[0];
  const ops = FILTER_OPS[fieldDef?.type || 'text'];

  function update(patch) {
    const next = { ...filter, ...patch };
    if (patch.field) {
      const newFieldDef = fields.find((f) => f.id === patch.field);
      next.fieldType = newFieldDef?.type || 'text';
      next.op = (FILTER_OPS[next.fieldType] || ['contains'])[0];
      next.value = '';
      next.value2 = '';
    }
    onChange(next);
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
      <Select
        value={filter.field}
        onChange={(field) => update({ field })}
        options={fields.map((f) => ({ value: f.id, label: f.label }))}
        triggerClassName="h-auto"
        triggerStyle={inputStyle}
      />
      <Select
        value={filter.op}
        onChange={(op) => update({ op })}
        options={ops.map((op) => ({ value: op, label: op }))}
        triggerClassName="h-auto"
        triggerStyle={inputStyle}
      />
      {fieldDef.type === 'enum' && filter.op === 'equals' && (
        <Select
          value={String(filter.value ?? '')}
          onChange={(value) => update({ value: parseValueForType(fieldDef, value) })}
          options={[{ value: '', label: '—' }, ...fieldDef.options.map((o) => ({ value: String(o.value), label: o.label }))]}
          triggerClassName="h-auto"
          triggerStyle={inputStyle}
        />
      )}
      {fieldDef.type === 'date' && (
        <div style={{ width: 180 }}>
          <DatePicker
            value={filter.value ?? ''}
            onChange={(value) => update({ value })}
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
          />
        </div>
      )}
      {fieldDef.type !== 'enum' && fieldDef.type !== 'presence' && fieldDef.type !== 'date' && (
        <input
          value={filter.value ?? ''}
          onChange={(e) => update({ value: e.target.value })}
          placeholder="value"
          style={inputStyle}
        />
      )}
      {filter.op === 'between' && fieldDef.type === 'date' && (
        <div style={{ width: 180 }}>
          <DatePicker
            value={filter.value2 ?? ''}
            onChange={(value2) => update({ value2 })}
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
          />
        </div>
      )}
      {filter.op === 'between' && fieldDef.type !== 'date' && (
        <input
          value={filter.value2 ?? ''}
          onChange={(e) => update({ value2: e.target.value })}
          placeholder="value"
          style={inputStyle}
        />
      )}
      <button onClick={onRemove} style={{ ...inputStyle, color: 'hsl(var(--destructive))', cursor: 'pointer' }}>×</button>
    </div>
  );
}

function parseValueForType(fieldDef, raw) {
  if (fieldDef.type === 'enum') {
    const opt = fieldDef.options.find((o) => String(o.value) === raw);
    return opt ? opt.value : raw;
  }
  return raw;
}

const inputStyle = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '6px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
};

export default FilterRow;
