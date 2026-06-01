import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, SettingsSelect, Switch, inputClass } from '../sharedUI.jsx';

export default function IntegrationsPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.integrations.panel')}>
      <Grid>
        <Field label={t('settingsPage.integrations.provider')}>
          <SettingsSelect
            value={prefs.webSearch.provider}
            onChange={(value) => update('webSearch', 'provider', value)}
            options={[
              { value: 'familysearch', label: t('settingsPage.integrations.providerFs') },
              { value: 'ancestry', label: t('settingsPage.integrations.providerAncestry') },
              { value: 'findagrave', label: t('settingsPage.integrations.providerFindAGrave') },
              { value: 'google', label: t('settingsPage.integrations.providerGoogle') },
              { value: 'custom', label: t('settingsPage.integrations.providerCustom') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.integrations.customUrl')}>
          <input value={prefs.webSearch.customUrl} onChange={(event) => update('webSearch', 'customUrl', event.target.value)} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.integrations.defaultFsTask')}>
          <SettingsSelect
            value={prefs.familySearch.defaultTaskType}
            onChange={(value) => update('familySearch', 'defaultTaskType', value)}
            options={[
              { value: 'match-review', label: t('settingsPage.integrations.taskMatch') },
              { value: 'record-match-review', label: t('settingsPage.integrations.taskRecord') },
              { value: 'picture-review', label: t('settingsPage.integrations.taskPicture') },
              { value: 'ordinance-review', label: t('settingsPage.integrations.taskOrdinance') },
              { value: 'sync-review', label: t('settingsPage.integrations.taskSync') },
            ]}
          />
        </Field>
        <Switch label={t('settingsPage.integrations.openInNewTab')} checked={prefs.webSearch.openInNewTab} onChange={(value) => update('webSearch', 'openInNewTab', value)} />
        <Switch label={t('settingsPage.integrations.showMatched')} checked={prefs.familySearch.showMatched} onChange={(value) => update('familySearch', 'showMatched', value)} />
        <Switch label={t('settingsPage.integrations.showUnmatched')} checked={prefs.familySearch.showUnmatched} onChange={(value) => update('familySearch', 'showUnmatched', value)} />
      </Grid>
    </Panel>
  );
}
