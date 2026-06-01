import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, SettingsSelect, Switch, vitalPreview } from '../sharedUI.jsx';
import { VITAL_MARKER_STYLE_OPTIONS } from '../../../lib/vitalFormat.js';

export default function ArabicIslamicPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.arabicIslamic.panel')}>
      <Grid>
        <Field label={t('settingsPage.arabicIslamic.vitalMarkerStyle')} hint={t('settingsPage.arabicIslamic.vitalMarkerHint')}>
          <SettingsSelect
            value={prefs.formats.vitalDisplay?.markerStyle || 'range'}
            onChange={(value) => update('formats', 'vitalDisplay', { ...(prefs.formats.vitalDisplay || {}), markerStyle: value })}
            options={VITAL_MARKER_STYLE_OPTIONS.map((option) => ({
              value: option.value,
              label: t(`constants.vitalMarker.${option.value}`),
            }))}
          />
          <div className="mt-1 text-[11px] text-muted-foreground">
            {t('settingsPage.preview')}: <span className="font-mono text-foreground">{vitalPreview(prefs.formats.vitalDisplay?.markerStyle)}</span>
          </div>
        </Field>
        <Switch
          label={t('settingsPage.arabicIslamic.preferArabic')}
          checked={!!prefs.arabicIslamic?.preferArabicCatalogLabels}
          onChange={(value) => update('arabicIslamic', 'preferArabicCatalogLabels', value)}
        />
      </Grid>
      <p className="mt-3 text-xs text-muted-foreground">{t('settingsPage.arabicIslamic.footer')}</p>
    </Panel>
  );
}
