/**
 * SearchApp — top-level UI for the search page.
 * Pick entity type, build filter rows, run search, view results.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ENTITY_TYPES, SEARCH_FIELDS, FILTER_OPS, runSearch } from '../../lib/search.js';
import { listAllScopes, runScope } from '../../lib/smartScopes.js';
import { applySearchReplace, previewSearchReplace, replaceableFields, undoLastSearchReplace } from '../../lib/searchReplace.js';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { FilterRow } from './FilterRow.jsx';
import { SearchResults } from './SearchResults.jsx';

const SAVED_SEARCHES_KEY = 'savedSearches';

function searchFiltersToScopeRules(filters, textQuery) {
  const rules = [];
  if (textQuery && textQuery.trim()) {
    rules.push({ field: '*', operator: 'contains', value: textQuery.trim() });
  }
  for (const f of filters || []) {
    if (!f?.field) continue;
    if (f.op === 'exists') rules.push({ field: f.field, operator: 'exists', value: '' });
    else if (f.op === 'missing') rules.push({ field: f.field, operator: 'missing', value: '' });
    else if (f.op === 'equals') rules.push({ field: f.field, operator: 'equals', value: f.value || '' });
    else if (f.op === 'contains' || f.op === 'startsWith') rules.push({ field: f.field, operator: 'contains', value: f.value || '' });
    else if (f.op === 'before') rules.push({ field: f.field, operator: 'lt', value: f.value || '' });
    else if (f.op === 'after') rules.push({ field: f.field, operator: 'gt', value: f.value || '' });
    else if (f.op === 'between') {
      rules.push({ field: f.field, operator: 'gt', value: f.value || '' });
      rules.push({ field: f.field, operator: 'lt', value: f.value2 || '' });
    }
  }
  return rules;
}

function newFilter(entityType) {
  const fields = SEARCH_FIELDS[entityType] || [];
  const f = fields[0];
  if (!f) return null;
  return { field: f.id, fieldType: f.type, op: FILTER_OPS[f.type][0], value: '', value2: '' };
}

export function SearchApp() {
  const [entityType, setEntityType] = useState('Person');
  const [textQuery, setTextQuery] = useState('');
  const [filters, setFilters] = useState([]);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [scopeOptions, setScopeOptions] = useState([]);
  const [replaceField, setReplaceField] = useState('');
  const [findText, setFindText] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeField, setWholeField] = useState(false);
  const [replacePreview, setReplacePreview] = useState(null);
  const [replaceStatus, setReplaceStatus] = useState('');
  const [savedSearches, setSavedSearches] = useState([]);
  const navigate = useNavigate();

  const loadSaved = useCallback(async () => {
    const list = await getLocalDatabase().getMeta(SAVED_SEARCHES_KEY);
    setSavedSearches(Array.isArray(list) ? list : []);
  }, []);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  const onSaveSearch = useCallback(async () => {
    const name = prompt('Save this search as:');
    if (!name) return;
    const db = getLocalDatabase();
    const list = Array.isArray(await db.getMeta(SAVED_SEARCHES_KEY)) ? await db.getMeta(SAVED_SEARCHES_KEY) : [];
    const entry = {
      id: `ss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      entityType,
      textQuery,
      filters,
      savedAt: new Date().toISOString(),
    };
    const next = [...list, entry];
    await db.setMeta(SAVED_SEARCHES_KEY, next);
    setSavedSearches(next);
  }, [entityType, textQuery, filters]);

  const onLoadSearch = useCallback((id) => {
    const entry = savedSearches.find((s) => s.id === id);
    if (!entry) return;
    setEntityType(entry.entityType || 'Person');
    setTextQuery(entry.textQuery || '');
    setFilters(entry.filters || []);
    setResult(null);
  }, [savedSearches]);

  const onDeleteSearch = useCallback(async (id) => {
    if (!confirm('Delete saved search?')) return;
    const db = getLocalDatabase();
    const list = Array.isArray(await db.getMeta(SAVED_SEARCHES_KEY)) ? await db.getMeta(SAVED_SEARCHES_KEY) : [];
    const next = list.filter((s) => s.id !== id);
    await db.setMeta(SAVED_SEARCHES_KEY, next);
    setSavedSearches(next);
  }, []);

  const onSaveAsSmartFilter = useCallback(() => {
    const name = prompt('Smart filter name:');
    if (!name) return;
    const rules = searchFiltersToScopeRules(filters, textQuery);
    navigate('/smart-filters', {
      state: {
        draftFilter: {
          name,
          entityType,
          match: 'all',
          rules: rules.length ? rules : [{ field: '', operator: 'exists', value: '' }],
        },
      },
    });
  }, [entityType, filters, textQuery, navigate]);

  const replaceFields = useMemo(() => replaceableFields(entityType), [entityType]);

  useEffect(() => {
    setReplaceField(replaceFields[0]?.id || '');
    setReplacePreview(null);
  }, [replaceFields]);

  useEffect(() => {
    let cancelled = false;
    listAllScopes(entityType).then((scopes) => {
      if (!cancelled) setScopeOptions(scopes);
    });
    return () => {
      cancelled = true;
    };
  }, [entityType]);

  const onRun = useCallback(async () => {
    setRunning(true);
    const r = await runSearch({ entityType, textQuery, filters });
    setResult(r);
    setRunning(false);
  }, [entityType, textQuery, filters]);

  const onRunScope = useCallback(async (scopeId) => {
    if (!scopeId) return;
    setRunning(true);
    setReplaceStatus('');
    try {
      const r = await runScope(scopeId);
      setEntityType(r.entityType);
      setFilters([]);
      setTextQuery('');
      setResult({ records: r.records, total: r.total, hasMore: false });
    } catch (error) {
      setReplaceStatus(error.message);
    } finally {
      setRunning(false);
    }
  }, []);

  const onAddFilter = useCallback(() => {
    const f = newFilter(entityType);
    if (f) setFilters((x) => [...x, f]);
  }, [entityType]);

  const onUpdateFilter = useCallback((i, next) => {
    setFilters((x) => x.map((f, j) => (i === j ? next : f)));
  }, []);

  const onRemoveFilter = useCallback((i) => {
    setFilters((x) => x.filter((_, j) => j !== i));
  }, []);

  const onPreviewReplace = useCallback(async () => {
    setRunning(true);
    setReplaceStatus('Building preview…');
    try {
      const preview = await previewSearchReplace({
        entityType,
        fieldName: replaceField,
        findText,
        replacementText,
        matchCase,
        wholeField,
        filters,
        textQuery,
      });
      setReplacePreview(preview);
      setReplaceStatus(`${preview.total.toLocaleString()} replacement${preview.total === 1 ? '' : 's'} ready across ${preview.searched.toLocaleString()} searched records.`);
    } catch (error) {
      setReplaceStatus(error.message);
    } finally {
      setRunning(false);
    }
  }, [entityType, replaceField, findText, replacementText, matchCase, wholeField, filters, textQuery]);

  const onApplyReplace = useCallback(async () => {
    if (!replacePreview?.changes?.length) return;
    if (!confirm(`Apply ${replacePreview.total.toLocaleString()} replacement${replacePreview.total === 1 ? '' : 's'}?`)) return;
    setRunning(true);
    setReplaceStatus('Applying replacements…');
    try {
      const applied = await applySearchReplace(replacePreview);
      setReplaceStatus(`Applied ${applied.changed.toLocaleString()} replacement${applied.changed === 1 ? '' : 's'}.`);
      setReplacePreview(null);
      await onRun();
    } catch (error) {
      setReplaceStatus(error.message);
    } finally {
      setRunning(false);
    }
  }, [replacePreview, onRun]);

  const onUndoReplace = useCallback(async () => {
    setRunning(true);
    setReplaceStatus('Undoing last Search and Replace…');
    try {
      const undone = await undoLastSearchReplace();
      setReplaceStatus(`Restored ${undone.restored.toLocaleString()} record${undone.restored === 1 ? '' : 's'}.`);
      await onRun();
    } catch (error) {
      setReplaceStatus(error.message);
    } finally {
      setRunning(false);
    }
  }, [onRun]);

  return (
    <div style={shell}>
      <header style={header}>
        <Field label="Entity">
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setFilters([]); setResult(null); }} style={input}>
            {ENTITY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Free text">
          <input
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            placeholder="Match any field…"
            style={{ ...input, minWidth: 200 }}
            onKeyDown={(e) => e.key === 'Enter' && onRun()}
          />
        </Field>

        <Field label="Smart Scope">
          <select
            value=""
            onChange={(e) => onRunScope(e.target.value)}
            style={{ ...input, minWidth: 200, cursor: 'pointer' }}
          >
            <option value="">Choose a scope…</option>
            {scopeOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.imported ? 'Imported: ' : ''}{s.label}{s.imported && !s.executable ? ' (preserved)' : ''}</option>
            ))}
          </select>
        </Field>

        <button onClick={onAddFilter} style={{ ...input, cursor: 'pointer', marginTop: 14 }}>+ Filter</button>
        <button onClick={onRun} disabled={running} style={{ ...input, cursor: 'pointer', marginTop: 14, background: 'hsl(var(--primary))' }}>
          {running ? 'Running…' : 'Search'}
        </button>

        <Field label="Saved searches">
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              value=""
              onChange={(e) => e.target.value && onLoadSearch(e.target.value)}
              style={{ ...input, cursor: 'pointer', minWidth: 180 }}
            >
              <option value="">{savedSearches.length ? 'Load saved…' : 'No saved searches'}</option>
              {savedSearches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button onClick={onSaveSearch} style={{ ...input, cursor: 'pointer' }} title="Persist the current search">Save</button>
            {savedSearches.length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && onDeleteSearch(e.target.value)}
                style={{ ...input, cursor: 'pointer', width: 80 }}
                title="Delete a saved search"
              >
                <option value="">Del…</option>
                {savedSearches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <button onClick={onSaveAsSmartFilter} style={{ ...input, cursor: 'pointer' }} title="Open this search in the Smart Filter editor">
              → Smart Filter
            </button>
          </div>
        </Field>
      </header>

      <div style={filterPanel}>
        {filters.length === 0 && <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>No filters. Type free text and click Search, or add field-specific filters with “+ Filter”.</div>}
        {filters.map((f, i) => (
          <FilterRow
            key={i}
            entityType={entityType}
            filter={f}
            onChange={(next) => onUpdateFilter(i, next)}
            onRemove={() => onRemoveFilter(i)}
          />
        ))}
      </div>

      <section style={replacePanel}>
        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Search and Replace</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Field">
            <select value={replaceField} onChange={(e) => setReplaceField(e.target.value)} style={{ ...input, minWidth: 150 }}>
              {replaceFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
            </select>
          </Field>
          <Field label="Find">
            <input value={findText} onChange={(e) => setFindText(e.target.value)} style={{ ...input, minWidth: 180 }} />
          </Field>
          <Field label="Replace with">
            <input value={replacementText} onChange={(e) => setReplacementText(e.target.value)} style={{ ...input, minWidth: 180 }} />
          </Field>
          <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case
          </label>
          <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={wholeField} onChange={(e) => setWholeField(e.target.checked)} /> Whole field
          </label>
          <button onClick={onPreviewReplace} disabled={running || !replaceField || !findText} style={input}>Preview</button>
          <button onClick={onApplyReplace} disabled={running || !replacePreview?.changes?.length} style={{ ...input, background: 'hsl(var(--primary))' }}>Apply</button>
          <button onClick={onUndoReplace} disabled={running} style={input}>Undo Last</button>
        </div>
        {replaceStatus && <div style={{ marginTop: 8, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{replaceStatus}</div>}
        {replacePreview?.changes?.length > 0 && (
          <div style={previewBox}>
            {replacePreview.changes.slice(0, 20).map((change) => (
              <div key={`${change.recordName}-${change.fieldName}`} style={previewRow}>
                <strong>{change.label}</strong>
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>{change.fieldName}</span>
                <span>{String(change.before)}</span>
                <span style={{ color: 'hsl(var(--primary))' }}>{String(change.after)}</span>
              </div>
            ))}
            {replacePreview.changes.length > 20 && (
              <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, padding: 6 }}>
                {replacePreview.changes.length - 20} more replacement previews hidden.
              </div>
            )}
          </div>
        )}
      </section>

      <main style={main}>
        <SearchResults entityType={entityType} result={result} />
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 12 }}>
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

const shell = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'hsl(var(--background))',
};
const header = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  padding: '12px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
  flexWrap: 'wrap',
};
const filterPanel = { padding: '12px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const replacePanel = { padding: '12px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const main = { flex: 1, position: 'relative', overflow: 'hidden' };
const input = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  padding: '8px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
};
const previewBox = { marginTop: 10, maxHeight: 180, overflow: 'auto', border: '1px solid hsl(var(--border))', borderRadius: 8 };
const previewRow = { display: 'grid', gridTemplateColumns: 'minmax(160px, 1.2fr) 120px minmax(160px, 1fr) minmax(160px, 1fr)', gap: 8, padding: '6px 8px', borderBottom: '1px solid hsl(var(--border))', fontSize: 12 };

export default SearchApp;
