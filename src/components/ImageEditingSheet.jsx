import React, { useEffect, useRef, useState } from 'react';

/**
 * ImageEditingSheet — modal canvas-based editor for a single image.
 * Supports rotate (90° steps), flip (horizontal/vertical), brightness,
 * contrast, grayscale, and a simple rectangular crop.
 *
 * Mac reference: ImageEditingSheet.nib in Base.lproj.
 * onApply receives a PNG data URL derived from the edited canvas.
 */
export function ImageEditingSheet({ src, onApply, onCancel, title = 'Edit image' }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [cropEnabled, setCropEnabled] = useState(false);
  const [drag, setDrag] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setCrop({ x: 0, y: 0, w: img.width, h: img.height });
      setReady(true);
    };
    img.onerror = () => setReady(false);
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (!ready) return;
    draw();
  }, [ready, rotation, flipH, flipV, brightness, contrast, grayscale, crop, cropEnabled]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const radians = (rotation * Math.PI) / 180;
    const isSideways = rotation % 180 !== 0;
    const sourceW = cropEnabled ? crop.w : img.width;
    const sourceH = cropEnabled ? crop.h : img.height;
    const outW = isSideways ? sourceH : sourceW;
    const outH = isSideways ? sourceW : sourceH;
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`;
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate(radians);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    if (cropEnabled) {
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, -sourceW / 2, -sourceH / 2, sourceW, sourceH);
    } else {
      ctx.drawImage(img, -sourceW / 2, -sourceH / 2, sourceW, sourceH);
    }
    ctx.restore();
  };

  const apply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onApply(canvas.toDataURL('image/png'));
  };

  const rotate = (delta) => setRotation((r) => (r + delta + 360) % 360);

  const onCanvasPointerDown = (event) => {
    if (!cropEnabled || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    setDrag({ startX: x, startY: y });
  };

  const onCanvasPointerMove = (event) => {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const cx = Math.min(drag.startX, x);
    const cy = Math.min(drag.startY, y);
    const cw = Math.abs(x - drag.startX);
    const ch = Math.abs(y - drag.startY);
    if (cw < 4 || ch < 4) return;
    const img = imgRef.current;
    if (!img) return;
    setCrop({
      x: Math.max(0, Math.min(img.width - cw, cx)),
      y: Math.max(0, Math.min(img.height - ch, cy)),
      w: Math.min(img.width, cw),
      h: Math.min(img.height, ch),
    });
  };

  const onCanvasPointerUp = () => setDrag(null);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
        </header>
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-4 bg-black/30 flex items-center justify-center min-h-[320px]">
            {ready ? (
              <canvas
                ref={canvasRef}
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerLeave={onCanvasPointerUp}
                style={{ maxWidth: '100%', maxHeight: '60vh', cursor: cropEnabled ? 'crosshair' : 'default', background: '#fff' }}
              />
            ) : (
              <div className="text-xs text-muted-foreground">Loading image…</div>
            )}
          </div>
          <div className="w-full md:w-64 p-4 space-y-3 text-xs border-t md:border-t-0 md:border-l border-border">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => rotate(-90)} className="border border-border rounded-md py-1.5 hover:bg-accent">Rotate ⟲</button>
              <button onClick={() => rotate(90)} className="border border-border rounded-md py-1.5 hover:bg-accent">Rotate ⟳</button>
              <button onClick={() => setFlipH((v) => !v)} className={`border border-border rounded-md py-1.5 hover:bg-accent ${flipH ? 'bg-accent' : ''}`}>Flip H</button>
              <button onClick={() => setFlipV((v) => !v)} className={`border border-border rounded-md py-1.5 hover:bg-accent ${flipV ? 'bg-accent' : ''}`}>Flip V</button>
            </div>
            <label className="block">Brightness: {brightness}%
              <input type="range" min={0} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full" />
            </label>
            <label className="block">Contrast: {contrast}%
              <input type="range" min={0} max={200} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full" />
            </label>
            <label className="block">Grayscale: {grayscale}%
              <input type="range" min={0} max={100} value={grayscale} onChange={(e) => setGrayscale(Number(e.target.value))} className="w-full" />
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={cropEnabled} onChange={(e) => setCropEnabled(e.target.checked)} /> Crop mode (drag on image)</label>
            <button
              onClick={() => {
                setRotation(0); setFlipH(false); setFlipV(false);
                setBrightness(100); setContrast(100); setGrayscale(0);
                setCropEnabled(false);
                if (imgRef.current) setCrop({ x: 0, y: 0, w: imgRef.current.width, h: imgRef.current.height });
              }}
              className="w-full border border-border rounded-md py-1.5 hover:bg-accent"
            >
              Reset
            </button>
          </div>
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
          <button type="button" onClick={apply} disabled={!ready} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50">Apply</button>
        </footer>
      </div>
    </div>
  );
}

export default ImageEditingSheet;
