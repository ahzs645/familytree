/**
 * SearchApp — top-level UI for the search page.
 * Pick entity type, build filter rows, run search, view results.
 */
import React, { useState, useCallback } from 'react';
import { ENTITY_TYPES, SEARCH_FIELDS, FILTER_OPS, runSearch } from '../../lib/search.js';
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
        <a href="/" style={{ color: '#8b90a0', textDecoration: 'none', marginRight: 16, fontSize: 13 }}>← Home</a>
        <strong style={{ color: '#e2e4eb', marginRight: 24 }}>Search</strong>

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

        <button onClick={onAddFilter} style={{ ...input, cursor: 'pointer', marginTop: 14 }}>+ Filter</button>
        <button onClick={onRun} disabled={running} style={{ ...input, cursor: 'pointer', marginTop: 14, background: '#3b6db8' }}>
          {running ? 'Running…' : 'Search'}
        </button>
      </header>

      <div style={filterPanel}>
        {filters.length === 0 && <div style={{ color: '#5b6072', fontSize: 13 }}>No filters. Type free text and click Search, or add field-specific filters with “+ Filter”.</div>}
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
      <span style={{ color: '#8b90a0', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

const shell = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: '#0f1117',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
};
const header = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 8,
  padding: '12px 20px',
  borderBottom: '1px solid #2e3345',
  background: '#161926',
  flexWrap: 'wrap',
};
const filterPanel = { padding: '12px 20px', borderBottom: '1px solid #2e3345', background: '#13161f' };
const main = { flex: 1, position: 'relative', overflow: 'hidden' };
const input = {
  background: '#242837',
  color: '#e2e4eb',
  border: '1px solid #2e3345',
  borderRadius: 8,
  padding: '8px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
};

export default SearchApp;
