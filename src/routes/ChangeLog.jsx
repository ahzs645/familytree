/**
 * Change Log viewer — lists recent ChangeLogEntry records grouped by date,
 * expandable to show field-level sub-entries.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { listChangeLogEntries, getSubEntriesForEntry } from '../lib/changeLogQuery.js';
import { refToRecordName } from '../lib/recordRef.js';

const ENTITY_TYPES = ['', 'Person', 'Family', 'PersonEvent', 'FamilyEvent', 'Place', 'Source'];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16);
  return d.toLocaleString();
}

function dateKey(iso) {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10);
}

export default function ChangeLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [subs, setSubs] = useState({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const list = await listChangeLogEntries({ entityType: filter || undefined });
      if (!cancel) {
        setEntries(list);
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [filter]);

  const toggle = useCallback(async (recordName) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(recordName)) next.delete(recordName);
      else next.add(recordName);
      return next;
    });
    if (!subs[recordName]) {
      const list = await getSubEntriesForEntry(recordName);
      setSubs((prev) => ({ ...prev, [recordName]: list }));
    }
  }, [subs]);

  const groups = [];
  {
    let currentKey = null;
    let currentGroup = null;
    for (const e of entries) {
      const k = dateKey(e.fields?.timestamp?.value || e.fields?.mft_changeDate?.value);
      if (k !== currentKey) {
        currentKey = k;
        currentGroup = { key: k, entries: [] };
        groups.push(currentGroup);
      }
      currentGroup.entries.push(e);
    }
  }

  return (
    <div style={shell}>
      <header style={header}>
        <label style={label}>Entity:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={select}>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{t || 'All'}</option>
          ))}
        </select>
        <span style={{ marginLeft: 'auto', color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
          {loading ? 'Loading…' : `${entries.length} entries`}
        </span>
      </header>
      <main style={main}>
        {!loading && entries.length === 0 && (
          <div style={{ color: 'hsl(var(--muted-foreground))', padding: 40, textAlign: 'center' }}>
            No change log entries yet.
          </div>
        )}
        {groups.map((g) => (
          <section key={g.key} style={{ marginBottom: 24 }}>
            <div style={dateHeader}>{g.key === 'unknown' ? 'Unknown date' : g.key}</div>
            {g.entries.map((e) => {
              const isOpen = expanded.has(e.recordName);
              const f = e.fields || {};
              return (
                <div key={e.recordName} style={row}>
                  <button onClick={() => toggle(e.recordName)} style={rowHead}>
                    <span style={kindBadge(f.changeType?.value)}>{f.changeType?.value || '—'}</span>
                    <span style={{ color: 'hsl(var(--foreground))', flex: 1, marginLeft: 10 }}>
                      {f.targetType?.value || 'Record'} · {f.summary?.value || refToRecordName(f.target?.value) || ''}
                    </span>
                    <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, marginRight: 10 }}>
                      {formatDate(f.timestamp?.value || f.mft_changeDate?.value)}
                    </span>
                    <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div style={detail}>
                      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12, marginBottom: 6 }}>
                        Author: {f.author?.value || 'unknown'} · Target: {refToRecordName(f.target?.value)}
                      </div>
                      {(subs[e.recordName] || []).length === 0 ? (
                        <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>No field-level detail.</div>
                      ) : (
                        <table style={subTable}>
                          <thead>
                            <tr>
                              <th style={subTh}>Field</th>
                              <th style={subTh}>Before</th>
                              <th style={subTh}>After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(subs[e.recordName] || []).map((s) => (
                              <tr key={s.recordName}>
                                <td style={subTd}>{s.fields?.fieldName?.value || '—'}</td>
                                <td style={subTd}>{s.fields?.oldValue?.value || <em style={{ color: 'hsl(var(--muted-foreground))' }}>empty</em>}</td>
                                <td style={subTd}>{s.fields?.newValue?.value || <em style={{ color: 'hsl(var(--muted-foreground))' }}>empty</em>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </main>
    </div>
  );
}

function kindBadge(kind) {
  const colors = { Add: '#4ade80', Delete: 'hsl(var(--destructive))', Change: 'hsl(var(--primary))', ResolvedConflict: '#fb923c' };
  return {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    color: colors[kind] || 'hsl(var(--muted-foreground))',
    border: `1px solid ${colors[kind] || 'hsl(var(--muted-foreground))'}`,
    borderRadius: 4,
    padding: '2px 6px',
    minWidth: 60,
    textAlign: 'center',
  };
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%' };
const header = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' };
const label = { color: 'hsl(var(--muted-foreground))', fontSize: 12 };
const select = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '7px 10px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none' };
const main = { flex: 1, overflow: 'auto', padding: '16px 24px' };
const dateHeader = { color: 'hsl(var(--muted-foreground))', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 8 };
const row = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, marginBottom: 6 };
const rowHead = { display: 'flex', alignItems: 'center', width: '100%', background: 'transparent', border: 'none', padding: '10px 14px', cursor: 'pointer', color: 'hsl(var(--foreground))' };
const detail = { padding: '10px 14px 14px', borderTop: '1px solid hsl(var(--border))' };
const subTable = { width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 4 };
const subTh = { textAlign: 'left', padding: '5px 8px', color: 'hsl(var(--muted-foreground))', fontWeight: 600, borderBottom: '1px solid hsl(var(--border))' };
const subTd = { padding: '5px 8px', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))', fontFamily: '"SF Mono", Consolas, monospace', fontSize: 11.5, wordBreak: 'break-word', verticalAlign: 'top' };
