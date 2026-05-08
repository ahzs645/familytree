/**
 * Inline controls in the ChartsApp header for the Relationship Path chart:
 * bloodline filter, depth/path caps, and a dropdown that lists all paths
 * found between the two selected people.
 */
import React from 'react';
import { relationshipControlsStyle, relationshipToggleStyle, selectStyle } from './styles.js';

export function RelationshipPathControls({
  bloodlineOnly,
  onBloodlineOnlyChange,
  maxPaths,
  onMaxPathsChange,
  maxDepth,
  onMaxDepthChange,
  excludeNonBiological,
  onExcludeNonBiologicalChange,
  paths,
  selectedPathId,
  onSelectedPathChange,
  onReset,
  disabled,
}) {
  return (
    <div style={relationshipControlsStyle}>
      <label style={relationshipToggleStyle}>
        <input
          type="checkbox"
          checked={bloodlineOnly}
          onChange={(event) => onBloodlineOnlyChange(event.target.checked)}
          disabled={disabled}
        />
        <span>Bloodlines only</span>
      </label>
      <label style={relationshipToggleStyle} title="Skip paths that cross adopted or step relationships.">
        <input
          type="checkbox"
          checked={excludeNonBiological}
          onChange={(event) => onExcludeNonBiologicalChange(event.target.checked)}
          disabled={disabled}
        />
        <span>Full-blood only</span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11 }}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Max paths</span>
        <input
          type="number"
          min={1}
          max={40}
          value={maxPaths}
          onChange={(event) => onMaxPathsChange(Math.max(1, Math.min(40, Number(event.target.value) || 1)))}
          disabled={disabled}
          style={{ ...selectStyle, width: 60 }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11 }}>
        <span style={{ color: 'hsl(var(--muted-foreground))' }}>Max depth</span>
        <input
          type="number"
          min={2}
          max={24}
          value={maxDepth}
          onChange={(event) => onMaxDepthChange(Math.max(2, Math.min(24, Number(event.target.value) || 2)))}
          disabled={disabled}
          style={{ ...selectStyle, width: 60 }}
        />
      </label>
      <select
        value={selectedPathId || ''}
        onChange={(event) => onSelectedPathChange(event.target.value || null)}
        disabled={disabled || paths.length === 0}
        style={{ ...selectStyle, minWidth: 180 }}
        title="Relationship path"
      >
        <option value="">{disabled ? 'Pick compare person' : paths.length ? 'Select path...' : 'No path found'}</option>
        {paths.map((path, index) => (
          <option key={path.id} value={path.id}>
            {index + 1}. {path.label} ({path.steps.length - 1} step{path.steps.length === 2 ? '' : 's'})
          </option>
        ))}
      </select>
      <button type="button" onClick={onReset} disabled={disabled} style={selectStyle}>
        Reset
      </button>
    </div>
  );
}
