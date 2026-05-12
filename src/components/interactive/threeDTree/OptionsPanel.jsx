import React, { useEffect, useState } from 'react';
import {
  APPEARANCE_MODES,
  BOTTOM_PLANE_MODES,
  CAMERA_MODES,
  CHILD_SORTING_MODES,
  CONNECTION_COLOR_MODES,
  GENERATION_BAND_COLOR_MODES,
  GENERATION_BAND_STYLES,
  LIGHTING_MODES,
  MAX_ANCESTOR_GENERATIONS,
  MAX_DESCENDANT_GENERATIONS,
  MIN_GENERATIONS,
  OPTIONS_PANEL_STATE_STORAGE_KEY,
  OPTION_GROUPS,
  PERSON_COLORING_MODES,
  PERSON_IMAGE_STYLES,
  PERSON_STYLES,
} from './constants.js';
import { panelStyles } from './optionsPanelStyles.js';

const DEFAULT_OPEN_GROUPS = {
  general: true,
  generations: true,
  personStyle: false,
  personInformation: false,
  connections: false,
  generationBands: false,
  camera: false,
  lighting: false,
  ground: false,
  animations: false,
  selection: false,
};

function readOpenGroupState() {
  if (typeof window === 'undefined') return DEFAULT_OPEN_GROUPS;
  try {
    const raw = window.localStorage.getItem(OPTIONS_PANEL_STATE_STORAGE_KEY);
    if (!raw) return DEFAULT_OPEN_GROUPS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_OPEN_GROUPS;
    return { ...DEFAULT_OPEN_GROUPS, ...parsed };
  } catch {
    return DEFAULT_OPEN_GROUPS;
  }
}

export function OptionsPanel({ viewerOptions, onChange, onClose }) {
  const [open, setOpen] = useState(readOpenGroupState);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(OPTIONS_PANEL_STATE_STORAGE_KEY, JSON.stringify(open));
    } catch {
      // Optional persistence.
    }
  }, [open]);

  const toggle = (id) => setOpen((current) => ({ ...current, [id]: !current[id] }));
  const set = (patch) => onChange((current) => ({ ...current, ...patch }));

  return (
    <div style={panelStyles.panel} role="dialog" aria-label="Interactive Tree options">
      <div style={panelStyles.header}>
        <span style={panelStyles.title}>Options</span>
        <button type="button" style={panelStyles.closeButton} onClick={onClose} aria-label="Close options">×</button>
      </div>
      <div style={panelStyles.scroll}>
        {OPTION_GROUPS.map((group) => (
          <section key={group.id} style={panelStyles.section}>
            <button
              type="button"
              style={panelStyles.sectionHeader}
              onClick={() => toggle(group.id)}
              aria-expanded={open[group.id]}
            >
              <span style={panelStyles.disclosure}>{open[group.id] ? '▾' : '▸'}</span>
              {group.label}
            </button>
            {open[group.id] && (
              <div style={panelStyles.sectionBody}>{renderGroup(group.id, viewerOptions, set)}</div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function renderGroup(groupId, options, set) {
  switch (groupId) {
    case 'general':
      return (
        <>
          <SelectRow label="Canvas" value={options.appearanceMode} options={APPEARANCE_MODES} onChange={(v) => set({ appearanceMode: v })} />
          <SelectRow label="Person Style" value={options.personStyle} options={PERSON_STYLES} onChange={(v) => set({ personStyle: v })} />
          <SelectRow label="Person Pictures" value={options.personImageStyle} options={PERSON_IMAGE_STYLES} onChange={(v) => set({ personImageStyle: v })} />
        </>
      );
    case 'generations':
      return (
        <>
          <SliderRow
            label="Ancestor Generations"
            min={MIN_GENERATIONS}
            max={MAX_ANCESTOR_GENERATIONS}
            step={1}
            value={options.ancestorGenerations}
            onChange={(v) => set({ ancestorGenerations: v })}
            valueFormatter={(v) => `${v}`}
          />
          <SliderRow
            label="Descendant Generations"
            min={MIN_GENERATIONS}
            max={MAX_DESCENDANT_GENERATIONS}
            step={1}
            value={options.descendantGenerations}
            onChange={(v) => set({ descendantGenerations: v })}
            valueFormatter={(v) => `${v}`}
          />
        </>
      );
    case 'personStyle':
      return (
        <>
          <SelectRow label="Person Coloring" value={options.personColoringMode} options={PERSON_COLORING_MODES} onChange={(v) => set({ personColoringMode: v })} />
          <SelectRow label="Child Sorting" value={options.childSortingMode} options={CHILD_SORTING_MODES} onChange={(v) => set({ childSortingMode: v })} />
          <ToggleRow label="Highlight Living Persons" value={options.highlightLivingPersons} onChange={(v) => set({ highlightLivingPersons: v })} />
        </>
      );
    case 'personInformation':
      return (
        <>
          <ToggleRow label="Display Birth Date" value={options.displayBirthDate} onChange={(v) => set({ displayBirthDate: v })} />
          <ToggleRow label="Display Death Date" value={options.displayDeathDate} onChange={(v) => set({ displayDeathDate: v })} />
          <ToggleRow label="Display Kinships" value={options.displayKinships} onChange={(v) => set({ displayKinships: v })} />
          <ToggleRow label="Display Labels" value={options.displayLabels} onChange={(v) => set({ displayLabels: v })} />
          <ToggleRow label="Display Person Groups" value={options.displayPersonGroups} onChange={(v) => set({ displayPersonGroups: v })} />
          <ToggleRow label="Display Notes Icon" value={options.displayNotesIcon} onChange={(v) => set({ displayNotesIcon: v })} />
          <ToggleRow label="Display Media Icon" value={options.displayMediaIcon} onChange={(v) => set({ displayMediaIcon: v })} />
        </>
      );
    case 'connections':
      return (
        <>
          <SelectRow label="Connection Color" value={options.connectionColorMode} options={CONNECTION_COLOR_MODES} onChange={(v) => set({ connectionColorMode: v })} />
          {options.connectionColorMode === 'customColor' && (
            <ColorRow label="Custom Color" value={options.connectionCustomColor || '#7b5af6'} onChange={(v) => set({ connectionCustomColor: v })} />
          )}
          <SliderRow
            label="Connection Width"
            min={0.4}
            max={2.5}
            step={0.05}
            value={options.connectionThickness}
            onChange={(v) => set({ connectionThickness: v })}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />
        </>
      );
    case 'generationBands':
      return (
        <>
          <SelectRow label="Style" value={options.generationBandStyle} options={GENERATION_BAND_STYLES} onChange={(v) => set({ generationBandStyle: v })} />
          <SelectRow label="Colors" value={options.generationBandColorMode} options={GENERATION_BAND_COLOR_MODES} onChange={(v) => set({ generationBandColorMode: v })} />
          <SliderRow
            label="Opacity"
            min={0}
            max={1}
            step={0.02}
            value={options.generationBandOpacity}
            onChange={(v) => set({ generationBandOpacity: v })}
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
          />
          <ToggleRow label="Always use full width" value={options.generationBandsFullWidth} onChange={(v) => set({ generationBandsFullWidth: v })} />
        </>
      );
    case 'camera':
      return <SelectRow label="Camera Perspective" value={options.cameraMode} options={CAMERA_MODES} onChange={(v) => set({ cameraMode: v })} />;
    case 'lighting':
      return (
        <>
          <SelectRow label="Lighting Mode" value={options.lightingMode} options={LIGHTING_MODES} onChange={(v) => set({ lightingMode: v })} />
          <SliderRow
            label="Illumination Strength"
            min={0.2}
            max={2.0}
            step={0.05}
            value={options.illuminationStrength}
            onChange={(v) => set({ illuminationStrength: v })}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />
          <SliderRow
            label="Shadow Strength"
            min={0}
            max={2.0}
            step={0.05}
            value={options.shadowStrength}
            onChange={(v) => set({ shadowStrength: v })}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />
        </>
      );
    case 'ground':
      return <SelectRow label="Ground Pattern" value={options.bottomPlaneMode} options={BOTTOM_PLANE_MODES} onChange={(v) => set({ bottomPlaneMode: v })} />;
    case 'animations':
      return (
        <SliderRow
          label="Animation Duration"
          min={0}
          max={2.0}
          step={0.05}
          value={options.animationDuration}
          onChange={(v) => set({ animationDuration: v })}
          valueFormatter={(v) => `${v.toFixed(2)}×`}
        />
      );
    case 'selection':
      return (
        <>
          <ToggleRow label="Lift persons on mouseover" value={options.liftPersonsOnMouseOver} onChange={(v) => set({ liftPersonsOnMouseOver: v })} />
          <ToggleRow label="Enlarge name on mouseover" value={options.enlargeNameBadgesOnMouseOver} onChange={(v) => set({ enlargeNameBadgesOnMouseOver: v })} />
          <ToggleRow label="Auto-select inserted persons" value={options.autoSelectInsertedObjects} onChange={(v) => set({ autoSelectInsertedObjects: v })} />
          <ToggleRow label="Scroll to selected if near border" value={options.scrollSelectedToVisible} onChange={(v) => set({ scrollSelectedToVisible: v })} />
        </>
      );
    default:
      return null;
  }
}

function SelectRow({ label, value, options, onChange }) {
  return (
    <label style={panelStyles.row}>
      <span style={panelStyles.rowLabel}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={panelStyles.select}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SliderRow({ label, min, max, step, value, onChange, valueFormatter }) {
  return (
    <div style={panelStyles.row}>
      <div style={panelStyles.sliderHeader}>
        <span style={panelStyles.rowLabel}>{label}</span>
        <span style={panelStyles.sliderValue}>{valueFormatter ? valueFormatter(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={panelStyles.slider}
      />
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div style={panelStyles.row}>
      <span style={panelStyles.rowLabel}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ width: 36, height: 28, border: '1px solid hsl(var(--border))', borderRadius: 6, padding: 0, background: 'transparent', cursor: 'pointer' }}
        />
        <code style={{ font: '600 11px ui-monospace, SFMono-Regular, Menlo, monospace', color: 'hsl(var(--muted-foreground))' }}>{value}</code>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <label style={panelStyles.toggleRow}>
      <input type="checkbox" checked={!!value} onChange={(event) => onChange(event.target.checked)} style={panelStyles.checkbox} />
      <span style={panelStyles.rowLabel}>{label}</span>
    </label>
  );
}
