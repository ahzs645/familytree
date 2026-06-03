import React, { useEffect, useState } from 'react';
import {
  APPEARANCE_MODES,
  BOTTOM_PLANE_MODES,
  CAMERA_MODES,
  CHILD_SORTING_MODES,
  CONNECTION_COLOR_MODES,
  DEFAULT_GENERATION_BAND_CUSTOM_COLOR,
  DEFAULT_GROUND_CUSTOM_COLOR,
  DEFAULT_PERSON_CUSTOM_COLOR,
  GENERATION_BAND_COLOR_MODES,
  GENERATION_BAND_STYLES,
  GENERATION_DIRECTIONS,
  GROUND_COLOR_MODES,
  LIGHTING_MODES,
  MAX_ANCESTOR_GENERATIONS,
  MAX_DESCENDANT_GENERATIONS,
  MAX_MINIFICATION_START,
  MAX_SIBLING_GENERATIONS,
  MIN_GENERATIONS,
  NUMBERING_SYSTEMS,
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
  layout: false,
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
    case 'layout':
      return (
        <>
          <SelectRow label="Generation Direction" value={options.generationDirection} options={GENERATION_DIRECTIONS} onChange={(v) => set({ generationDirection: v })} />
          <SliderRow
            label="Brother/Sister Generations"
            min={0}
            max={MAX_SIBLING_GENERATIONS}
            step={1}
            value={options.siblingGenerations}
            onChange={(v) => set({ siblingGenerations: v })}
            valueFormatter={(v) => `${v}`}
          />
          <SliderRow
            label="Scale Ancestors at Generation"
            min={0}
            max={MAX_MINIFICATION_START}
            step={1}
            value={options.ancestorScaleStartLevel}
            onChange={(v) => set({ ancestorScaleStartLevel: v })}
            valueFormatter={(v) => (v === 0 ? 'Off' : `${v}`)}
          />
          <SliderRow
            label="Scale Descendants at Generation"
            min={0}
            max={MAX_MINIFICATION_START}
            step={1}
            value={options.descendantScaleStartLevel}
            onChange={(v) => set({ descendantScaleStartLevel: v })}
            valueFormatter={(v) => (v === 0 ? 'Off' : `${v}`)}
          />
          <SliderRow
            label="Parents/Children Spacing"
            min={0.6}
            max={1.8}
            step={0.05}
            value={options.parentsChildrenSpacing}
            onChange={(v) => set({ parentsChildrenSpacing: v })}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />
          <SliderRow
            label="Partner Spacing"
            min={0.6}
            max={1.8}
            step={0.05}
            value={options.partnerSpacing}
            onChange={(v) => set({ partnerSpacing: v })}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />
          <SliderRow
            label="Branch Spacing"
            min={0.6}
            max={1.8}
            step={0.05}
            value={options.branchSpacing}
            onChange={(v) => set({ branchSpacing: v })}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />
        </>
      );
    case 'personStyle':
      return (
        <>
          <SelectRow label="Person Coloring" value={options.personColoringMode} options={PERSON_COLORING_MODES} onChange={(v) => set({ personColoringMode: v })} />
          {options.personColoringMode === 'customColor' && (
            <ColorRow label="Custom Color" value={options.personCustomColor || DEFAULT_PERSON_CUSTOM_COLOR} onChange={(v) => set({ personCustomColor: v })} />
          )}
          <SelectRow label="Child Sorting" value={options.childSortingMode} options={CHILD_SORTING_MODES} onChange={(v) => set({ childSortingMode: v })} />
          <SliderRow
            label="Person Width"
            min={0.6}
            max={1.6}
            step={0.05}
            value={options.personWidth}
            onChange={(v) => set({ personWidth: v })}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />
          <SliderRow
            label="Background Saturation"
            min={0}
            max={1.5}
            step={0.05}
            value={options.personSaturation}
            onChange={(v) => set({ personSaturation: v })}
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
          />
          <ToggleRow label="Highlight Living Persons" value={options.highlightLivingPersons} onChange={(v) => set({ highlightLivingPersons: v })} />
          <ToggleRow label="Desaturate Ancestors of Partner" value={options.desaturatePartnerAncestors} onChange={(v) => set({ desaturatePartnerAncestors: v })} />
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
          <ToggleRow label="Display Influential Relations Icon" value={options.displayInfluentialIcon} onChange={(v) => set({ displayInfluentialIcon: v })} />
          <ToggleRow label="Display FamilySearch Icons" value={options.displayFamilySearchIcons} onChange={(v) => set({ displayFamilySearchIcons: v })} />
          <ToggleRow label="Indicators for further persons" value={options.displayFurtherPersonsIndicators} onChange={(v) => set({ displayFurtherPersonsIndicators: v })} />
          <ToggleRow label="Display Numbering System" value={options.displayNumberingSystem} onChange={(v) => set({ displayNumberingSystem: v })} />
          {options.displayNumberingSystem && (
            <SelectRow label="Numbering" value={options.numberingSystem} options={NUMBERING_SYSTEMS} onChange={(v) => set({ numberingSystem: v })} />
          )}
          <SliderRow
            label="Font Size"
            min={0.7}
            max={1.5}
            step={0.05}
            value={options.fontSize}
            onChange={(v) => set({ fontSize: v })}
            valueFormatter={(v) => `${Math.round(v * 100)}%`}
          />
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
          {options.generationBandColorMode === 'customColor' && (
            <ColorRow label="Custom Color" value={options.generationBandCustomColor || DEFAULT_GENERATION_BAND_CUSTOM_COLOR} onChange={(v) => set({ generationBandCustomColor: v })} />
          )}
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
          <ToggleRow label="Show Range of Birth Dates" value={options.generationBandsShowBirthDates} onChange={(v) => set({ generationBandsShowBirthDates: v })} />
          <ToggleRow label="Show Generations" value={options.generationBandsShowGenerations} onChange={(v) => set({ generationBandsShowGenerations: v })} />
          <ToggleRow label="Segment Bands by Pedigree" value={options.generationBandsSegmentByPedigree} onChange={(v) => set({ generationBandsSegmentByPedigree: v })} />
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
          <SliderRow
            label="Shadow Radius"
            min={0}
            max={4.0}
            step={0.05}
            value={options.shadowRadius}
            onChange={(v) => set({ shadowRadius: v })}
            valueFormatter={(v) => `${v.toFixed(2)}×`}
          />
          <SliderRow
            label="Shadow Distance"
            min={0}
            max={40}
            step={1}
            value={options.shadowDistance}
            onChange={(v) => set({ shadowDistance: v })}
            valueFormatter={(v) => `${Math.round(v)}`}
          />
          <SliderRow
            label="Shadow Angle"
            min={0}
            max={360}
            step={5}
            value={options.shadowAngle}
            onChange={(v) => set({ shadowAngle: v })}
            valueFormatter={(v) => `${Math.round(v)}°`}
          />
        </>
      );
    case 'ground':
      return (
        <>
          <SelectRow label="Ground Pattern" value={options.bottomPlaneMode} options={BOTTOM_PLANE_MODES} onChange={(v) => set({ bottomPlaneMode: v })} />
          <SelectRow label="Ground Color" value={options.groundColorMode} options={GROUND_COLOR_MODES} onChange={(v) => set({ groundColorMode: v })} />
          {options.groundColorMode === 'customColor' && (
            <ColorRow label="Custom Color" value={options.groundCustomColor || DEFAULT_GROUND_CUSTOM_COLOR} onChange={(v) => set({ groundCustomColor: v })} />
          )}
        </>
      );
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
