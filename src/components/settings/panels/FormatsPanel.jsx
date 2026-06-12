import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, NameFormatPreview, Panel, SettingsSelect, Switch, inputClass } from '../sharedUI.jsx';
import {
  CALENDAR_OPTIONS,
  DIRECTION_OPTIONS,
  NUMBERING_SYSTEM_OPTIONS,
  SUPPORTED_LOCALES,
} from '../../../lib/i18n.js';
import { ADDITIONAL_NAME_DISPLAY_OPTIONS, NAME_FORMAT_OPTIONS } from '../../../lib/nameFormat.js';

export default function FormatsPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.formats.panel')}>
      <Grid>
        <Field label={t('settingsPage.formats.nameOrder')}>
          <SettingsSelect
            value={prefs.formats.nameOrder}
            onChange={(value) => update('formats', 'nameOrder', value)}
            options={[
              { value: 'given-family', label: t('settingsPage.formats.nameOrderGivenFamily') },
              { value: 'family-given', label: t('settingsPage.formats.nameOrderFamilyGiven') },
              { value: 'display', label: t('settingsPage.formats.nameOrderDisplay') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.formats.nameDisplayFormat')}>
          <SettingsSelect
            value={prefs.formats.nameDisplayFormat}
            onChange={(value) => update('formats', 'nameDisplayFormat', value)}
            options={NAME_FORMAT_OPTIONS.map((option) => ({
              value: option.value,
              label: t(`constants.nameFormat.${option.value}`),
            }))}
          />
          <NameFormatPreview preset={prefs.formats.nameDisplayFormat} t={t} />
        </Field>
        <Field label={t('settingsPage.formats.nameSortFormat')}>
          <SettingsSelect
            value={prefs.formats.nameSortFormat}
            onChange={(value) => update('formats', 'nameSortFormat', value)}
            options={NAME_FORMAT_OPTIONS.map((option) => ({
              value: option.value,
              label: t(`constants.nameFormat.${option.value}`),
            }))}
          />
          <NameFormatPreview preset={prefs.formats.nameSortFormat} t={t} />
        </Field>
        <Field label={t('settingsPage.formats.additionalNameDisplay')}>
          <SettingsSelect
            value={prefs.formats.additionalNameDisplay}
            onChange={(value) => update('formats', 'additionalNameDisplay', value)}
            options={ADDITIONAL_NAME_DISPLAY_OPTIONS.map((option) => ({
              value: option.value,
              label: t(`constants.additionalNameDisplay.${option.value}`),
            }))}
          />
        </Field>
        <Field label={t('settingsPage.formats.surnameCase')}>
          <SettingsSelect
            value={prefs.formats.surnameCase}
            onChange={(value) => update('formats', 'surnameCase', value)}
            options={[
              { value: 'as-entered', label: t('settingsPage.formats.surnameAsEntered') },
              { value: 'upper', label: t('settingsPage.formats.surnameUpper') },
              { value: 'title', label: t('settingsPage.formats.surnameTitle') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.formats.dateDisplayFormat')}>
          <SettingsSelect
            value={prefs.formats.dateDisplayFormat}
            onChange={(value) => update('formats', 'dateDisplayFormat', value)}
            options={[
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              { value: 'DD MM YYYY', label: 'DD MM YYYY' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
              { value: 'D MMM YYYY', label: 'D MMM YYYY' },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.formats.readableDateFormats')}>
          <textarea value={prefs.formats.readableDateFormats} onChange={(event) => update('formats', 'readableDateFormats', event.target.value)} rows={5} className={inputClass} />
        </Field>
        <Switch
          label={t('settingsPage.formats.acceptYearOnly')}
          checked={prefs.formats.partialDateEntry?.allowYearOnly !== false}
          onChange={(value) => update('formats', 'partialDateEntry', { ...(prefs.formats.partialDateEntry || {}), allowYearOnly: value })}
        />
        <Switch
          label={t('settingsPage.formats.acceptYearMonth')}
          checked={prefs.formats.partialDateEntry?.allowYearMonth !== false}
          onChange={(value) => update('formats', 'partialDateEntry', { ...(prefs.formats.partialDateEntry || {}), allowYearMonth: value })}
        />
        <Switch
          label={t('settingsPage.formats.acceptCalendarPrefixes')}
          checked={prefs.formats.partialDateEntry?.allowCalendarPrefixes !== false}
          onChange={(value) => update('formats', 'partialDateEntry', { ...(prefs.formats.partialDateEntry || {}), allowCalendarPrefixes: value })}
        />
        <Field label={t('settingsPage.formats.language')}>
          <SettingsSelect
            value={prefs.localization?.locale || 'en'}
            onChange={(value) => update('localization', 'locale', value)}
            options={SUPPORTED_LOCALES.map((locale) => ({
              value: locale.value,
              label: `${locale.label} - ${locale.nativeLabel}`,
            }))}
          />
        </Field>
        <Field label={t('settingsPage.formats.direction')}>
          <SettingsSelect
            value={prefs.localization?.direction || 'auto'}
            onChange={(value) => update('localization', 'direction', value)}
            options={DIRECTION_OPTIONS.map((option) => ({
              value: option.value,
              label: t(`constants.direction.${option.value}`),
            }))}
          />
        </Field>
        <Field label={t('settingsPage.formats.numberingSystem')}>
          <SettingsSelect
            value={prefs.localization?.numberingSystem || 'auto'}
            onChange={(value) => update('localization', 'numberingSystem', value)}
            options={NUMBERING_SYSTEM_OPTIONS.map((option) => ({
              value: option.value,
              label: t(`constants.numberingSystem.${option.value}`),
            }))}
          />
        </Field>
        <Field label={t('settingsPage.formats.calendar')}>
          <SettingsSelect
            value={prefs.localization?.calendar || 'gregory'}
            onChange={(value) => update('localization', 'calendar', value)}
            options={CALENDAR_OPTIONS.map((option) => ({
              value: option.value,
              label: t(`constants.calendar.${option.value}`),
            }))}
          />
        </Field>
      </Grid>
    </Panel>
  );
}
