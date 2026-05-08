/**
 * State for the configurable "Virtual Tree" chart — both the 2D layout
 * inputs (source axis, orientation, spacing) and the 3D-specific
 * symbol/colour/depth-of-field knobs.
 */
import { useState } from 'react';
import { DOF_DEFAULTS } from '../VirtualTree3D.jsx';

export function useVirtualTreeOptions() {
  const [virtualSource, setVirtualSource] = useState('descendant');
  const [virtualOrientation, setVirtualOrientation] = useState('vertical');
  const [virtualHSpacing, setVirtualHSpacing] = useState(24);
  const [virtualVSpacing, setVirtualVSpacing] = useState(110);
  const [virtualTreeData, setVirtualTreeData] = useState(null);
  const [virtualViewMode, setVirtualViewMode] = useState('3d');
  const [virtualSymbolMode, setVirtualSymbolMode] = useState('sphere');
  const [virtualColorMode, setVirtualColorMode] = useState('gender');
  const [virtualShowGenerationBands, setVirtualShowGenerationBands] = useState(true);
  const [virtualDof, setVirtualDof] = useState(DOF_DEFAULTS);

  return {
    virtualSource,
    setVirtualSource,
    virtualOrientation,
    setVirtualOrientation,
    virtualHSpacing,
    setVirtualHSpacing,
    virtualVSpacing,
    setVirtualVSpacing,
    virtualTreeData,
    setVirtualTreeData,
    virtualViewMode,
    setVirtualViewMode,
    virtualSymbolMode,
    setVirtualSymbolMode,
    virtualColorMode,
    setVirtualColorMode,
    virtualShowGenerationBands,
    setVirtualShowGenerationBands,
    virtualDof,
    setVirtualDof,
  };
}
