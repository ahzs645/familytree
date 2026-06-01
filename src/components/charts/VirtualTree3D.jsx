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
    return <div style={{ padding: 24, color: '#9ca3af' }}>No virtual-tree data yet.</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 400, background: '#0b0f1a' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div style={toolbarStyle}>
        <button type="button" onClick={() => sceneRef.current?.fitToContent()} style={toolButtonStyle} title="Size to Fit">
          <LocateFixed size={16} aria-hidden="true" />
          <span>Size to Fit</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setCameraMode('iso');
            sceneRef.current?.setCameraMode('iso');
          }}
          style={iconButtonStyle}
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
          triggerStyle={{ ...selectStyle, paddingInlineEnd: 32 }}
          ariaLabel="3D camera view"
        />
      </div>
    </div>
  );
}

export default VirtualTree3D;

const toolbarStyle = {
  position: 'absolute',
  top: 12,
  left: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 6,
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: 8,
  background: 'rgba(15, 23, 42, 0.76)',
  backdropFilter: 'blur(12px)',
};

const toolButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 32,
  padding: '0 10px',
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: 6,
  background: 'rgba(30, 41, 59, 0.92)',
  color: '#f8fafc',
  fontSize: 12,
  cursor: 'pointer',
};

const iconButtonStyle = {
  ...toolButtonStyle,
  width: 32,
  justifyContent: 'center',
  padding: 0,
};

const selectStyle = {
  height: 32,
  border: '1px solid rgba(148, 163, 184, 0.28)',
  borderRadius: 6,
  background: 'rgba(15, 23, 42, 0.94)',
  color: '#f8fafc',
  fontSize: 12,
  padding: '0 8px',
};
