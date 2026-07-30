/**
 * One row of a multi-criteria filter: field + op + value(s) + remove button.
 */
import React from 'react';
import { SEARCH_FIELDS, FILTER_OPS } from '../../lib/search.js';
import { DatePicker } from '../ui/DatePicker.jsx';
import { Select } from '../ui/Select.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';

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
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      <Select
        value={filter.field}
        onChange={(field) => update({ field })}
        options={fields.map((f) => ({ value: f.id, label: f.label }))}
        triggerClassName="h-10"
      />
      <Select
        value={filter.op}
        onChange={(op) => update({ op })}
        options={ops.map((op) => ({ value: op, label: op }))}
        triggerClassName="h-10"
      />
      {fieldDef.type === 'enum' && filter.op === 'equals' && (
        <Select
          value={String(filter.value ?? '')}
          onChange={(value) => update({ value: parseValueForType(fieldDef, value) })}
          options={[{ value: '', label: '—' }, ...fieldDef.options.map((o) => ({ value: String(o.value), label: o.label }))]}
          triggerClassName="h-10"
        />
      )}
      {fieldDef.type === 'date' && (
        <div className="w-[180px]">
          <DatePicker
            value={filter.value ?? ''}
            onChange={(value) => update({ value })}
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
          />
        </div>
      )}
      {fieldDef.type !== 'enum' && fieldDef.type !== 'presence' && fieldDef.type !== 'date' && (
        <Input
          value={filter.value ?? ''}
          onChange={(e) => update({ value: e.target.value })}
          placeholder="value"
          className="w-auto px-2.5 py-1.5"
        />
      )}
      {filter.op === 'between' && fieldDef.type === 'date' && (
        <div className="w-[180px]">
          <DatePicker
            value={filter.value2 ?? ''}
            onChange={(value2) => update({ value2 })}
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
          />
        </div>
      )}
      {filter.op === 'between' && fieldDef.type !== 'date' && (
        <Input
          value={filter.value2 ?? ''}
          onChange={(e) => update({ value2: e.target.value })}
          placeholder="value"
          className="w-auto px-2.5 py-1.5"
        />
      )}
      <Button variant="destructiveOutline" onClick={onRemove} aria-label="Remove filter">×</Button>
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

export default FilterRow;
