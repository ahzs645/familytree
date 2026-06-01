import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, SettingsSelect, Switch } from '../sharedUI.jsx';
import { APP_FUNCTIONS } from '../../../lib/functionCatalog.js';

export default function GeneralPanel() {
  const { prefs, update, theme, setTheme, t } = useSettings();
  return (
    <Panel title={t('settingsPage.general.panel')}>
      <Grid>
        <Field label={t('settingsPage.general.theme')}>
          <SettingsSelect
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t('settingsPage.general.themeLight') },
              { value: 'dark', label: t('settingsPage.general.themeDark') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.general.startView')}>
          <SettingsSelect
            value={prefs.general.startRoute}
            onChange={(value) => update('general', 'startRoute', value)}
            options={APP_FUNCTIONS.filter((item) => !item.unavailable).map((item) => ({
              value: item.to,
              label: t(`appFunctions.${item.to}`, { defaultValue: item.label }),
            }))}
          />
        </Field>
        <Switch label={t('settingsPage.general.confirmDeletes')} checked={prefs.general.confirmDeletes} onChange={(value) => update('general', 'confirmDeletes', value)} />
        <Switch label={t('settingsPage.general.autoSaveEditors')} checked={prefs.general.autoSaveEditors} onChange={(value) => update('general', 'autoSaveEditors', value)} />
        <Switch label={t('settingsPage.general.showPrivateRecords')} checked={prefs.general.showPrivateRecords} onChange={(value) => update('general', 'showPrivateRecords', value)} />
        <Switch label={t('settingsPage.general.compactLists')} checked={prefs.general.compactLists} onChange={(value) => update('general', 'compactLists', value)} />
      </Grid>
    </Panel>
  );
}
