/**
 * Plausibility checker — flags improbable data (dates, ages, lifespans).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { runPlausibilityChecks } from '../lib/plausibility.js';
import { getAppPreferences } from '../lib/appPreferences.js';

const SEV_COLORS = {
  high: 'text-destructive border-destructive/40',
  medium: 'text-amber-500 border-amber-500/40',
  low: 'text-muted-foreground border-border',
};

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
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Plausibility checker</h1>
        <span className="text-xs text-muted-foreground ms-2">{warnings.length} warnings</span>
        <div className="ms-auto flex gap-2">
          {[['', 'All'], ['high', `High (${counts.high || 0})`], ['medium', `Medium (${counts.medium || 0})`], ['low', `Low (${counts.low || 0})`]].map(([id, lbl]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`text-xs px-3 py-1.5 rounded-md border ${filter === id ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-secondary text-foreground'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 overflow-auto p-5 bg-background">
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {warnings.length === 0 ? 'No plausibility issues found 🎉' : 'No warnings at this severity.'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((w, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-md">
                <span className={`inline-block text-[10px] font-bold uppercase tracking-wider rounded border px-2 py-0.5 min-w-[60px] text-center ${SEV_COLORS[w.severity]}`}>
                  {w.severity}
                </span>
                <span className="flex-1 text-sm">{w.message}</span>
                <span className="text-[11px] text-muted-foreground font-mono">{w.rule}</span>
                <button
                  onClick={() => navigate(w.recordType === 'Family' ? `/family/${w.recordName}` : `/person/${w.recordName}`)}
                  className="text-xs text-primary border border-border rounded-md px-2 py-1 hover:bg-accent"
                >
                  open
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
