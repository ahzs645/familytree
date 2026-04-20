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
import React, { useEffect, useRef } from 'react';
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
  onPick,
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

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
      { symbolMode, colorMode, photosById: photosById || new Map() }
    );
    scene.setRelationshipPath(relationshipPathIds || []);
  }, [virtualTreeData, symbolMode, colorMode, photosById]);

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

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 400 }} />;
}

export default VirtualTree3D;
