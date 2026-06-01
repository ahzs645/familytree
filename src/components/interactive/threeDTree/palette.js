export function makePalette(dark, lightingMode = 'normal') {
  const base = dark
    ? {
        background: '#10131a',
        grid: '#303848',
        gridStrong: '#46536a',
        text: '#f4f6fa',
        muted: '#9aa5b5',
        shadow: '#05070b',
        ambient: '#dfe7ff',
        keyLight: '#fff2d8',
        fillLight: '#bad5ff',
        male: '#6aa7ff',
        maleDeep: '#285fbc',
        female: '#e3a464',
        femaleDeep: '#b97c3a',
        unknown: '#aeb6c0',
        unknownDeep: '#79828f',
        ancestorLine: '#b49a54',
        descendantLine: '#d04fa4',
        partnerLine: '#9b8a69',
        bandText: '#f4f6fa',
      }
    : {
        background: '#fbfbf7',
        grid: '#ecefed',
        gridStrong: '#dce2e1',
        text: '#1d1f24',
        muted: '#717985',
        shadow: '#8d929a',
        ambient: '#ffffff',
        keyLight: '#fff7de',
        fillLight: '#dceaff',
        male: '#79b7ff',
        maleDeep: '#3779d7',
        // Female bodies are warm tan/peach in the source's simplified style
        // (per the reference close-up), not pink.
        female: '#e7a86a',
        femaleDeep: '#c4823f',
        unknown: '#cdd3da',
        unknownDeep: '#8d97a4',
        ancestorLine: '#b4a13b',
        descendantLine: '#d62b92',
        partnerLine: '#9c8a64',
        bandText: '#33353a',
      };
  if (lightingMode === 'flat') {
    return { ...base, ambient: '#ffffff', keyLight: '#ffffff', fillLight: '#ffffff' };
  }
  if (lightingMode === 'sunset') {
    return { ...base, keyLight: '#ffb25d', fillLight: '#d36a9f', ambient: dark ? '#ffd2b8' : '#fff0dc' };
  }
  if (lightingMode === 'blue') {
    return { ...base, keyLight: '#d8e8ff', fillLight: '#8fbfff', ambient: dark ? '#dbe9ff' : '#ffffff' };
  }
  if (lightingMode === 'green') {
    return { ...base, keyLight: '#e2ffd7', fillLight: '#9adfbd', ambient: dark ? '#e6ffe4' : '#ffffff' };
  }
  if (lightingMode === 'violet') {
    return { ...base, keyLight: '#f1deff', fillLight: '#c8a1ff', ambient: dark ? '#f2e2ff' : '#ffffff' };
  }
  return base;
}
