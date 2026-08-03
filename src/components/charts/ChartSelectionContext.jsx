/**
 * Context that lets PersonNode open a person in the charts side panel
 * without every chart component threading an extra prop.
 *
 * Single-click on a person still calls the chart's own onPersonClick
 * (which re-roots the tree). Double-click dispatches to openPerson here.
 */
import React, { createContext, useContext } from 'react';

const ChartSelectionContext = createContext({
  openPerson: null,
  selectedObject: null,
  selectObject: null,
  objectStyles: {},
  connectionStyles: {},
});

export function ChartSelectionProvider({
  openPerson,
  selectedObject,
  selectObject,
  objectStyles = {},
  connectionStyles = {},
  children,
}) {
  return (
    <ChartSelectionContext.Provider value={{
      openPerson,
      selectedObject,
      selectObject,
      objectStyles,
      connectionStyles,
    }}>
      {children}
    </ChartSelectionContext.Provider>
  );
}

export function useChartSelection() {
  return useContext(ChartSelectionContext);
}
