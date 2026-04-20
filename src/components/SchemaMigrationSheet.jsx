/**
 * Schema migration confirmation — mirrors MacFamilyTree's DatabaseMigration
 * prompt. Shown when the stored dataset schema is older than the runtime.
 *
 * Offers "Backup first, then migrate" or "Open read-only" (memory-only; not
 * persisted) so users never lose data to a silent upgrade.
 */
import React, { useEffect, useState } from 'react';
import {
  DATASET_SCHEMA_VERSION,
  describeMigrationPlan,
  getStoredDatasetSchemaVersion,
  runMigrations,
} from '../lib/datasetMigration.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { exportBackup } from '../lib/backup.js';

export function SchemaMigrationSheet() {
  const modal = useModal();
  const [state, setState] = useState({ loading: true, fromVersion: null, steps: [] });
  const [readOnly, setReadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const from = await getStoredDatasetSchemaVersion();
        if (from >= DATASET_SCHEMA_VERSION) {
          if (!cancelled) setState({ loading: false, fromVersion: from, steps: [] });
          return;
        }
        const steps = await describeMigrationPlan(from);
        if (!cancelled) setState({ loading: false, fromVersion: from, steps });
      } catch (err) {
        if (!cancelled) setError(err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const needsMigration = !state.loading && state.steps.length > 0 && !dismissed;
  if (!needsMigration) return null;
  if (readOnly) {
    return (
      <Banner>
        Read-only mode — dataset is at schema v{state.fromVersion}, runtime expects v{DATASET_SCHEMA_VERSION}. Writes are disabled for this session.
        <button onClick={() => setReadOnly(false)} className="ms-2 underline">Change my mind</button>
      </Banner>
    );
  }

  const onBackupThenMigrate = async () => {
    setBusy(true);
    setError(null);
    try {
      await snapshotBackup();
      await runMigrations(state.fromVersion);
      setDismissed(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const onMigrateWithoutBackup = async () => {
    if (!(await modal.confirm('Migrate without a backup? If something goes wrong the old data will not be recoverable.', { title: 'Migrate without backup', okLabel: 'Proceed', destructive: true }))) return;
    setBusy(true);
    setError(null);
    try {
      await runMigrations(state.fromVersion);
      setDismissed(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-lg">
        <header className="px-5 py-3 border-b border-border">
          <h2 className="text-base font-semibold">Family Tree Migration</h2>
        </header>
        <main className="px-5 py-4 space-y-3 text-sm">
          <p className="text-muted-foreground leading-relaxed">
            Your local data is at schema v{state.fromVersion}; this build expects v{DATASET_SCHEMA_VERSION}.
            A backup will be created automatically if you proceed.
          </p>
          <div className="bg-secondary border border-border rounded-md p-3 text-xs space-y-1.5">
            <div className="font-semibold text-foreground">Planned steps</div>
            {state.steps.map((s) => (
              <div key={`${s.from}-${s.to}`} className="text-muted-foreground">
                v{s.from} → v{s.to}: {s.description}
              </div>
            ))}
          </div>
          {error && <div className="text-xs text-destructive">Migration error: {String(error?.message || error)}</div>}
        </main>
        <footer className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-wrap">
          <button
            onClick={() => setReadOnly(true)}
            className="text-sm border border-border bg-secondary rounded-md px-3 py-1.5"
            disabled={busy}
          >
            Open read-only
          </button>
          <button
            onClick={onMigrateWithoutBackup}
            className="text-sm border border-border bg-secondary rounded-md px-3 py-1.5"
            disabled={busy}
          >
            Migrate without backup
          </button>
          <button
            onClick={onBackupThenMigrate}
            className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5"
            disabled={busy}
          >
            {busy ? 'Working…' : 'Backup then migrate'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Banner({ children }) {
  return (
    <div className="bg-amber-500/10 text-amber-600 dark:text-amber-300 border-b border-amber-500/30 text-xs px-4 py-2 text-center">
      {children}
    </div>
  );
}

async function snapshotBackup() {
  const dataset = await exportBackup();
  const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudtreeweb-pre-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default SchemaMigrationSheet;
