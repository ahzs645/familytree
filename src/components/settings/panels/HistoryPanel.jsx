import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';

export default function HistoryPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.history.panel')}>
      <Grid>
        <Switch label={t('settingsPage.history.showWorldEvents')} checked={prefs.history?.showWorldEventsInTimeline !== false} onChange={(value) => update('history', 'showWorldEventsInTimeline', value)} />
        <Field label={t('settingsPage.history.yearsBefore')}>
          <input type="number" min={0} max={50} value={prefs.history?.lifespanYearsBeforeBirth ?? 5} onChange={(event) => update('history', 'lifespanYearsBeforeBirth', Number(event.target.value))} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.history.yearsAfter')}>
          <input type="number" min={0} max={50} value={prefs.history?.lifespanYearsAfterDeath ?? 5} onChange={(event) => update('history', 'lifespanYearsAfterDeath', Number(event.target.value))} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.history.categories')}>
          <input
            type="text"
            value={(prefs.history?.worldHistoryCategories || []).join(', ')}
            onChange={(event) => update('history', 'worldHistoryCategories', event.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className={inputClass}
          />
        </Field>
      </Grid>
    </Panel>
  );
}
