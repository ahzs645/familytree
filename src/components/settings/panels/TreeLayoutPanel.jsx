import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Grid, Panel, Switch } from '../sharedUI.jsx';

export default function TreeLayoutPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.treeLayout.panel')}>
      <Grid>
        <Switch
          label={t('settingsPage.treeLayout.athara')}
          checked={prefs.treeLayout?.atharaCoupleSafeguards !== false}
          onChange={(value) => update('treeLayout', 'atharaCoupleSafeguards', value)}
        />
        <Switch
          label={t('settingsPage.treeLayout.cycleProtection')}
          checked={prefs.treeLayout?.cycleProtection !== false}
          onChange={(value) => update('treeLayout', 'cycleProtection', value)}
        />
        <Switch
          label={t('settingsPage.treeLayout.singleParentFallback')}
          checked={prefs.treeLayout?.singleParentCoupleFallback !== false}
          onChange={(value) => update('treeLayout', 'singleParentCoupleFallback', value)}
        />
      </Grid>
      <p className="mt-3 text-xs text-muted-foreground">{t('settingsPage.treeLayout.footer')}</p>
    </Panel>
  );
}
