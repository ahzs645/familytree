import React, { useState } from 'react';

export default function DonutChart({ data, colors }) {
  const [hoveredOrigin, setHoveredOrigin] = useState(null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '20px' }}>
      <div style={{ 
        width: '160px', height: '160px', position: 'relative', flexShrink: 0
      }}>
        <svg viewBox="0 0 42 42" width="100%" height="100%" style={{ transform: 'rotate(-90deg)', overflow: 'visible', filter: 'drop-shadow(0 4px 10px var(--shadow))' }}>
          <circle cx="21" cy="21" r="15.915494309189533" fill="transparent" stroke="var(--card-border)" strokeWidth="6" />
          {data.map(o => (
            <circle
              key={o.origin}
              cx="21" cy="21" r="15.915494309189533"
              fill="transparent"
              stroke={colors[o.origin] || colors.generic}
              strokeWidth={hoveredOrigin === o.origin ? "8" : "6"}
              strokeDasharray={`${o.exactPct} ${100 - o.exactPct}`}
              strokeDashoffset={-o.offset}
              style={{ transition: 'stroke-width 0.2s, stroke 0.2s', cursor: 'pointer', outline: 'none' }}
              onMouseEnter={() => setHoveredOrigin(o.origin)}
              onMouseLeave={() => setHoveredOrigin(null)}
            />
          ))}
        </svg>
        
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center' }}>
          {hoveredOrigin ? (
            <>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 10px', lineHeight: 1.2, marginBottom: '2px' }}>
                {data.find(o => o.origin === hoveredOrigin)?.label}
              </span>
              <strong style={{ fontSize: '1.4rem', color: 'var(--ink)', lineHeight: 1 }}>
                {data.find(o => o.origin === hoveredOrigin)?.percentage}%
              </strong>
            </>
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--ink-light)', fontStyle: 'italic', padding: '0 15px' }}>Hover to view</span>
          )}
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.map(o => (
          <div 
            key={o.origin} 
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '1rem', color: 'var(--ink)', cursor: 'pointer', opacity: hoveredOrigin && hoveredOrigin !== o.origin ? 0.3 : 1, transition: 'opacity 0.2s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: colors[o.origin] || colors.generic, transition: 'transform 0.2s', transform: hoveredOrigin === o.origin ? 'scale(1.2)' : 'scale(1)' }}></div>
              <strong style={{ transition: 'color 0.2s', color: hoveredOrigin === o.origin ? 'var(--accent)' : 'inherit' }}>{o.label}</strong>
            </div>
            <span>{o.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}