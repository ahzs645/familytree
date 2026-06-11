import {
  APPEARANCE_MODES,
  BOTTOM_PLANE_MODES,
  BOX_ALIGNMENTS,
  CAMERA_MODES,
  CHILD_SORTING_MODES,
  CONNECTION_COLOR_MODES,
  ORDINANCES_MODES,
  DEFAULT_GENERATION_BAND_CUSTOM_COLOR,
  DEFAULT_GROUND_CUSTOM_COLOR,
  DEFAULT_PERSON_CUSTOM_COLOR,
  GENERATION_BAND_COLOR_MODES,
  GENERATION_BAND_STYLES,
  GENERATION_DIRECTIONS,
  GROUND_COLOR_MODES,
  LEGACY_CAMERA_MODE_MAP,
  LIGHTING_MODES,
  MAX_ANCESTOR_GENERATIONS,
  MAX_DESCENDANT_GENERATIONS,
  MAX_MINIFICATION_START,
  MAX_SIBLING_GENERATIONS,
  MIN_GENERATIONS,
  NUMBERING_SYSTEMS,
  PERSON_COLORING_MODES,
  PERSON_IMAGE_STYLES,
  PERSON_STYLES,
  VIEWER_OPTIONS_STORAGE_KEY,
  VIEWER_OPTIONS_VERSION,
} from './constants.js';

export function defaultViewerOptions() {
  return {
    version: VIEWER_OPTIONS_VERSION,
    appearanceMode: 'macLight',

    // General
    personStyle: 'simplified',
    personImageStyle: 'round',

    // Generations (drives layout traversal depth)
    ancestorGenerations: 4,
    descendantGenerations: 6,

    // Layout & spacing (multipliers; 1.0 = native default look)
    generationDirection: 'topToBottom',
    boxAlignment: 'centered',
    adjustParentPositions: true,
    parentsChildrenSpacing: 1.0,
    partnerSpacing: 1.0,
    branchSpacing: 1.0,
    siblingGenerations: 4,
    ancestorScaleStartLevel: 0,
    descendantScaleStartLevel: 0,
    siblingMinification: 0,
    otherSiblingMinification: 0,
    personWidth: 1.0,
    personSaturation: 1.0,

    // Person Information (label content)
    displayBirthDate: true,
    displayDeathDate: true,
    displayKinships: false,
    displayLabels: true,
    displayPersonGroups: false,
    displayNotesIcon: false,
    displayMediaIcon: false,
    displayFurtherPersonsIndicators: true,
    displayInfluentialIcon: false,
    displayFamilySearchIcons: true,
    displayNumberingSystem: false,
    numberingSystem: 'ahnentafel',
    displayEventDescription: false,
    ordinancesMode: 'none',
    highlightLivingPersons: false,
    personColoringMode: 'byGender',
    personCustomColor: DEFAULT_PERSON_CUSTOM_COLOR,
    desaturatePartnerAncestors: false,
    childSortingMode: 'byBirthAsc',
    fontSize: 1.0,

    // Connections
    connectionThickness: 1.0,
    connectionColorMode: 'byGenerationLight',
    connectionCustomColor: '#7b5af6',

    // Generation Bands — defaults match the Mac Flat viewer aesthetic
    generationBandStyle: 'raised',
    generationBandColorMode: 'macPink',
    generationBandCustomColor: DEFAULT_GENERATION_BAND_CUSTOM_COLOR,
    generationBandOpacity: 0.62,
    generationBandsFullWidth: true,
    generationBandsShowBirthDates: true,
    generationBandsShowGenerations: true,
    generationBandsSegmentByPedigree: true,
    keepLabelsVisible: false,

    // Camera — the native default is mode 1, "Top Down, slightly tilted"
    // (orthographic, pitch -63°). The tilt is what makes figures read as
    // standing busts and foreshortens the generation bands like the Mac view.
    cameraMode: 'topDownSlight',

    // Lighting
    lightingMode: 'normal',
    illuminationStrength: 1.0,
    shadowStrength: 1.0,
    shadowRadius: 1.0,
    shadowDistance: 18,
    shadowAngle: 315,

    // Ground
    bottomPlaneMode: 'grid',
    groundColorMode: 'auto',
    groundCustomColor: DEFAULT_GROUND_CUSTOM_COLOR,

    // Animations
    animationDuration: 1.0,

    // Selection behavior
    liftPersonsOnMouseOver: true,
    enlargeNameBadgesOnMouseOver: true,
    autoSelectInsertedObjects: true,
    scrollSelectedToVisible: true,
  };
}

export function readInitialViewerOptions() {
  const fallback = defaultViewerOptions();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(VIEWER_OPTIONS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return migrateAndValidate(parsed, fallback);
  } catch {
    return fallback;
  }
}

function migrateAndValidate(parsed, fallback) {
  // Migrate legacy camera mode ids.
  const migratedCameraMode = LEGACY_CAMERA_MODE_MAP[parsed.cameraMode] || parsed.cameraMode;

  // One-time reset (pre-v5 stores) of the look-defining options to the
  // source-matching defaults, so users who had explored e.g. the multi-colour
  // "By Generation" bands or a different camera land on the MacFamilyTree pink
  // top-down look without having to hunt through Options.
  const resetLook = (Number(parsed.version) || 0) < 5;

  // v6: the camera default moved from the flat 'topDown' to the native
  // 'topDownSlight' (-63° tilt). Stores that still sit on the old default get
  // moved once; an explicitly chosen non-default mode is left alone.
  const resetCamera = (Number(parsed.version) || 0) < 6 && migratedCameraMode === 'topDown';

  return {
    version: VIEWER_OPTIONS_VERSION,
    appearanceMode: pickFrom(APPEARANCE_MODES, parsed.appearanceMode, fallback.appearanceMode),
    personStyle: pickFrom(PERSON_STYLES, parsed.personStyle, fallback.personStyle),
    personImageStyle: pickFrom(PERSON_IMAGE_STYLES, parsed.personImageStyle, fallback.personImageStyle),

    ancestorGenerations: clampInt(parsed.ancestorGenerations, MIN_GENERATIONS, MAX_ANCESTOR_GENERATIONS, fallback.ancestorGenerations),
    descendantGenerations: clampInt(parsed.descendantGenerations, MIN_GENERATIONS, MAX_DESCENDANT_GENERATIONS, fallback.descendantGenerations),

    generationDirection: pickFrom(GENERATION_DIRECTIONS, parsed.generationDirection, fallback.generationDirection),
    boxAlignment: pickFrom(BOX_ALIGNMENTS, parsed.boxAlignment, fallback.boxAlignment),
    adjustParentPositions: pickBool(parsed.adjustParentPositions, fallback.adjustParentPositions),
    parentsChildrenSpacing: clampNumber(parsed.parentsChildrenSpacing, 0.6, 1.8, fallback.parentsChildrenSpacing),
    partnerSpacing: clampNumber(parsed.partnerSpacing, 0.6, 1.8, fallback.partnerSpacing),
    branchSpacing: clampNumber(parsed.branchSpacing, 0.6, 1.8, fallback.branchSpacing),
    siblingGenerations: clampInt(parsed.siblingGenerations, 0, MAX_SIBLING_GENERATIONS, fallback.siblingGenerations),
    ancestorScaleStartLevel: clampInt(parsed.ancestorScaleStartLevel, 0, MAX_MINIFICATION_START, fallback.ancestorScaleStartLevel),
    descendantScaleStartLevel: clampInt(parsed.descendantScaleStartLevel, 0, MAX_MINIFICATION_START, fallback.descendantScaleStartLevel),
    siblingMinification: clampNumber(parsed.siblingMinification, 0, 0.8, fallback.siblingMinification),
    otherSiblingMinification: clampNumber(parsed.otherSiblingMinification, 0, 0.8, fallback.otherSiblingMinification),
    personWidth: clampNumber(parsed.personWidth, 0.6, 1.6, fallback.personWidth),
    personSaturation: clampNumber(parsed.personSaturation, 0, 1.5, fallback.personSaturation),

    displayBirthDate: pickBool(parsed.displayBirthDate, fallback.displayBirthDate),
    displayDeathDate: pickBool(parsed.displayDeathDate, fallback.displayDeathDate),
    displayKinships: pickBool(parsed.displayKinships, fallback.displayKinships),
    displayLabels: pickBool(parsed.displayLabels, fallback.displayLabels),
    displayPersonGroups: pickBool(parsed.displayPersonGroups, fallback.displayPersonGroups),
    displayNotesIcon: pickBool(parsed.displayNotesIcon, fallback.displayNotesIcon),
    displayMediaIcon: pickBool(parsed.displayMediaIcon, fallback.displayMediaIcon),
    displayFurtherPersonsIndicators: pickBool(parsed.displayFurtherPersonsIndicators, fallback.displayFurtherPersonsIndicators),
    displayInfluentialIcon: pickBool(parsed.displayInfluentialIcon, fallback.displayInfluentialIcon),
    displayFamilySearchIcons: pickBool(parsed.displayFamilySearchIcons, fallback.displayFamilySearchIcons),
    displayNumberingSystem: pickBool(parsed.displayNumberingSystem, fallback.displayNumberingSystem),
    numberingSystem: pickFrom(NUMBERING_SYSTEMS, parsed.numberingSystem, fallback.numberingSystem),
    displayEventDescription: pickBool(parsed.displayEventDescription, fallback.displayEventDescription),
    ordinancesMode: pickFrom(ORDINANCES_MODES, parsed.ordinancesMode, fallback.ordinancesMode),
    highlightLivingPersons: pickBool(parsed.highlightLivingPersons, fallback.highlightLivingPersons),
    personColoringMode: pickFrom(PERSON_COLORING_MODES, parsed.personColoringMode, fallback.personColoringMode),
    personCustomColor: pickHex(parsed.personCustomColor, fallback.personCustomColor),
    desaturatePartnerAncestors: pickBool(parsed.desaturatePartnerAncestors, fallback.desaturatePartnerAncestors),
    childSortingMode: pickFrom(CHILD_SORTING_MODES, parsed.childSortingMode, fallback.childSortingMode),
    fontSize: clampNumber(parsed.fontSize, 0.7, 1.5, fallback.fontSize),

    connectionThickness: clampNumber(parsed.connectionThickness, 0.4, 2.5, fallback.connectionThickness),
    connectionColorMode: pickFrom(CONNECTION_COLOR_MODES, parsed.connectionColorMode, fallback.connectionColorMode),
    connectionCustomColor: pickHex(parsed.connectionCustomColor, fallback.connectionCustomColor),

    generationBandStyle: resetLook ? fallback.generationBandStyle : pickFrom(GENERATION_BAND_STYLES, parsed.generationBandStyle, fallback.generationBandStyle),
    generationBandColorMode: resetLook ? fallback.generationBandColorMode : pickFrom(GENERATION_BAND_COLOR_MODES, parsed.generationBandColorMode, fallback.generationBandColorMode),
    generationBandCustomColor: pickHex(parsed.generationBandCustomColor, fallback.generationBandCustomColor),
    generationBandOpacity: clampNumber(parsed.generationBandOpacity, 0, 1, fallback.generationBandOpacity),
    generationBandsFullWidth: pickBool(parsed.generationBandsFullWidth, fallback.generationBandsFullWidth),
    generationBandsShowBirthDates: pickBool(parsed.generationBandsShowBirthDates, fallback.generationBandsShowBirthDates),
    generationBandsShowGenerations: pickBool(parsed.generationBandsShowGenerations, fallback.generationBandsShowGenerations),
    generationBandsSegmentByPedigree: pickBool(parsed.generationBandsSegmentByPedigree, fallback.generationBandsSegmentByPedigree),
    keepLabelsVisible: pickBool(parsed.keepLabelsVisible, fallback.keepLabelsVisible),

    cameraMode: (resetLook || resetCamera) ? fallback.cameraMode : pickFrom(CAMERA_MODES, migratedCameraMode, fallback.cameraMode),

    lightingMode: pickFrom(LIGHTING_MODES, parsed.lightingMode, fallback.lightingMode),
    illuminationStrength: clampNumber(parsed.illuminationStrength, 0.2, 2.0, fallback.illuminationStrength),
    shadowStrength: clampNumber(parsed.shadowStrength, 0, 2.0, fallback.shadowStrength),
    shadowRadius: clampNumber(parsed.shadowRadius, 0, 4.0, fallback.shadowRadius),
    shadowDistance: clampNumber(parsed.shadowDistance, 0, 40, fallback.shadowDistance),
    shadowAngle: clampNumber(parsed.shadowAngle, 0, 360, fallback.shadowAngle),

    bottomPlaneMode: pickFrom(BOTTOM_PLANE_MODES, parsed.bottomPlaneMode, fallback.bottomPlaneMode),
    groundColorMode: pickFrom(GROUND_COLOR_MODES, parsed.groundColorMode, fallback.groundColorMode),
    groundCustomColor: pickHex(parsed.groundCustomColor, fallback.groundCustomColor),

    animationDuration: clampNumber(parsed.animationDuration, 0, 2.0, fallback.animationDuration),

    liftPersonsOnMouseOver: pickBool(parsed.liftPersonsOnMouseOver, fallback.liftPersonsOnMouseOver),
    enlargeNameBadgesOnMouseOver: pickBool(parsed.enlargeNameBadgesOnMouseOver, fallback.enlargeNameBadgesOnMouseOver),
    autoSelectInsertedObjects: pickBool(parsed.autoSelectInsertedObjects, fallback.autoSelectInsertedObjects),
    scrollSelectedToVisible: pickBool(parsed.scrollSelectedToVisible, fallback.scrollSelectedToVisible),
  };
}

function pickFrom(options, value, fallback) {
  return options.some((option) => option.id === value) ? value : fallback;
}

function pickBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function pickHex(value, fallback) {
  if (typeof value !== 'string') return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}
