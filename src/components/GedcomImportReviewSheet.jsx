/**
 * Post-import review sheet for GEDCOM imports.
 * Mirrors MacFamilyTree's `GedcomImporterIssuesAnalyzerSheet`: shows unparsed
 * tags and unreadable dates collected during `analyzeGedcomText`.
 */
import React, { useMemo, useState } from 'react';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'warnings', label: 'Warnings' },
  { id: 'errors', label: 'Errors' },
];

export function GedcomImportReviewSheet({ result, onClose }) {
  const [tab, setTab] = useState('summary');
  const groups = useMemo(() => {
    const all = Array.isArray(result?.issues) ? result.issues : [];
    return {
      warnings: all.filter((item) => item.severity === 'warning'),
      errors: all.filter((item) => item.severity === 'error'),
      info: all.filter((item) => !['warning', 'error'].includes(item.severity)),
    };
  }, [result]);
  if (!result) return null;
  const counts = result.counts || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-lg">
        <header className="px-5 py-3 border-b border-border flex items-center gap-3">
          <h2 className="text-base font-semibold">GEDCOM Import Issues</h2>
          <span className="text-xs text-muted-foreground">
            {result.total ? `${result.total.toLocaleString()} records imported` : 'Import complete'}
          </span>
          <button onClick={onClose} className="ms-auto text-sm text-muted-foreground hover:text-foreground">Close</button>
        </header>
        <nav className="px-5 pt-3 border-b border-border flex gap-1">
          {TABS.map((t) => {
            const count = t.id === 'summary' ? null : groups[t.id].length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-xs px-3 py-1.5 rounded-t-md border border-b-0 transition-colors ${
                  tab === t.id ? 'bg-background border-border' : 'bg-secondary border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}{count !== null ? ` · ${count}` : ''}
              </button>
            );
          })}
        </nav>
        <main className="flex-1 overflow-auto p-5">
          {tab === 'summary' && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2">
                {['INDI', 'FAM', 'SOUR', 'NOTE', 'OBJE', 'unsupportedEvents'].map((k) => (
                  <div key={k} className="bg-secondary border border-border rounded-md p-3">
                    <div className="text-xs text-muted-foreground">{label(k)}</div>
                    <div className="text-lg font-semibold">{Number(counts[k] || 0).toLocaleString()}</div>
                  </div>
                ))}
              </div>
              {groups.errors.length === 0 && groups.warnings.length === 0 && (
                <div className="text-xs text-muted-foreground pt-2">
                  All GEDCOM tags and dates were interpreted successfully.
                </div>
              )}
              {(groups.errors.length > 0 || groups.warnings.length > 0) && (
                <div className="text-xs text-muted-foreground pt-2">
                  {groups.errors.length} error{s(groups.errors.length)}, {groups.warnings.length} warning{s(groups.warnings.length)} collected. Switch tabs to review details.
                </div>
              )}
            </div>
          )}
          {tab === 'warnings' && <IssueList items={groups.warnings} empty="All GEDCOM tags and dates were interpreted." />}
          {tab === 'errors' && <IssueList items={groups.errors} empty="No blocking errors — every line was parsed." />}
        </main>
        <footer className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
          Source: {result.format || result.source || 'gedcom'}
        </footer>
      </div>
    </div>
  );
}

function IssueList({ items, empty }) {
  if (!items.length) return <div className="text-sm text-muted-foreground">{empty}</div>;
  return (
    <ul className="space-y-1 text-xs">
      {items.slice(0, 500).map((issue, index) => (
        <li key={index} className="flex gap-3 py-1 border-b border-border/60">
          <span className="tabular-nums text-muted-foreground w-16">{issue.line ? `line ${issue.line}` : '—'}</span>
          <span className="flex-1">{issue.message}</span>
        </li>
      ))}
      {items.length > 500 && (
        <li className="text-muted-foreground text-center pt-2">… +{items.length - 500} more</li>
      )}
    </ul>
  );
}

function label(key) {
  switch (key) {
    case 'INDI': return 'Individuals';
    case 'FAM': return 'Families';
    case 'SOUR': return 'Sources';
    case 'NOTE': return 'Notes';
    case 'OBJE': return 'Media refs';
    case 'unsupportedEvents': return 'Unmapped events';
    default: return key;
  }
}

function s(n) { return n === 1 ? '' : 's'; }

export default GedcomImportReviewSheet;
