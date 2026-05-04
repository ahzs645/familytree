import React from 'react';
import { originLabels } from './constants.js';

export default function Legend({ nodes }) {
  // Find all unique origins present in the current dataset
  const presentOrigins = new Set();
  nodes?.forEach(node => {
    if (node.origin === 'dual') {
      presentOrigins.add('polish'); // 'dual' identity uses the Polish flag design
    } else if (node.origin) {
      presentOrigins.add(node.origin);
    }
  });

  const uniqueOrigins = Array.from(presentOrigins).sort();

  return (
    <div className="legend">
      <h2>Legend</h2>
      <div className="legend-row"><div className="legend-line descent"></div><span>Descent</span></div>
      <div className="legend-row"><div className="legend-line marriage"></div><span>Marriage / Union</span></div>
      
      {uniqueOrigins.length > 0 && (
        <>
          <div style={{ marginTop: '8px', borderTop: '1px solid var(--card-border)', paddingTop: '7px', fontSize: '.72rem', color: 'var(--ink-light)', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 600 }}>
            Geographic Origin
          </div>
          {uniqueOrigins.map(origin => (
            <div className="legend-row" key={origin}>
              <span className={`origin-tag origin-${origin}`} style={{ margin: 0 }}>
                {originLabels[origin] || origin}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
