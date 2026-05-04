import { Gender } from '../../../models/index.js';

export const GEN_STEP = 225;
export const NODE_SPACING = 240;
export const PARTNER_OFFSET = 178;
export const AVATAR_RADIUS = 46;
export const ROOT_CARD = { w: 230, h: 230 };
export const SKIN = '#f4d3a5';
export const SKIN_SHADOW = '#dcae7a';
export const BAND_LABEL_GUTTER = 310;
export const REFERENCE_MODEL_BASE = '/mft-models/';
export const VIEWER_OPTIONS_STORAGE_KEY = 'cloudtreeweb:interactive-tree-viewer-options';
export const CAMERA_STATE_STORAGE_KEY = 'cloudtreeweb:interactive-tree-camera-state';
export const REFERENCE_MODEL_GROUND_ROTATION_X = Math.PI / 2;

export const PERSON_STYLES = [
  { id: 'simplified', label: 'Simplified', suffix: '' },
  { id: 'cartoon', label: 'Cartoon', suffix: 'Cartoon' },
  { id: 'gender', label: 'Gender', suffix: 'Gender' },
  { id: 'flat', label: 'Flat', suffix: 'Flat' },
];
export const CAMERA_MODES = [
  { id: 'tilted', label: 'Tilted' },
  { id: 'top', label: 'Top' },
  { id: 'front', label: 'Front' },
  { id: 'isoLeft', label: 'Iso L' },
  { id: 'isoRight', label: 'Iso R' },
];
export const LIGHTING_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'flat', label: 'Flat' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'violet', label: 'Violet' },
];
export const BOTTOM_PLANE_MODES = [
  { id: 'grid', label: 'Grid' },
  { id: 'plain', label: 'Plain' },
  { id: 'checker', label: 'Checker' },
  { id: 'dots', label: 'Dots' },
];
export const GENERATION_BAND_STYLES = [
  { id: 'raised', label: 'Raised' },
  { id: 'flat', label: 'Flat' },
  { id: 'pedestal', label: 'Pedestal' },
  { id: 'none', label: 'None' },
];
export const REFERENCE_MODEL_GENDERS = {
  [Gender.Male]: 'Male',
  [Gender.Female]: 'Female',
  unknown: 'Unknown',
};
