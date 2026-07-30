import React from 'react';

const MAP_MODES = [
  { id: 'map', label: 'Map' },
  { id: 'globe', label: 'Globe' },
  { id: 'statistics', label: 'Statistics' },
];

/**
 * Sits on the 32px compact rung (see ui/Button.jsx) so it aligns with the
 * buttons and selects it shares a toolbar with — it used to derive its height
 * from padding and come out at 24px.
 */
export function MapModeSwitch({ activeMode, onModeChange, modes = MAP_MODES }) {
  return (
    <div className="inline-flex h-8 items-center rounded-md border border-border bg-secondary p-0.5" aria-label="Map mode">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onModeChange(mode.id)}
          className={`flex h-full items-center rounded px-2.5 text-xs ${activeMode === mode.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          aria-pressed={activeMode === mode.id}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
