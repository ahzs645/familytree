import React from 'react';
import { normalizePageStyle } from '../../lib/presentationSettings.js';

export function PresentationSettingsControls({ value, onChange, label = 'Page' }) {
  const pageStyle = normalizePageStyle(value);
  const update = (patch) => onChange?.(normalizePageStyle({ ...pageStyle, ...patch }));

  return (
    <Field label={label}>
      <div style={row}>
        <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={pageStyle.paginate} onChange={(event) => update({ paginate: event.target.checked })} /> Breaks
        </label>
        <select value={pageStyle.pageSize} onChange={(event) => update({ pageSize: event.target.value })} style={input}>
          <option value="letter">Letter</option>
          <option value="a4">A4</option>
          <option value="legal">Legal</option>
        </select>
        <select value={pageStyle.orientation} onChange={(event) => update({ orientation: event.target.value })} style={input}>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
        <select value={pageStyle.background} onChange={(event) => update({ background: event.target.value })} style={input}>
          <option value="none">White</option>
          <option value="soft">Soft</option>
          <option value="sepia">Sepia</option>
        </select>
        <input
          type="number"
          min={24}
          max={96}
          value={pageStyle.margin}
          onChange={(event) => update({ margin: event.target.value })}
          style={{ ...input, width: 64 }}
          title="Margin"
        />
      </div>
    </Field>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginInlineEnd: 12 }}>
      <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, marginBottom: 3 }}>{label}</span>
      {children}
    </div>
  );
}

const row = { display: 'flex', gap: 4 };
const input = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 10px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none', cursor: 'pointer' };

export default PresentationSettingsControls;
