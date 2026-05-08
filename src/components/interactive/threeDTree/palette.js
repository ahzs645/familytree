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
        female: '#ff9ab5',
        femaleDeep: '#b94b6c',
        unknown: '#e4d7b3',
        unknownDeep: '#8f7f59',
        ancestorLine: '#b49a54',
        descendantLine: '#d04fa4',
        partnerLine: '#9b8a69',
        bandText: '#f4f6fa',
      }
    : {
        background: '#fbfbfa',
        grid: '#edf0f1',
        gridStrong: '#dce2e5',
        text: '#1d1f24',
        muted: '#717985',
        shadow: '#a4a8ad',
        ambient: '#ffffff',
        keyLight: '#fff7de',
        fillLight: '#dceaff',
        male: '#79b7ff',
        maleDeep: '#3779d7',
        female: '#ffa2bd',
        femaleDeep: '#d56984',
        unknown: '#f3e8c7',
        unknownDeep: '#b9a36d',
        ancestorLine: '#aa8236',
        descendantLine: '#c93d94',
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
