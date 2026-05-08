import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';

export default function ContentDownloadPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.contentDownload.panel')}>
      <Grid>
        <Switch label={t('settingsPage.contentDownload.autoHistory')} checked={prefs.contentDownload?.autoDownloadHistory !== false} onChange={(value) => update('contentDownload', 'autoDownloadHistory', value)} />
        <Switch label={t('settingsPage.contentDownload.autoFs')} checked={!!prefs.contentDownload?.autoDownloadFamilySearchSources} onChange={(value) => update('contentDownload', 'autoDownloadFamilySearchSources', value)} />
        <Field label={t('settingsPage.contentDownload.concurrency')}>
          <input type="number" min={1} max={12} value={prefs.contentDownload?.concurrency ?? 3} onChange={(event) => update('contentDownload', 'concurrency', Number(event.target.value))} className={inputClass} />
        </Field>
        <Switch label={t('settingsPage.contentDownload.wifiOnly')} checked={!!prefs.contentDownload?.wifiOnly} onChange={(value) => update('contentDownload', 'wifiOnly', value)} />
      </Grid>
    </Panel>
  );
}
