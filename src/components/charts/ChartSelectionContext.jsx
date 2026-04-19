/**
 * Context that lets PersonNode open a person in the charts side panel
 * without every chart component threading an extra prop.
 *
 * Single-click on a person still calls the chart's own onPersonClick
 * (which re-roots the tree). Double-click dispatches to openPerson here.
 */
import React, { createContext, useContext } from 'react';

const ChartSelectionContext = createContext({ openPerson: null });

export function ChartSelectionProvider({ openPerson, children }) {
  return (
    <ChartSelectionContext.Provider value={{ openPerson }}>
      {children}
    </ChartSelectionContext.Provider>
  );
}

export function useChartSelection() {
  return useContext(ChartSelectionContext);
}
