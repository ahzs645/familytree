import React from 'react';

/**
 * ChartEmptyState — the standard placeholder every chart renders when it has
 * no subject to draw (e.g. no proband selected). Centralizes the padding and
 * muted-text styling that was repeated across the chart components.
 */
export function ChartEmptyState({ theme, children = 'No person selected.' }) {
  // Text color follows the active chart theme (not the app theme), so it
  // stays inline.
  return <div className="p-6" style={{ color: theme.textMuted }}>{children}</div>;
}

export default ChartEmptyState;
