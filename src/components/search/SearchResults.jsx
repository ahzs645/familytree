/**
 * Renders matched records from search.runSearch() as a table-ish list.
 */
import React from 'react';
import { SEARCH_FIELDS } from '../../lib/search.js';

export function SearchResults({ entityType, result }) {
  if (!result) return <div style={{ padding: 24, color: '#8b90a0' }}>Run a search to see results.</div>;
  if (result.records.length === 0) return <div style={{ padding: 24, color: '#8b90a0' }}>No matches.</div>;

  const cols = (SEARCH_FIELDS[entityType] || []).slice(0, 5);

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      <div style={{ padding: '8px 16px', color: '#8b90a0', fontSize: 12 }}>
        {result.total} match{result.total === 1 ? '' : 'es'}{result.hasMore ? ` (showing first ${result.records.length})` : ''}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#161926', position: 'sticky', top: 0 }}>
            {cols.map((c) => (
              <th key={c.id} style={th}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.records.map((r) => (
            <tr key={r.recordName} style={{ borderBottom: '1px solid #1f2230' }}>
              {cols.map((c) => (
                <td key={c.id} style={td}>
                  {formatVal(r.fields?.[c.id]?.value, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatVal(v, col) {
  if (v == null || v === '') return <span style={{ color: '#5b6072' }}>—</span>;
  if (col.type === 'enum') {
    const opt = col.options.find((o) => o.value === v);
    return opt ? opt.label : String(v);
  }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 40);
  return String(v);
}

const th = { textAlign: 'left', padding: '10px 14px', color: '#8b90a0', fontWeight: 600, borderBottom: '1px solid #2e3345' };
const td = { padding: '8px 14px', color: '#e2e4eb' };

export default SearchResults;
