import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, SettingsSelect, inputClass } from '../sharedUI.jsx';
import { applyDocumentAppearance } from '../../../lib/appPreferences.js';

/**
 * Colors & Appearance — accent colour, chart theme, and report background.
 * Mac reference: PreferencePaneColors.nib. The accent colour is applied to the
 * live document immediately so the picker doubles as a preview.
 */
export default function ColorsPanel() {
  const { prefs, update, theme, setTheme, t } = useSettings();
  if (!prefs) return null;
  const appearance = prefs.appearance || {};

  const setAccent = (value) => {
    update('appearance', 'accentColor', value);
    applyDocumentAppearance({ ...appearance, accentColor: value });
  };

  return (
    <Panel title={t('settingsPage.colors.panel')}>
      <Grid>
        <Field label={t('settingsPage.colors.theme')}>
          <SettingsSelect
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t('settingsPage.colors.themeLight') },
              { value: 'dark', label: t('settingsPage.colors.themeDark') },
              { value: 'system', label: t('settingsPage.colors.themeSystem') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.colors.accent')}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={appearance.accentColor || '#2563eb'}
              onChange={(event) => setAccent(event.target.value)}
              className="h-9 w-12 rounded-md border border-border bg-card p-1"
              aria-label={t('settingsPage.colors.accent')}
            />
            <input
              type="text"
              value={appearance.accentColor || ''}
              onChange={(event) => setAccent(event.target.value)}
              placeholder="#2563eb"
              className={inputClass}
            />
          </div>
        </Field>
        <Field label={t('settingsPage.colors.chartTheme')}>
          <SettingsSelect
            value={appearance.chartTheme || 'auto'}
            onChange={(value) => update('appearance', 'chartTheme', value)}
            options={[
              { value: 'auto', label: t('settingsPage.colors.chartThemeAuto') },
              { value: 'light', label: t('settingsPage.colors.themeLight') },
              { value: 'dark', label: t('settingsPage.colors.themeDark') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.colors.reportBackground')}>
          <SettingsSelect
            value={appearance.reportBackground || 'none'}
            onChange={(value) => update('appearance', 'reportBackground', value)}
            options={[
              { value: 'none', label: t('settingsPage.colors.reportBackgroundNone') },
              { value: 'subtle', label: t('settingsPage.colors.reportBackgroundSubtle') },
              { value: 'parchment', label: t('settingsPage.colors.reportBackgroundParchment') },
            ]}
          />
        </Field>
      </Grid>
    </Panel>
  );
}
