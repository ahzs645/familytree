import { Gender } from '../../../models/index.js';

export const GEN_STEP = 270;

// Generations sit at staggered DEPTH (z) so the tilted camera shows nearer
// generations overlapping/occluding farther ones — the native viewer's nested
// look, which a flat coplanar board can't produce. Descendants (gen > 0) lift
// toward the camera, ancestors (gen < 0) recede; root stays at 0. Applied to
// bands, figures, and connectors together so each generation moves as a slab.
export const GENERATION_DEPTH_STEP = 18;
export function generationDepthZ(generation) {
  return (Number(generation) || 0) * GENERATION_DEPTH_STEP;
}
export const NODE_SPACING = 240;
export const PARTNER_OFFSET = 178;
export const AVATAR_RADIUS = 46;
export const ROOT_CARD = { w: 230, h: 230 };
export const SKIN = '#f4d3a5';
export const SKIN_SHADOW = '#dcae7a';
export const BAND_LABEL_GUTTER = 310;
export const REFERENCE_MODEL_BASE = `${import.meta.env.BASE_URL}mft-models/`;
export const VIEWER_OPTIONS_STORAGE_KEY = 'cloudtreeweb:interactive-tree-viewer-options';
export const VIEWER_OPTIONS_VERSION = 7;
export const CAMERA_STATE_STORAGE_KEY = 'cloudtreeweb:interactive-tree-camera-state';
export const CAMERA_STATE_VERSION = 12;
export const OPTIONS_PANEL_STATE_STORAGE_KEY = 'cloudtreeweb:interactive-tree-options-panel';
// Native InteractiveTreeView3DViewerPersonObject leans each figure back to face
// the camera (decompiled bodyNode euler-X = -18° in the default perspective
// mode). Our board is the XY plane with +Z up, so a negative X rotation tilts
// the figure's front up toward the tilted camera, revealing the front of the
// body+head (the puffy "cloud" silhouette) instead of a top-down foreshortening.
export const REFERENCE_MODEL_GROUND_ROTATION_X = -0.32;

// Person rendering style (matches Mac InteractiveTreeView3DViewer_PersonStyle_*)
export const PERSON_STYLES = [
  { id: 'simplified', label: 'Simplified', suffix: '' },
  { id: 'cartoon', label: 'Cartoon', suffix: 'Cartoon' },
  { id: 'gender', label: 'Gender', suffix: 'Gender' },
  { id: 'flat', label: 'Flat', suffix: 'Flat' },
];

// 10 native camera presets (CoreInteractiveTreeView.strings _CameraMode_*).
// Pitch/yaw per mode live in camera.js MODE_ANGLES, extracted from the
// MacFamilyTree 11 binary; all presets render orthographic, native default
// is topDownSlight.
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
  { id: 'macPink', label: 'Mac Pedigree (Lilac → Yellow)' },
  { id: 'byGeneration', label: 'By Generation' },
  { id: 'gray', label: 'Gray' },
  { id: 'highSaturation', label: 'By Generation, High Saturation' },
  { id: 'blueGradient', label: 'Blue Gradient' },
  { id: 'greenGradient', label: 'Green Gradient' },
  { id: 'blueOrange', label: 'Blue / Orange Gradient' },
  { id: 'magentaOrange', label: 'Magenta / Orange Gradient' },
  { id: 'customColor', label: 'Custom Color' },
];

export const DEFAULT_GENERATION_BAND_CUSTOM_COLOR = '#ef9bc9';

// Native: _PersonColoringMode_* (ByGender/Generation/Pedigree/Label/PersonGroup/Custom).
export const PERSON_COLORING_MODES = [
  { id: 'byGender', label: 'By Gender' },
  { id: 'byGeneration', label: 'By Generation' },
  { id: 'byPedigree', label: 'By Pedigree' },
  { id: 'byBirthYear', label: 'By Birth Year' },
  { id: 'byAge', label: 'By Age at Death' },
  { id: 'byLabel', label: 'By Label' },
  { id: 'byPersonGroup', label: 'By Person Group' },
  { id: 'customColor', label: 'Custom Color' },
];

export const DEFAULT_PERSON_CUSTOM_COLOR = '#7da9d8';

// Native: _BottomPlaneColorMode_*. The ground pattern (BOTTOM_PLANE_MODES) is
// separate from its tint; the native viewer lets you set both independently.
export const GROUND_COLOR_MODES = [
  { id: 'auto', label: 'Default (Paper)' },
  { id: 'white', label: 'White' },
  { id: 'lightGray', label: 'Light Gray' },
  { id: 'gray', label: 'Gray' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'sand', label: 'Sand' },
  { id: 'dark', label: 'Dark' },
  { id: 'customColor', label: 'Custom Color' },
];

export const GROUND_COLOR_VALUES = {
  white: '#ffffff',
  lightGray: '#eceef1',
  gray: '#c9ccd1',
  blue: '#d8e6f5',
  green: '#dceede',
  sand: '#efe6d2',
  dark: '#2a2d33',
};

export const DEFAULT_GROUND_CUSTOM_COLOR = '#e8eaed';

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
  { id: 'layout', label: 'Layout & Spacing' },
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

// Native: _GeneralLayout_Generations_* — which screen axis generations flow
// along. Default topToBottom keeps oldest generations at the top.
export const GENERATION_DIRECTIONS = [
  { id: 'topToBottom', label: 'Top to Bottom' },
  { id: 'bottomToTop', label: 'Bottom to Top' },
  { id: 'leftToRight', label: 'Left to Right' },
  { id: 'rightToLeft', label: 'Right to Left' },
];

// Brother/Sister Generations: how many generations away from the focused person
// still show collateral siblings. 4 ≈ the current native-style default.
export const MAX_SIBLING_GENERATIONS = 6;
export const DEFAULT_SIBLING_GENERATIONS = 4;

// Scale Ancestors/Descendants at Generation: the generation at which person
// figures begin shrinking (0 = never). Mirrors the native minification start.
export const MAX_MINIFICATION_START = 8;

// Native: _DisplayNumberingSystem — the kinship/reference numbering shown on
// each person. Maps onto src/lib/referenceNumbering.js systems.
export const NUMBERING_SYSTEMS = [
  { id: 'ahnentafel', label: 'Ahnentafel' },
  { id: 'daboville', label: "d'Aboville" },
  { id: 'henry', label: 'Henry' },
  { id: 'generation', label: 'Generation' },
];

// Native: _OrdinancesMode_* — how LDS ordinance completion is surfaced.
export const ORDINANCES_MODES = [
  { id: 'none', label: 'None' },
  { id: 'icon', label: 'By Icon' },
  { id: 'color', label: 'By Color' },
];

// Native: _InteractiveTreeViewFlatViewer_BackgroundStyle_* — the flat (2D)
// viewer's nine background presets (solid / spotlight / custom variants).
export const FLAT_BACKGROUND_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'gray', label: 'Gray' },
  { id: 'blue', label: 'Blue' },
  { id: 'whiteSpotlight', label: 'White Spotlight' },
  { id: 'lightBlueSpotlight', label: 'Light Blue Spotlight' },
  { id: 'lightOrangeSpotlight', label: 'Light Orange Spotlight' },
  { id: 'customColor', label: 'Custom Color' },
  { id: 'customGradient', label: 'Custom Gradient Color' },
  { id: 'customSpotlight', label: 'Custom Spotlight Color' },
];

export const DEFAULT_FLAT_BACKGROUND_CUSTOM_COLOR = '#dce7f5';

// Native: _BuilderGenerationsAlignmentHint_* — how person boxes align within a
// generation band. We model the visible variants as a vertical offset/anchor.
export const BOX_ALIGNMENTS = [
  { id: 'centered', label: 'Centered' },
  { id: 'centeredUniform', label: 'Centered, Uniform Height' },
  { id: 'baseline', label: 'Aligned to Baseline of Name' },
  { id: 'leading', label: 'Leading Edge' },
  { id: 'leadingUniform', label: 'Leading Edge, Uniform Height' },
];
