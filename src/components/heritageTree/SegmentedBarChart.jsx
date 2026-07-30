/**
 * Heritage split as a single stacked bar. Chrome uses the app tokens; only the
 * segment colours come from the origin palette, where the colour is the data.
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils.js';

export default function SegmentedBarChart({ data, colors }) {
  const [hoveredOrigin, setHoveredOrigin] = useState(null);

  return (
    <div>
      <div className="mb-3 flex h-5 w-full overflow-hidden rounded-full border border-border">
        {data.map((o) => (
          <div
            key={o.origin}
            className={cn('h-full cursor-pointer transition-opacity', hoveredOrigin && hoveredOrigin !== o.origin && 'opacity-30')}
            style={{ width: `${o.exactPct}%`, background: colors[o.origin] || colors.generic }}
            title={`${o.label}: ${o.percentage}%`}
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
          />
        ))}
      </div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))' }}>
        {data.map((o) => (
          <div
            key={o.origin}
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
            className={cn(
              'flex cursor-pointer items-center gap-2 transition-opacity',
              hoveredOrigin && hoveredOrigin !== o.origin && 'opacity-30',
            )}
          >
            <div
              className={cn('h-3 w-3 flex-shrink-0 rounded-sm transition-transform', hoveredOrigin === o.origin && 'scale-125')}
              style={{ background: colors[o.origin] || colors.generic }}
            />
            <strong className={cn('truncate font-medium', hoveredOrigin === o.origin && 'text-interactive')}>{o.label}</strong>
            <span className="ms-auto text-muted-foreground">{o.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
