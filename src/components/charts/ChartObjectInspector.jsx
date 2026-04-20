/**
 * Property inspector for the currently selected chart overlay.
 *
 * Mac reference: the chart pane's right-hand Object Inspector lets the user
 * tweak per-object fields (text content, font size, stroke, colors,
 * geometry). This web inspector is a leaner equivalent — it only exposes
 * the fields that the current overlay model supports (text, line, image).
 */
import React from 'react';

const row = { display: 'block', marginBottom: 8 };
const label = { color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 };
const input = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  borderRadius: 4,
  font: '13px -apple-system, system-ui, sans-serif',
};

function NumberField({ value, onChange, label: labelText }) {
  return (
    <label style={row}>
      <div style={label}>{labelText}</div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        style={input}
      />
    </label>
  );
}

function TextField({ value, onChange, label: labelText, type = 'text', placeholder }) {
  return (
    <label style={row}>
      <div style={label}>{labelText}</div>
      <input
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={input}
      />
    </label>
  );
}

function ColorField({ value, onChange, label: labelText }) {
  return (
    <label style={row}>
      <div style={label}>{labelText}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="color"
          value={value || '#000000'}
          onChange={(event) => onChange(event.target.value)}
          style={{ width: 36, height: 28, border: '1px solid hsl(var(--border))', background: 'transparent', padding: 0 }}
        />
        <input
          type="text"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...input, flex: 1 }}
        />
      </div>
    </label>
  );
}

export function ChartObjectInspector({ overlays = [], selectedOverlayId, onUpdateOverlay }) {
  const selected = overlays.find((overlay) => overlay?.id === selectedOverlayId) || null;

  if (!selected) {
    return (
      <div style={{ padding: 12, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
        Select an overlay to edit its properties.
      </div>
    );
  }

  const patch = (changes) => {
    if (!onUpdateOverlay) return;
    onUpdateOverlay(selected.id, { ...selected, ...changes });
  };

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 8, letterSpacing: 0.4 }}>
        OBJECT INSPECTOR — {selected.type?.toUpperCase() || 'UNKNOWN'}
      </div>

      {selected.type === 'text' && (
        <>
          <TextField label="Text" value={selected.text} onChange={(value) => patch({ text: value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <NumberField label="X" value={selected.x} onChange={(value) => patch({ x: value })} />
            <NumberField label="Y" value={selected.y} onChange={(value) => patch({ y: value })} />
          </div>
          <NumberField label="Font size" value={selected.fontSize} onChange={(value) => patch({ fontSize: Math.max(6, value) })} />
          <ColorField label="Color" value={selected.color} onChange={(value) => patch({ color: value })} />
        </>
      )}

      {selected.type === 'line' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <NumberField label="X1" value={selected.x1} onChange={(value) => patch({ x1: value })} />
            <NumberField label="Y1" value={selected.y1} onChange={(value) => patch({ y1: value })} />
            <NumberField label="X2" value={selected.x2} onChange={(value) => patch({ x2: value })} />
            <NumberField label="Y2" value={selected.y2} onChange={(value) => patch({ y2: value })} />
          </div>
          <NumberField label="Stroke width" value={selected.strokeWidth} onChange={(value) => patch({ strokeWidth: Math.max(0.5, value) })} />
          <ColorField label="Color" value={selected.color} onChange={(value) => patch({ color: value })} />
        </>
      )}

      {selected.type === 'image' && (
        <>
          <TextField label="Image URL" value={selected.href} onChange={(value) => patch({ href: value })} placeholder="https://… or data:image/…" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <NumberField label="X" value={selected.x} onChange={(value) => patch({ x: value })} />
            <NumberField label="Y" value={selected.y} onChange={(value) => patch({ y: value })} />
            <NumberField label="Width" value={selected.width} onChange={(value) => patch({ width: Math.max(4, value) })} />
            <NumberField label="Height" value={selected.height} onChange={(value) => patch({ height: Math.max(4, value) })} />
          </div>
        </>
      )}
    </div>
  );
}

export default ChartObjectInspector;
