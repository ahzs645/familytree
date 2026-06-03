/**
 * ToDo Wizard — bulk-create ToDos from research suggestions.
 * Mirrors MacFamilyTree's ToDoWizardSheet.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { generateResearchSuggestions } from '../lib/researchSuggestions.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { logRecordCreated } from '../lib/changeLog.js';
import { matchesSearchText } from '../lib/i18n.js';
import { writeRef } from '../lib/schema.js';
import { Panel } from './ui/Panel.jsx';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToDoWizardSheet({ open, onClose, onCreated }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const suggestions = await generateResearchSuggestions();
      const flat = [];
      for (const item of suggestions) {
        for (const suggestion of item.suggestions) {
          flat.push({
            key: `${item.recordName}:${suggestion}`,
            recordName: item.recordName,
            fullName: item.fullName,
            suggestion,
          });
        }
      }
      if (!cancelled) {
        setRows(flat);
        setSelected(new Set(flat.map((r) => r.key)));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const filtered = useMemo(() => {
    if (!filter) return rows;
    return rows.filter((r) => matchesSearchText(r.fullName, filter) || matchesSearchText(r.suggestion, filter));
  }, [rows, filter]);

  if (!open) return null;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = filtered.every((r) => next.has(r.key));
      for (const row of filtered) {
        if (allVisibleSelected) next.delete(row.key);
        else next.add(row.key);
      }
      return next;
    });
  };

  const onCreate = async () => {
    const chosen = rows.filter((r) => selected.has(r.key));
    if (chosen.length === 0) {
      setMessage('Pick at least one suggestion to convert.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const db = getLocalDatabase();
      const createdTodos = [];
      const createdRelations = [];
      for (const row of chosen) {
        const todo = {
          recordName: uuid('todo'),
          recordType: 'ToDo',
          fields: {
            title: { value: row.suggestion, type: 'STRING' },
            type: { value: 'Research', type: 'STRING' },
            status: { value: 'Open', type: 'STRING' },
            priority: { value: 'Normal', type: 'STRING' },
            description: { value: `Auto-generated from Research Assistant for ${row.fullName}.`, type: 'STRING' },
          },
        };
        createdTodos.push(todo);
        createdRelations.push({
          recordName: uuid('todo-rel'),
          recordType: 'ToDoRelation',
          fields: {
            todo: writeRef(todo.recordName, 'ToDo'),
            target: writeRef(row.recordName, 'Person'),
            targetType: { value: 'Person', type: 'STRING' },
          },
        });
      }
      await db.applyRecordTransaction({ saveRecords: [...createdTodos, ...createdRelations] });
      for (const todo of createdTodos) await logRecordCreated(todo);
      setMessage(`Created ${createdTodos.length} ToDo${createdTodos.length === 1 ? '' : 's'}.`);
      onCreated?.(createdTodos.length);
    } catch (error) {
      setMessage(`Failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="ToDo Wizard"
      meta={`${selected.size} selected of ${rows.length}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
      maxHeight="max-h-[85vh]"
    >
        <div className="px-5 py-2 border-b border-border flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by person or suggestion…"
            className="flex-1 bg-background border border-border rounded-md px-2.5 py-1.5 text-sm"
          />
          <button onClick={toggleAllVisible} className="text-xs border border-border bg-secondary rounded-md px-2 py-1.5">
            Toggle visible
          </button>
        </div>
        <main className="flex-1 overflow-auto p-3 space-y-1">
          {loading && <div className="p-6 text-sm text-muted-foreground">Analyzing your tree…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground text-center">No open suggestions match that filter.</div>
          )}
          {filtered.map((row) => (
            <label key={row.key} className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(row.key)}
                onChange={() => toggle(row.key)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{row.suggestion}</div>
                <div className="text-xs text-muted-foreground truncate">for {row.fullName}</div>
              </div>
            </label>
          ))}
        </main>
        <footer className="px-5 py-3 border-t border-border flex items-center gap-3">
          {message && <div className="text-xs text-muted-foreground">{message}</div>}
          <button onClick={onClose} disabled={busy} className="ms-auto text-sm border border-border bg-secondary rounded-md px-3 py-1.5">Cancel</button>
          <button onClick={onCreate} disabled={busy || selected.size === 0} className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5">
            {busy ? 'Creating…' : `Create ${selected.size} ToDo${selected.size === 1 ? '' : 's'}`}
          </button>
        </footer>
    </Panel>
  );
}

export default ToDoWizardSheet;
