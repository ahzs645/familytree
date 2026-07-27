/**
 * Theming/coloring state for the chart canvas: the chart theme, the aesthetic
 * coloring mode, the research-completeness overlay mode (plus its loaded
 * per-person rows), the chart content toggles (portraits/lifespan/IDs), and
 * the loaded portrait map.
 *
 * The `colorForPerson` resolver stays in ChartsApp because it also needs the
 * generation index derived from the loaded trees.
 */
import { useState } from 'react';
import { DEFAULT_CHART_CONTENT } from '../ChartContentContext.jsx';

export function useChartTheming() {
  const [themeId, setThemeId] = useState('auto');
  const [completenessColorMode, setCompletenessColorMode] = useState('gender');
  const [completenessRowsByPerson, setCompletenessRowsByPerson] = useState(new Map());
  const [coloringMode, setColoringMode] = useState('gender');
  const [chartContent, setChartContent] = useState(DEFAULT_CHART_CONTENT);
  const [chartPhotos, setChartPhotos] = useState(null);

  return {
    themeId, setThemeId,
    completenessColorMode, setCompletenessColorMode,
    completenessRowsByPerson, setCompletenessRowsByPerson,
    coloringMode, setColoringMode,
    chartContent, setChartContent,
    chartPhotos, setChartPhotos,
  };
}
