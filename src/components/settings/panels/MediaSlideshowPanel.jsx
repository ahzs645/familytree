import React from 'react';
import { useSettings } from '../SettingsContext.jsx';
import { Field, Grid, Panel, Switch, inputClass } from '../sharedUI.jsx';

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
          <select
            value={prefs.media?.slideshow?.filter || 'all'}
            onChange={(event) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), filter: event.target.value })}
            className={inputClass}
          >
            <option value="all">{t('settingsPage.media.filterAll')}</option>
            <option value="MediaPicture">{t('settingsPage.media.filterPictures')}</option>
            <option value="MediaPDF">{t('settingsPage.media.filterPdf')}</option>
            <option value="MediaURL">{t('settingsPage.media.filterUrl')}</option>
            <option value="MediaAudio">{t('settingsPage.media.filterAudio')}</option>
            <option value="MediaVideo">{t('settingsPage.media.filterVideo')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.media.imageFit')}>
          <select
            value={prefs.media?.slideshow?.fit || 'contain'}
            onChange={(event) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), fit: event.target.value })}
            className={inputClass}
          >
            <option value="contain">{t('settingsPage.media.fitContain')}</option>
            <option value="cover">{t('settingsPage.media.fitCover')}</option>
            <option value="actual">{t('settingsPage.media.fitActual')}</option>
          </select>
        </Field>
        <Field label={t('settingsPage.media.backdrop')}>
          <select
            value={prefs.media?.slideshow?.background || 'dark'}
            onChange={(event) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), background: event.target.value })}
            className={inputClass}
          >
            <option value="dark">{t('settingsPage.media.backdropDark')}</option>
            <option value="light">{t('settingsPage.media.backdropLight')}</option>
            <option value="soft">{t('settingsPage.media.backdropSoft')}</option>
          </select>
        </Field>
        <Switch label={t('settingsPage.media.captions')} checked={prefs.media?.slideshow?.showCaption !== false} onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), showCaption: value })} />
        <Switch label={t('settingsPage.media.metadata')} checked={!!prefs.media?.slideshow?.showMetadata} onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), showMetadata: value })} />
        <Switch label={t('settingsPage.media.loop')} checked={prefs.media?.slideshow?.loop !== false} onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), loop: value })} />
        <Switch label={t('settingsPage.media.shuffle')} checked={!!prefs.media?.slideshow?.random} onChange={(value) => update('media', 'slideshow', { ...(prefs.media?.slideshow || {}), random: value })} />
      </Grid>
    </Panel>
  );
}
