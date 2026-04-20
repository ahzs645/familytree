/**
 * Property inspector for the currently selected chart overlay(s).
 *
 * Mac reference: the chart pane's right-hand Object Inspector.
 * Supports single selection (selectedOverlayId) and multi-selection
 * (selectedOverlayIds) with native-style messaging for:
 *   - no editable properties (fallback)
 *   - mixed-type selection ("multiple objects of different kinds")
 *   - uniform multi-selection (shared editable fields only)
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
const notice = {
  padding: 12,
  fontSize: 12,
  color: 'hsl(var(--muted-foreground))',
  background: 'hsl(var(--muted) / 0.2)',
  border: '1px dashed hsl(var(--border))',
  borderRadius: 6,
  margin: 8,
};

function NumberField({ value, onChange, label: labelText, min, step = 1 }) {
  return (
    <label style={row}>
      <div style={label}>{labelText}</div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
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

function SelectField({ value, onChange, label: labelText, options }) {
  return (
    <label style={row}>
      <div style={label}>{labelText}</div>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} style={input}>
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}

function multiValue(items, key) {
  const first = items[0]?.[key];
  return items.every((item) => item[key] === first) ? first : null;
}

function TextFields({ subject, patch, includeGeometry = true }) {
  return (
    <>
      {subject.text !== undefined && <TextField label="Text" value={subject.text} onChange={(value) => patch({ text: value })} />}
      {includeGeometry && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <NumberField label="X" value={subject.x} onChange={(value) => patch({ x: value })} />
          <NumberField label="Y" value={subject.y} onChange={(value) => patch({ y: value })} />
        </div>
      )}
      <NumberField label="Font size" value={subject.fontSize} min={6} onChange={(value) => patch({ fontSize: Math.max(6, value) })} />
      <SelectField
        label="Weight"
        value={subject.fontWeight || 'normal'}
        onChange={(value) => patch({ fontWeight: value })}
        options={[{ value: 'normal', label: 'Normal' }, { value: 'bold', label: 'Bold' }]}
      />
      <ColorField label="Color" value={subject.color} onChange={(value) => patch({ color: value })} />
      <NumberField label="Opacity (0–1)" value={subject.opacity ?? 1} step={0.1} min={0} onChange={(value) => patch({ opacity: Math.min(1, Math.max(0, value)) })} />
    </>
  );
}

function LineFields({ subject, patch, includeGeometry = true }) {
  return (
    <>
      {includeGeometry && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <NumberField label="X1" value={subject.x1} onChange={(value) => patch({ x1: value })} />
          <NumberField label="Y1" value={subject.y1} onChange={(value) => patch({ y1: value })} />
          <NumberField label="X2" value={subject.x2} onChange={(value) => patch({ x2: value })} />
          <NumberField label="Y2" value={subject.y2} onChange={(value) => patch({ y2: value })} />
        </div>
      )}
      <NumberField label="Stroke width" value={subject.strokeWidth} min={0.5} step={0.5} onChange={(value) => patch({ strokeWidth: Math.max(0.5, value) })} />
      <SelectField
        label="Stroke style"
        value={subject.strokeDash || 'solid'}
        onChange={(value) => patch({ strokeDash: value })}
        options={[
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
          { value: 'dotted', label: 'Dotted' },
        ]}
      />
      <ColorField label="Color" value={subject.color} onChange={(value) => patch({ color: value })} />
      <NumberField label="Opacity (0–1)" value={subject.opacity ?? 1} step={0.1} min={0} onChange={(value) => patch({ opacity: Math.min(1, Math.max(0, value)) })} />
    </>
  );
}

function ImageFields({ subject, patch, includeGeometry = true }) {
  return (
    <>
      {subject.href !== undefined && <TextField label="Image URL" value={subject.href} onChange={(value) => patch({ href: value })} placeholder="https://… or data:image/…" />}
      {includeGeometry && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <NumberField label="X" value={subject.x} onChange={(value) => patch({ x: value })} />
          <NumberField label="Y" value={subject.y} onChange={(value) => patch({ y: value })} />
          <NumberField label="Width" value={subject.width} min={4} onChange={(value) => patch({ width: Math.max(4, value) })} />
          <NumberField label="Height" value={subject.height} min={4} onChange={(value) => patch({ height: Math.max(4, value) })} />
        </div>
      )}
      <NumberField label="Opacity (0–1)" value={subject.opacity ?? 1} step={0.1} min={0} onChange={(value) => patch({ opacity: Math.min(1, Math.max(0, value)) })} />
    </>
  );
}

export function ChartObjectInspector({ overlays = [], selectedOverlayId, selectedOverlayIds, onUpdateOverlay }) {
  const ids = Array.isArray(selectedOverlayIds) && selectedOverlayIds.length
    ? selectedOverlayIds
    : (selectedOverlayId ? [selectedOverlayId] : []);
  const selection = overlays.filter((overlay) => ids.includes(overlay?.id));

  if (!selection.length) {
    return (
      <div style={{ padding: 12, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
        Please select persons or connections to edit their properties.
      </div>
    );
  }

  const types = new Set(selection.map((item) => item.type));
  if (types.size > 1) {
    return (
      <div style={notice}>
        You have selected multiple objects of different kinds. Select objects of the same type to edit shared properties.
      </div>
    );
  }

  const type = [...types][0];
  const isMulti = selection.length > 1;
  const subject = isMulti
    ? {
        type,
        text: multiValue(selection, 'text'),
        fontSize: multiValue(selection, 'fontSize'),
        fontWeight: multiValue(selection, 'fontWeight'),
        color: multiValue(selection, 'color'),
        opacity: multiValue(selection, 'opacity'),
        strokeWidth: multiValue(selection, 'strokeWidth'),
        strokeDash: multiValue(selection, 'strokeDash'),
        href: multiValue(selection, 'href'),
      }
    : selection[0];

  const patch = (changes) => {
    if (!onUpdateOverlay) return;
    selection.forEach((item) => onUpdateOverlay(item.id, { ...item, ...changes }));
  };

  if (!['text', 'line', 'image'].includes(type)) {
    return (
      <div style={notice}>
        The selected object has no editable properties.
      </div>
    );
  }

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 8, letterSpacing: 0.4 }}>
        OBJECT INSPECTOR — {(type || 'UNKNOWN').toUpperCase()}
        {isMulti ? ` (${selection.length} selected)` : ''}
      </div>
      {type === 'text' && <TextFields subject={subject} patch={patch} includeGeometry={!isMulti} />}
      {type === 'line' && <LineFields subject={subject} patch={patch} includeGeometry={!isMulti} />}
      {type === 'image' && <ImageFields subject={subject} patch={patch} includeGeometry={!isMulti} />}
    </div>
  );
}

export default ChartObjectInspector;
