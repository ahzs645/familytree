/**
 * VirtualTree3D — React wrapper around VirtualTree3DScene.
 *
 * The heavy lifting lives in `virtualTree3D/` so the component stays a
 * thin lifecycle shell: mount scene, feed it data, forward prop changes
 * (symbol mode, color mode, relationship-path highlight), tear down on
 * unmount.
 *
 * See virtualTree3D/README structure:
 *   - Scene.js          scene/camera/renderer orchestration
 *   - PersonObject.js   one node per person
 *   - FamilyObject.js   partner-pair markers
 *   - ConnectionObject.js one edge per builder connection
 *   - symbolModes.js    sphere/rounded/circle/photo meshes
 *   - colorModes.js     gender/generation/lastName/uniform colors
 *   - lighting.js       ambient + key + fill + shadows
 *   - relationshipPath.js highlight a path through the graph
 */
import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, RotateCcw } from 'lucide-react';
import { Select } from '../ui/Select.jsx';
import { cn } from '../../lib/utils.js';
import { VirtualTree3DScene } from './virtualTree3D/Scene.js';
import { SYMBOL_MODES } from './virtualTree3D/symbolModes.js';
import { COLOR_MODES } from './virtualTree3D/colorModes.js';
import { DOF_DEFAULTS } from './virtualTree3D/postProcessing.js';

export { SYMBOL_MODES, COLOR_MODES, DOF_DEFAULTS };

export function VirtualTree3D({
  virtualTreeData,
  symbolMode = 'sphere',
  colorMode = 'gender',
  relationshipPathIds = [],
  photosById,
  dof = DOF_DEFAULTS,
  layoutOptions = {},
  showGenerationBands = true,
  onPick,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const [cameraMode, setCameraMode] = useState('iso');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const scene = new VirtualTree3DScene(container, { onPick });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [onPick]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (!virtualTreeData?.nodes?.length) {
      scene.setData({ nodes: [], connections: [] });
      return;
    }
    scene.setData(
      { nodes: virtualTreeData.nodes, connections: virtualTreeData.connections || [] },
      {
        symbolMode,
        colorMode,
        photosById: photosById || new Map(),
        layoutOptions: { ...(virtualTreeData.config || {}), ...layoutOptions },
        showGenerationBands,
      }
    );
    scene.setRelationshipPath(relationshipPathIds || []);
  }, [virtualTreeData, symbolMode, colorMode, photosById, layoutOptions, showGenerationBands]);

  useEffect(() => {
    sceneRef.current?.setColorMode(colorMode);
  }, [colorMode]);

  useEffect(() => {
    sceneRef.current?.setRelationshipPath(relationshipPathIds || []);
  }, [relationshipPathIds]);

  useEffect(() => {
    sceneRef.current?.setDepthOfField(dof || DOF_DEFAULTS);
  }, [dof]);

  if (!virtualTreeData?.nodes?.length) {
    return <div className="p-6 text-muted-foreground">No virtual-tree data yet.</div>;
  }

  // The toolbar sits over the always-dark WebGL scene (bg #0b0f1a matches the
  // Three.js clear color), so it keeps fixed dark glass colors instead of
  // theme tokens.
  return (
    <div className="relative h-full min-h-[400px] w-full bg-[#0b0f1a]">
      <div ref={containerRef} className="h-full w-full" />
      <div className="absolute start-3 top-3 flex items-center gap-2 rounded-md border border-slate-400/30 bg-slate-900/75 p-1.5 backdrop-blur-md">
        <button type="button" onClick={() => sceneRef.current?.fitToContent()} className={TOOL_BUTTON_CLASSES} title="Size to Fit">
          <LocateFixed size={16} aria-hidden="true" />
          <span>Size to Fit</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCameraMode('iso');
            sceneRef.current?.setCameraMode('iso');
          }}
          className={cn(TOOL_BUTTON_CLASSES, 'w-8 justify-center px-0')}
          title="Reset view"
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <Select
          value={cameraMode}
          onChange={(value) => {
            setCameraMode(value);
            sceneRef.current?.setCameraMode(value);
          }}
          options={[
            { value: 'iso', label: 'Isometric' },
            { value: 'top', label: 'Top' },
            { value: 'front', label: 'Front' },
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ]}
          triggerClassName="h-8 border-slate-400/30 bg-slate-900/95 ps-2 text-xs text-slate-50 hover:bg-slate-800"
          ariaLabel="3D camera view"
        />
      </div>
    </div>
  );
}

export default VirtualTree3D;

// Fixed dark glass button styling for the 3D toolbar (see note above).
const TOOL_BUTTON_CLASSES =
  'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-400/30 bg-slate-800/90 px-2.5 text-xs text-slate-50';
