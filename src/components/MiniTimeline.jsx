/**
 * MiniTimeline — compact horizontal life-events timeline for one person.
 * Plots dated events as vertical ticks across a span derived from the
 * earliest and latest events. Hover a tick to see its label.
 */
import React, { useMemo } from 'react';

function yearOf(s) {
  const m = String(s || '').match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

const KIND_COLOR = {
  Birth: 'rgb(74 222 128)',
  Death: 'rgb(248 113 113)',
  Marriage: 'rgb(244 114 182)',
  Burial: 'rgb(156 163 175)',
};

export function MiniTimeline({ events = [], height = 56 }) {
  const points = useMemo(() => events
    .map((e) => ({
      label: e.label || e.fields?.conclusionType?.value || e.fields?.eventType?.value || 'Event',
      year: yearOf(e.year ?? e.fields?.date?.value ?? e.date),
      raw: e.year ?? e.fields?.date?.value ?? e.date,
    }))
    .filter((p) => p.year != null)
    .sort((a, b) => a.year - b.year), [events]);

  if (points.length === 0) {
    return <div className="text-xs text-muted-foreground italic">No dated events to plot.</div>;
  }

  const min = points[0].year;
  const max = points[points.length - 1].year;
  const span = Math.max(1, max - min);
  // Pad either side so end ticks aren't flush against the edges.
  const pad = Math.max(2, Math.round(span * 0.05));
  const start = min - pad;
  const end = max + pad;
  const range = end - start;

  return (
    <div className="w-full" style={{ height }}>
      <div className="relative w-full" style={{ height: height - 18 }}>
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
        {points.map((p, i) => {
          const x = ((p.year - start) / range) * 100;
          const color = KIND_COLOR[p.label] || 'hsl(var(--primary))';
          return (
            <div
              key={i}
              title={`${p.label} · ${p.raw || p.year}`}
              className="absolute top-1/2 -translate-y-1/2 w-1 h-3 rounded-sm"
              style={{ left: `calc(${x}% - 2px)`, background: color }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
        <span>{start}</span>
        <span>{end}</span>
      </div>
    </div>
  );
}

export default MiniTimeline;
