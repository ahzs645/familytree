/**
 * Slideshow — auto-advancing display of media records.
 * Falls back gracefully when records have no embedded image data.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { getAppPreferences } from '../lib/appPreferences.js';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
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
      const db = getLocalDatabase();
      const all = selectedIds.length
        ? await db.getRecords(selectedIds)
        : (await Promise.all(mediaTypesForFilter(filter).map((t) => db.query(t, { limit: 100000 })))).flatMap(({ records }) => records);
      const filtered = eventFilter === 'all'
        ? all
        : all.filter((m) => String(m.fields?.eventType?.value || m.fields?.conclusionType?.value || '').toLowerCase().includes(eventFilter.toLowerCase()));
      const assetEntries = await Promise.all(filtered.map(async (record) => {
        const ids = record.fields?.assetIds?.value || [];
        const assets = ids.length ? (await Promise.all(ids.map((id) => db.getAsset(id)))).filter(Boolean) : await db.listAssetsForRecord(record.recordName);
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
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card flex-wrap">
        <h1 className="text-base font-semibold">Slideshow</h1>
        <span className="text-xs text-muted-foreground">{index + 1} / {media.length}</span>
        <div className="ms-auto flex items-center gap-2 flex-wrap">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            disabled={selectedIds.length > 0}
            className="bg-secondary border border-border rounded-md px-2 py-1 text-xs disabled:opacity-50">
            <option value="all">All media</option>
            <option value="MediaPicture">Pictures only</option>
            <option value="MediaURL">URLs only</option>
            <option value="MediaPDF">PDFs only</option>
            <option value="MediaAudio">Audio only</option>
            <option value="MediaVideo">Video only</option>
          </select>
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
            className="bg-secondary border border-border rounded-md px-2 py-1 text-xs" aria-label="Event filter">
            <option value="all">Any event</option>
            <option value="birth">Birth</option>
            <option value="marriage">Marriage</option>
            <option value="death">Death</option>
            <option value="residence">Residence</option>
          </select>
          <label className="text-xs text-muted-foreground">Interval</label>
          <input type="number" min={1} max={60} value={interval}
            onChange={(e) => setIntervalSec(Math.max(1, +e.target.value || 5))}
            className="bg-background border border-border rounded-md w-14 px-2 py-1 text-xs" />
          <span className="text-xs text-muted-foreground">sec</span>
          <select value={fit} onChange={(e) => setFit(e.target.value)}
            className="bg-secondary border border-border rounded-md px-2 py-1 text-xs" aria-label="Image fit">
            <option value="contain">Fit</option>
            <option value="cover">Fill</option>
            <option value="actual">Actual</option>
          </select>
          <select value={background} onChange={(e) => setBackground(e.target.value)}
            className="bg-secondary border border-border rounded-md px-2 py-1 text-xs" aria-label="Backdrop">
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="soft">Soft</option>
          </select>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showCaption} onChange={(e) => setShowCaption(e.target.checked)} /> Captions</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showMetadata} onChange={(e) => setShowMetadata(e.target.checked)} /> Details</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={random} onChange={(e) => setRandom(e.target.checked)} /> Shuffle</label>
          <button onClick={toggleFullscreen} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">{fullscreen ? 'Exit full' : 'Fullscreen'}</button>
          <button onClick={() => setPlaying((p) => !p)}
            className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">{playing ? '❚❚' : '▶'}</button>
        </div>
      </header>
      <main className={`flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden ${backdropClass}`}>
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
            {showMetadata ? <div className="mt-1 text-[11px] text-muted-foreground">{currentType} · {current?.recordName}</div> : null}
          </div>
        ) : null}
        <button onClick={() => setIndex((i) => (i - 1 + order.length) % order.length)}
          className="absolute start-4 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur border border-border rounded-full w-10 h-10">{isRtl ? '›' : '‹'}</button>
        <button onClick={() => setIndex((i) => (i + 1) % order.length)}
          className="absolute end-4 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur border border-border rounded-full w-10 h-10">{isRtl ? '‹' : '›'}</button>
      </main>
    </div>
  );
}
