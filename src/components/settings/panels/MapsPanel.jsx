import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';

export default function MapsPanel() {
  const { mapPrefs, updateMap, t } = useSettings();
  if (!mapPrefs) return null;
  return (
    <Panel title={t('settingsPage.maps.panel')}>
      <Grid>
        <Field label={t('settingsPage.maps.basemap')}>
          <select value={mapPrefs.basemap} onChange={(event) => updateMap('basemap', event.target.value)} className={inputClass}>
            <option value="auto">{t('settingsPage.maps.basemapAuto')}</option>
            <option value="positron">{t('settingsPage.maps.basemapLight')}</option>
            <option value="voyager">{t('settingsPage.maps.basemapVoyager')}</option>
            <option value="dark">{t('settingsPage.maps.basemapDark')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.maps.defaultZoom')}>
          <input type="number" min="1" max="18" value={mapPrefs.defaultZoom} onChange={(event) => updateMap('defaultZoom', Number(event.target.value))} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.maps.batchLimit')}>
          <input type="number" min="1" max="50" value={mapPrefs.batchLimit} onChange={(event) => updateMap('batchLimit', Number(event.target.value))} className={inputClass} />
        </Field>
        <Switch label={t('settingsPage.maps.showLabels')} checked={mapPrefs.showLabels} onChange={(value) => updateMap('showLabels', value)} />
        <Switch label={t('settingsPage.maps.markerClustering')} checked={mapPrefs.markerClustering} onChange={(value) => updateMap('markerClustering', value)} />
      </Grid>
    </Panel>
  );
}
