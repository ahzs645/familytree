/**
 * FanChart — radial ancestor chart. Each generation is a ring of slices.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutFan } from './layouts/fanLayout.js';

const PADDING = 40;
// Approximate width of one character in SVG px, per 1px of font size. Works for
// the mixed Arabic/Latin label set the tree uses; enough to prevent overflow.
const CHAR_WIDTH_RATIO = 0.55;
const MIN_FONT_SIZE = 6;

function fitFontSize(name, availableWidth, maxSize) {
  if (!name) return maxSize;
  const ideal = availableWidth / (name.length * CHAR_WIDTH_RATIO);
  return Math.max(MIN_FONT_SIZE, Math.min(maxSize, ideal));
}

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (d.year) {
    const parts = [d.day, d.month, d.year].filter(Boolean);
    return parts.join('.');
  }
  return '';
}

function personSubtext(person, gen) {
  if (!person) return [];
  const lines = [];
  const birth = formatDate(person.birthDate || person.birth);
  if (birth) lines.push(`Birth ${birth}`);
  if (gen <= 2 && person.birthPlace) lines.push(String(person.birthPlace).slice(0, 34));
  return lines;
}

export function FanChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, arcDegrees, page, overlays, onOverlaysChange, chartCanvasRef, ...overlayProps }) {
  const { slices, totalRadius, size, probandRadius } = useMemo(
    () => layoutFan(tree, generations, { arcDegrees }),
    [tree, generations, arcDegrees]
  );
  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;

  const cx = size / 2;
  const cy = size / 2;

  return (
    <ChartCanvas
      ref={chartCanvasRef}
      theme={theme}
      page={page}
      overlays={overlays}
      onOverlaysChange={onOverlaysChange}
      {...overlayProps}
    >
      <g transform={`translate(${PADDING},${PADDING})`}>
        <g transform={`translate(${cx},${cy})`}>
          {slices.map((s, i) => {
            if (s.proband) {
              const colors = theme.gender[s.person?.gender ?? 0] || theme.gender[0];
              const sub = personSubtext(s.person, 0);
              const fullName = s.person?.fullName || 'No name recorded';
              const nameSize = fitFontSize(fullName, probandRadius * 1.75, 14);
              return (
                <g key={'p' + i} style={{ cursor: onPersonClick && s.person ? 'pointer' : 'default' }} onClick={() => onPersonClick && s.person && onPersonClick(s.person)}>
                  <circle r={probandRadius} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
                  <text textAnchor="middle" dy={-8} fill={theme.text} fontSize={nameSize} fontWeight={600} fontFamily={theme.fontFamily}>
                    {fullName}
                  </text>
                  {sub.map((line, li) => (
                    <text
                      key={li}
                      textAnchor="middle"
                      dy={10 + li * 12}
                      fill={theme.textMuted}
                      fontSize={fitFontSize(line, probandRadius * 1.85, 10)}
                      fontFamily={theme.fontFamily}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            }
            const colors = theme.gender[s.person?.gender ?? 0] || theme.gender[0];
            const fill = s.placeholder ? theme.placeholderFill : colors.fill;
            const stroke = s.placeholder ? theme.placeholderStroke : colors.stroke;
            const maxFontByGen = s.gen <= 1 ? 14 : s.gen <= 2 ? 12 : s.gen <= 3 ? 11 : 10;
            // Inner rings: text follows the arc via textPath.
            // Outer rings (gen >= 3): wedges are too narrow — render text radially.
            const useArc = s.gen <= 2;
            const pathId = `fan-arc-${s.gen}-${s.slot}`;
            const label = s.person?.fullName || '';
            const arcSpan = Math.abs(s.a1 - s.a0);
            // Available width for label: along the arc for curved text, along the
            // ring radial span minus a small margin for radial text.
            const availableWidth = useArc
              ? s.midRadius * arcSpan - 8
              : 80 - 8;
            const fontSize = fitFontSize(label, availableWidth, maxFontByGen);
            return (
              <g
                key={i}
                style={{ cursor: onPersonClick && s.person ? 'pointer' : 'default' }}
                onClick={() => onPersonClick && s.person && onPersonClick(s.person)}
              >
                <path
                  d={s.path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray={s.placeholder ? '3 2' : 'none'}
                />
                {useArc ? (
                  <>
                    <defs>
                      <path id={pathId} d={s.textArcPath} />
                    </defs>
                    <text fill={theme.text} fontSize={fontSize} fontFamily={theme.fontFamily}>
                      <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                        {label}
                      </textPath>
                    </text>
                  </>
                ) : (
                  (() => {
                    const tx = Math.cos(s.midAngle) * s.midRadius;
                    const ty = Math.sin(s.midAngle) * s.midRadius;
                    const deg = (s.midAngle * 180) / Math.PI;
                    // Radial text: rotate so it reads outward along the radius.
                    const rotation = Math.sin(s.midAngle) < 0 ? deg + 90 : deg - 90;
                    return (
                      <g transform={`translate(${tx},${ty}) rotate(${rotation})`}>
                        <text textAnchor="middle" dy={4} fill={theme.text} fontSize={fontSize} fontFamily={theme.fontFamily}>
                          {label}
                        </text>
                      </g>
                    );
                  })()
                )}
              </g>
            );
          })}
        </g>
      </g>
    </ChartCanvas>
  );
}

export default FanChart;
