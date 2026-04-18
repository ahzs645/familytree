/**
 * FanChart — radial ancestor chart. Each generation is a ring of slices.
 */
import React, { useMemo } from 'react';
import { ChartCanvas } from './ChartCanvas.jsx';
import { DEFAULT_THEME } from './theme.js';
import { layoutFan } from './layouts/fanLayout.js';

const PADDING = 40;

function fitText(name, gen) {
  if (!name) return '';
  // Smaller rings get less room — truncate aggressively.
  const max = gen <= 1 ? 18 : gen <= 3 ? 14 : gen <= 4 ? 10 : 7;
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

export function FanChart({ tree, generations = 5, onPersonClick, theme = DEFAULT_THEME, arcDegrees, page }) {
  const { slices, totalRadius, size, probandRadius } = useMemo(
    () => layoutFan(tree, generations, { arcDegrees }),
    [tree, generations, arcDegrees]
  );
  if (!tree) return <div style={{ padding: 24, color: theme.textMuted }}>No person selected.</div>;

  const cx = size / 2;
  const cy = size / 2;

  return (
    <ChartCanvas theme={theme} page={page}>
      <g transform={`translate(${PADDING},${PADDING})`}>
        <g transform={`translate(${cx},${cy})`}>
          {slices.map((s, i) => {
            if (s.proband) {
              const colors = theme.gender[s.person?.gender ?? 0] || theme.gender[0];
              return (
                <g key={'p' + i} style={{ cursor: onPersonClick && s.person ? 'pointer' : 'default' }} onClick={() => onPersonClick && s.person && onPersonClick(s.person)}>
                  <circle r={probandRadius} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.5} />
                  <text textAnchor="middle" dy={-2} fill={theme.text} fontSize={13} fontWeight={600} fontFamily={theme.fontFamily}>
                    {fitText(s.person?.fullName || 'No name recorded', 0)}
                  </text>
                </g>
              );
            }
            const colors = theme.gender[s.person?.gender ?? 0] || theme.gender[0];
            const fill = s.placeholder ? theme.placeholderFill : colors.fill;
            const stroke = s.placeholder ? theme.placeholderStroke : colors.stroke;
            const tx = Math.cos(s.midAngle) * s.midRadius;
            const ty = Math.sin(s.midAngle) * s.midRadius;
            // Rotate text along the arc; flip when on the bottom half so it stays readable.
            let textAngleDeg = (s.midAngle * 180) / Math.PI;
            const flip = textAngleDeg > 90 || textAngleDeg < -90;
            const rotation = flip ? textAngleDeg + 180 : textAngleDeg;
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
                <g transform={`translate(${tx},${ty}) rotate(${rotation})`}>
                  <text
                    textAnchor="middle"
                    dy={4}
                    fill={theme.text}
                    fontSize={s.gen <= 2 ? 11 : 9}
                    fontFamily={theme.fontFamily}
                  >
                    {fitText(s.person?.fullName || '', s.gen)}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </g>
    </ChartCanvas>
  );
}

export default FanChart;
