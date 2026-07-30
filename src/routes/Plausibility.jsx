/**
 * Plausibility checker — flags improbable data (dates, ages, lifespans).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterChip } from '../components/ui/FilterChip.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { runPlausibilityChecks } from '../lib/plausibility.js';
import { getAppPreferences } from '../lib/appPreferences.js';

export default function Plausibility() {
  const [warnings, setWarnings] = useState(null);
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancel = false;
    (async () => {
      const prefs = await getAppPreferences();
      const w = await runPlausibilityChecks(prefs.plausibility);
      if (!cancel) setWarnings(w);
    })();
    return () => { cancel = true; };
  }, []);

  if (warnings == null) return <div className="p-10 text-muted-foreground">Running checks…</div>;
  const filtered = filter ? warnings.filter((w) => w.severity === filter) : warnings;
  const counts = warnings.reduce((acc, w) => ({ ...acc, [w.severity]: (acc[w.severity] || 0) + 1 }), {});

  return (
    <div className="flex flex-col h-full">
      <header className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h2 className="text-base font-semibold">Plausibility checker</h2>
        <span className="text-xs text-muted-foreground ms-2">{warnings.length} warnings</span>
        <div className="ms-auto flex flex-wrap gap-2">
          {[['', 'All'], ['high', `High (${counts.high || 0})`], ['medium', `Medium (${counts.medium || 0})`], ['low', `Low (${counts.low || 0})`]].map(([id, lbl]) => (
            <FilterChip key={id} active={filter === id} onClick={() => setFilter(id)}>
              {lbl}
            </FilterChip>
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-5 bg-background">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {warnings.length === 0 ? 'No plausibility issues found 🎉' : 'No warnings at this severity.'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((w, i) => (
              <div key={i} className="flex flex-col gap-2 p-3 bg-card border border-border rounded-md sm:flex-row sm:items-center sm:gap-3">
                <div className="flex items-start gap-3 sm:flex-1">
                  <StatusBadge tone={w.severity}>
                    {w.severity}
                  </StatusBadge>
                  <span className="flex-1 text-sm">{w.message}</span>
                </div>
                <div className="flex items-center justify-between gap-3 ps-[72px] sm:ps-0">
                  <span className="text-[11px] text-muted-foreground/70 font-mono">{w.rule}</span>
                  <button
                    onClick={() => navigate(w.recordType === 'Family' ? `/family/${w.recordName}` : `/person/${w.recordName}`)}
                    className="text-xs text-interactive border border-border rounded-md px-2 py-1 hover:bg-accent"
                  >
                    open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
