/**
 * Chart background editor — mirrors MacFamilyTree's `EditChartPane_EditBackgroundButton`.
 *
 * Supports none / solid color / linear gradient / image. Returns a CSS-ready
 * string the chart renderer can drop straight into `background:`.
 */
import React, { useEffect, useMemo, useState } from 'react';

const BG_TYPES = [
  { id: 'none', label: 'None' },
  { id: 'color', label: 'Solid color' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'image', label: 'Image' },
];

export function parseBackgroundSpec(value) {
  if (!value) return { type: 'none' };
  if (typeof value === 'object') return { type: 'none', ...value };
  const trimmed = String(value).trim();
  if (!trimmed) return { type: 'none' };
  if (/^linear-gradient\(/i.test(trimmed)) {
    const match = trimmed.match(/^linear-gradient\(\s*([-\d.]+)deg\s*,\s*([^,]+)\s*,\s*([^)]+)\)/i);
    if (match) {
      return {
        type: 'gradient',
        angle: Number(match[1]) || 180,
        colorStart: match[2].trim(),
        colorEnd: match[3].trim(),
      };
    }
  }
  if (/^url\(/i.test(trimmed)) {
    const match = trimmed.match(/^url\(['"]?([^'"]+)['"]?\)/i);
    if (match) return { type: 'image', image: match[1] };
  }
  return { type: 'color', color: trimmed };
}

export function serializeBackgroundSpec(spec) {
  if (!spec) return '';
  if (spec.type === 'color' && spec.color) return String(spec.color);
  if (spec.type === 'gradient' && spec.colorStart && spec.colorEnd) {
    const angle = Number(spec.angle);
    const safe = Number.isFinite(angle) ? angle : 180;
    return `linear-gradient(${safe}deg, ${spec.colorStart}, ${spec.colorEnd})`;
  }
  if (spec.type === 'image' && spec.image) {
    return `url('${spec.image}') center / cover no-repeat`;
  }
  return '';
}

export function ChartBackgroundSheet({ open, value, onApply, onClose }) {
  const initial = useMemo(() => parseBackgroundSpec(value), [value]);
  const [spec, setSpec] = useState(initial);
  useEffect(() => { if (open) setSpec(initial); }, [open, initial]);
  if (!open) return null;

  const update = (patch) => setSpec((prev) => ({ ...prev, ...patch }));
  const preview = serializeBackgroundSpec(spec);

  const onImageFile = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update({ image: String(reader.result || '') });
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-lg">
        <header className="px-5 py-3 border-b border-border flex items-center gap-3">
          <h2 className="text-base font-semibold">Edit Background</h2>
          <button onClick={onClose} className="ms-auto text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        </header>
        <main className="p-5 space-y-4 text-sm">
          <div className="flex gap-1">
            {BG_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => update({ type: t.id })}
                className={`flex-1 text-xs rounded-md border px-2 py-1.5 ${spec.type === t.id ? 'border-primary bg-accent' : 'border-border bg-secondary'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {spec.type === 'color' && (
            <label className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-20">Color</span>
              <input type="color" value={asHex(spec.color) || '#ffffff'} onChange={(e) => update({ color: e.target.value })} />
              <input
                type="text"
                value={spec.color || ''}
                onChange={(e) => update({ color: e.target.value })}
                placeholder="#rrggbb or any CSS color"
                className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs"
              />
            </label>
          )}

          {spec.type === 'gradient' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20">Start</span>
                <input type="color" value={asHex(spec.colorStart) || '#ffffff'} onChange={(e) => update({ colorStart: e.target.value })} />
                <input type="text" value={spec.colorStart || ''} onChange={(e) => update({ colorStart: e.target.value })} className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs" />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20">End</span>
                <input type="color" value={asHex(spec.colorEnd) || '#cccccc'} onChange={(e) => update({ colorEnd: e.target.value })} />
                <input type="text" value={spec.colorEnd || ''} onChange={(e) => update({ colorEnd: e.target.value })} className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs" />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-20">Angle</span>
                <input type="range" min={0} max={360} value={Number(spec.angle) || 0} onChange={(e) => update({ angle: Number(e.target.value) })} className="flex-1" />
                <span className="text-xs text-muted-foreground w-12 text-end tabular-nums">{Number(spec.angle) || 0}°</span>
              </label>
            </div>
          )}

          {spec.type === 'image' && (
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onImageFile(e.target.files?.[0])}
                className="text-xs"
              />
              <input
                type="text"
                value={spec.image || ''}
                onChange={(e) => update({ image: e.target.value })}
                placeholder="https:// or data: URL"
                className="w-full bg-background border border-border rounded-md px-2 py-1 text-xs"
              />
            </div>
          )}

          <div className="rounded-md border border-border h-24 overflow-hidden" style={{ background: preview || 'transparent' }}>
            {!preview && (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                No background
              </div>
            )}
          </div>
        </main>
        <footer className="px-5 py-3 border-t border-border flex gap-2 justify-end">
          <button onClick={() => onApply('')} className="text-sm border border-border bg-secondary rounded-md px-3 py-1.5">Clear</button>
          <button onClick={() => onApply(serializeBackgroundSpec(spec))} className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5">
            Apply
          </button>
        </footer>
      </div>
    </div>
  );
}

function asHex(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(str)) return str;
  if (/^#[0-9a-fA-F]{3}$/.test(str)) {
    return `#${str[1]}${str[1]}${str[2]}${str[2]}${str[3]}${str[3]}`;
  }
  return null;
}

export default ChartBackgroundSheet;
