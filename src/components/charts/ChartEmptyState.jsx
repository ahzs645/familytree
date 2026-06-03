import React from 'react';

/**
 * ChartEmptyState — the standard placeholder every chart renders when it has
 * no subject to draw (e.g. no proband selected). Centralizes the padding and
 * muted-text styling that was repeated across the chart components.
 */
export function ChartEmptyState({ theme, children = 'No person selected.' }) {
  return <div style={{ padding: 24, color: theme.textMuted }}>{children}</div>;
}

export default ChartEmptyState;
