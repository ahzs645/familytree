import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, SettingsSelect, Switch, inputClass } from '../sharedUI.jsx';

export default function MediaSlideshowPanel() {
  const { prefs, update, t } = useSettings();
  return (
    <Panel title={t('settingsPage.media.panel')}>
      <Grid>
        <Field label={t('settingsPage.media.interval')}>
          <input
            type="number"
            min={1}
            max={60}
            value={prefs.media?.slideshow?.interval ?? 5}
            onChange={(event) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), interval: Number(event.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label={t('settingsPage.media.filterType')}>
          <SettingsSelect
            value={prefs.media?.slideshow?.filter || 'all'}
            onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), filter: value })}
            options={[
              { value: 'all', label: t('settingsPage.media.filterAll') },
              { value: 'MediaPicture', label: t('settingsPage.media.filterPictures') },
              { value: 'MediaPDF', label: t('settingsPage.media.filterPdf') },
              { value: 'MediaURL', label: t('settingsPage.media.filterUrl') },
              { value: 'MediaAudio', label: t('settingsPage.media.filterAudio') },
              { value: 'MediaVideo', label: t('settingsPage.media.filterVideo') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.media.imageFit')}>
          <SettingsSelect
            value={prefs.media?.slideshow?.fit || 'contain'}
            onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), fit: value })}
            options={[
              { value: 'contain', label: t('settingsPage.media.fitContain') },
              { value: 'cover', label: t('settingsPage.media.fitCover') },
              { value: 'actual', label: t('settingsPage.media.fitActual') },
            ]}
          />
        </Field>
        <Field label={t('settingsPage.media.backdrop')}>
          <SettingsSelect
            value={prefs.media?.slideshow?.background || 'dark'}
            onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), background: value })}
            options={[
              { value: 'dark', label: t('settingsPage.media.backdropDark') },
              { value: 'light', label: t('settingsPage.media.backdropLight') },
              { value: 'soft', label: t('settingsPage.media.backdropSoft') },
            ]}
          />
        </Field>
        <Switch label={t('settingsPage.media.captions')} checked={prefs.media?.slideshow?.showCaption !== false} onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), showCaption: value })} />
        <Switch label={t('settingsPage.media.metadata')} checked={!!prefs.media?.slideshow?.showMetadata} onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), showMetadata: value })} />
        <Switch label={t('settingsPage.media.loop')} checked={prefs.media?.slideshow?.loop !== false} onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), loop: value })} />
        <Switch label={t('settingsPage.media.shuffle')} checked={!!prefs.media?.slideshow?.random} onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), random: value })} />
      </Grid>
    </Panel>
  );
}
