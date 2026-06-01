import React from 'react';

const MAP_MODES = [
  { id: 'map', label: 'Map' },
  { id: 'globe', label: 'Globe' },
];

export function MapModeSwitch({ activeMode, onModeChange }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-secondary p-0.5" aria-label="Map mode">
      {MAP_MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => onModeChange(mode.id)}
          className={`px-2.5 py-1 text-xs rounded ${activeMode === mode.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          aria-pressed={activeMode === mode.id}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
