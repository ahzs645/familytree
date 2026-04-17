/**
 * SearchApp — top-level UI for the search page.
 * Pick entity type, build filter rows, run search, view results.
 */
import React, { useState, useCallback } from 'react';
import { ENTITY_TYPES, SEARCH_FIELDS, FILTER_OPS, runSearch } from '../../lib/search.js';
import { listScopes, runScope } from '../../lib/smartScopes.js';
import { FilterRow } from './FilterRow.jsx';
import { SearchResults } from './SearchResults.jsx';

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

  const onRun = useCallback(async () => {
    setRunning(true);
    const r = await runSearch({ entityType, textQuery, filters });
    setResult(r);
    setRunning(false);
  }, [entityType, textQuery, filters]);

  const onRunScope = useCallback(async (scopeId) => {
    if (!scopeId) return;
    setRunning(true);
    const r = await runScope(scopeId);
    setEntityType(r.entityType);
    setFilters([]);
    setTextQuery('');
    setResult({ records: r.records, total: r.total, hasMore: false });
    setRunning(false);
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
            {listScopes().map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </Field>

        <button onClick={onAddFilter} style={{ ...input, cursor: 'pointer', marginTop: 14 }}>+ Filter</button>
        <button onClick={onRun} disabled={running} style={{ ...input, cursor: 'pointer', marginTop: 14, background: 'hsl(var(--primary))' }}>
          {running ? 'Running…' : 'Search'}
        </button>
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

export default SearchApp;
