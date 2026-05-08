import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, inputClass } from '../sharedUI.jsx';

export default function CategoriesPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.categories.panel')}>
      <Grid>
        <Field label={t('settingsPage.categories.labelOrder')}>
          <select value={prefs.categoryConfigurations?.labelOrder || 'alphabetical'} onChange={(event) => update('categoryConfigurations', 'labelOrder', event.target.value)} className={inputClass}>
            <option value="alphabetical">{t('settingsPage.categories.labelAlphabetical')}</option>
            <option value="custom">{t('settingsPage.categories.labelCustom')}</option>
            <option value="usage">{t('settingsPage.categories.labelByUsage')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.categories.groupOrder')}>
          <select value={prefs.categoryConfigurations?.groupOrder || 'custom'} onChange={(event) => update('categoryConfigurations', 'groupOrder', event.target.value)} className={inputClass}>
            <option value="custom">{t('settingsPage.categories.groupCustom')}</option>
            <option value="alphabetical">{t('settingsPage.categories.groupAlphabetical')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.categories.hidden')}>
          <input
            type="text"
            value={(prefs.categoryConfigurations?.hiddenCategories || []).join(', ')}
            onChange={(event) => update('categoryConfigurations', 'hiddenCategories', event.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className={inputClass}
          />
        </Field>
      </Grid>
    </Panel>
  );
}
