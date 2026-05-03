import React from 'react';
import { VISUAL_OPTION_SECTIONS, updateVisualViewOption } from '../../lib/visualViewOptions.js';

export function VisualOptionsDrawer({
  kind = 'mapStory',
  open,
  options,
  onChange,
  onClose,
  sections = VISUAL_OPTION_SECTIONS,
  title = 'Options',
}) {
  if (!open) return null;

  const setOption = (key, value) => {
    onChange(updateVisualViewOption(kind, options, key, value));
  };

  return (
    <aside className="absolute inset-x-2 bottom-2 z-20 max-h-[70%] overflow-auto rounded-md border border-border bg-card/95 p-4 text-sm shadow-xl backdrop-blur md:inset-x-auto md:end-3 md:bottom-auto md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[min(340px,calc(100%-1.5rem))]">
      <div className="mb-3 flex items-center gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">Display, heat map, and timeline playback controls.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ms-auto rounded-md border border-border bg-secondary px-2 py-1 text-xs hover:bg-accent"
        >
          Close
        </button>
      </div>
      <div className="space-y-4">
        {sections.map((section) => (
          <section key={section.id}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.label}</div>
            <div className="space-y-2">
              {section.controls.map((control) => (
                <VisualOptionControl
                  key={control.key}
                  control={control}
                  value={options[control.key]}
                  onChange={(value) => setOption(control.key, value)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function VisualOptionControl({ control, value, onChange }) {
  if (control.type === 'checkbox') {
    return (
      <label className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{control.label}</span>
      </label>
    );
  }

  if (control.type === 'select') {
    return (
      <label className="grid gap-1 text-xs text-muted-foreground">
        <span>{control.label}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 rounded-md border border-border bg-secondary px-2 text-xs text-foreground"
        >
          {control.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  const labelValue = control.format === 'percent'
    ? `${Math.round(Number(value) * 100)}%`
    : `${value}${control.unit || ''}`;

  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span className="flex items-center justify-between gap-2">
        <span>{control.label}</span>
        <span>{labelValue}</span>
      </span>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default VisualOptionsDrawer;
