import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import {
  getAppPreferences,
  preferenceDownloadPayload,
  resetAppPreferences,
  saveAppPreferences,
} from '../lib/appPreferences.js';
import { APP_FUNCTIONS, groupedFunctions } from '../lib/functionCatalog.js';
import {
  CALENDAR_OPTIONS,
  DIRECTION_OPTIONS,
  NUMBERING_SYSTEM_OPTIONS,
  SUPPORTED_LOCALES,
} from '../lib/i18n.js';
import { getMapPreferences, saveMapPreferences } from '../lib/placeGeocoding.js';
import { NAME_FORMAT_OPTIONS, formatName } from '../lib/nameFormat.js';
import { VITAL_MARKER_STYLE_OPTIONS } from '../lib/vitalFormat.js';
import { PLAUSIBILITY_ANALYZERS } from '../lib/plausibility.js';
import { GEDCOM_ENCODINGS } from '../lib/genealogyFileFormats.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const TAB_IDS = [
  'general', 'formats', 'arabic-islamic', 'tree-layout', 'maps', 'media',
  'pdf', 'history', 'content-download', 'edit-controllers', 'categories',
  'export', 'privacy', 'plausibility', 'integrations', 'functions',
];

export default function Settings() {
  const modal = useModal();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const tabs = TAB_IDS.map((id) => ({ id, label: t(`settingsPage.tabs.${id}`) }));
  const [activeTab, setActiveTab] = useState('general');
  const [prefs, setPrefs] = useState(null);
  const [mapPrefs, setMapPrefs] = useState(null);
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [app, map] = await Promise.all([getAppPreferences(), getMapPreferences()]);
      if (!cancelled) {
        setPrefs(app);
        setMapPrefs(map);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((section, key, value) => {
    setPrefs((current) => ({
      ...current,
      [section]: {
        ...(current?.[section] || {}),
        [key]: value,
      },
    }));
  }, []);

  const updateMap = useCallback((key, value) => {
    setMapPrefs((current) => ({ ...(current || {}), [key]: value }));
  }, []);

  const save = useCallback(async () => {
    const [nextPrefs, nextMap] = await Promise.all([
      saveAppPreferences(prefs),
      mapPrefs ? saveMapPreferences(mapPrefs) : Promise.resolve(mapPrefs),
    ]);
    setPrefs(nextPrefs);
    setMapPrefs(nextMap);
    setStatus(t('settingsPage.saved'));
    setTimeout(() => setStatus(''), 1500);
  }, [mapPrefs, prefs, t]);

  const reset = useCallback(async () => {
    if (!(await modal.confirm(t('settingsPage.resetConfirm'), { title: t('settingsPage.resetTitle'), okLabel: t('settingsPage.resetOk'), destructive: true }))) return;
    const next = await resetAppPreferences();
    setPrefs(next);
    setStatus(t('settingsPage.resetStatus'));
    setTimeout(() => setStatus(''), 1500);
  }, [modal, t]);

  const exportPrefs = useCallback(() => {
    const blob = new Blob([JSON.stringify(preferenceDownloadPayload(prefs), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudtreeweb-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [prefs]);

  const importPrefs = useCallback(async (file) => {
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    const next = await saveAppPreferences(parsed.preferences || parsed);
    setPrefs(next);
    setStatus(t('settingsPage.imported'));
    setTimeout(() => setStatus(''), 1500);
  }, [t]);

  if (!prefs || !mapPrefs) return <div className="p-10 text-muted-foreground">{t('settingsPage.loading')}</div>;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5">
        <header className="flex items-center gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold">{t('settingsPage.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('settingsPage.subtitle')}</p>
          </div>
          {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
          <button onClick={save} className={primaryButton}>{t('settingsPage.save')}</button>
          <button onClick={reset} className={secondaryButton}>{t('settingsPage.reset')}</button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-border mb-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 ${activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'general' && (
          <Panel title={t('settingsPage.general.panel')}>
            <Grid>
              <Field label={t('settingsPage.general.theme')}>
                <select value={theme} onChange={(event) => setTheme(event.target.value)} className={inputClass}>
                  <option value="light">{t('settingsPage.general.themeLight')}</option>
                  <option value="dark">{t('settingsPage.general.themeDark')}</option>
                </select>
              </Field>
              <Field label={t('settingsPage.general.startView')}>
                <select value={prefs.general.startRoute} onChange={(event) => update('general', 'startRoute', event.target.value)} className={inputClass}>
                  {APP_FUNCTIONS.filter((item) => !item.unavailable).map((item) => <option key={item.to} value={item.to}>{t(`appFunctions.${item.to}`, { defaultValue: item.label })}</option>)}
                </select>
              </Field>
              <Switch label={t('settingsPage.general.confirmDeletes')} checked={prefs.general.confirmDeletes} onChange={(value) => update('general', 'confirmDeletes', value)} />
              <Switch label={t('settingsPage.general.autoSaveEditors')} checked={prefs.general.autoSaveEditors} onChange={(value) => update('general', 'autoSaveEditors', value)} />
              <Switch label={t('settingsPage.general.showPrivateRecords')} checked={prefs.general.showPrivateRecords} onChange={(value) => update('general', 'showPrivateRecords', value)} />
              <Switch label={t('settingsPage.general.compactLists')} checked={prefs.general.compactLists} onChange={(value) => update('general', 'compactLists', value)} />
            </Grid>
          </Panel>
        )}

        {activeTab === 'formats' && (
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
        )}

        {activeTab === 'arabic-islamic' && (
          <Panel title={t('settingsPage.arabicIslamic.panel')}>
            <Grid>
              <Field label={t('settingsPage.arabicIslamic.vitalMarkerStyle')} hint={t('settingsPage.arabicIslamic.vitalMarkerHint')}>
                <select
                  value={prefs.formats.vitalDisplay?.markerStyle || 'range'}
                  onChange={(event) => update('formats', 'vitalDisplay', { ...(prefs.formats.vitalDisplay || {}), markerStyle: event.target.value })}
                  className={inputClass}
                >
                  {VITAL_MARKER_STYLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{t(`constants.vitalMarker.${option.value}`)}</option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {t('settingsPage.preview')}: <span className="font-mono text-foreground">{vitalPreview(prefs.formats.vitalDisplay?.markerStyle)}</span>
                </div>
              </Field>
              <Switch
                label={t('settingsPage.arabicIslamic.preferArabic')}
                checked={!!prefs.arabicIslamic?.preferArabicCatalogLabels}
                onChange={(value) => update('arabicIslamic', 'preferArabicCatalogLabels', value)}
              />
            </Grid>
            <p className="mt-3 text-xs text-muted-foreground">{t('settingsPage.arabicIslamic.footer')}</p>
          </Panel>
        )}

        {activeTab === 'tree-layout' && (
          <Panel title={t('settingsPage.treeLayout.panel')}>
            <Grid>
              <Switch
                label={t('settingsPage.treeLayout.athara')}
                checked={prefs.treeLayout?.atharaCoupleSafeguards !== false}
                onChange={(value) => update('treeLayout', 'atharaCoupleSafeguards', value)}
              />
              <Switch
                label={t('settingsPage.treeLayout.cycleProtection')}
                checked={prefs.treeLayout?.cycleProtection !== false}
                onChange={(value) => update('treeLayout', 'cycleProtection', value)}
              />
              <Switch
                label={t('settingsPage.treeLayout.singleParentFallback')}
                checked={prefs.treeLayout?.singleParentCoupleFallback !== false}
                onChange={(value) => update('treeLayout', 'singleParentCoupleFallback', value)}
              />
            </Grid>
            <p className="mt-3 text-xs text-muted-foreground">{t('settingsPage.treeLayout.footer')}</p>
          </Panel>
        )}

        {activeTab === 'maps' && (
          <Panel title={t('settingsPage.maps.panel')}>
            <Grid>
              <Field label={t('settingsPage.maps.basemap')}>
                <select value={mapPrefs.basemap} onChange={(event) => updateMap('basemap', event.target.value)} className={inputClass}>
                  <option value="auto">{t('settingsPage.maps.basemapAuto')}</option>
                  <option value="positron">{t('settingsPage.maps.basemapLight')}</option>
                  <option value="voyager">{t('settingsPage.maps.basemapVoyager')}</option>
                  <option value="dark">{t('settingsPage.maps.basemapDark')}</option>
                </select>
              </Field>
              <Field label={t('settingsPage.maps.defaultZoom')}>
                <input type="number" min="1" max="18" value={mapPrefs.defaultZoom} onChange={(event) => updateMap('defaultZoom', Number(event.target.value))} className={inputClass} />
              </Field>
              <Field label={t('settingsPage.maps.batchLimit')}>
                <input type="number" min="1" max="50" value={mapPrefs.batchLimit} onChange={(event) => updateMap('batchLimit', Number(event.target.value))} className={inputClass} />
              </Field>
              <Switch label={t('settingsPage.maps.showLabels')} checked={mapPrefs.showLabels} onChange={(value) => updateMap('showLabels', value)} />
              <Switch label={t('settingsPage.maps.markerClustering')} checked={mapPrefs.markerClustering} onChange={(value) => updateMap('markerClustering', value)} />
            </Grid>
          </Panel>
        )}

        {activeTab === 'media' && (
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
        )}

        {activeTab === 'pdf' && (
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
        )}

        {activeTab === 'history' && (
          <Panel title={t('settingsPage.history.panel')}>
            <Grid>
              <Switch label={t('settingsPage.history.showWorldEvents')} checked={prefs.history?.showWorldEventsInTimeline !== false} onChange={(value) => update('history', 'showWorldEventsInTimeline', value)} />
              <Field label={t('settingsPage.history.yearsBefore')}>
                <input type="number" min={0} max={50} value={prefs.history?.lifespanYearsBeforeBirth ?? 5} onChange={(event) => update('history', 'lifespanYearsBeforeBirth', Number(event.target.value))} className={inputClass} />
              </Field>
              <Field label={t('settingsPage.history.yearsAfter')}>
                <input type="number" min={0} max={50} value={prefs.history?.lifespanYearsAfterDeath ?? 5} onChange={(event) => update('history', 'lifespanYearsAfterDeath', Number(event.target.value))} className={inputClass} />
              </Field>
              <Field label={t('settingsPage.history.categories')}>
                <input
                  type="text"
                  value={(prefs.history?.worldHistoryCategories || []).join(', ')}
                  onChange={(event) => update('history', 'worldHistoryCategories', event.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  className={inputClass}
                />
              </Field>
            </Grid>
          </Panel>
        )}

        {activeTab === 'content-download' && (
          <Panel title={t('settingsPage.contentDownload.panel')}>
            <Grid>
              <Switch label={t('settingsPage.contentDownload.autoHistory')} checked={prefs.contentDownload?.autoDownloadHistory !== false} onChange={(value) => update('contentDownload', 'autoDownloadHistory', value)} />
              <Switch label={t('settingsPage.contentDownload.autoFs')} checked={!!prefs.contentDownload?.autoDownloadFamilySearchSources} onChange={(value) => update('contentDownload', 'autoDownloadFamilySearchSources', value)} />
              <Field label={t('settingsPage.contentDownload.concurrency')}>
                <input type="number" min={1} max={12} value={prefs.contentDownload?.concurrency ?? 3} onChange={(event) => update('contentDownload', 'concurrency', Number(event.target.value))} className={inputClass} />
              </Field>
              <Switch label={t('settingsPage.contentDownload.wifiOnly')} checked={!!prefs.contentDownload?.wifiOnly} onChange={(value) => update('contentDownload', 'wifiOnly', value)} />
            </Grid>
          </Panel>
        )}

        {activeTab === 'edit-controllers' && (
          <Panel title={t('settingsPage.editControllers.panel')}>
            <Grid>
              <Switch label={t('settingsPage.editControllers.eventTypesCollapsed')} checked={!!prefs.editControllers?.eventTypesCollapsed} onChange={(value) => update('editControllers', 'eventTypesCollapsed', value)} />
              <Switch label={t('settingsPage.editControllers.factTypesCollapsed')} checked={!!prefs.editControllers?.factTypesCollapsed} onChange={(value) => update('editControllers', 'factTypesCollapsed', value)} />
              <Field label={t('settingsPage.editControllers.defaultEvent')}>
                <input type="text" value={prefs.editControllers?.defaultEventType || 'Birth'} onChange={(event) => update('editControllers', 'defaultEventType', event.target.value)} className={inputClass} />
              </Field>
              <Field label={t('settingsPage.editControllers.defaultFact')}>
                <input type="text" value={prefs.editControllers?.defaultFactType || 'Occupation'} onChange={(event) => update('editControllers', 'defaultFactType', event.target.value)} className={inputClass} />
              </Field>
            </Grid>
          </Panel>
        )}

        {activeTab === 'categories' && (
          <Panel title={t('settingsPage.categories.panel')}>
            <Grid>
              <Field label={t('settingsPage.categories.labelOrder')}>
                <select value={prefs.categoryConfigurations?.labelOrder || 'alphabetical'} onChange={(event) => update('categoryConfigurations', 'labelOrder', event.target.value)} className={inputClass}>
                  <option value="alphabetical">{t('settingsPage.categories.labelAlphabetical')}</option>
                  <option value="custom">{t('settingsPage.categories.labelCustom')}</option>
                  <option value="usage">{t('settingsPage.categories.labelByUsage')}</option>
                </select>
              </Field>
              <Field label={t('settingsPage.categories.groupOrder')}>
                <select value={prefs.categoryConfigurations?.groupOrder || 'custom'} onChange={(event) => update('categoryConfigurations', 'groupOrder', event.target.value)} className={inputClass}>
                  <option value="custom">{t('settingsPage.categories.groupCustom')}</option>
                  <option value="alphabetical">{t('settingsPage.categories.groupAlphabetical')}</option>
                </select>
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
        )}

        {activeTab === 'export' && (
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
        )}

        {activeTab === 'privacy' && (
          <Panel title={t('settingsPage.privacy.panel')}>
            <Grid>
              <Switch label={t('settingsPage.privacy.hidePrivate')} checked={prefs.privacy.hideMarkedPrivate !== false} onChange={(value) => update('privacy', 'hideMarkedPrivate', value)} />
              <Switch label={t('settingsPage.privacy.hideLiving')} checked={!!prefs.privacy.hideLivingPersons} onChange={(value) => update('privacy', 'hideLivingPersons', value)} />
              <Switch label={t('settingsPage.privacy.maskOnly')} checked={!!prefs.privacy.hideLivingDetailsOnly} onChange={(value) => update('privacy', 'hideLivingDetailsOnly', value)} />
              <Field label={t('settingsPage.privacy.threshold')}>
                <input type="number" min="1" max="200" value={prefs.privacy.livingPersonThresholdYears} onChange={(event) => update('privacy', 'livingPersonThresholdYears', Number(event.target.value))} className={inputClass} />
              </Field>
            </Grid>
            <p className="mt-3 text-xs text-muted-foreground">{t('settingsPage.privacy.footer')}</p>
          </Panel>
        )}

        {activeTab === 'plausibility' && (
          <Panel title={t('settingsPage.plausibility.panel')}>
            <div className="space-y-2">
              {PLAUSIBILITY_ANALYZERS.map((a) => (
                <label key={a.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.plausibility?.enabled?.[a.id] !== false}
                    onChange={(e) => update('plausibility', 'enabled', { ...(prefs.plausibility?.enabled || {}), [a.id]: e.target.checked })}
                  />
                  <span className="flex-1">{t(`constants.plausibility.${a.id}`)}</span>
                </label>
              ))}
            </div>
            <Grid>
              <Field label={t('settingsPage.plausibility.maxLifespan')}>
                <input type="number" min="1" max="200" value={prefs.plausibility.thresholds.maxLifespan} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, maxLifespan: Number(e.target.value) })} className={inputClass} />
              </Field>
              <Field label={t('settingsPage.plausibility.minMarriageAge')}>
                <input type="number" min="1" max="50" value={prefs.plausibility.thresholds.minMarriageAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, minMarriageAge: Number(e.target.value) })} className={inputClass} />
              </Field>
              <Field label={t('settingsPage.plausibility.minParentAge')}>
                <input type="number" min="1" max="50" value={prefs.plausibility.thresholds.minParentAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, minParentAge: Number(e.target.value) })} className={inputClass} />
              </Field>
              <Field label={t('settingsPage.plausibility.maxParentAge')}>
                <input type="number" min="1" max="100" value={prefs.plausibility.thresholds.maxParentAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, maxParentAge: Number(e.target.value) })} className={inputClass} />
              </Field>
            </Grid>
          </Panel>
        )}

        {activeTab === 'integrations' && (
          <Panel title={t('settingsPage.integrations.panel')}>
            <Grid>
              <Field label={t('settingsPage.integrations.provider')}>
                <select value={prefs.webSearch.provider} onChange={(event) => update('webSearch', 'provider', event.target.value)} className={inputClass}>
                  <option value="familysearch">{t('settingsPage.integrations.providerFs')}</option>
                  <option value="ancestry">{t('settingsPage.integrations.providerAncestry')}</option>
                  <option value="findagrave">{t('settingsPage.integrations.providerFindAGrave')}</option>
                  <option value="google">{t('settingsPage.integrations.providerGoogle')}</option>
                  <option value="custom">{t('settingsPage.integrations.providerCustom')}</option>
                </select>
              </Field>
              <Field label={t('settingsPage.integrations.customUrl')}>
                <input value={prefs.webSearch.customUrl} onChange={(event) => update('webSearch', 'customUrl', event.target.value)} className={inputClass} />
              </Field>
              <Field label={t('settingsPage.integrations.defaultFsTask')}>
                <select value={prefs.familySearch.defaultTaskType} onChange={(event) => update('familySearch', 'defaultTaskType', event.target.value)} className={inputClass}>
                  <option value="match-review">{t('settingsPage.integrations.taskMatch')}</option>
                  <option value="record-match-review">{t('settingsPage.integrations.taskRecord')}</option>
                  <option value="picture-review">{t('settingsPage.integrations.taskPicture')}</option>
                  <option value="ordinance-review">{t('settingsPage.integrations.taskOrdinance')}</option>
                  <option value="sync-review">{t('settingsPage.integrations.taskSync')}</option>
                </select>
              </Field>
              <Switch label={t('settingsPage.integrations.openInNewTab')} checked={prefs.webSearch.openInNewTab} onChange={(value) => update('webSearch', 'openInNewTab', value)} />
              <Switch label={t('settingsPage.integrations.showMatched')} checked={prefs.familySearch.showMatched} onChange={(value) => update('familySearch', 'showMatched', value)} />
              <Switch label={t('settingsPage.integrations.showUnmatched')} checked={prefs.familySearch.showUnmatched} onChange={(value) => update('familySearch', 'showUnmatched', value)} />
            </Grid>
          </Panel>
        )}

        {activeTab === 'functions' && (
          <FunctionsPanel prefs={prefs} setPrefs={setPrefs} t={t} />
        )}
      </div>
    </div>
  );
}

function FunctionsPanel({ prefs, setPrefs, t }) {
  const groups = useMemo(() => groupedFunctions(APP_FUNCTIONS.filter((item) => !item.unavailable)), []);
  const toggleList = (listName, route) => {
    setPrefs((current) => {
      const set = new Set(current.functions[listName] || []);
      if (set.has(route)) set.delete(route);
      else set.add(route);
      return {
        ...current,
        functions: {
          ...current.functions,
          [listName]: [...set],
        },
      };
    });
  };

  return (
    <Panel title={t('settingsPage.functions.panel')}>
      <div className="space-y-5">
        {Object.entries(groups).map(([category, items]) => {
          const categoryKey = `categories.${category.toLowerCase()}`;
          const categoryLabel = t(categoryKey);
          return (
          <section key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{categoryLabel === categoryKey ? category : categoryLabel}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((item) => (
                <div key={item.to} className="rounded-md border border-border bg-card p-3">
                  <div className="text-sm font-medium mb-2">{t(`appFunctions.${item.to}`, { defaultValue: item.label })}</div>
                  <div className="flex flex-wrap gap-2">
                    <CheckButton active={prefs.functions.favorites.includes(item.to)} onClick={() => toggleList('favorites', item.to)}>{t('settingsPage.functions.favorite')}</CheckButton>
                    <CheckButton active={prefs.functions.emphasized.includes(item.to)} onClick={() => toggleList('emphasized', item.to)}>{t('settingsPage.functions.emphasized')}</CheckButton>
                    <CheckButton active={prefs.functions.hidden.includes(item.to)} onClick={() => toggleList('hidden', item.to)}>{t('settingsPage.functions.hidden')}</CheckButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
          );
        })}
      </div>
    </Panel>
  );
}

const SAMPLE_NAME_PARTS = { title: 'Dr.', first: 'Maria', middle: 'Eleanor', last: 'García', suffix: 'Jr.' };

function NameFormatPreview({ preset, t }) {
  const rendered = formatName(SAMPLE_NAME_PARTS, preset) || '—';
  return (
    <div className="mt-1 text-[11px] text-muted-foreground">
      {t ? t('settingsPage.preview') : 'Preview'}: <span className="font-mono text-foreground">{rendered}</span>
    </div>
  );
}

function vitalPreview(markerStyle = 'range') {
  if (markerStyle === 'symbols') return '* 1901  ◆ 1989';
  if (markerStyle === 'arabic-labels') return 'ميلاد 1901  وفاة 1989';
  return '1901 – 1989';
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground mt-1">{hint}</span>}
    </label>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-sm">{label}</span>
      <input type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function CheckButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary text-foreground'}`}
    >
      {children}
    </button>
  );
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';
const primaryButton = 'rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60';
const secondaryButton = 'rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60';
