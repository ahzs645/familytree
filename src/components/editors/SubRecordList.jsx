/**
 * Generic inline editor for a list of subordinate records (AdditionalName,
 * PersonFact, etc.). Caller supplies:
 *  - the current list
 *  - a handler to add/update/delete an item
 *  - the fields to render per row
 */
import React from 'react';

export function SubRecordList({ items, fields, onUpdate, onAdd, onDelete, addLabel = '+ Add', empty = 'None.' }) {
  return (
    <div>
      {items.length === 0 && <div className="text-xs italic text-muted-foreground mb-2">{empty}</div>}
      {items.map((it, i) => (
        <div
          key={it.recordName || i}
          className="flex gap-2 items-center p-2 mb-1.5 rounded-md border border-border bg-card"
        >
          {fields.map((f) => (
            <input
              key={f.id}
              value={it[f.id] || ''}
              placeholder={f.label}
              onChange={(e) => onUpdate(i, { ...it, [f.id]: e.target.value })}
              className="flex-1 min-w-0 bg-background text-foreground border border-border rounded-sm px-2 py-1 text-xs outline-none"
            />
          ))}
          <button
            onClick={() => onDelete(i)}
            className="text-destructive border border-border rounded-sm px-2 py-1 text-xs hover:bg-destructive/10"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="mt-1 text-xs text-primary border border-border rounded-md px-3 py-1.5 hover:bg-accent"
      >
        {addLabel}
      </button>
    </div>
  );
}

export default SubRecordList;
