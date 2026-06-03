/**
 * SearchApp — top-level UI for the search page.
 * Pick entity type, build filter rows, run search, view results.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ENTITY_TYPES, SEARCH_FIELDS, FILTER_OPS, runGenealogyAdvancedSearch, runSearch } from '../../lib/search.js';
import { listAllScopes, runScope } from '../../lib/smartScopes.js';
import { applySearchReplace, previewSearchReplace, replaceableFields, undoLastSearchReplace } from '../../lib/searchReplace.js';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { generateId } from '../../lib/ids.js';
import { FilterRow } from './FilterRow.jsx';
import { SearchResults } from './SearchResults.jsx';
import { useModal } from '../../contexts/ModalContext.jsx';
import { Select } from '../ui/Select.jsx';

const SAVED_SEARCHES_KEY = 'savedSearches';
const EMPTY_GENEALOGY_SEARCH = Object.freeze({
  matchMode: 'all',
  firstName: '',
  exactFirstName: false,
  surname: '',
  exactSurname: false,
  alias: '',
  gender: '',
  occupation: '',
  birthPlace: '',
  birthBefore: '',
  birthAfter: '',
  deathPlace: '',
  deathBefore: '',
  deathAfter: '',
  marriagePlace: '',
  marriageBefore: '',
  marriageAfter: '',
  baptismPlace: '',
  baptismBefore: '',
  baptismAfter: '',
  burialPlace: '',
  burialBefore: '',
  burialAfter: '',
});

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
  const modal = useModal();
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
  const [showGenealogySearch, setShowGenealogySearch] = useState(false);
  const [genealogySearch, setGenealogySearch] = useState(EMPTY_GENEALOGY_SEARCH);
  const location = useLocation();
  const navigate = useNavigate();
  const isSearchReplaceRoute = location.pathname === '/search-and-replace';

  const loadSaved = useCallback(async () => {
    const list = await getLocalDatabase().getMeta(SAVED_SEARCHES_KEY);
    setSavedSearches(Array.isArray(list) ? list : []);
  }, []);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  const onSaveSearch = useCallback(async () => {
    const name = await modal.prompt('Save this search as:', '', { title: 'Save search' });
    if (!name) return;
    const db = getLocalDatabase();
    const list = Array.isArray(await db.getMeta(SAVED_SEARCHES_KEY)) ? await db.getMeta(SAVED_SEARCHES_KEY) : [];
    const entry = {
      id: generateId('ss', { randomLength: 4 }),
      name,
      entityType,
      textQuery,
      filters,
      savedAt: new Date().toISOString(),
    };
    const next = [...list, entry];
    await db.setMeta(SAVED_SEARCHES_KEY, next);
    setSavedSearches(next);
  }, [entityType, textQuery, filters, modal]);

  const onLoadSearch = useCallback((id) => {
    const entry = savedSearches.find((s) => s.id === id);
    if (!entry) return;
    setEntityType(entry.entityType || 'Person');
    setTextQuery(entry.textQuery || '');
    setFilters(entry.filters || []);
    setResult(null);
  }, [savedSearches]);

  const onDeleteSearch = useCallback(async (id) => {
    if (!(await modal.confirm('Delete saved search?', { title: 'Delete saved search', okLabel: 'Delete', destructive: true }))) return;
    const db = getLocalDatabase();
    const list = Array.isArray(await db.getMeta(SAVED_SEARCHES_KEY)) ? await db.getMeta(SAVED_SEARCHES_KEY) : [];
    const next = list.filter((s) => s.id !== id);
    await db.setMeta(SAVED_SEARCHES_KEY, next);
    setSavedSearches(next);
  }, [modal]);

  const onSaveAsSmartFilter = useCallback(async () => {
    const name = await modal.prompt('Smart filter name:', '', { title: 'Save as smart filter' });
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
  }, [entityType, filters, textQuery, navigate, modal]);

  const replaceFields = useMemo(() => replaceableFields(entityType), [entityType]);
  const entityTypeOptions = useMemo(() => ENTITY_TYPES.map((type) => ({ value: type.id, label: type.label })), []);
  const scopeSelectOptions = useMemo(() => [
    { value: '', label: 'Choose a scope…' },
    ...scopeOptions.map((scope) => ({
      value: scope.id,
      label: `${scope.imported ? 'Imported: ' : ''}${scope.label}${scope.imported && !scope.executable ? ' (preserved)' : ''}`,
    })),
  ], [scopeOptions]);
  const savedSearchOptions = useMemo(() => [
    { value: '', label: savedSearches.length ? 'Load saved…' : 'No saved searches' },
    ...savedSearches.map((search) => ({ value: search.id, label: search.name })),
  ], [savedSearches]);
  const deleteSavedSearchOptions = useMemo(() => [
    { value: '', label: 'Del…' },
    ...savedSearches.map((search) => ({ value: search.id, label: search.name })),
  ], [savedSearches]);
  const replaceFieldOptions = useMemo(() => replaceFields.map((field) => ({ value: field.id, label: field.label })), [replaceFields]);
  const genealogyGenderOptions = useMemo(() => [
    { value: '', label: 'Any gender' },
    { value: '0', label: 'Male' },
    { value: '1', label: 'Female' },
    { value: '2', label: 'Unknown' },
    { value: '3', label: 'Intersex' },
  ], []);

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

  const updateGenealogySearch = useCallback((field, value) => {
    setGenealogySearch((current) => ({ ...current, [field]: value }));
  }, []);

  const onRunGenealogySearch = useCallback(async () => {
    setRunning(true);
    setEntityType('Person');
    setReplaceStatus('');
    try {
      const r = await runGenealogyAdvancedSearch(genealogySearch);
      setResult(r);
    } catch (error) {
      setReplaceStatus(error.message);
    } finally {
      setRunning(false);
    }
  }, [genealogySearch]);

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
    if (!(await modal.confirm(`Apply ${replacePreview.total.toLocaleString()} replacement${replacePreview.total === 1 ? '' : 's'}?`, { title: 'Apply replacements', okLabel: 'Apply' }))) return;
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
  }, [replacePreview, onRun, modal]);

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
          <Select
            value={entityType}
            onChange={(value) => { setEntityType(value); setFilters([]); setResult(null); }}
            options={entityTypeOptions}
            triggerClassName="h-auto"
            triggerStyle={input}
          />
        </Field>

        <Field label="Free text">
          <input
            value={textQuery}
            onChange={(e) => setTextQuery(e.target.value)}
            placeholder="Match any field…"
            style={{ ...input, width: '100%', minWidth: 0 }}
            onKeyDown={(e) => e.key === 'Enter' && onRun()}
          />
        </Field>

        <Field label="Smart Scope">
          <Select
            value=""
            onChange={onRunScope}
            options={scopeSelectOptions}
            style={{ width: '100%', minWidth: 0 }}
            triggerClassName="h-auto"
            triggerStyle={{ ...input, cursor: 'pointer' }}
          />
        </Field>

        <button onClick={onAddFilter} style={{ ...input, cursor: 'pointer', marginTop: 14 }}>+ Filter</button>
        <button
          onClick={() => setShowGenealogySearch((value) => !value)}
          style={{ ...input, cursor: 'pointer', marginTop: 14 }}
          title="Show genealogy-specific person criteria"
        >
          Genealogy
        </button>
        <button onClick={onRun} disabled={running} style={{ ...primaryButton, cursor: 'pointer', marginTop: 14 }}>
          {running ? 'Running…' : 'Search'}
        </button>

        <Field label="Saved searches">
          <div style={{ display: 'flex', gap: 4 }}>
            <Select
              value=""
              onChange={(value) => value && onLoadSearch(value)}
              options={savedSearchOptions}
              style={{ flex: '1 1 180px', minWidth: 0 }}
              triggerClassName="h-auto"
              triggerStyle={{ ...input, cursor: 'pointer' }}
            />
            <button onClick={onSaveSearch} style={{ ...input, cursor: 'pointer' }} title="Persist the current search">Save</button>
            {savedSearches.length > 0 && (
              <Select
                value=""
                onChange={(value) => value && onDeleteSearch(value)}
                options={deleteSavedSearchOptions}
                style={{ width: 80 }}
                triggerClassName="h-auto"
                triggerStyle={{ ...input, cursor: 'pointer' }}
              />
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

      {showGenealogySearch && (
        <section style={genealogyPanel}>
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Genealogy Advanced Search</div>
          <div style={genealogyGrid}>
            <Field label="Match">
              <Select
                value={genealogySearch.matchMode}
                onChange={(value) => updateGenealogySearch('matchMode', value)}
                options={[{ value: 'all', label: 'All criteria' }, { value: 'any', label: 'Any criteria' }]}
                triggerClassName="h-auto"
                triggerStyle={input}
              />
            </Field>
            <TextField label="First name" value={genealogySearch.firstName} onChange={(value) => updateGenealogySearch('firstName', value)} />
            <CheckField label="Exact first" checked={genealogySearch.exactFirstName} onChange={(value) => updateGenealogySearch('exactFirstName', value)} />
            <TextField label="Surname" value={genealogySearch.surname} onChange={(value) => updateGenealogySearch('surname', value)} />
            <CheckField label="Exact surname" checked={genealogySearch.exactSurname} onChange={(value) => updateGenealogySearch('exactSurname', value)} />
            <TextField label="Alias/public name" value={genealogySearch.alias} onChange={(value) => updateGenealogySearch('alias', value)} />
            <Field label="Gender">
              <Select
                value={genealogySearch.gender}
                onChange={(value) => updateGenealogySearch('gender', value)}
                options={genealogyGenderOptions}
                triggerClassName="h-auto"
                triggerStyle={input}
              />
            </Field>
            <TextField label="Occupation/fact" value={genealogySearch.occupation} onChange={(value) => updateGenealogySearch('occupation', value)} />
            <EventCriteria label="Birth" prefix="birth" values={genealogySearch} onChange={updateGenealogySearch} />
            <EventCriteria label="Death" prefix="death" values={genealogySearch} onChange={updateGenealogySearch} />
            <EventCriteria label="Marriage" prefix="marriage" values={genealogySearch} onChange={updateGenealogySearch} />
            <EventCriteria label="Baptism" prefix="baptism" values={genealogySearch} onChange={updateGenealogySearch} />
            <EventCriteria label="Burial" prefix="burial" values={genealogySearch} onChange={updateGenealogySearch} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={onRunGenealogySearch} disabled={running} style={primaryButton}>{running ? 'Running…' : 'Run Genealogy Search'}</button>
            <button onClick={() => setGenealogySearch(EMPTY_GENEALOGY_SEARCH)} disabled={running} style={input}>Reset</button>
          </div>
        </section>
      )}

      {isSearchReplaceRoute && (
        <section style={replacePanel}>
          <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Search and Replace</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="Field">
              <Select
                value={replaceField}
                onChange={setReplaceField}
                options={replaceFieldOptions}
                style={{ width: '100%', minWidth: 0 }}
                triggerClassName="h-auto"
                triggerStyle={input}
              />
            </Field>
            <Field label="Find">
              <input value={findText} onChange={(e) => setFindText(e.target.value)} style={{ ...input, width: '100%', minWidth: 0 }} />
            </Field>
            <Field label="Replace with">
              <input value={replacementText} onChange={(e) => setReplacementText(e.target.value)} style={{ ...input, width: '100%', minWidth: 0 }} />
            </Field>
            <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case
            </label>
            <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={wholeField} onChange={(e) => setWholeField(e.target.checked)} /> Whole field
            </label>
            <button onClick={onPreviewReplace} disabled={running || !replaceField || !findText} style={input}>Preview</button>
            <button onClick={onApplyReplace} disabled={running || !replacePreview?.changes?.length} style={primaryButton}>Apply</button>
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
      )}

      <main style={main}>
        <SearchResults entityType={entityType} result={result} />
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginRight: 12, minWidth: 0, flex: '1 1 auto' }}>
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={{ ...input, width: '100%', minWidth: 0 }} />
    </Field>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6, minHeight: 36 }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}
    </label>
  );
}

function EventCriteria({ label, prefix, values, onChange }) {
  return (
    <>
      <TextField label={`${label} place`} value={values[`${prefix}Place`]} onChange={(value) => onChange(`${prefix}Place`, value)} />
      <TextField label={`${label} before`} value={values[`${prefix}Before`]} onChange={(value) => onChange(`${prefix}Before`, value)} />
      <TextField label={`${label} after`} value={values[`${prefix}After`]} onChange={(value) => onChange(`${prefix}After`, value)} />
    </>
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
const genealogyPanel = { padding: '12px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const genealogyGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, alignItems: 'end' };
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
const primaryButton = {
  ...input,
  background: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
};
const previewBox = { marginTop: 10, maxHeight: 180, overflow: 'auto', border: '1px solid hsl(var(--border))', borderRadius: 8 };
const previewRow = { display: 'grid', gridTemplateColumns: 'minmax(120px, 1.2fr) minmax(80px, 0.8fr) minmax(120px, 1fr) minmax(120px, 1fr)', gap: 8, padding: '6px 8px', borderBottom: '1px solid hsl(var(--border))', fontSize: 12, wordBreak: 'break-word' };

export default SearchApp;
