import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';

export default function IntegrationsPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.integrations.panel')}>
      <Grid>
        <Field label={t('settingsPage.integrations.provider')}>
          <select value={prefs.webSearch.provider} onChange={(event) => update('webSearch', 'provider', event.target.value)} className={inputClass}>
            <option value="familysearch">{t('settingsPage.integrations.providerFs')}</option>
            <option value="ancestry">{t('settingsPage.integrations.providerAncestry')}</option>
            <option value="findagrave">{t('settingsPage.integrations.providerFindAGrave')}</option>
            <option value="google">{t('settingsPage.integrations.providerGoogle')}</option>
            <option value="custom">{t('settingsPage.integrations.providerCustom')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.integrations.customUrl')}>
          <input value={prefs.webSearch.customUrl} onChange={(event) => update('webSearch', 'customUrl', event.target.value)} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.integrations.defaultFsTask')}>
          <select value={prefs.familySearch.defaultTaskType} onChange={(event) => update('familySearch', 'defaultTaskType', event.target.value)} className={inputClass}>
            <option value="match-review">{t('settingsPage.integrations.taskMatch')}</option>
            <option value="record-match-review">{t('settingsPage.integrations.taskRecord')}</option>
            <option value="picture-review">{t('settingsPage.integrations.taskPicture')}</option>
            <option value="ordinance-review">{t('settingsPage.integrations.taskOrdinance')}</option>
            <option value="sync-review">{t('settingsPage.integrations.taskSync')}</option>
          </select>
        </Field>
        <Switch label={t('settingsPage.integrations.openInNewTab')} checked={prefs.webSearch.openInNewTab} onChange={(value) => update('webSearch', 'openInNewTab', value)} />
        <Switch label={t('settingsPage.integrations.showMatched')} checked={prefs.familySearch.showMatched} onChange={(value) => update('familySearch', 'showMatched', value)} />
        <Switch label={t('settingsPage.integrations.showUnmatched')} checked={prefs.familySearch.showUnmatched} onChange={(value) => update('familySearch', 'showUnmatched', value)} />
      </Grid>
    </Panel>
  );
}
