import {
  BOTTOM_PLANE_MODES,
  CAMERA_MODES,
  GENERATION_BAND_STYLES,
  LIGHTING_MODES,
  PERSON_STYLES,
  APPEARANCE_MODES,
  VIEWER_OPTIONS_STORAGE_KEY,
  VIEWER_OPTIONS_VERSION,
} from './constants.js';

export function defaultViewerOptions() {
  return {
    version: VIEWER_OPTIONS_VERSION,
    appearanceMode: 'macLight',
    personStyle: 'simplified',
    cameraMode: 'top',
    lightingMode: 'normal',
    bottomPlaneMode: 'grid',
    generationBandStyle: 'raised',
  };
}

export function readInitialViewerOptions() {
  const fallback = defaultViewerOptions();
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VIEWER_OPTIONS_STORAGE_KEY) || 'null');
    if (parsed?.version !== VIEWER_OPTIONS_VERSION) return fallback;
    return {
      version: VIEWER_OPTIONS_VERSION,
      appearanceMode: APPEARANCE_MODES.some((option) => option.id === parsed?.appearanceMode) ? parsed.appearanceMode : fallback.appearanceMode,
      personStyle: PERSON_STYLES.some((option) => option.id === parsed?.personStyle) ? parsed.personStyle : fallback.personStyle,
      cameraMode: CAMERA_MODES.some((option) => option.id === parsed?.cameraMode) ? parsed.cameraMode : fallback.cameraMode,
      lightingMode: LIGHTING_MODES.some((option) => option.id === parsed?.lightingMode) ? parsed.lightingMode : fallback.lightingMode,
      bottomPlaneMode: BOTTOM_PLANE_MODES.some((option) => option.id === parsed?.bottomPlaneMode) ? parsed.bottomPlaneMode : fallback.bottomPlaneMode,
      generationBandStyle: GENERATION_BAND_STYLES.some((option) => option.id === parsed?.generationBandStyle) ? parsed.generationBandStyle : fallback.generationBandStyle,
    };
  } catch {
    return fallback;
  }
}
