/**
 * Classic-UI bridge — embeds the legacy minified bundle in an iframe so the
 * original editors stay reachable while we rebuild them natively. Same
 * IndexedDB; the legacy bundle reads/writes the same data.
 */
import React from 'react';

export default function Classic() {
  return (
    <div style={shell}>
      <header style={header}>
        <strong style={{ fontSize: 13, color: '#e2e4eb' }}>Classic UI</strong>
        <span style={{ marginLeft: 12, color: '#8b90a0', fontSize: 12 }}>
          Original CloudTreeWeb editors. Reads and writes the same browser database — changes appear in the new views too.
        </span>
        <a
          href="/classic.html"
          target="_blank"
          rel="noopener"
          style={{ marginLeft: 'auto', color: '#6c8aff', fontSize: 12, textDecoration: 'none' }}
        >
          Open in new tab ↗
        </a>
      </header>
      <iframe
        src="/classic.html"
        title="CloudTreeWeb Classic UI"
        style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
      />
    </div>
  );
}

const shell = { display: 'flex', flexDirection: 'column', height: '100%' };
const header = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 20px',
  borderBottom: '1px solid #2e3345',
  background: '#161926',
};
