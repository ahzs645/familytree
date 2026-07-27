import React from 'react';
import { normalizePageStyle } from '../../lib/presentationSettings.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

export function PresentationSettingsControls({ value, onChange, label }) {
  const { t } = useTranslation();
  const pageStyle = normalizePageStyle(value);
  const update = (patch) => onChange?.(normalizePageStyle({ ...pageStyle, ...patch }));

  // Each control carries its own aria-label: the group caption names the row,
  // not the individual selects, so without these they reach assistive tech as
  // four unnamed combo boxes.
  return (
    <Field label={label ?? t('presentation.page')}>
      <div style={row}>
        <label style={{ ...input, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={pageStyle.paginate}
            onChange={(event) => update({ paginate: event.target.checked })}
          /> {t('presentation.breaks')}
        </label>
        <select
          value={pageStyle.pageSize}
          onChange={(event) => update({ pageSize: event.target.value })}
          style={input}
          aria-label={t('presentation.pageSize')}
        >
          <option value="letter">{t('presentation.letter')}</option>
          <option value="a4">A4</option>
          <option value="legal">{t('presentation.legal')}</option>
        </select>
        <select
          value={pageStyle.orientation}
          onChange={(event) => update({ orientation: event.target.value })}
          style={input}
          aria-label={t('presentation.orientation')}
        >
          <option value="portrait">{t('presentation.portrait')}</option>
          <option value="landscape">{t('presentation.landscape')}</option>
        </select>
        <select
          value={pageStyle.background}
          onChange={(event) => update({ background: event.target.value })}
          style={input}
          aria-label={t('presentation.background')}
        >
          <option value="none">{t('presentation.white')}</option>
          <option value="soft">{t('presentation.soft')}</option>
          <option value="sepia">{t('presentation.sepia')}</option>
        </select>
        <input
          type="number"
          min={24}
          max={96}
          value={pageStyle.margin}
          onChange={(event) => update({ margin: event.target.value })}
          style={{ ...input, width: 64 }}
          title={t('presentation.margin')}
          aria-label={t('presentation.margin')}
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

const row = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const input = { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '8px 10px', font: '13px -apple-system, system-ui, sans-serif', outline: 'none', cursor: 'pointer' };

export default PresentationSettingsControls;
