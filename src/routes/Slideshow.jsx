/**
 * Slideshow — auto-advancing display of media records.
 * Falls back gracefully when records have no embedded image data.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { getAppPreferences } from '../lib/appPreferences.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { PageTitle } from '../components/ui/PageTitle.jsx';
import { Select } from '../components/ui/Select.jsx';
import { ToolbarOverflow, MenuRow } from '../components/ui/ToolbarOverflow.jsx';
import { useIsMobile } from '../lib/useIsMobile.js';
import { useSetPageMeta } from '../contexts/PageMetaContext.jsx';
import {
  mediaAssetSrc,
  mediaDisplayLabel,
  mediaRecordFallbackSrc,
  mediaTypesForFilter,
  normalizeMediaSlideshowSettings,
  parseMediaSlideshowSearchParams,
} from '../lib/mediaPresentation.js';

export default function Slideshow() {
  const { localization } = useTranslation();
  const isRtl = localization.direction === 'rtl';
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const [media, setMedia] = useState([]);
  const [assetsByMedia, setAssetsByMedia] = useState({});
  const [order, setOrder] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [settingsReady, setSettingsReady] = useState(false);
  const [interval, setIntervalSec] = useState(5);
  const [playing, setPlaying] = useState(true);
  const [filter, setFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [showCaption, setShowCaption] = useState(true);
  const [showMetadata, setShowMetadata] = useState(false);
  const [loop, setLoop] = useState(true);
  const [random, setRandom] = useState(false);
  const [fit, setFit] = useState('contain');
  const [background, setBackground] = useState('dark');
  const [fullscreen, setFullscreen] = useState(false);
  const tick = useRef(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const prefs = await getAppPreferences();
      const parsed = parseMediaSlideshowSearchParams(searchParams, prefs.media?.slideshow);
      const normalized = normalizeMediaSlideshowSettings(parsed.settings);
      if (cancel) return;
      setSelectedIds(parsed.selectedIds);
      setIntervalSec(normalized.interval);
      setFilter(normalized.filter);
      setEventFilter(normalized.eventFilter);
      setShowCaption(normalized.showCaption);
      setShowMetadata(normalized.showMetadata);
      setLoop(normalized.loop);
      setRandom(normalized.random);
      setFit(normalized.fit);
      setBackground(normalized.background);
      setSettingsReady(true);
    })();
    return () => { cancel = true; };
  }, [searchParams]);

  useEffect(() => {
    if (!settingsReady) return undefined;
    let cancel = false;
    (async () => {
      const data = getAppDataClient();
      const all = selectedIds.length
        ? await data.records.getMany(selectedIds)
        : (await Promise.all(mediaTypesForFilter(filter).map((t) => data.records.query(t, { limit: 100000 })))).flatMap(({ records }) => records);
      const filtered = eventFilter === 'all'
        ? all
        : all.filter((m) => String(m.fields?.eventType?.value || m.fields?.conclusionType?.value || '').toLowerCase().includes(eventFilter.toLowerCase()));
      const assetEntries = await Promise.all(filtered.map(async (record) => {
        const ids = record.fields?.assetIds?.value || [];
        const assets = ids.length ? (await Promise.all(ids.map((id) => data.assets.get(id)))).filter(Boolean) : await data.assets.listForRecord(record.recordName);
        return [record.recordName, assets];
      }));
      if (cancel) return;
      setMedia(filtered);
      setAssetsByMedia(Object.fromEntries(assetEntries));
      setIndex(0);
    })();
    return () => { cancel = true; };
  }, [eventFilter, filter, selectedIds, settingsReady]);

  useEffect(() => {
    if (random) {
      const indices = media.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setOrder(indices);
    } else {
      setOrder(media.map((_, i) => i));
    }
    setIndex(0);
  }, [media, random]);

  useEffect(() => {
    clearInterval(tick.current);
    if (playing && order.length > 1) {
      tick.current = setInterval(() => setIndex((i) => {
        const next = i + 1;
        if (next >= order.length) return loop ? 0 : i;
        return next;
      }), interval * 1000);
    }
    return () => clearInterval(tick.current);
  }, [playing, interval, order.length, loop]);

  // The phone's app bar carries the position, so the toolbar does not.
  useSetPageMeta(isMobile && media.length ? `${index + 1} / ${media.length}` : null);

  if (settingsReady && media.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No media records to show. Add media via the Media page or clear the selected slideshow set.
      </div>
    );
  }
  if (!settingsReady) return <div className="h-full flex items-center justify-center text-muted-foreground">Loading slideshow...</div>;

  const orderedIndex = order[index] ?? 0;
  const current = media[orderedIndex];
  const src = mediaAssetSrc(assetsByMedia[current?.recordName]?.[0]) || mediaRecordFallbackSrc(current);
  const caption = mediaDisplayLabel(current);
  const currentType = current?.recordType?.replace('Media', '') || 'Media';
  const fitClass = fit === 'cover' ? 'object-cover w-full h-full' : fit === 'actual' ? 'object-none max-w-none max-h-none' : 'object-contain max-w-full max-h-full';
  const backdropClass = background === 'light' ? 'bg-white text-slate-950' : background === 'soft' ? 'bg-secondary text-foreground' : 'bg-zinc-950 text-white';

  // Rendered inline on a wide toolbar and inside the overflow sheet on a
  // phone, so the two never drift apart.
  const settingsControls = (
    <>
      <MenuRow label="Media">
        <Select
          value={filter}
          onChange={setFilter}
          disabled={selectedIds.length > 0}
          ariaLabel="Media type"
          className="w-auto"
          triggerClassName="h-8 ps-2.5 pe-7 text-xs"
          options={[
            { value: 'all', label: 'All media' },
            { value: 'MediaPicture', label: 'Pictures only' },
            { value: 'MediaURL', label: 'URLs only' },
            { value: 'MediaPDF', label: 'PDFs only' },
            { value: 'MediaAudio', label: 'Audio only' },
            { value: 'MediaVideo', label: 'Video only' },
          ]}
        />
      </MenuRow>
      <MenuRow label="Event">
        <Select
          value={eventFilter}
          onChange={setEventFilter}
          ariaLabel="Event filter"
          className="w-auto"
          triggerClassName="h-8 ps-2.5 pe-7 text-xs"
          options={[
            { value: 'all', label: 'Any event' },
            { value: 'birth', label: 'Birth' },
            { value: 'marriage', label: 'Marriage' },
            { value: 'death', label: 'Death' },
            { value: 'residence', label: 'Residence' },
          ]}
        />
      </MenuRow>
      <MenuRow label="Interval">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="number" min={1} max={60} value={interval} aria-label="Interval in seconds"
            onChange={(e) => setIntervalSec(Math.max(1, +e.target.value || 5))}
            className="bg-background border border-border rounded-md h-8 w-14 px-2 text-xs" />
          sec
        </span>
      </MenuRow>
      <MenuRow label="Fit">
        <Select
          value={fit}
          onChange={setFit}
          ariaLabel="Image fit"
          className="w-auto"
          triggerClassName="h-8 ps-2.5 pe-7 text-xs"
          options={[
            { value: 'contain', label: 'Fit' },
            { value: 'cover', label: 'Fill' },
            { value: 'actual', label: 'Actual' },
          ]}
        />
      </MenuRow>
      <MenuRow label="Backdrop">
        <Select
          value={background}
          onChange={setBackground}
          ariaLabel="Backdrop"
          className="w-auto"
          triggerClassName="h-8 ps-2.5 pe-7 text-xs"
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'soft', label: 'Soft' },
          ]}
        />
      </MenuRow>
      <label className="flex items-center gap-1.5 px-2 py-1.5 text-xs md:px-0 md:py-0"><input type="checkbox" checked={showCaption} onChange={(e) => setShowCaption(e.target.checked)} /> Captions</label>
      <label className="flex items-center gap-1.5 px-2 py-1.5 text-xs md:px-0 md:py-0"><input type="checkbox" checked={showMetadata} onChange={(e) => setShowMetadata(e.target.checked)} /> Details</label>
      <label className="flex items-center gap-1.5 px-2 py-1.5 text-xs md:px-0 md:py-0"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop</label>
      <label className="flex items-center gap-1.5 px-2 py-1.5 text-xs md:px-0 md:py-0"><input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} /> Shuffle</label>
    </>
  );

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2 md:px-5 md:py-3 flex-wrap">
        <PageTitle className="text-base font-semibold">Slideshow</PageTitle>
        <span className="hidden text-xs text-muted-foreground md:inline">{index + 1} / {media.length}</span>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {/* Playback stays on the bar; everything that configures the show
              moves into the sheet on a phone, where the media is the point. */}
          {!isMobile && settingsControls}
          <button onClick={toggleFullscreen} className="bg-secondary border border-border rounded-md h-8 px-3 text-xs">{fullscreen ? 'Exit full' : 'Fullscreen'}</button>
          <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}
            className="bg-secondary border border-border rounded-md h-8 px-3 text-xs">{playing ? '❚❚' : '▶'}</button>
          {isMobile && (
            <ToolbarOverflow label="Slideshow settings">
              <div className="flex flex-col gap-1">{settingsControls}</div>
            </ToolbarOverflow>
          )}
        </div>
      </header>
      <div className={`flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden ${backdropClass}`}>
        {src && current?.recordType === 'MediaAudio' ? (
          <audio controls autoPlay={playing} src={src} className="w-full max-w-2xl" />
        ) : src && current?.recordType === 'MediaVideo' ? (
          <video controls autoPlay={playing} src={src} className="max-w-full max-h-full rounded-md shadow-lg" />
        ) : src && current?.recordType === 'MediaPDF' ? (
          <iframe title={caption} src={src} className="w-full h-full max-w-5xl rounded-md border border-border bg-white" />
        ) : src ? (
          <img src={src} alt={caption}
            className={`${fitClass} rounded-md shadow-lg`} />
        ) : (
          <div className="text-center text-muted-foreground border border-dashed border-border rounded-md p-12">
            <div className="text-4xl mb-3">🖼</div>
            <div className="text-sm">{caption}</div>
            <div className="text-xs mt-2">No embedded image; only metadata is in this record.</div>
          </div>
        )}
        {showCaption ? (
          <div className="absolute bottom-4 start-0 end-0 text-center text-sm bg-card/80 backdrop-blur px-4 py-2 mx-auto max-w-md rounded-md">
            {caption}
            {showMetadata ? <div className="mt-1 text-2xs text-muted-foreground">{currentType} · {current?.recordName}</div> : null}
          </div>
        ) : null}
        <button onClick={() => setIndex((i) => (i - 1 + order.length) % order.length)}
          className="absolute start-4 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur border border-border rounded-full w-10 h-10">{isRtl ? '›' : '‹'}</button>
        <button onClick={() => setIndex((i) => (i + 1) % order.length)}
          className="absolute end-4 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur border border-border rounded-full w-10 h-10">{isRtl ? '‹' : '›'}</button>
      </div>
    </div>
  );
}
