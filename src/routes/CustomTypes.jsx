/**
 * Custom Types — editor for user-defined event, fact, additional-name,
 * and ToDo type catalogs.
 *
 * Mac reference: `DatabaseMaintenance.strings` exposes one such editor per
 * category. This route collapses them into a single tabbed page so callers
 * don't need four routes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  CUSTOM_TYPE_CATEGORIES,
  listCustomTypes,
  saveCustomType,
  deleteCustomType,
} from '../lib/customTypes.js';

const input = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm';
const button = 'rounded-md border border-border bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent';
const buttonPrimary = 'rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold';

export default function CustomTypes() {
  const [activeCategory, setActiveCategory] = useState(CUSTOM_TYPE_CATEGORIES[0].id);
  const [entries, setEntries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ label: '', hint: '' });

  const refresh = useCallback(async (categoryId = activeCategory) => {
    setEntries(await listCustomTypes(categoryId));
  }, [activeCategory]);

  useEffect(() => { refresh(activeCategory); }, [activeCategory, refresh]);

  const onAdd = useCallback(async () => {
    if (!draft.label.trim()) return;
    setBusy(true);
    try {
      await saveCustomType(activeCategory, draft);
      setDraft({ label: '', hint: '' });
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [activeCategory, draft, refresh]);

  const onDelete = useCallback(async (id) => {
    if (!confirm('Delete this custom type?')) return;
    await deleteCustomType(activeCategory, id);
    await refresh();
  }, [activeCategory, refresh]);

  const onEditLabel = useCallback(async (entry, label) => {
    if (label === entry.label) return;
    await saveCustomType(activeCategory, { ...entry, label });
    await refresh();
  }, [activeCategory, refresh]);

  const activeCategoryMeta = CUSTOM_TYPE_CATEGORIES.find((category) => category.id === activeCategory);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-3xl mx-auto p-5">
        <h1 className="text-xl font-bold mb-1">Custom Types</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Add project-specific type labels that show up in event, fact, alias, and ToDo pickers.
        </p>

        <nav className="flex flex-wrap gap-2 mb-4">
          {CUSTOM_TYPE_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={activeCategory === category.id
                ? buttonPrimary
                : button}
            >
              {category.label}
            </button>
          ))}
        </nav>

        {activeCategoryMeta && (
          <p className="text-xs text-muted-foreground mb-3">{activeCategoryMeta.description}</p>
        )}

        <div className="rounded-lg border border-border bg-card p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2">Add new</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Label (e.g. Confirmation)"
              className={`${input} flex-1 min-w-[200px]`}
            />
            <input
              value={draft.hint}
              onChange={(e) => setDraft({ ...draft, hint: e.target.value })}
              placeholder="Hint / description (optional)"
              className={`${input} flex-1 min-w-[200px]`}
            />
            <button onClick={onAdd} disabled={busy || !draft.label.trim()} className={buttonPrimary}>
              Add
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card">
          {entries.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No custom entries yet for this category.</div>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 p-3">
                  <input
                    defaultValue={entry.label}
                    onBlur={(e) => onEditLabel(entry, e.target.value.trim())}
                    className={`${input} flex-1`}
                  />
                  {entry.hint && (
                    <span className="text-xs text-muted-foreground">{entry.hint}</span>
                  )}
                  <button onClick={() => onDelete(entry.id)} className={button}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
