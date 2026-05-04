import React, { useState } from 'react';

export default function SegmentedBarChart({ data, colors }) {
  const [hoveredOrigin, setHoveredOrigin] = useState(null);

  return (
    <div>
      <div style={{ display: 'flex', width: '100%', height: '20px', borderRadius: '10px', overflow: 'hidden', marginBottom: '15px', boxShadow: '0 2px 5px var(--shadow)' }}>
        {data.map(o => (
          <div 
            key={o.origin} 
            style={{ 
              width: `${o.exactPct}%`, 
              height: '100%', 
              background: colors[o.origin] || colors.generic,
              opacity: hoveredOrigin && hoveredOrigin !== o.origin ? 0.3 : 1,
              transition: 'opacity 0.2s',
              cursor: 'pointer'
            }}
            title={`${o.label}: ${o.percentage}%`}
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
          ></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
        {data.map(o => (
          <div 
            key={o.origin} 
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: 'var(--ink)', cursor: 'pointer', opacity: hoveredOrigin && hoveredOrigin !== o.origin ? 0.3 : 1, transition: 'opacity 0.2s' }}
          >
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: colors[o.origin] || colors.generic, transition: 'transform 0.2s', transform: hoveredOrigin === o.origin ? 'scale(1.2)' : 'scale(1)' }}></div>
            <strong style={{ transition: 'color 0.2s', color: hoveredOrigin === o.origin ? 'var(--accent)' : 'inherit' }}>{o.label}</strong>
            <span style={{ color: 'var(--ink-light)' }}>{o.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}