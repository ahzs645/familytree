import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';

export default function PdfPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.pdf.panel')}>
      <Grid>
        <Field label={t('settingsPage.pdf.pageSize')}>
          <select value={prefs.pdf.pageSize} onChange={(event) => update('pdf', 'pageSize', event.target.value)} className={inputClass}>
            <option value="letter">{t('settingsPage.pdf.paperLetter')}</option>
            <option value="a4">{t('settingsPage.pdf.paperA4')}</option>
            <option value="legal">{t('settingsPage.pdf.paperLegal')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.pdf.orientation')}>
          <select value={prefs.pdf.orientation} onChange={(event) => update('pdf', 'orientation', event.target.value)} className={inputClass}>
            <option value="portrait">{t('settingsPage.pdf.portrait')}</option>
            <option value="landscape">{t('settingsPage.pdf.landscape')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.pdf.margin')}>
          <input type="number" min={12} max={144} value={prefs.pdf.margin} onChange={(event) => update('pdf', 'margin', Number(event.target.value))} className={inputClass} />
        </Field>
        <Switch label={t('settingsPage.pdf.embedFonts')} checked={prefs.pdf.embedFonts !== false} onChange={(value) => update('pdf', 'embedFonts', value)} />
        <Switch label={t('settingsPage.pdf.includeBookmarks')} checked={prefs.pdf.includeBookmarks !== false} onChange={(value) => update('pdf', 'includeBookmarks', value)} />
        <Switch label={t('settingsPage.pdf.compressImages')} checked={prefs.pdf.compressImages !== false} onChange={(value) => update('pdf', 'compressImages', value)} />
      </Grid>
    </Panel>
  );
}
