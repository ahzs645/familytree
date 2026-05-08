import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, inputClass } from '../sharedUI.jsx';
import { PLAUSIBILITY_ANALYZERS } from '../../../lib/plausibility.js';

export default function PlausibilityPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.plausibility.panel')}>
      <div className="space-y-2">
        {PLAUSIBILITY_ANALYZERS.map((a) => (
          <label key={a.id} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={prefs.plausibility?.enabled?.[a.id] !== false}
              onChange={(e) => update('plausibility', 'enabled', { ...(prefs.plausibility?.enabled || {}), [a.id]: e.target.checked })}
            />
            <span className="flex-1">{t(`constants.plausibility.${a.id}`)}</span>
          </label>
        ))}
      </div>
      <Grid>
        <Field label={t('settingsPage.plausibility.maxLifespan')}>
          <input type="number" min="1" max="200" value={prefs.plausibility.thresholds.maxLifespan} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, maxLifespan: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.plausibility.minMarriageAge')}>
          <input type="number" min="1" max="50" value={prefs.plausibility.thresholds.minMarriageAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, minMarriageAge: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.plausibility.minParentAge')}>
          <input type="number" min="1" max="50" value={prefs.plausibility.thresholds.minParentAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, minParentAge: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.plausibility.maxParentAge')}>
          <input type="number" min="1" max="100" value={prefs.plausibility.thresholds.maxParentAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, maxParentAge: Number(e.target.value) })} className={inputClass} />
        </Field>
      </Grid>
    </Panel>
  );
}
