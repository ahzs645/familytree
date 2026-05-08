/**
 * State container for the export sheet (PNG/JPG/PDF).
 *
 * The values are persisted with the chart document, so consumers also need
 * to read them out for the dirty-tracking effect in ChartsApp.
 */
import { useState } from 'react';

export function useExportSettings() {
  const [exportFormat, setExportFormat] = useState('png');
  const [exportScale, setExportScale] = useState(1);
  const [exportIncludeBackground, setExportIncludeBackground] = useState(true);
  const [exportJpegQuality, setExportJpegQuality] = useState(0.92);
  const [exportFileNameTemplate, setExportFileNameTemplate] = useState('{title}-{date}');

  return {
    exportFormat,
    setExportFormat,
    exportScale,
    setExportScale,
    exportIncludeBackground,
    setExportIncludeBackground,
    exportJpegQuality,
    setExportJpegQuality,
    exportFileNameTemplate,
    setExportFileNameTemplate,
  };
}
