import React from 'react';
import { lifeSpanLabel } from '../../../models/index.js';
import { styles, dockToggleStyle } from './styles.js';
import { buildTreeNavigationOptions, firstNavigationOption } from './navigationOptions.js';

export function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricValue}>{value}</span>
      <span style={styles.metricLabel}>{label}</span>
    </div>
  );
}

export function ViewerSelect({ label, value, options, onChange }) {
  return (
    <label style={styles.selectLabel}>
      <span style={styles.selectText}>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={styles.select}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function TreeNavigationControls({ context, onPick }) {
  const sections = buildTreeNavigationOptions(context);
  const selectValue = '';
  const jump = (sectionId) => {
    const option = firstNavigationOption(context, sectionId);
    if (option) onPick?.(option.id);
  };
  if (!sections.length) return null;
  return (
    <div style={styles.navDockGroup}>
      <button type="button" style={styles.dockButton} onClick={() => jump('parents')} disabled={!sections.some((section) => section.id === 'parents')}>
        Parent
      </button>
      <button type="button" style={styles.dockButton} onClick={() => jump('partners')} disabled={!sections.some((section) => section.id === 'partners')}>
        Partner
      </button>
      <button type="button" style={styles.dockButton} onClick={() => jump('children')} disabled={!sections.some((section) => section.id === 'children')}>
        Child
      </button>
      <select
        value={selectValue}
        onChange={(event) => {
          if (event.target.value) onPick?.(event.target.value);
        }}
        style={styles.navigationSelect}
        aria-label="Navigate family tree"
      >
        <option value="">Navigate...</option>
        {sections.map((section) => (
          <optgroup key={section.id} label={section.label}>
            {section.options.map((option) => (
              <option key={`${section.id}:${option.id}`} value={option.id}>
                {option.relation}: {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function PersonHoverCard({ person, x, y }) {
  return (
    <div style={{ ...styles.hoverCard, left: x + 14, top: y + 14 }}>
      <div style={styles.hoverName}>{person?.fullName || 'Unnamed person'}</div>
      <div style={styles.hoverMeta}>{lifeSpanLabel(person) || 'No life dates'}</div>
    </div>
  );
}

export function PersonContextMenu({
  node,
  person,
  x,
  y,
  onClose,
  onPick,
  onEditPerson,
  onOpenFamily,
  onShowInfo,
  onOpenAncestorChart,
  onOpenDescendantChart,
}) {
  const familyId = selectableFamilyId(node);
  const run = (handler) => {
    onClose?.();
    handler?.(person?.recordName);
  };
  const runFamily = () => {
    onClose?.();
    if (familyId) onOpenFamily?.(familyId);
  };
  return (
    <div
      style={{ ...styles.contextMenu, left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
    >
      <div style={styles.contextHeader}>
        <div style={styles.contextName}>{person?.fullName || 'Unnamed person'}</div>
        <div style={styles.contextMeta}>{lifeSpanLabel(person) || 'No life dates'}</div>
      </div>
      <button type="button" style={styles.contextItem} onClick={() => run(onPick)} role="menuitem">Set as Focus</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onShowInfo)} role="menuitem">Show Info</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onEditPerson)} role="menuitem">Edit Person</button>
      {familyId && <button type="button" style={styles.contextItem} onClick={runFamily} role="menuitem">Select Family</button>}
      <button type="button" style={styles.contextItem} onClick={() => run(onOpenAncestorChart)} role="menuitem">Ancestor Chart</button>
      <button type="button" style={styles.contextItem} onClick={() => run(onOpenDescendantChart)} role="menuitem">Descendant Chart</button>
    </div>
  );
}

function selectableFamilyId(node) {
  const id = node?.familyBlockId;
  if (!id || id === 'root' || id.startsWith?.('leaf:')) return null;
  return id;
}

export { dockToggleStyle };
