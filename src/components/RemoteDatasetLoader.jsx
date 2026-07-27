/**
 * `?url=…` deep-link import, inside the React tree.
 *
 * Renders the whole lifecycle of a shared dataset link: a confirm sheet, a
 * determinate progress bar while it downloads and imports, and — the part
 * that was missing entirely — a visible error with the failing URL and a
 * Retry button. Cancelling leaves a banner so the link is still actionable
 * instead of vanishing into an empty "No tree yet" screen.
 *
 * Exposes its state through RemoteDatasetContext so Home can hold back the
 * onboarding redirect while a link is still in flight.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import {
  REMOTE_IMPORT_ENABLED,
  formatBytes,
  getDatasetUrlFromQuery,
  importRemoteDataset,
  isAlreadyLoaded,
  isSharePreviewRoute,
} from '../lib/remoteDataset.js';

const RemoteDatasetContext = createContext({ pending: false, status: 'idle' });

export function useRemoteDataset() {
  return useContext(RemoteDatasetContext);
}

const IDLE = { status: 'idle', url: null, loaded: 0, total: 0, error: null };

export function RemoteDatasetProvider({ children }) {
  const { t } = useTranslation();
  const { refresh, hasData } = useDatabaseStatus();
  const [state, setState] = useState(IDLE);
  const startedRef = useRef(false);

  // Decide once per page load whether this URL still needs handling.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const url = getDatasetUrlFromQuery();
    if (!url || isSharePreviewRoute()) return;
    if (!REMOTE_IMPORT_ENABLED) {
      console.warn('[CloudTreeWeb] ignored ?url= import because remote imports are disabled.');
      return;
    }
    let cancelled = false;
    (async () => {
      if (await isAlreadyLoaded(url)) return;
      if (!cancelled) setState({ ...IDLE, status: 'confirming', url });
    })();
    return () => { cancelled = true; };
  }, []);

  const run = useCallback(async (url) => {
    setState({ status: 'loading', url, loaded: 0, total: 0, error: null });
    try {
      await importRemoteDataset(url, {
        onStage: ({ stage, loaded, total }) => {
          setState((s) => (s.status === 'loading' ? { ...s, stage, loaded, total } : s));
        },
      });
      await refresh();
      setState({ ...IDLE, status: 'done', url });
    } catch (err) {
      console.error('[CloudTreeWeb] failed to load dataset from ?url=', err);
      setState({ status: 'error', url, loaded: 0, total: 0, error: err?.message || String(err) });
    }
  }, [refresh]);

  const value = useMemo(() => ({
    ...state,
    pending: state.status === 'confirming' || state.status === 'loading' || state.status === 'error' || state.status === 'cancelled',
    retry: () => run(state.url),
    dismiss: () => setState(IDLE),
  }), [state, run]);

  return (
    <RemoteDatasetContext.Provider value={value}>
      {children}
      <RemoteDatasetUI
        state={state}
        hasData={hasData}
        t={t}
        onConfirm={() => run(state.url)}
        onCancel={() => setState((s) => ({ ...s, status: 'cancelled' }))}
        onDismiss={() => setState(IDLE)}
      />
    </RemoteDatasetContext.Provider>
  );
}

function Backdrop({ children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}

function UrlLine({ url }) {
  return (
    <p className="mb-4 break-all rounded bg-secondary px-2 py-1.5 font-mono text-xs text-muted-foreground" dir="ltr">
      {url}
    </p>
  );
}

function RemoteDatasetUI({ state, hasData, t, onConfirm, onCancel, onDismiss }) {
  const { status, url, loaded, total, stage, error } = state;
  if (status === 'idle' || status === 'done' || !url) return null;

  if (status === 'confirming') {
    return (
      <Backdrop>
        <h2 className="mb-2 text-lg font-semibold">
          {t('app.remoteImport.title', { defaultValue: 'Import this family tree?' })}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {hasData
            ? t('app.remoteImport.replaceBody', { defaultValue: 'This will replace the family tree currently stored in this browser.' })
            : t('app.remoteImport.importBody', { defaultValue: 'The data is imported into this browser only — it is never uploaded anywhere.' })}
        </p>
        <UrlLine url={url} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('app.remoteImport.importAction', { defaultValue: 'Import' })}
          </button>
        </div>
      </Backdrop>
    );
  }

  if (status === 'loading') {
    const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;
    // 'done' still renders here for the beat between the last onStage call and
    // the post-refresh state flip — keep showing "Importing" rather than
    // snapping the label back to "Downloading".
    const label = stage === 'importing' || stage === 'done'
      ? t('app.remoteImport.importing', { defaultValue: 'Importing records…' })
      : t('app.remoteImport.downloading', { defaultValue: 'Downloading family tree…' });
    return (
      <Backdrop>
        <h2 className="mb-2 text-lg font-semibold">{label}</h2>
        <UrlLine url={url} />
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-label={label}
          aria-valuenow={pct ?? undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full bg-primary transition-[width] duration-200 ${pct === null ? 'animate-pulse w-1/3' : ''}`}
            style={pct === null ? undefined : { width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {pct === null
            ? formatBytes(loaded)
            : `${pct}% · ${formatBytes(loaded)} / ${formatBytes(total)}`}
        </p>
      </Backdrop>
    );
  }

  if (status === 'error') {
    return (
      <Backdrop>
        <h2 className="mb-2 text-lg font-semibold text-destructive">
          {t('app.remoteImport.failedTitle', { defaultValue: 'Could not import that family tree' })}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{error}</p>
        <UrlLine url={url} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            {t('common.dismiss', { defaultValue: 'Dismiss' })}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {t('app.remoteImport.retry', { defaultValue: 'Try again' })}
          </button>
        </div>
      </Backdrop>
    );
  }

  // cancelled — stay out of the way, but keep the link actionable.
  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
        <span className="flex-1 text-sm text-muted-foreground">
          {t('app.remoteImport.cancelledBody', { defaultValue: 'This link points at a family tree that has not been imported.' })}
        </span>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t('app.remoteImport.importAction', { defaultValue: 'Import' })}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          aria-label={t('common.dismiss', { defaultValue: 'Dismiss' })}
        >
          {t('common.dismiss', { defaultValue: 'Dismiss' })}
        </button>
      </div>
    </div>
  );
}
