/**
 * Heritage split as a donut. Rendered inside the analytics dialog, so it uses
 * the app's surface/text tokens; only the slice colours come from the origin
 * palette, where the colour is the data.
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils.js';

export default function DonutChart({ data, colors }) {
  const [hoveredOrigin, setHoveredOrigin] = useState(null);
  const hovered = hoveredOrigin ? data.find((o) => o.origin === hoveredOrigin) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
      <div className="relative h-40 w-40 flex-shrink-0">
        <svg viewBox="0 0 42 42" width="100%" height="100%" className="-rotate-90 overflow-visible">
          <circle cx="21" cy="21" r="15.915494309189533" fill="transparent" stroke="hsl(var(--border))" strokeWidth="6" />
          {data.map((o) => (
            <circle
              key={o.origin}
              cx="21" cy="21" r="15.915494309189533"
              fill="transparent"
              stroke={colors[o.origin] || colors.generic}
              strokeWidth={hoveredOrigin === o.origin ? '8' : '6'}
              strokeDasharray={`${o.exactPct} ${100 - o.exactPct}`}
              strokeDashoffset={-o.offset}
              className="cursor-pointer outline-none transition-[stroke-width]"
              onMouseEnter={() => setHoveredOrigin(o.origin)}
              onMouseLeave={() => setHoveredOrigin(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          {hovered ? (
            <>
              <span className="mb-0.5 text-[0.65rem] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
                {hovered.label}
              </span>
              <strong className="text-2xl leading-none">{hovered.percentage}%</strong>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Hover to view</span>
          )}
        </div>
      </div>

      <div className="flex min-w-[12rem] flex-1 flex-col gap-2.5">
        {data.map((o) => (
          <div
            key={o.origin}
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 transition-opacity',
              hoveredOrigin && hoveredOrigin !== o.origin && 'opacity-30',
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={cn('h-4 w-4 flex-shrink-0 rounded transition-transform', hoveredOrigin === o.origin && 'scale-125')}
                style={{ background: colors[o.origin] || colors.generic }}
              />
              <strong className={cn('truncate font-medium', hoveredOrigin === o.origin && 'text-interactive')}>{o.label}</strong>
            </div>
            <span className="text-muted-foreground">{o.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
