import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';

export default function PrivacyPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.privacy.panel')}>
      <Grid>
        <Switch label={t('settingsPage.privacy.hidePrivate')} checked={prefs.privacy.hideMarkedPrivate !== false} onChange={(value) => update('privacy', 'hideMarkedPrivate', value)} />
        <Switch label={t('settingsPage.privacy.hideLiving')} checked={!!prefs.privacy.hideLivingPersons} onChange={(value) => update('privacy', 'hideLivingPersons', value)} />
        <Switch label={t('settingsPage.privacy.maskOnly')} checked={!!prefs.privacy.hideLivingDetailsOnly} onChange={(value) => update('privacy', 'hideLivingDetailsOnly', value)} />
        <Field label={t('settingsPage.privacy.threshold')}>
          <input type="number" min="1" max="200" value={prefs.privacy.livingPersonThresholdYears} onChange={(event) => update('privacy', 'livingPersonThresholdYears', Number(event.target.value))} className={inputClass} />
        </Field>
      </Grid>
      <p className="mt-3 text-xs text-muted-foreground">{t('settingsPage.privacy.footer')}</p>
    </Panel>
  );
}
