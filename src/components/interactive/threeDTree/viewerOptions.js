import {
  APPEARANCE_MODES,
  BOTTOM_PLANE_MODES,
  CAMERA_MODES,
  CHILD_SORTING_MODES,
  CONNECTION_COLOR_MODES,
  GENERATION_BAND_COLOR_MODES,
  GENERATION_BAND_STYLES,
  LEGACY_CAMERA_MODE_MAP,
  LIGHTING_MODES,
  MAX_ANCESTOR_GENERATIONS,
  MAX_DESCENDANT_GENERATIONS,
  MIN_GENERATIONS,
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

    // Person Information (label content)
    displayBirthDate: true,
    displayDeathDate: true,
    displayKinships: false,
    displayLabels: true,
    displayPersonGroups: false,
    displayNotesIcon: false,
    displayMediaIcon: false,
    highlightLivingPersons: false,
    personColoringMode: 'byGender',
    childSortingMode: 'byBirthAsc',

    // Connections
    connectionThickness: 1.0,
    connectionColorMode: 'byGenerationLight',
    connectionCustomColor: '#7b5af6',

    // Generation Bands — defaults match the Mac Flat viewer aesthetic
    generationBandStyle: 'raised',
    generationBandColorMode: 'macPink',
    generationBandOpacity: 0.62,
    generationBandsFullWidth: true,

    // Camera
    cameraMode: 'topDown',

    // Lighting
    lightingMode: 'normal',
    illuminationStrength: 1.0,
    shadowStrength: 1.0,

    // Ground
    bottomPlaneMode: 'grid',

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

  return {
    version: VIEWER_OPTIONS_VERSION,
    appearanceMode: pickFrom(APPEARANCE_MODES, parsed.appearanceMode, fallback.appearanceMode),
    personStyle: pickFrom(PERSON_STYLES, parsed.personStyle, fallback.personStyle),
    personImageStyle: pickFrom(PERSON_IMAGE_STYLES, parsed.personImageStyle, fallback.personImageStyle),

    ancestorGenerations: clampInt(parsed.ancestorGenerations, MIN_GENERATIONS, MAX_ANCESTOR_GENERATIONS, fallback.ancestorGenerations),
    descendantGenerations: clampInt(parsed.descendantGenerations, MIN_GENERATIONS, MAX_DESCENDANT_GENERATIONS, fallback.descendantGenerations),

    displayBirthDate: pickBool(parsed.displayBirthDate, fallback.displayBirthDate),
    displayDeathDate: pickBool(parsed.displayDeathDate, fallback.displayDeathDate),
    displayKinships: pickBool(parsed.displayKinships, fallback.displayKinships),
    displayLabels: pickBool(parsed.displayLabels, fallback.displayLabels),
    displayPersonGroups: pickBool(parsed.displayPersonGroups, fallback.displayPersonGroups),
    displayNotesIcon: pickBool(parsed.displayNotesIcon, fallback.displayNotesIcon),
    displayMediaIcon: pickBool(parsed.displayMediaIcon, fallback.displayMediaIcon),
    highlightLivingPersons: pickBool(parsed.highlightLivingPersons, fallback.highlightLivingPersons),
    personColoringMode: pickFrom(PERSON_COLORING_MODES, parsed.personColoringMode, fallback.personColoringMode),
    childSortingMode: pickFrom(CHILD_SORTING_MODES, parsed.childSortingMode, fallback.childSortingMode),

    connectionThickness: clampNumber(parsed.connectionThickness, 0.4, 2.5, fallback.connectionThickness),
    connectionColorMode: pickFrom(CONNECTION_COLOR_MODES, parsed.connectionColorMode, fallback.connectionColorMode),
    connectionCustomColor: pickHex(parsed.connectionCustomColor, fallback.connectionCustomColor),

    generationBandStyle: pickFrom(GENERATION_BAND_STYLES, parsed.generationBandStyle, fallback.generationBandStyle),
    generationBandColorMode: pickFrom(GENERATION_BAND_COLOR_MODES, parsed.generationBandColorMode, fallback.generationBandColorMode),
    generationBandOpacity: clampNumber(parsed.generationBandOpacity, 0, 1, fallback.generationBandOpacity),
    generationBandsFullWidth: pickBool(parsed.generationBandsFullWidth, fallback.generationBandsFullWidth),

    cameraMode: pickFrom(CAMERA_MODES, migratedCameraMode, fallback.cameraMode),

    lightingMode: pickFrom(LIGHTING_MODES, parsed.lightingMode, fallback.lightingMode),
    illuminationStrength: clampNumber(parsed.illuminationStrength, 0.2, 2.0, fallback.illuminationStrength),
    shadowStrength: clampNumber(parsed.shadowStrength, 0, 2.0, fallback.shadowStrength),

    bottomPlaneMode: pickFrom(BOTTOM_PLANE_MODES, parsed.bottomPlaneMode, fallback.bottomPlaneMode),

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
