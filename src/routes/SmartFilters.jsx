/**
 * Smart Filters — user authoring UI for custom scopes.
 *
 * Mac reference: `ScopesEditSheet.nib`, `_Scopes_EditScopes_HeaderTitle`.
 * This is the editor for filters stored via `customScopes.js`; built-in
 * scopes (`smartScopes.js:BUILTIN_SCOPES`) remain read-only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CUSTOM_FILTER_ENTITY_TYPES,
  FILTER_OPERATORS,
  listCustomFilters,
  saveCustomFilter,
  deleteCustomFilter,
  runCustomFilter,
  newBlankFilter,
  availablePathSteps,
} from '../lib/customScopes.js';

const COMMON_FIELDS_BY_ENTITY = {
  Person: ['firstName', 'lastName', 'gender', 'cached_birthDate', 'cached_deathDate', 'birthPlace', 'deathPlace', 'thumbnailFileIdentifier', 'isBookmarked'],
  Family: ['man', 'woman', 'marriedDate', 'divorcedDate', 'marriagePlace'],
  PersonEvent: ['person', 'eventType', 'cached_date', 'place', 'description'],
  FamilyEvent: ['family', 'eventType', 'cached_date', 'place'],
  Place: ['placeName', 'cached_normallocationString', 'latitude', 'longitude', 'geonameID'],
  Source: ['title', 'cached_title', 'publication', 'author'],
  Repository: ['name', 'address'],
  Story: ['title', 'text'],
  ToDo: ['title', 'done', 'priority', 'dueDate'],
  Media: ['filename', 'description'],
  Label: ['name', 'color'],
  PersonGroup: ['name'],
  Research: ['title', 'question', 'done'],
};

const input = 'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm';
const button = 'rounded-md border border-border bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent';
const buttonPrimary = 'rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold';

export default function SmartFilters() {
  const [filters, setFilters] = useState([]);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    const list = await listCustomFilters();
    setFilters(list);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Accept a draft filter passed via navigation state (e.g. "Save current
  // search as smart filter" from SearchApp) and open it in the editor.
  useEffect(() => {
    const draft = location.state?.draftFilter;
    if (draft) {
      setSelected({ ...newBlankFilter(draft.entityType || 'Person'), ...draft });
      setPreview(null);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const onNew = () => {
    const blank = newBlankFilter('Person');
    setSelected(blank);
    setPreview(null);
  };

  const onSave = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const saved = await saveCustomFilter(selected);
      setSelected(saved);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [selected, refresh]);

  const onDelete = useCallback(async (id) => {
    if (!confirm('Delete this smart filter?')) return;
    await deleteCustomFilter(id);
    if (selected?.id === id) setSelected(null);
    await refresh();
  }, [selected, refresh]);

  const onRun = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await runCustomFilter(selected);
      setPreview(result);
    } finally {
      setBusy(false);
    }
  }, [selected]);

  const suggestedFields = useMemo(() => (
    selected ? (COMMON_FIELDS_BY_ENTITY[selected.entityType] || []) : []
  ), [selected]);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        <aside>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Smart filters</h2>
            <button onClick={onNew} className={button}>+ New</button>
          </div>
          {filters.length === 0 ? (
            <div className="text-xs text-muted-foreground">No custom filters yet.</div>
          ) : (
            <ul className="space-y-1">
              {filters.map((filter) => (
                <li key={filter.id}>
                  <button
                    onClick={() => { setSelected(filter); setPreview(null); }}
                    className={`block w-full text-start px-3 py-2 rounded-md border ${selected?.id === filter.id ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-accent/40'}`}
                  >
                    <div className="text-sm font-medium">{filter.name}</div>
                    <div className="text-xs text-muted-foreground">{filter.entityType} · {filter.rules?.length ?? 0} rules</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section>
          {!selected ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Pick a filter on the left or click <em>+ New</em> to author one.
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start gap-2">
                <input
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  className={`${input} text-base font-semibold`}
                  placeholder="Filter name"
                />
                <select
                  value={selected.entityType}
                  onChange={(e) => setSelected({ ...selected, entityType: e.target.value })}
                  className={input + ' w-auto'}
                >
                  {CUSTOM_FILTER_ENTITY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Match</span>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={selected.match !== 'any'} onChange={() => setSelected({ ...selected, match: 'all' })} />
                  all rules
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={selected.match === 'any'} onChange={() => setSelected({ ...selected, match: 'any' })} />
                  any rule
                </label>
              </div>

              <div className="space-y-2">
                <RuleList
                  rules={selected.rules || []}
                  entityType={selected.entityType}
                  suggestedFields={suggestedFields}
                  onChange={(rules) => setSelected({ ...selected, rules })}
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button onClick={onSave} disabled={busy} className={buttonPrimary}>Save</button>
                <button onClick={onRun} disabled={busy} className={button}>Preview matches</button>
                <button onClick={() => onDelete(selected.id)} disabled={busy} className={button}>Delete</button>
              </div>

              {preview && (
                <div className="rounded-md border border-border bg-background p-3">
                  <div className="text-sm font-semibold mb-1">{preview.total.toLocaleString()} matches</div>
                  <ul className="text-xs text-muted-foreground max-h-48 overflow-auto">
                    {preview.records.slice(0, 40).map((record) => (
                      <li key={record.recordName}>{record.recordName}</li>
                    ))}
                    {preview.total > 40 && <li>… and {preview.total - 40} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RuleList({ rules, entityType, suggestedFields, onChange }) {
  const update = (index, next) => {
    const list = [...rules];
    list[index] = next;
    onChange(list);
  };
  const remove = (index) => onChange(rules.filter((_, i) => i !== index));
  const addRule = () => onChange([...rules, { field: '', operator: 'exists', value: '' }]);
  const addGroup = () => onChange([...rules, { match: 'any', rules: [{ field: '', operator: 'exists', value: '' }] }]);
  return (
    <div className="space-y-2">
      {rules.map((rule, index) => (
        Array.isArray(rule.rules) ? (
          <GroupRow
            key={index}
            rule={rule}
            entityType={entityType}
            suggestedFields={suggestedFields}
            onChange={(next) => update(index, next)}
            onRemove={() => remove(index)}
          />
        ) : (
          <RuleRow
            key={index}
            rule={rule}
            entityType={entityType}
            suggestedFields={suggestedFields}
            onChange={(next) => update(index, next)}
            onRemove={() => remove(index)}
          />
        )
      ))}
      <div className="flex gap-2">
        <button onClick={addRule} className={button}>+ Add rule</button>
        <button onClick={addGroup} className={button}>+ Add group</button>
      </div>
    </div>
  );
}

function GroupRow({ rule, entityType, suggestedFields, onChange, onRemove }) {
  return (
    <div className="rounded-md border-2 border-primary/30 bg-background/40 p-2 space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-muted-foreground uppercase tracking-wide">Group · Match</span>
        <label className="flex items-center gap-1">
          <input type="radio" checked={rule.match !== 'any'} onChange={() => onChange({ ...rule, match: 'all' })} />
          all
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={rule.match === 'any'} onChange={() => onChange({ ...rule, match: 'any' })} />
          any
        </label>
        <button onClick={onRemove} className="ms-auto text-sm text-muted-foreground hover:text-destructive" title="Remove group">×</button>
      </div>
      <RuleList
        rules={rule.rules || []}
        entityType={entityType}
        suggestedFields={suggestedFields}
        onChange={(rules) => onChange({ ...rule, rules })}
      />
    </div>
  );
}

function RuleRow({ rule, onChange, onRemove, suggestedFields, entityType }) {
  const operator = FILTER_OPERATORS.find((op) => op.id === rule.operator) || FILTER_OPERATORS[0];
  const path = Array.isArray(rule.path) ? rule.path : [];
  const availableSteps = availablePathSteps(pathEntityFor(entityType, path));
  return (
    <div className="rounded-md border border-border bg-background/60 p-2 space-y-2">
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-muted-foreground">Through:</span>
          {path.map((step, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5">
              {step}
              <button
                type="button"
                onClick={() => onChange({ ...rule, path: path.slice(0, i) })}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${step}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        {availableSteps.length > 0 && (
          <select
            value=""
            onChange={(event) => {
              if (!event.target.value) return;
              onChange({ ...rule, path: [...path, event.target.value] });
            }}
            className={input + ' w-auto'}
            title="Add a hop (e.g. father → birth place)"
          >
            <option value="">+ hop…</option>
            {availableSteps.map((step) => <option key={step} value={step}>{step}</option>)}
          </select>
        )}
        <input
          list="smart-filter-fields"
          value={rule.field}
          onChange={(event) => onChange({ ...rule, field: event.target.value })}
          placeholder="Field name (e.g. lastName)"
          className={`${input} flex-1 min-w-[180px]`}
        />
        <datalist id="smart-filter-fields">
          {suggestedFields.map((field) => <option key={field} value={field} />)}
        </datalist>
        <select
          value={rule.operator}
          onChange={(event) => onChange({ ...rule, operator: event.target.value })}
          className={input + ' w-auto'}
        >
          {FILTER_OPERATORS.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
        </select>
        {operator.takesValue && (
          <input
            value={rule.value ?? ''}
            onChange={(event) => onChange({ ...rule, value: event.target.value })}
            placeholder="Value"
            className={`${input} flex-1 min-w-[140px]`}
          />
        )}
        <button onClick={onRemove} className="text-sm text-muted-foreground hover:text-destructive">×</button>
      </div>
    </div>
  );
}

function pathEntityFor(startEntity, path) {
  let current = startEntity;
  for (const step of path) {
    if (step === 'birthPlace' || step === 'deathPlace') current = 'Place';
    else if (step === 'man' || step === 'woman') current = 'Person';
    else current = 'Person';
  }
  return current;
}
