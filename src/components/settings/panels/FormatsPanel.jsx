import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, NameFormatPreview, Panel, Switch, inputClass } from '../sharedUI.jsx';
import {
  CALENDAR_OPTIONS,
  DIRECTION_OPTIONS,
  NUMBERING_SYSTEM_OPTIONS,
  SUPPORTED_LOCALES,
} from '../../../lib/i18n.js';
import { NAME_FORMAT_OPTIONS } from '../../../lib/nameFormat.js';

export default function FormatsPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.formats.panel')}>
      <Grid>
        <Field label={t('settingsPage.formats.nameOrder')}>
          <select value={prefs.formats.nameOrder} onChange={(event) => update('formats', 'nameOrder', event.target.value)} className={inputClass}>
            <option value="given-family">{t('settingsPage.formats.nameOrderGivenFamily')}</option>
            <option value="family-given">{t('settingsPage.formats.nameOrderFamilyGiven')}</option>
            <option value="display">{t('settingsPage.formats.nameOrderDisplay')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.formats.nameDisplayFormat')}>
          <select value={prefs.formats.nameDisplayFormat} onChange={(event) => update('formats', 'nameDisplayFormat', event.target.value)} className={inputClass}>
            {NAME_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{t(`constants.nameFormat.${option.value}`)}</option>
            ))}
          </select>
          <NameFormatPreview preset={prefs.formats.nameDisplayFormat} t={t} />
        </Field>
        <Field label={t('settingsPage.formats.nameSortFormat')}>
          <select value={prefs.formats.nameSortFormat} onChange={(event) => update('formats', 'nameSortFormat', event.target.value)} className={inputClass}>
            {NAME_FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{t(`constants.nameFormat.${option.value}`)}</option>
            ))}
          </select>
          <NameFormatPreview preset={prefs.formats.nameSortFormat} t={t} />
        </Field>
        <Field label={t('settingsPage.formats.surnameCase')}>
          <select value={prefs.formats.surnameCase} onChange={(event) => update('formats', 'surnameCase', event.target.value)} className={inputClass}>
            <option value="as-entered">{t('settingsPage.formats.surnameAsEntered')}</option>
            <option value="upper">{t('settingsPage.formats.surnameUpper')}</option>
            <option value="title">{t('settingsPage.formats.surnameTitle')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.formats.dateDisplayFormat')}>
          <select value={prefs.formats.dateDisplayFormat} onChange={(event) => update('formats', 'dateDisplayFormat', event.target.value)} className={inputClass}>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD MM YYYY">DD MM YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="D MMM YYYY">D MMM YYYY</option>
          </select>
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
          <select value={prefs.localization?.locale || 'en'} onChange={(event) => update('localization', 'locale', event.target.value)} className={inputClass}>
            {SUPPORTED_LOCALES.map((locale) => (
              <option key={locale.value} value={locale.value}>{locale.label} - {locale.nativeLabel}</option>
            ))}
          </select>
        </Field>
        <Field label={t('settingsPage.formats.direction')}>
          <select value={prefs.localization?.direction || 'auto'} onChange={(event) => update('localization', 'direction', event.target.value)} className={inputClass}>
            {DIRECTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(`constants.direction.${option.value}`)}</option>)}
          </select>
        </Field>
        <Field label={t('settingsPage.formats.numberingSystem')}>
          <select value={prefs.localization?.numberingSystem || 'auto'} onChange={(event) => update('localization', 'numberingSystem', event.target.value)} className={inputClass}>
            {NUMBERING_SYSTEM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(`constants.numberingSystem.${option.value}`)}</option>)}
          </select>
        </Field>
        <Field label={t('settingsPage.formats.calendar')}>
          <select value={prefs.localization?.calendar || 'gregory'} onChange={(event) => update('localization', 'calendar', event.target.value)} className={inputClass}>
            {CALENDAR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(`constants.calendar.${option.value}`)}</option>)}
          </select>
        </Field>
      </Grid>
    </Panel>
  );
}
