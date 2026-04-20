/**
 * Change Log viewer — lists ChangeLogEntry records grouped by date.
 * Expand any row to fetch + show field-level ChangeLogSubEntries.
 *
 * Reads through the changeLogQuery helpers so it works for both legacy
 * mft entries and ones written by saveWithChangeLog.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  listChangeLogEntries,
  getSubEntriesForEntry,
  entityTypeOf,
  targetLabelOf,
  targetIdOf,
  changeKindOf,
  authorOf,
  timestampMillis,
  subEntryDescription,
} from '../lib/changeLogQuery.js';
import {
  PURGE_WINDOWS,
  purgeChangeLogOlderThan,
  purgeChangeLogForDeletedRecords,
} from '../lib/changeLog.js';
import { useModal } from '../contexts/ModalContext.jsx';

const ENTITY_TYPES = ['', 'Person', 'Family', 'PersonEvent', 'FamilyEvent', 'Place', 'Source'];

function formatDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function dateKey(ms) {
  if (!ms) return 'unknown';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return 'unknown';
  return d.toISOString().slice(0, 10);
}

export default function ChangeLog() {
  const modal = useModal();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [subs, setSubs] = useState({});
  const [purgeStatus, setPurgeStatus] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

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
    return () => { cancel = true; };
  }, [filter, reloadTick]);

  const runPurge = useCallback(async (window) => {
    if (!(await modal.confirm(`${window.label}?\n\nThis cannot be undone.`, { title: 'Purge change log', okLabel: 'Purge', destructive: true }))) return;
    setPurgeStatus('Purging…');
    try {
      const { removedEntries, removedSubEntries } = await purgeChangeLogOlderThan(window.ms);
      setPurgeStatus(`Removed ${removedEntries} entries and ${removedSubEntries} sub-entries.`);
      setSubs({});
      setExpanded(new Set());
      setReloadTick((n) => n + 1);
    } catch (error) {
      setPurgeStatus(`Purge failed: ${error?.message || error}`);
    }
  }, [modal]);

  const runPurgeOrphans = useCallback(async () => {
    if (!(await modal.confirm('Purge change-log entries for records that no longer exist?\n\nThis cannot be undone.', { title: 'Purge orphans', okLabel: 'Purge', destructive: true }))) return;
    setPurgeStatus('Purging orphans…');
    try {
      const { removedEntries, removedSubEntries } = await purgeChangeLogForDeletedRecords();
      setPurgeStatus(`Removed ${removedEntries} orphan entries and ${removedSubEntries} sub-entries.`);
      setSubs({});
      setExpanded(new Set());
      setReloadTick((n) => n + 1);
    } catch (error) {
      setPurgeStatus(`Purge failed: ${error?.message || error}`);
    }
  }, [modal]);

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
      const k = dateKey(timestampMillis(e));
      if (k !== currentKey) {
        currentKey = k;
        currentGroup = { key: k, entries: [] };
        groups.push(currentGroup);
      }
      currentGroup.entries.push(e);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <label className="text-xs text-muted-foreground">Entity</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-secondary text-foreground border border-border rounded-md px-2.5 py-1.5 text-sm outline-none"
        >
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t || 'All'}</option>)}
        </select>
        <span className="ms-auto text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${entries.length} entries`}
        </span>
      </header>

      <div className="px-5 py-2 border-b border-border bg-background flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground me-1">Purge:</span>
        {PURGE_WINDOWS.map((w) => (
          <button
            key={w.id}
            onClick={() => runPurge(w)}
            className="rounded-md border border-border bg-secondary px-2.5 py-1 hover:bg-accent"
            title={w.label}
          >
            {w.id}
          </button>
        ))}
        <button
          onClick={runPurgeOrphans}
          className="rounded-md border border-border bg-secondary px-2.5 py-1 hover:bg-accent"
          title="Purge entries whose target record no longer exists"
        >
          orphans
        </button>
        {purgeStatus && <span className="text-muted-foreground ms-2">{purgeStatus}</span>}
      </div>

      <main className="flex-1 overflow-auto p-5 bg-background">
        {!loading && entries.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            No change log entries{filter ? ` for ${filter}` : ''}.
          </div>
        )}
        {groups.map((g) => (
          <section key={g.key} className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {g.key === 'unknown' ? 'Unknown date' : g.key}
            </div>
            {g.entries.map((e) => {
              const isOpen = expanded.has(e.recordName);
              const kind = changeKindOf(e);
              return (
                <div key={e.recordName} className="bg-card border border-border rounded-md mb-1.5">
                  <button
                    onClick={() => toggle(e.recordName)}
                    className="flex items-center w-full px-3 py-2.5 text-start hover:bg-secondary/40 transition-colors"
                  >
                    {kind && <KindBadge kind={kind} />}
                    <span className="flex-1 ms-3 text-sm">
                      <span className="text-muted-foreground me-2">{entityTypeOf(e) || 'Record'}</span>
                      <span className="text-foreground">{targetLabelOf(e) || targetIdOf(e)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground me-3">{formatDate(timestampMillis(e))}</span>
                    <span className="text-muted-foreground">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border bg-background/60">
                      <SubEntries
                        subs={subs[e.recordName] || []}
                        entityType={entityTypeOf(e)}
                        author={authorOf(e)}
                        targetId={targetIdOf(e)}
                      />
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

function SubEntries({ subs, entityType, author, targetId }) {
  if (subs.length === 0) {
    return (
      <div className="px-4 py-3">
        <div className="text-xs text-muted-foreground italic">No field-level changes recorded.</div>
        {(author || targetId) && (
          <div className="text-[11px] text-muted-foreground mt-1">
            {author && <>Author: {author} · </>}Target: {targetId || '—'}
          </div>
        )}
      </div>
    );
  }
  // Order sub-entries by their own changeDate so the sentence list reads chronologically.
  const ordered = [...subs].sort(
    (a, b) => (a.fields?.changeDate?.value || 0) - (b.fields?.changeDate?.value || 0)
  );
  return (
    <div>
      {ordered.map((s) => {
        const ts = s.fields?.changeDate?.value;
        return (
          <div
            key={s.recordName}
            className="flex items-center px-4 py-2 border-t border-border/40 first:border-t-0"
          >
            <span className="flex-1 text-sm text-foreground pr-4 break-words" dir="auto">
              {subEntryDescription(s, entityType)}
            </span>
            {ts && (
              <span className="text-[11px] text-muted-foreground ms-2 whitespace-nowrap">
                {new Date(ts).toLocaleString()}
              </span>
            )}
          </div>
        );
      })}
      {(author || targetId) && (
        <div className="px-4 py-2 border-t border-border/40 text-[11px] text-muted-foreground">
          {author && <>Author: {author} · </>}Target: {targetId || '—'}
        </div>
      )}
    </div>
  );
}

const KIND_COLORS = {
  Add: 'text-emerald-500 border-emerald-500/40',
  Delete: 'text-destructive border-destructive/40',
  Change: 'text-primary border-primary/40',
  ResolvedConflict: 'text-amber-500 border-amber-500/40',
};

function KindBadge({ kind }) {
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider rounded border px-2 py-0.5 min-w-[60px] text-center ${KIND_COLORS[kind] || 'text-muted-foreground border-border'}`}>
      {kind}
    </span>
  );
}
