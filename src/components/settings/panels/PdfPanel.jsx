import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, SettingsSelect, Switch, inputClass } from '../sharedUI.jsx';

export default function PdfPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.pdf.panel')}>
      <Grid>
        <Field label={t('settingsPage.pdf.pageSize')}>
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
        <Field label={t('settingsPage.pdf.orientation')}>
          <SettingsSelect
            value={prefs.pdf.orientation}
            onChange={(value) => update('pdf', 'orientation', value)}
            options={[
              { value: 'portrait', label: t('settingsPage.pdf.portrait') },
              { value: 'landscape', label: t('settingsPage.pdf.landscape') },
            ]}
          />
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
