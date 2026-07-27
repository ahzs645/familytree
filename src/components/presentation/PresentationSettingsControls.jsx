import React from 'react';
import { cn } from '../../lib/utils.js';
import { normalizePageStyle } from '../../lib/presentationSettings.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

/**
 * Shared toolbar control chrome. Native <select> elements are kept (instead of
 * ui/Select) because these live in width-sensitive flex-wrap toolbars and rely
 * on the browser auto-sizing to translated option labels.
 */
const controlClass = 'cursor-pointer rounded-md border border-border bg-secondary text-secondary-foreground px-2.5 py-2 text-sm outline-none';

export function PresentationSettingsControls({ value, onChange, label }) {
  const { t } = useTranslation();
  const pageStyle = normalizePageStyle(value);
  const update = (patch) => onChange?.(normalizePageStyle({ ...pageStyle, ...patch }));

  // Each control carries its own aria-label: the group caption names the row,
  // not the individual selects, so without these they reach assistive tech as
  // four unnamed combo boxes.
  return (
    <Field label={label ?? t('presentation.page')}>
      <div className="flex flex-wrap gap-1.5">
        <label className={cn(controlClass, 'flex items-center gap-1.5')}>
          <input
            type="checkbox"
            checked={pageStyle.paginate}
            onChange={(event) => update({ paginate: event.target.checked })}
          /> {t('presentation.breaks')}
        </label>
        <select
          value={pageStyle.pageSize}
          onChange={(event) => update({ pageSize: event.target.value })}
          className={controlClass}
          aria-label={t('presentation.pageSize')}
        >
          <option value="letter">{t('presentation.letter')}</option>
          <option value="a4">A4</option>
          <option value="legal">{t('presentation.legal')}</option>
        </select>
        <select
          value={pageStyle.orientation}
          onChange={(event) => update({ orientation: event.target.value })}
          className={controlClass}
          aria-label={t('presentation.orientation')}
        >
          <option value="portrait">{t('presentation.portrait')}</option>
          <option value="landscape">{t('presentation.landscape')}</option>
        </select>
        <select
          value={pageStyle.background}
          onChange={(event) => update({ background: event.target.value })}
          className={controlClass}
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
          className={cn(controlClass, 'w-16 cursor-auto')}
          title={t('presentation.margin')}
          aria-label={t('presentation.margin')}
        />
      </div>
    </Field>
  );
}

function Field({ label, children }) {
  return (
    <div className="me-3 flex flex-col">
      <span className="mb-1 text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export default PresentationSettingsControls;
