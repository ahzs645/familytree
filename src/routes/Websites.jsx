/**
 * Websites route - publish-oriented static site configuration and export.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { DEFAULT_SITE_OPTIONS, SITE_THEMES, buildSite, downloadSite, validateSiteExport } from '../lib/websiteExport.js';
import {
  DEFAULT_PUBLISH_TARGET,
  getPublishTarget,
  postWebsiteToWebhook,
  savePublishTarget,
  validatePublishTarget,
  listPublishHistory,
  recordPublishHistoryEntry,
  clearPublishHistory,
} from '../lib/publishTargets.js';
import { useModal } from '../contexts/ModalContext.jsx';

const buttonPrimary = 'rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50';
const buttonSecondary = 'rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50';
const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

export default function Websites() {
  const modal = useModal();
  const { summary } = useDatabaseStatus();
  const [options, setOptions] = useState(DEFAULT_SITE_OPTIONS);
  const [validation, setValidation] = useState(null);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [completedStats, setCompletedStats] = useState(null);
  const [publishTarget, setPublishTarget] = useState(DEFAULT_PUBLISH_TARGET);
  const [publishHistory, setPublishHistory] = useState([]);
  const controllerRef = useRef(null);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      const target = await getPublishTarget();
      if (!cancel) setPublishTarget(target);
      const history = await listPublishHistory();
      if (!cancel) setPublishHistory(history);
    })();
    return () => { cancel = true; };
  }, []);

  const appendHistory = useCallback(async (entry) => {
    await recordPublishHistoryEntry(entry);
    const refreshed = await listPublishHistory();
    setPublishHistory(refreshed);
  }, []);

  const onClearHistory = useCallback(async () => {
    if (!(await modal.confirm('Clear the publish history?', { title: 'Clear history', okLabel: 'Clear', destructive: true }))) return;
    await clearPublishHistory();
    setPublishHistory([]);
  }, [modal]);

  const privacyLabel = useMemo(() => (
    options.includePrivate ? 'Public and private records will be included.' : 'Private records will be filtered from the public site.'
  ), [options.includePrivate]);

  const updateOption = useCallback((key, value) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setValidation(null);
    setCompletedStats(null);
  }, []);

  const updatePublishTarget = useCallback((key, value) => {
    setPublishTarget((current) => ({ ...current, [key]: value }));
  }, []);

  const onValidate = useCallback(async () => {
    setBusy(true);
    setStatus('Checking publish readiness...');
    setProgress(null);
    setCompletedStats(null);
    try {
      const result = await validateSiteExport(options);
      setValidation(result);
      setStatus(result.canExport ? 'Website export is ready.' : 'Website export has blocking issues.');
    } catch (error) {
      setStatus(`Validation failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }, [options]);

  const onExport = useCallback(async () => {
    setBusy(true);
    setCompletedStats(null);
    setStatus('Preparing website export...');
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const preflight = await validateSiteExport(options);
      setValidation(preflight);
      if (!preflight.canExport) {
        setStatus('Website export has blocking issues.');
        return;
      }
      const result = await downloadSite({
        ...options,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setCompletedStats(result.stats);
      setStatus(`Exported ${result.stats.pages.toLocaleString()} pages and ${result.stats.assets.toLocaleString()} bundled asset${result.stats.assets === 1 ? '' : 's'}.`);
    } catch (error) {
      if (error.name === 'AbortError') setStatus('Website export canceled.');
      else setStatus(`Website export failed: ${error.message}`);
    } finally {
      controllerRef.current = null;
      setBusy(false);
    }
  }, [options]);

  const onSaveTarget = useCallback(async () => {
    setBusy(true);
    setStatus('Saving publish target...');
    try {
      const validation = validatePublishTarget(publishTarget);
      if (!validation.canPublish) {
        setStatus(`Publish target has issues: ${validation.errors.join(' ')}`);
        return;
      }
      const saved = await savePublishTarget(validation.target);
      setPublishTarget(saved);
      setStatus('Publish target saved.');
    } catch (error) {
      setStatus(`Publish target save failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }, [publishTarget]);

  const onPublishTarget = useCallback(async () => {
    setBusy(true);
    setCompletedStats(null);
    setStatus('Preparing publish target...');
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const targetValidation = validatePublishTarget(publishTarget);
      if (!targetValidation.canPublish) {
        setStatus(`Publish target has issues: ${targetValidation.errors.join(' ')}`);
        await appendHistory({
          mode: targetValidation.target.mode,
          targetName: targetValidation.target.name,
          status: 'failed-validation',
          siteTitle: options.siteTitle,
          validationLog: targetValidation.errors.map((message) => ({ severity: 'error', message })),
          message: 'Publish target failed validation.',
        });
        return;
      }
      await savePublishTarget(targetValidation.target);
      if (targetValidation.target.mode === 'webhook') {
        const result = await buildSite({
          ...options,
          signal: controller.signal,
          onProgress: setProgress,
        });
        await postWebsiteToWebhook({
          blob: result.blob,
          target: targetValidation.target,
          siteTitle: options.siteTitle,
        });
        setCompletedStats(result.stats);
        setStatus(`Published website zip to webhook. ${result.stats.pages.toLocaleString()} pages prepared.`);
        await appendHistory({
          mode: 'webhook',
          targetName: targetValidation.target.name,
          status: 'success',
          siteTitle: options.siteTitle,
          validationLog: [],
          message: `Webhook delivery succeeded. ${result.stats.pages} pages.`,
        });
        return;
      }
      await downloadSite({
        ...options,
        signal: controller.signal,
        onProgress: setProgress,
      });
      const doneMessage = targetValidation.target.mode === 'download'
        ? 'Website zip downloaded.'
        : `Website zip downloaded for ${targetValidation.target.mode.toUpperCase()} upload to ${targetValidation.target.host}${targetValidation.target.remotePath}.`;
      setStatus(doneMessage);
      await appendHistory({
        mode: targetValidation.target.mode,
        targetName: targetValidation.target.name,
        status: 'success',
        siteTitle: options.siteTitle,
        validationLog: [],
        message: doneMessage,
      });
    } catch (error) {
      const failMessage = error.name === 'AbortError' ? 'Publishing canceled.' : `Publishing failed: ${error.message}`;
      setStatus(failMessage);
      await appendHistory({
        mode: publishTarget?.mode || 'download',
        targetName: publishTarget?.name || '',
        status: error.name === 'AbortError' ? 'canceled' : 'failed',
        siteTitle: options.siteTitle,
        validationLog: [],
        message: failMessage,
      });
    } finally {
      controllerRef.current = null;
      setBusy(false);
    }
  }, [options, publishTarget, appendHistory]);

  const onCancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const percent = progress?.total ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-4xl mx-auto p-5">
        <div className="flex flex-wrap items-start gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold mb-1">Websites</h1>
            <p className="text-sm text-muted-foreground">
              Configure and publish a static family website. Data import/export remains in <Link to="/export" className="text-primary hover:underline">Import & Export</Link>.
            </p>
          </div>
          <Link to="/publish" className="ms-auto rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium hover:bg-accent">
            Publish hub
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-4">Site settings</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Site title">
                <input
                  value={options.siteTitle}
                  onChange={(event) => updateOption('siteTitle', event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Theme">
                <select
                  value={options.theme}
                  onChange={(event) => updateOption('theme', event.target.value)}
                  className={inputClass}
                >
                  {SITE_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.label}</option>)}
                </select>
              </Field>
              <Field label="Tagline">
                <input
                  value={options.tagline}
                  onChange={(event) => updateOption('tagline', event.target.value)}
                  placeholder="Optional subtitle"
                  className={inputClass}
                />
              </Field>
              <Field label="Accent color">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={options.accentColor}
                    onChange={(event) => updateOption('accentColor', event.target.value)}
                    className="h-10 w-12 rounded-md border border-border bg-background p-1"
                    aria-label="Accent color"
                  />
                  <input
                    value={options.accentColor}
                    onChange={(event) => updateOption('accentColor', event.target.value)}
                    className={inputClass}
                  />
                </div>
              </Field>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
                <input
                  type="checkbox"
                  checked={options.includePrivate}
                  onChange={(event) => updateOption('includePrivate', event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Include private records</span>
                  <span className="text-xs text-muted-foreground">{privacyLabel}</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
                <input
                  type="checkbox"
                  checked={options.includeAssets}
                  onChange={(event) => updateOption('includeAssets', event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">Bundle media thumbnails and files</span>
                  <span className="text-xs text-muted-foreground">Included media assets are copied into the website zip under assets/media.</span>
                </span>
              </label>
            </div>

            <div className="mt-5 rounded-md border border-border bg-background p-4">
              <h3 className="text-sm font-semibold mb-3">Publish target</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Method">
                  <select
                    value={publishTarget.mode}
                    onChange={(event) => updatePublishTarget('mode', event.target.value)}
                    className={inputClass}
                  >
                    <option value="download">Download</option>
                    <option value="ftp">FTP</option>
                    <option value="sftp">SFTP</option>
                    <option value="webhook">Webhook</option>
                  </select>
                </Field>
                <Field label="Profile name">
                  <input value={publishTarget.name} onChange={(event) => updatePublishTarget('name', event.target.value)} className={inputClass} />
                </Field>
                {(publishTarget.mode === 'ftp' || publishTarget.mode === 'sftp') && (
                  <>
                    <Field label="Host">
                      <input value={publishTarget.host} onChange={(event) => updatePublishTarget('host', event.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Port">
                      <input value={publishTarget.port} onChange={(event) => updatePublishTarget('port', event.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Remote path">
                      <input value={publishTarget.remotePath} onChange={(event) => updatePublishTarget('remotePath', event.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Username">
                      <input value={publishTarget.username} onChange={(event) => updatePublishTarget('username', event.target.value)} className={inputClass} />
                    </Field>
                  </>
                )}
                {publishTarget.mode === 'webhook' && (
                  <>
                    <Field label="Webhook URL">
                      <input value={publishTarget.webhookUrl} onChange={(event) => updatePublishTarget('webhookUrl', event.target.value)} className={inputClass} />
                    </Field>
                    <Field label="Header">
                      <input value={publishTarget.webhookHeader} onChange={(event) => updatePublishTarget('webhookHeader', event.target.value)} placeholder="Authorization: Bearer token" className={inputClass} />
                    </Field>
                  </>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={onSaveTarget} disabled={busy} className={buttonSecondary}>Save target</button>
                <button onClick={onPublishTarget} disabled={busy || !summary} className={buttonPrimary}>Publish target</button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={onValidate} disabled={busy || !summary} className={buttonSecondary}>Validate</button>
              <button onClick={onExport} disabled={busy || !summary} className={buttonPrimary}>Download website zip</button>
              {busy && controllerRef.current && (
                <button onClick={onCancel} className={buttonSecondary}>Cancel</button>
              )}
            </div>
          </section>

          <aside className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-semibold mb-3">Publish summary</h2>
            <div className="space-y-2 text-sm">
              <SummaryRow label="Records loaded" value={summary?.total?.toLocaleString() || '0'} />
              <SummaryRow label="People" value={(summary?.types?.Person || 0).toLocaleString()} />
              <SummaryRow label="Families" value={(summary?.types?.Family || 0).toLocaleString()} />
              <SummaryRow label="Media" value={MEDIA_COUNT(summary).toLocaleString()} />
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              The website export creates a browsable index plus pages for included people, families, places, sources, media, and stories.
            </div>
          </aside>
        </div>

        {progress && (
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <div className="flex justify-between text-sm mb-2">
              <span>{progress.message}</span>
              <span className="text-muted-foreground">{Number.isFinite(percent) ? percent : 0}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
            </div>
          </div>
        )}

        {validation && (
          <ValidationPanel validation={validation} />
        )}

        {completedStats && (
          <div className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            Completed: {completedStats.persons.toLocaleString()} people, {completedStats.families.toLocaleString()} families,{' '}
            {completedStats.places.toLocaleString()} places, {completedStats.sources.toLocaleString()} sources,{' '}
            {completedStats.media.toLocaleString()} media records, {completedStats.stories.toLocaleString()} stories.
          </div>
        )}

        {status && (
          <div className="mt-4 rounded-md border border-border bg-card p-3 text-sm">{status}</div>
        )}

        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">Publish history</h2>
            {publishHistory.length > 0 && (
              <button onClick={onClearHistory} className={buttonSecondary}>Clear</button>
            )}
          </div>
          {publishHistory.length === 0 ? (
            <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
              No publishes recorded yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {publishHistory.map((entry) => (
                <li key={entry.id} className="rounded-md border border-border bg-card p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded ${statusBadgeClass(entry.status)}`}>
                      {entry.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">· {entry.mode}</span>
                    {entry.targetName && <span className="text-xs text-muted-foreground">· {entry.targetName}</span>}
                    {entry.siteTitle && <span className="text-xs text-muted-foreground">· {entry.siteTitle}</span>}
                  </div>
                  {entry.message && <div className="text-sm">{entry.message}</div>}
                  {Array.isArray(entry.validationLog) && entry.validationLog.length > 0 && (
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {entry.validationLog.map((log, index) => (
                        <li key={index}>· [{log.severity}] {log.message}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function statusBadgeClass(status) {
  if (status === 'success') return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200';
  if (status === 'canceled') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  return 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200';
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ValidationPanel({ validation }) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="font-semibold mb-2">{validation.canExport ? 'Validation passed' : 'Validation failed'}</div>
      <div className="text-muted-foreground mb-3">
        {validation.counts.persons.toLocaleString()} publishable people · {validation.counts.privatePersons.toLocaleString()} private people ·{' '}
        {validation.missingReferences.length.toLocaleString()} missing references · {validation.privacyConflicts.length.toLocaleString()} privacy conflicts
      </div>
      {validation.errors.map((message) => (
        <div key={message} className="text-destructive">{message}</div>
      ))}
      {validation.warnings.map((message) => (
        <div key={message} className="text-muted-foreground">{message}</div>
      ))}
      {validation.missingReferences.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          Missing samples: {validation.missingReferences.slice(0, 4).map((item) => `${item.from}.${item.field} -> ${item.to}`).join('; ')}
        </div>
      )}
    </div>
  );
}

function MEDIA_COUNT(summary) {
  const types = summary?.types || {};
  return ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'].reduce((total, type) => total + (types[type] || 0), 0);
}
