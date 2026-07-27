/**
 * Sidebar of options for the configurable Virtual Tree chart: renderer
 * (2D SVG vs 3D Three.js), the 3D symbol/color/depth-of-field knobs, and the
 * shared source/orientation/spacing layout inputs.
 *
 * Prop names match the useVirtualTreeOptions() result exactly, so ChartStage
 * renders it as `<VirtualTreeOptionsPanel {...virtualOptions} />`.
 */
import React from 'react';
import { Select } from '../../ui/Select.jsx';
import { SYMBOL_MODES, COLOR_MODES } from '../VirtualTree3D.jsx';
import { COMPACT_SELECT_TRIGGER } from './controlStyles.js';

export function VirtualTreeOptionsPanel({
  virtualViewMode, setVirtualViewMode,
  virtualSymbolMode, setVirtualSymbolMode,
  virtualColorMode, setVirtualColorMode,
  virtualShowGenerationBands, setVirtualShowGenerationBands,
  virtualDof, setVirtualDof,
  virtualSource, setVirtualSource,
  virtualOrientation, setVirtualOrientation,
  virtualHSpacing, setVirtualHSpacing,
  virtualVSpacing, setVirtualVSpacing,
}) {
  return (
    <aside className="w-[220px] border-e border-border bg-card p-4 text-sm text-card-foreground">
      <div className="mb-2 text-xs tracking-wide text-muted-foreground">VIRTUAL TREE OPTIONS</div>
      <label className="mb-2.5 block">
        <div className="mb-1 text-xs text-muted-foreground">Renderer</div>
        <Select
          value={virtualViewMode}
          onChange={setVirtualViewMode}
          options={[
            { value: '2d', label: '2D (SVG)' },
            { value: '3d', label: '3D (Three.js)' },
          ]}
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
      </label>
      {virtualViewMode === '3d' && (
        <>
          <label className="mb-2.5 block">
            <div className="mb-1 text-xs text-muted-foreground">Symbol mode</div>
            <Select
              value={virtualSymbolMode}
              onChange={setVirtualSymbolMode}
              options={SYMBOL_MODES.map((mode) => ({ value: mode, label: mode }))}
              triggerClassName={COMPACT_SELECT_TRIGGER}
            />
          </label>
          <label className="mb-2.5 block">
            <div className="mb-1 text-xs text-muted-foreground">Color mode</div>
            <Select
              value={virtualColorMode}
              onChange={setVirtualColorMode}
              options={COLOR_MODES.map((mode) => ({ value: mode, label: mode }))}
              triggerClassName={COMPACT_SELECT_TRIGGER}
            />
          </label>
          <label className="mb-2 flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={virtualShowGenerationBands}
              onChange={(e) => setVirtualShowGenerationBands(e.target.checked)}
            />
            Generation bands
          </label>
          <label className="mb-2 flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={virtualDof.enabled}
              onChange={(e) => setVirtualDof((d) => ({ ...d, enabled: e.target.checked }))}
            />
            Depth of field
          </label>
          {virtualDof.enabled && (
            <>
              <label className="mb-2 block">
                <div className="mb-1 text-xs text-muted-foreground">Focus ({Math.round(virtualDof.focus)})</div>
                <input
                  type="range"
                  min={100}
                  max={2000}
                  step={10}
                  value={virtualDof.focus}
                  onChange={(e) => setVirtualDof((d) => ({ ...d, focus: +e.target.value }))}
                  className="w-full"
                />
              </label>
              <label className="mb-2 block">
                <div className="mb-1 text-xs text-muted-foreground">Aperture ({virtualDof.aperture.toFixed(5)})</div>
                <input
                  type="range"
                  min={0}
                  max={0.001}
                  step={0.00005}
                  value={virtualDof.aperture}
                  onChange={(e) => setVirtualDof((d) => ({ ...d, aperture: +e.target.value }))}
                  className="w-full"
                />
              </label>
              <label className="mb-2.5 block">
                <div className="mb-1 text-xs text-muted-foreground">Max blur ({virtualDof.maxblur.toFixed(3)})</div>
                <input
                  type="range"
                  min={0}
                  max={0.05}
                  step={0.001}
                  value={virtualDof.maxblur}
                  onChange={(e) => setVirtualDof((d) => ({ ...d, maxblur: +e.target.value }))}
                  className="w-full"
                />
              </label>
            </>
          )}
        </>
      )}
      <label className="mb-2.5 block">
        <div className="mb-1 text-xs text-muted-foreground">Source</div>
        <Select
          value={virtualSource}
          onChange={setVirtualSource}
          options={[
            { value: 'descendant', label: 'Descendants' },
            { value: 'ancestor', label: 'Ancestors' },
            { value: 'hourglass', label: 'Hourglass' },
          ]}
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
      </label>
      <label className="mb-2.5 block">
        <div className="mb-1 text-xs text-muted-foreground">Orientation</div>
        <Select
          value={virtualOrientation}
          onChange={setVirtualOrientation}
          options={[
            { value: 'vertical', label: 'Vertical' },
            { value: 'horizontal', label: 'Horizontal' },
          ]}
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
      </label>
      <label className="mb-2.5 block">
        <div className="mb-1 text-xs text-muted-foreground">Sibling spacing ({virtualHSpacing}px)</div>
        <input type="range" min={8} max={80} value={virtualHSpacing} onChange={(e) => setVirtualHSpacing(+e.target.value)} className="w-full" />
      </label>
      <label className="mb-2.5 block">
        <div className="mb-1 text-xs text-muted-foreground">Generation spacing ({virtualVSpacing}px)</div>
        <input type="range" min={50} max={200} value={virtualVSpacing} onChange={(e) => setVirtualVSpacing(+e.target.value)} className="w-full" />
      </label>
    </aside>
  );
}
