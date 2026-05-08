import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass, secondaryButton } from '../sharedUI.jsx';
import { GEDCOM_ENCODINGS } from '../../../lib/genealogyFileFormats.js';

export default function ExportPanel() {
  const { prefs, update, exportPrefs, importPrefs, fileRef, t } = useSettings();
  return (
    <Panel title={t('settingsPage.export.panel')}>
      <Grid>
        <Field label={t('settingsPage.export.pdfPageSize')}>
          <select value={prefs.pdf.pageSize} onChange={(event) => update('pdf', 'pageSize', event.target.value)} className={inputClass}>
            <option value="letter">{t('settingsPage.pdf.paperLetter')}</option>
            <option value="a4">{t('settingsPage.pdf.paperA4')}</option>
            <option value="legal">{t('settingsPage.pdf.paperLegal')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.export.pdfOrientation')}>
          <select value={prefs.pdf.orientation} onChange={(event) => update('pdf', 'orientation', event.target.value)} className={inputClass}>
            <option value="portrait">{t('settingsPage.pdf.portrait')}</option>
            <option value="landscape">{t('settingsPage.pdf.landscape')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.export.pdfMargin')}>
          <input type="number" min="12" max="144" value={prefs.pdf.margin} onChange={(event) => update('pdf', 'margin', Number(event.target.value))} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.export.gedcomEncodingExport')}>
          <select value={prefs.exportDefaults.gedcomEncoding} onChange={(event) => update('exportDefaults', 'gedcomEncoding', event.target.value)} className={inputClass}>
            <option value="utf-8">UTF-8</option>
            <option value="utf-16">UTF-16</option>
            <option value="ansi">ANSI</option>
          </select>
        </Field>
        <Field label={t('settingsPage.export.gedcomEncodingImport')}>
          <select
            value={prefs.importDefaults?.gedcomEncoding || 'auto'}
            onChange={(event) => update('importDefaults', 'gedcomEncoding', event.target.value)}
            className={inputClass}
          >
            {GEDCOM_ENCODINGS.map((option) => (
              <option key={option.id} value={option.id}>{t(`constants.gedcomEncoding.${option.id}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('settingsPage.export.gedcomImportMode')}>
          <select
            value={prefs.importDefaults?.gedcomMode || 'review'}
            onChange={(event) => update('importDefaults', 'gedcomMode', event.target.value)}
            className={inputClass}
          >
            <option value="review">{t('settingsPage.export.modeReview')}</option>
            <option value="strict">{t('settingsPage.export.modeStrict')}</option>
            <option value="lenient">{t('settingsPage.export.modeLenient')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.export.websiteTheme')}>
          <select value={prefs.exportDefaults.websiteTheme} onChange={(event) => update('exportDefaults', 'websiteTheme', event.target.value)} className={inputClass}>
            <option value="classic">{t('settingsPage.export.themeClassic')}</option>
            <option value="compact">{t('settingsPage.export.themeCompact')}</option>
            <option value="archive">{t('settingsPage.export.themeArchive')}</option>
          </select>
        </Field>
        <Switch label={t('settingsPage.export.includePrivate')} checked={prefs.exportDefaults.includePrivate} onChange={(value) => update('exportDefaults', 'includePrivate', value)} />
        <Switch label={t('settingsPage.export.includeMedia')} checked={prefs.exportDefaults.includeMedia} onChange={(value) => update('exportDefaults', 'includeMedia', value)} />
      </Grid>
      <div className="flex gap-2 mt-5">
        <button onClick={exportPrefs} className={secondaryButton}>{t('settingsPage.export.downloadPrefs')}</button>
        <button onClick={() => fileRef.current?.click()} className={secondaryButton}>{t('settingsPage.export.importPrefs')}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => importPrefs(event.target.files?.[0])} />
      </div>
    </Panel>
  );
}
