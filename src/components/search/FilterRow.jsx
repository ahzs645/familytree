/**
 * One row of a multi-criteria filter: field + op + value(s) + remove button.
 */
import React from 'react';
import { SEARCH_FIELDS, FILTER_OPS } from '../../lib/search.js';

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
      <select value={filter.field} onChange={(e) => update({ field: e.target.value })} style={inputStyle}>
        {fields.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>
      <select value={filter.op} onChange={(e) => update({ op: e.target.value })} style={inputStyle}>
        {ops.map((op) => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>
      {fieldDef.type === 'enum' && filter.op === 'equals' && (
        <select value={String(filter.value ?? '')} onChange={(e) => update({ value: parseValueForType(fieldDef, e.target.value) })} style={inputStyle}>
          <option value="">—</option>
          {fieldDef.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {fieldDef.type !== 'enum' && fieldDef.type !== 'presence' && (
        <input
          value={filter.value ?? ''}
          onChange={(e) => update({ value: e.target.value })}
          placeholder={fieldDef.type === 'date' ? 'YYYY' : 'value'}
          style={inputStyle}
        />
      )}
      {filter.op === 'between' && (
        <input
          value={filter.value2 ?? ''}
          onChange={(e) => update({ value2: e.target.value })}
          placeholder="YYYY"
          style={inputStyle}
        />
      )}
      <button onClick={onRemove} style={{ ...inputStyle, color: '#f87171', cursor: 'pointer' }}>×</button>
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
  background: '#242837',
  color: '#e2e4eb',
  border: '1px solid #2e3345',
  borderRadius: 6,
  padding: '6px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
};

export default FilterRow;
