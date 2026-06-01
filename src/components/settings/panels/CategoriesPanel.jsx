import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, SettingsSelect, inputClass } from '../sharedUI.jsx';

export default function CategoriesPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.categories.panel')}>
      <Grid>
        <Field label={t('settingsPage.categories.labelOrder')}>
          <SettingsSelect
            value={prefs.categoryConfigurations?.labelOrder || 'alphabetical'}
            onChange={(value) => update('categoryConfigurations', 'labelOrder', value)}
            options={[
              { value: 'alphabetical', label: t('settingsPage.categories.labelAlphabetical') },
              { value: 'custom', label: t('settingsPage.categories.labelCustom') },
              { value: 'usage', label: t('settingsPage.categories.labelByUsage') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.categories.groupOrder')}>
          <SettingsSelect
            value={prefs.categoryConfigurations?.groupOrder || 'custom'}
            onChange={(value) => update('categoryConfigurations', 'groupOrder', value)}
            options={[
              { value: 'custom', label: t('settingsPage.categories.groupCustom') },
              { value: 'alphabetical', label: t('settingsPage.categories.groupAlphabetical') },
            ]}
          />
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
