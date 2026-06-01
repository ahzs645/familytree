import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, SettingsSelect, Switch, inputClass, secondaryButton } from '../sharedUI.jsx';
import { GEDCOM_ENCODINGS } from '../../../lib/genealogyFileFormats.js';

export default function ExportPanel() {
  const { prefs, update, exportPrefs, importPrefs, fileRef, t } = useSettings();
  return (
    <Panel title={t('settingsPage.export.panel')}>
      <Grid>
        <Field label={t('settingsPage.export.pdfPageSize')}>
          <SettingsSelect
            value={prefs.pdf.pageSize}
            onChange={(value) => update('pdf', 'pageSize', value)}
            options={[
              { value: 'letter', label: t('settingsPage.pdf.paperLetter') },
              { value: 'a4', label: t('settingsPage.pdf.paperA4') },
              { value: 'legal', label: t('settingsPage.pdf.paperLegal') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.export.pdfOrientation')}>
          <SettingsSelect
            value={prefs.pdf.orientation}
            onChange={(value) => update('pdf', 'orientation', value)}
            options={[
              { value: 'portrait', label: t('settingsPage.pdf.portrait') },
              { value: 'landscape', label: t('settingsPage.pdf.landscape') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.export.pdfMargin')}>
          <input type="number" min="12" max="144" value={prefs.pdf.margin} onChange={(event) => update('pdf', 'margin', Number(event.target.value))} className={inputClass} />
        </Field>
        <Field label={t('settingsPage.export.gedcomEncodingExport')}>
          <SettingsSelect
            value={prefs.exportDefaults.gedcomEncoding}
            onChange={(value) => update('exportDefaults', 'gedcomEncoding', value)}
            options={[
              { value: 'utf-8', label: 'UTF-8' },
              { value: 'utf-16', label: 'UTF-16' },
              { value: 'ansi', label: 'ANSI' },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.export.gedcomEncodingImport')}>
          <SettingsSelect
            value={prefs.importDefaults?.gedcomEncoding || 'auto'}
            onChange={(value) => update('importDefaults', 'gedcomEncoding', value)}
            options={GEDCOM_ENCODINGS.map((option) => ({
              value: option.id,
              label: t(`constants.gedcomEncoding.${option.id}`),
            }))}
          />
        </Field>
        <Field label={t('settingsPage.export.gedcomImportMode')}>
          <SettingsSelect
            value={prefs.importDefaults?.gedcomMode || 'review'}
            onChange={(value) => update('importDefaults', 'gedcomMode', value)}
            options={[
              { value: 'review', label: t('settingsPage.export.modeReview') },
              { value: 'strict', label: t('settingsPage.export.modeStrict') },
              { value: 'lenient', label: t('settingsPage.export.modeLenient') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.export.websiteTheme')}>
          <SettingsSelect
            value={prefs.exportDefaults.websiteTheme}
            onChange={(value) => update('exportDefaults', 'websiteTheme', value)}
            options={[
              { value: 'classic', label: t('settingsPage.export.themeClassic') },
              { value: 'compact', label: t('settingsPage.export.themeCompact') },
              { value: 'archive', label: t('settingsPage.export.themeArchive') },
            ]}
          />
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
