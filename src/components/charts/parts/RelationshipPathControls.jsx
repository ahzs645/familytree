/**
 * Inline controls in the ChartsApp header for the Relationship Path chart:
 * bloodline filter, depth/path caps, and a dropdown that lists all paths
 * found between the two selected people.
 */
import React from 'react';
import { Select } from '../../ui/Select.jsx';
import { Button } from '../../ui/Button.jsx';
import { Input } from '../../ui/Input.jsx';

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
    <div className="flex items-end gap-2 me-3">
      <label className="flex min-h-[34px] items-center gap-1.5 whitespace-nowrap text-sm text-foreground">
        <input
          type="checkbox"
          checked={bloodlineOnly}
          onChange={(event) => onBloodlineOnlyChange(event.target.checked)}
          disabled={disabled}
        />
        <span>Bloodlines only</span>
      </label>
      <label className="flex min-h-[34px] items-center gap-1.5 whitespace-nowrap text-sm text-foreground" title="Skip paths that cross adopted or step relationships.">
        <input
          type="checkbox"
          checked={excludeNonBiological}
          onChange={(event) => onExcludeNonBiologicalChange(event.target.checked)}
          disabled={disabled}
        />
        <span>Full-blood only</span>
      </label>
      <label className="flex flex-col text-xs">
        <span className="text-muted-foreground">Max paths</span>
        <Input
          type="number"
          min={1}
          max={40}
          value={maxPaths}
          onChange={(event) => onMaxPathsChange(Math.max(1, Math.min(40, Number(event.target.value) || 1)))}
          disabled={disabled}
          className="w-[60px] px-2"
        />
      </label>
      <label className="flex flex-col text-xs">
        <span className="text-muted-foreground">Max depth</span>
        <Input
          type="number"
          min={2}
          max={24}
          value={maxDepth}
          onChange={(event) => onMaxDepthChange(Math.max(2, Math.min(24, Number(event.target.value) || 2)))}
          disabled={disabled}
          className="w-[60px] px-2"
        />
      </label>
      <Select
        value={selectedPathId || ''}
        onChange={(value) => onSelectedPathChange(value || null)}
        disabled={disabled || paths.length === 0}
        options={[
          { value: '', label: disabled ? 'Pick compare person' : paths.length ? 'Select path...' : 'No path found' },
          ...paths.map((path, index) => ({
            value: path.id,
            label: `${index + 1}. ${path.label} (${path.steps.length - 1} step${path.steps.length === 2 ? '' : 's'})`,
          })),
        ]}
        className="min-w-[180px]"
        ariaLabel="Relationship path"
      />
      <Button onClick={onReset} disabled={disabled}>
        Reset
      </Button>
    </div>
  );
}
