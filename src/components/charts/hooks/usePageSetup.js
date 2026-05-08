/**
 * State container for everything that lives on the chart's "page":
 * title and note, paper size and orientation, the user-chosen background
 * (which falls back to the theme's), and the print margins / cut-marks
 * / page-number settings managed by the PageSetupSheet.
 *
 * Also tracks whether either of the related sheets is open, since those
 * booleans logically belong with this group rather than with chart layout.
 */
import { useState } from 'react';

const DEFAULT_MARGINS = { top: 36, right: 36, bottom: 36, left: 36 };

export function usePageSetup() {
  const [chartTitle, setChartTitle] = useState('');
  const [chartNote, setChartNote] = useState('');
  const [pageSize, setPageSize] = useState('letter');
  const [pageOrientation, setPageOrientation] = useState('landscape');
  const [chartBackground, setChartBackground] = useState('');
  const [backgroundSheetOpen, setBackgroundSheetOpen] = useState(false);
  const [pageSetupSheetOpen, setPageSetupSheetOpen] = useState(false);
  const [pageMargins, setPageMargins] = useState(DEFAULT_MARGINS);
  const [pagePrintMargins, setPagePrintMargins] = useState(DEFAULT_MARGINS);
  const [pageOverlap, setPageOverlap] = useState(0);
  const [pageCutMarks, setPageCutMarks] = useState(false);
  const [pagePrintPageNumbers, setPagePrintPageNumbers] = useState(false);
  const [pageOmitEmptyPages, setPageOmitEmptyPages] = useState(true);

  return {
    chartTitle,
    setChartTitle,
    chartNote,
    setChartNote,
    pageSize,
    setPageSize,
    pageOrientation,
    setPageOrientation,
    chartBackground,
    setChartBackground,
    backgroundSheetOpen,
    setBackgroundSheetOpen,
    pageSetupSheetOpen,
    setPageSetupSheetOpen,
    pageMargins,
    setPageMargins,
    pagePrintMargins,
    setPagePrintMargins,
    pageOverlap,
    setPageOverlap,
    pageCutMarks,
    setPageCutMarks,
    pagePrintPageNumbers,
    setPagePrintPageNumbers,
    pageOmitEmptyPages,
    setPageOmitEmptyPages,
  };
}
