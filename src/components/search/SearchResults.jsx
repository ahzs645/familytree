/**
 * Renders matched records from search.runSearch() as a table-ish list.
 */
import React from 'react';
import { SEARCH_FIELDS } from '../../lib/search.js';
import { BdiText, LtrText } from '../BdiText.jsx';

export function SearchResults({ entityType, result }) {
  if (!result) return <div className="p-6 text-muted-foreground">Run a search to see results.</div>;
  if (result.records.length === 0) return <div className="p-6 text-muted-foreground">No matches.</div>;

  const cols = (SEARCH_FIELDS[entityType] || []).slice(0, 5);

  return (
    <div className="h-full overflow-auto">
      <div className="px-4 py-2 text-xs text-muted-foreground">
        {result.total} match{result.total === 1 ? '' : 'es'}{result.hasMore ? ` (showing first ${result.records.length})` : ''}
      </div>
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 bg-card">
            {cols.map((c) => (
              <th key={c.id} className="border-b border-border px-3.5 py-2.5 text-start font-semibold text-muted-foreground">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.records.map((r) => (
            <tr key={r.recordName} className="border-b border-border">
              {cols.map((c) => (
                <td key={c.id} className="px-3.5 py-2 text-foreground">
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
  if (v == null || v === '') return <span className="text-muted-foreground">—</span>;
  if (col.type === 'enum') {
    const opt = col.options.find((o) => o.value === v);
    return opt ? opt.label : String(v);
  }
  if (typeof v === 'object') return <BdiText>{JSON.stringify(v).slice(0, 40)}</BdiText>;
  if (/date|year/i.test(col.id || '')) return <LtrText>{String(v)}</LtrText>;
  return <BdiText>{String(v)}</BdiText>;
}

export default SearchResults;
