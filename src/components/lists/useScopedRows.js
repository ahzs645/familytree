import { useEffect, useMemo, useState } from 'react';
import { listAllScopes, runScope } from '../../lib/smartScopes.js';

function normalizeIds(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value == null || value === '') return [];
  return [String(value)];
}

export function useScopedRows(rows, {
  entityType,
  rowIds = (row) => row.id,
  enabled = true,
} = {}) {
  const [scopes, setScopes] = useState([]);
  const [scopeId, setScopeId] = useState('');
  const [matchedIds, setMatchedIds] = useState(null);
  const [loadingScopes, setLoadingScopes] = useState(false);
  const [applyingScope, setApplyingScope] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !entityType) {
      setScopes([]);
      setScopeId('');
      setMatchedIds(null);
      return undefined;
    }
    setLoadingScopes(true);
    listAllScopes(entityType)
      .then((next) => {
        if (!cancelled) setScopes(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Unable to load smart filters.');
      })
      .finally(() => {
        if (!cancelled) setLoadingScopes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, entityType]);

  useEffect(() => {
    let cancelled = false;
    if (!scopeId) {
      setMatchedIds(null);
      setError('');
      return undefined;
    }
    setApplyingScope(true);
    setError('');
    runScope(scopeId)
      .then((result) => {
        if (cancelled) return;
        setMatchedIds(new Set((result.records || []).map((record) => String(record.recordName))));
      })
      .catch((err) => {
        if (cancelled) return;
        setMatchedIds(null);
        setError(err?.message || 'Unable to apply smart filter.');
      })
      .finally(() => {
        if (!cancelled) setApplyingScope(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeId]);

  const scopedRows = useMemo(() => {
    if (!matchedIds) return rows;
    return rows.filter((row) => normalizeIds(rowIds(row)).some((id) => matchedIds.has(id)));
  }, [rows, rowIds, matchedIds]);

  const selectedScope = scopes.find((scope) => scope.id === scopeId) || null;

  return {
    rows: scopedRows,
    scopes,
    scopeId,
    setScopeId,
    selectedScope,
    loading: loadingScopes || applyingScope,
    error,
  };
}

export default useScopedRows;
