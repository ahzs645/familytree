/**
 * Custom Types — editor for user-defined event, fact, additional-name,
 * and ToDo type catalogs.
 *
 * Mac reference: `DatabaseMaintenance.strings` exposes one such editor per
 * category. This route collapses them into a single tabbed page so callers
 * don't need four routes.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CUSTOM_TYPE_CATEGORIES,
  listCustomTypes,
  saveCustomType,
  deleteCustomType,
  reorderCustomTypes,
} from '../lib/customTypes.js';
import {
  PERSON_EVENT_TYPES,
  FAMILY_EVENT_TYPES,
  PERSON_FACT_TYPES,
  ADDITIONAL_NAME_TYPES,
} from '../lib/catalogs.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

// Built-in catalogs that back each custom-type category, so the page can show
// the full set (built-ins + user additions) the pickers actually offer. The
// 'event' category feeds both PersonEvent and FamilyEvent pickers, so it lists
// both catalogs. Categories whose defaults live on the category meta
// (todoStatus / todoPriority) fall back to that list; 'todo' has no exported
// catalog, so it shows user entries only.
const BUILTIN_CATALOGS = {
  event: [...PERSON_EVENT_TYPES, ...FAMILY_EVENT_TYPES],
  fact: PERSON_FACT_TYPES,
  additionalName: ADDITIONAL_NAME_TYPES,
};

function builtinsForCategory(category) {
  if (!category) return [];
  const list = BUILTIN_CATALOGS[category.id] || category.defaults || [];
  // The 'event' category merges two catalogs that share some ids (e.g. Census),
  // so de-duplicate by id to keep React keys unique and the listing clean.
  const seen = new Set();
  return list.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

const input = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm';
const button = 'rounded-md border border-border bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent';
const buttonPrimary = 'rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold';

export default function CustomTypes() {
  const modal = useModal();
  const { t } = useTranslation();
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
    if (!(await modal.confirm('Delete this custom type?', { title: 'Delete type', okLabel: 'Delete', destructive: true }))) return;
    await deleteCustomType(activeCategory, id);
    await refresh();
  }, [activeCategory, refresh, modal]);

  const onEditLabel = useCallback(async (entry, label) => {
    if (label === entry.label) return;
    await saveCustomType(activeCategory, { ...entry, label });
    await refresh();
  }, [activeCategory, refresh]);

  // Move a user entry up/down by swapping it with its neighbour, then persist
  // the new order via reorderCustomTypes(categoryId, orderedIds) and refresh.
  const onMove = useCallback(async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const orderedIds = entries.map((entry) => entry.id);
    [orderedIds[index], orderedIds[target]] = [orderedIds[target], orderedIds[index]];
    setBusy(true);
    try {
      await reorderCustomTypes(activeCategory, orderedIds);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [activeCategory, entries, refresh]);

  const activeCategoryMeta = CUSTOM_TYPE_CATEGORIES.find((category) => category.id === activeCategory);
  const builtins = useMemo(() => builtinsForCategory(activeCategoryMeta), [activeCategoryMeta]);

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

        <h2 className="text-sm font-semibold mb-2">
          {t('customTypes.yourTypesHeading', { defaultValue: 'Your types' })}
        </h2>
        <div className="rounded-lg border border-border bg-card">
          {entries.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No custom entries yet for this category.</div>
          ) : (
            <ul className="divide-y divide-border">
              {entries.map((entry, index) => (
                <li key={entry.id} className="flex items-center gap-3 p-3">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => onMove(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={t('customTypes.moveUp', { defaultValue: 'Move up' })}
                      title={t('customTypes.moveUp', { defaultValue: 'Move up' })}
                      className="px-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(index, 1)}
                      disabled={busy || index === entries.length - 1}
                      aria-label={t('customTypes.moveDown', { defaultValue: 'Move down' })}
                      title={t('customTypes.moveDown', { defaultValue: 'Move down' })}
                      className="px-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
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

        <h2 className="text-sm font-semibold mt-6 mb-1">
          {t('customTypes.builtinHeading', { defaultValue: 'Built-in types' })}
        </h2>
        <p className="text-xs text-muted-foreground mb-2">
          {t('customTypes.builtinDescription', {
            defaultValue: 'Shipped with the app and always available in the pickers. These cannot be edited or removed.',
          })}
        </p>
        <div className="rounded-lg border border-border bg-card">
          {builtins.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {t('customTypes.builtinEmpty', { defaultValue: 'No built-in types for this category.' })}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {builtins.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm">{entry.label}</span>
                  <code className="text-xs text-muted-foreground">{entry.id}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
