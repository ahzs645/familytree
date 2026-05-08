import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';
import { APP_FUNCTIONS } from '../../../lib/functionCatalog.js';

export default function GeneralPanel() {
  const { prefs, update, theme, setTheme, t } = useSettings();
  return (
    <Panel title={t('settingsPage.general.panel')}>
      <Grid>
        <Field label={t('settingsPage.general.theme')}>
          <select value={theme} onChange={(event) => setTheme(event.target.value)} className={inputClass}>
            <option value="light">{t('settingsPage.general.themeLight')}</option>
            <option value="dark">{t('settingsPage.general.themeDark')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.general.startView')}>
          <select value={prefs.general.startRoute} onChange={(event) => update('general', 'startRoute', event.target.value)} className={inputClass}>
            {APP_FUNCTIONS.filter((item) => !item.unavailable).map((item) => (
              <option key={item.to} value={item.to}>{t(`appFunctions.${item.to}`, { defaultValue: item.label })}</option>
            ))}
          </select>
        </Field>
        <Switch label={t('settingsPage.general.confirmDeletes')} checked={prefs.general.confirmDeletes} onChange={(value) => update('general', 'confirmDeletes', value)} />
        <Switch label={t('settingsPage.general.autoSaveEditors')} checked={prefs.general.autoSaveEditors} onChange={(value) => update('general', 'autoSaveEditors', value)} />
        <Switch label={t('settingsPage.general.showPrivateRecords')} checked={prefs.general.showPrivateRecords} onChange={(value) => update('general', 'showPrivateRecords', value)} />
        <Switch label={t('settingsPage.general.compactLists')} checked={prefs.general.compactLists} onChange={(value) => update('general', 'compactLists', value)} />
      </Grid>
    </Panel>
  );
}
