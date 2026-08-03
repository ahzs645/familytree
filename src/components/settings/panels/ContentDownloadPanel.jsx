import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';
import { useModal } from '../../../contexts/ModalContext.jsx';
import {
  GEOGRAPHIC_PACKAGE_MANIFESTS,
  installGeographicPackage,
  listInstalledGeographicPackages,
  removeGeographicPackage,
} from '../../../lib/geographicPackages.js';
import { Button } from '../../ui/Button.jsx';

export default function ContentDownloadPanel() {
  const { prefs, update, t } = useSettings();
  const modal = useModal();
  const [installed, setInstalled] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [errors, setErrors] = useState({});
  const baseUrl = prefs.contentDownload?.geographicPackageBaseUrl || '';

  const refresh = useCallback(async () => {
    setInstalled(await listInstalledGeographicPackages());
  }, []);

  useEffect(() => {
    refresh().catch(() => setErrors({ manager: t('settingsPage.contentDownload.loadFailed') }));
  }, [refresh, t]);

  const installedById = useMemo(() => new Map(installed.map((asset) => [asset.packageId, asset])), [installed]);

  const downloadPackage = async (packageId) => {
    setBusyId(packageId);
    setErrors((current) => ({ ...current, [packageId]: '' }));
    try {
      await installGeographicPackage(packageId, baseUrl);
      await refresh();
    } catch {
      setErrors((current) => ({ ...current, [packageId]: t('settingsPage.contentDownload.downloadFailed') }));
    } finally {
      setBusyId('');
    }
  };

  const removePackage = async (manifest) => {
    const confirmed = await modal.confirm(t('settingsPage.contentDownload.removeConfirm', { name: t(manifest.nameKey) }), {
      title: t('settingsPage.contentDownload.removeTitle'),
      okLabel: t('settingsPage.contentDownload.remove'),
      destructive: true,
    });
    if (!confirmed) return;
    setBusyId(manifest.id);
    try {
      await removeGeographicPackage(manifest.id);
      await refresh();
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-4">
      <Panel title={t('settingsPage.contentDownload.panel')}>
        <p className="mb-4 text-sm text-muted-foreground">{t('settingsPage.contentDownload.description')}</p>
        <Grid>
          <Switch label={t('settingsPage.contentDownload.autoHistory')} checked={prefs.contentDownload?.autoDownloadHistory !== false} onChange={(value) => update('contentDownload', 'autoDownloadHistory', value)} />
          <Switch label={t('settingsPage.contentDownload.autoFs')} checked={!!prefs.contentDownload?.autoDownloadFamilySearchSources} onChange={(value) => update('contentDownload', 'autoDownloadFamilySearchSources', value)} />
          <Field label={t('settingsPage.contentDownload.concurrency')}>
            <input type="number" min={1} max={12} value={prefs.contentDownload?.concurrency ?? 3} onChange={(event) => update('contentDownload', 'concurrency', Number(event.target.value))} className={inputClass} />
          </Field>
          <Switch label={t('settingsPage.contentDownload.wifiOnly')} checked={!!prefs.contentDownload?.wifiOnly} onChange={(value) => update('contentDownload', 'wifiOnly', value)} />
        </Grid>
      </Panel>

      <Panel title={t('settingsPage.contentDownload.geographicTitle')}>
        <Field label={t('settingsPage.contentDownload.baseUrl')} hint={t('settingsPage.contentDownload.baseUrlHint')}>
          <input
            type="url"
            value={baseUrl}
            placeholder={t('settingsPage.contentDownload.baseUrlPlaceholder')}
            onChange={(event) => update('contentDownload', 'geographicPackageBaseUrl', event.target.value)}
            className={inputClass}
          />
        </Field>
        {!String(baseUrl).trim() && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-text" role="status">
            {t('settingsPage.contentDownload.unavailableExplanation')}
          </p>
        )}
        {errors.manager && <p className="mt-3 text-sm text-destructive-text" role="alert">{errors.manager}</p>}
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <ul className="divide-y divide-border">
            {GEOGRAPHIC_PACKAGE_MANIFESTS.map((manifest) => {
              const asset = installedById.get(manifest.id);
              const isBusy = busyId === manifest.id;
              const status = asset
                ? t('settingsPage.contentDownload.statusInstalled')
                : baseUrl.trim()
                  ? t('settingsPage.contentDownload.statusAvailable')
                  : t('settingsPage.contentDownload.statusUnavailable');
              return (
                <li key={manifest.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{t(manifest.nameKey)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(asset?.byteSize || manifest.size, t)} · {status}
                      {asset?.installedAt ? ` · ${t('settingsPage.contentDownload.installedDate', { date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(asset.installedAt)) })}` : ''}
                    </div>
                    {errors[manifest.id] && <div className="mt-1 text-xs text-destructive-text" role="alert">{errors[manifest.id]}</div>}
                  </div>
                  {asset ? (
                    <Button variant="destructiveOutline" size="sm" disabled={isBusy} onClick={() => removePackage(manifest)}>
                      {isBusy ? t('settingsPage.contentDownload.removing') : t('settingsPage.contentDownload.remove')}
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" disabled={isBusy || !baseUrl.trim()} onClick={() => downloadPackage(manifest.id)}>
                      {isBusy ? t('settingsPage.contentDownload.downloading') : t('settingsPage.contentDownload.download')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>
    </div>
  );
}

function formatBytes(value, t) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return t('settingsPage.contentDownload.sizeBytes', { size: bytes });
  if (bytes < 1024 ** 2) return t('settingsPage.contentDownload.sizeKilobytes', { size: (bytes / 1024).toFixed(1) });
  return t('settingsPage.contentDownload.sizeMegabytes', { size: (bytes / 1024 ** 2).toFixed(bytes >= 100 * 1024 ** 2 ? 0 : 1) });
}
