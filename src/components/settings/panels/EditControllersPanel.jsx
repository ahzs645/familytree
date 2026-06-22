import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';

export default function EditControllersPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.editControllers.panel')}>
      <Grid>
        <Switch label={t('settingsPage.editControllers.eventTypesCollapsed')} checked={!!prefs.editControllers?.eventTypesCollapsed} onChange={(value) => update('editControllers', 'eventTypesCollapsed', value)} />
        <Switch label={t('settingsPage.editControllers.factTypesCollapsed')} checked={!!prefs.editControllers?.factTypesCollapsed} onChange={(value) => update('editControllers', 'factTypesCollapsed', value)} />
        <Field label={t('settingsPage.editControllers.defaultEvent')}>
          <input type="text" value={prefs.editControllers?.defaultEventType || 'Birth'} onChange={(event) => update('editControllers', 'defaultEventType', event.target.value)} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.editControllers.defaultFact')}>
          <input type="text" value={prefs.editControllers?.defaultFactType || 'Occupation'} onChange={(event) => update('editControllers', 'defaultFactType', event.target.value)} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.editControllers.defaultFamilyEvent')}>
          <input type="text" value={prefs.editControllers?.defaultFamilyEventType || 'Marriage'} onChange={(event) => update('editControllers', 'defaultFamilyEventType', event.target.value)} className={inputClass} />
        </Field>
        <Switch label={t('settingsPage.editControllers.applyDefaultEvents')} checked={!!prefs.editControllers?.applyDefaultEvents} onChange={(value) => update('editControllers', 'applyDefaultEvents', value)} />
      </Grid>
    </Panel>
  );
}
