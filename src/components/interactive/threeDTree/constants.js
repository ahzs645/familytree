import { Gender } from '../../../models/index.js';

export const GEN_STEP = 270;
export const NODE_SPACING = 240;
export const PARTNER_OFFSET = 178;
export const AVATAR_RADIUS = 46;
export const ROOT_CARD = { w: 230, h: 230 };
export const SKIN = '#f4d3a5';
export const SKIN_SHADOW = '#dcae7a';
export const BAND_LABEL_GUTTER = 310;
export const REFERENCE_MODEL_BASE = `${import.meta.env.BASE_URL}mft-models/`;
export const VIEWER_OPTIONS_STORAGE_KEY = 'cloudtreeweb:interactive-tree-viewer-options';
export const VIEWER_OPTIONS_VERSION = 4;
export const CAMERA_STATE_STORAGE_KEY = 'cloudtreeweb:interactive-tree-camera-state';
export const CAMERA_STATE_VERSION = 9;
export const OPTIONS_PANEL_STATE_STORAGE_KEY = 'cloudtreeweb:interactive-tree-options-panel';
export const REFERENCE_MODEL_GROUND_ROTATION_X = Math.PI / 2;

// Person rendering style (matches Mac InteractiveTreeView3DViewer_PersonStyle_*)
export const PERSON_STYLES = [
  { id: 'simplified', label: 'Simplified', suffix: '' },
  { id: 'cartoon', label: 'Cartoon', suffix: 'Cartoon' },
  { id: 'gender', label: 'Gender', suffix: 'Gender' },
  { id: 'flat', label: 'Flat', suffix: 'Flat' },
];

// 10 native camera presets (CoreInteractiveTreeView.strings _CameraMode_*)
export const CAMERA_MODES = [
  { id: 'topDown', label: 'Top Down' },
  { id: 'topDownSlight', label: 'Top Down, slightly tilted' },
  { id: 'topDownTilted', label: 'Top Down, tilted' },
  { id: 'front', label: 'Front' },
  { id: 'frontLeft', label: 'Front Left' },
  { id: 'frontRight', label: 'Front Right' },
  { id: 'topLeft', label: 'Top Left' },
  { id: 'topRight', label: 'Top Right' },
  { id: 'isoLeft', label: 'Isometric Left' },
  { id: 'isoRight', label: 'Isometric Right' },
];

// Legacy camera ids kept for migration: 'tilted', 'top', 'isoLeft', 'isoRight', 'front'.
export const LEGACY_CAMERA_MODE_MAP = {
  tilted: 'topDownTilted',
  top: 'topDown',
};

export const LIGHTING_MODES = [
  { id: 'normal', label: 'Normal' },
  { id: 'flat', label: 'Flat' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'blue', label: 'Light Blue' },
  { id: 'green', label: 'Light Green' },
  { id: 'violet', label: 'Light Violet' },
];

export const BOTTOM_PLANE_MODES = [
  { id: 'plain', label: 'Plain' },
  { id: 'grid', label: 'Grid' },
  { id: 'smallGrid', label: 'Small Grid' },
  { id: 'largeGrid', label: 'Large Grid' },
  { id: 'checker', label: 'Checker' },
  { id: 'smallChecker', label: 'Small Checkerboard' },
  { id: 'largeChecker', label: 'Large Checkerboard' },
  { id: 'dots', label: 'Dots' },
  { id: 'smallDots', label: 'Small Dots' },
  { id: 'largeDots', label: 'Large Dots' },
  { id: 'smallPlaid', label: 'Small Plaid Pattern' },
  { id: 'largePlaid', label: 'Large Plaid Pattern' },
  { id: 'smallRectangles', label: 'Small Rectangles' },
  { id: 'largeRectangles', label: 'Large Rectangles' },
  { id: 'wood', label: 'Wood' },
  { id: 'concrete', label: 'Concrete' },
  { id: 'marble', label: 'Marble' },
];

export const GENERATION_BAND_STYLES = [
  { id: 'raised', label: 'Raised' },
  { id: 'raisedProminent', label: 'Raised (Prominent Blood)' },
  { id: 'flat', label: 'Flat' },
  { id: 'pedestal', label: 'Pedestal' },
  { id: 'pedestalProminent', label: 'Pedestal (Prominent Blood)' },
  { id: 'smallStairs', label: 'Small Generation Stairs' },
  { id: 'smallStairsProminent', label: 'Small Stairs (Prominent Blood)' },
  { id: 'largeStairs', label: 'Large Generation Stairs' },
  { id: 'largeStairsProminent', label: 'Large Stairs (Prominent Blood)' },
  { id: 'none', label: 'None' },
];

// Native exposes 13 generation band color modes; subset wired for now.
export const GENERATION_BAND_COLOR_MODES = [
  { id: 'macPink', label: 'Mac Pink (Uniform)' },
  { id: 'byGeneration', label: 'By Generation' },
  { id: 'gray', label: 'Gray' },
  { id: 'highSaturation', label: 'By Generation, High Saturation' },
  { id: 'blueGradient', label: 'Blue Gradient' },
  { id: 'greenGradient', label: 'Green Gradient' },
  { id: 'blueOrange', label: 'Blue / Orange Gradient' },
  { id: 'magentaOrange', label: 'Magenta / Orange Gradient' },
];

// Native: _PersonColoringMode_* (ByGender/Generation/Pedigree/Label/PersonGroup/Custom).
export const PERSON_COLORING_MODES = [
  { id: 'byGender', label: 'By Gender' },
  { id: 'byGeneration', label: 'By Generation' },
  { id: 'byPedigree', label: 'By Pedigree' },
];

// Native: _FamilyConnectionColorMode_* (Gen Light/Dark/ByBlood/Gray/BlackOrWhite/Custom).
export const CONNECTION_COLOR_MODES = [
  { id: 'byGenerationLight', label: 'By Generation, Light' },
  { id: 'byGenerationDark', label: 'By Generation, Dark' },
  { id: 'byBlood', label: 'By Blood Relationship' },
  { id: 'gray', label: 'Gray' },
  { id: 'blackOrWhite', label: 'Black or White' },
  { id: 'customColor', label: 'Custom Color' },
];

export const DEFAULT_CONNECTION_CUSTOM_COLOR = '#7b5af6';

// Native: _ChildSortingMode_*.
export const CHILD_SORTING_MODES = [
  { id: 'byBirthAsc', label: 'By Birth Date, Ascending' },
  { id: 'byBirthDesc', label: 'By Birth Date, Descending' },
  { id: 'byName', label: 'By Name' },
];

// Native: _PersonImageStyleMode_*.
export const PERSON_IMAGE_STYLES = [
  { id: 'round', label: 'Round' },
  { id: 'roundRaised', label: 'Round, extruded' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'rectangleRaised', label: 'Rectangle, extruded' },
  { id: 'none', label: 'No Pictures' },
];

export const APPEARANCE_MODES = [
  { id: 'macLight', label: 'Mac' },
  { id: 'app', label: 'App' },
];

export const REFERENCE_MODEL_GENDERS = {
  [Gender.Male]: 'Male',
  [Gender.Female]: 'Female',
  unknown: 'Unknown',
};

// Mac group names → `CoreInteractiveTreeView.strings _Configurations_*GroupName`.
export const OPTION_GROUPS = [
  { id: 'general', label: 'General' },
  { id: 'generations', label: 'Generations' },
  { id: 'personStyle', label: 'Person Style' },
  { id: 'personInformation', label: 'Person Information' },
  { id: 'connections', label: 'Connections' },
  { id: 'generationBands', label: 'Generation Bands' },
  { id: 'camera', label: 'Camera' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'ground', label: 'Ground' },
  { id: 'animations', label: 'Animations' },
  { id: 'selection', label: 'Selection Behavior' },
];

export const MIN_GENERATIONS = 1;
export const MAX_ANCESTOR_GENERATIONS = 10;
export const MAX_DESCENDANT_GENERATIONS = 8;
