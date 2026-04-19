/**
 * Slideshow — auto-advancing display of media records.
 * Falls back gracefully when records have no embedded image data.
 */
import React, { useEffect, useRef, useState } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';

function imageSrcFromMedia(rec) {
  const f = rec.fields || {};
  return (
    f.fileURL?.value ||
    f.url?.value ||
    f.dataURL?.value ||
    f.thumbnailURL?.value ||
    null
  );
}

export default function Slideshow() {
  const [media, setMedia] = useState([]);
  const [index, setIndex] = useState(0);
  const [interval, setIntervalSec] = useState(5);
  const [playing, setPlaying] = useState(true);
  const [filter, setFilter] = useState('all');
  const tick = useRef(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const db = getLocalDatabase();
      const types = filter === 'all' ? ['MediaPicture', 'MediaURL', 'MediaPDF'] : [filter];
      const all = [];
      for (const t of types) {
        const { records } = await db.query(t, { limit: 100000 });
        all.push(...records);
      }
      if (!cancel) {
        setMedia(all);
        setIndex(0);
      }
    })();
    return () => { cancel = true; };
  }, [filter]);

  useEffect(() => {
    clearInterval(tick.current);
    if (playing && media.length > 1) {
      tick.current = setInterval(() => setIndex((i) => (i + 1) % media.length), interval * 1000);
    }
    return () => clearInterval(tick.current);
  }, [playing, interval, media.length]);

  if (media.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No media records to show. Add some via the Media page.
      </div>
    );
  }

  const current = media[index];
  const src = imageSrcFromMedia(current);
  const caption = current.fields?.caption?.value || current.fields?.filename?.value || current.recordName;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Slideshow</h1>
        <span className="text-xs text-muted-foreground">{index + 1} / {media.length}</span>
        <div className="ms-auto flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="bg-secondary border border-border rounded-md px-2 py-1 text-xs">
            <option value="all">All media</option>
            <option value="MediaPicture">Pictures only</option>
            <option value="MediaURL">URLs only</option>
          </select>
          <label className="text-xs text-muted-foreground">Interval</label>
          <input type="number" min={1} max={60} value={interval}
            onChange={(e) => setIntervalSec(Math.max(1, +e.target.value || 5))}
            className="bg-background border border-border rounded-md w-14 px-2 py-1 text-xs" />
          <span className="text-xs text-muted-foreground">sec</span>
          <button onClick={() => setPlaying((p) => !p)}
            className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">{playing ? '❚❚' : '▶'}</button>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center bg-background p-6 relative">
        {src ? (
          <img src={src} alt={caption}
            className="max-w-full max-h-full object-contain rounded-md shadow-lg" />
        ) : (
          <div className="text-center text-muted-foreground border border-dashed border-border rounded-md p-12">
            <div className="text-4xl mb-3">🖼</div>
            <div className="text-sm">{caption}</div>
            <div className="text-xs mt-2">No embedded image; only metadata is in this record.</div>
          </div>
        )}
        <div className="absolute bottom-4 start-0 end-0 text-center text-sm bg-card/80 backdrop-blur px-4 py-2 mx-auto max-w-md rounded-md">
          {caption}
        </div>
        <button onClick={() => setIndex((i) => (i - 1 + media.length) % media.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur border border-border rounded-full w-10 h-10">‹</button>
        <button onClick={() => setIndex((i) => (i + 1) % media.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-card/80 backdrop-blur border border-border rounded-full w-10 h-10">›</button>
      </main>
    </div>
  );
}
