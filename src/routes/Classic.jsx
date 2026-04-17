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
        <strong style={{ fontSize: 13, color: 'hsl(var(--foreground))' }}>Classic UI</strong>
        <span style={{ marginLeft: 12, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
          Original CloudTreeWeb editors. Reads and writes the same browser database — changes appear in the new views too.
        </span>
        <a
          href="/classic.html"
          target="_blank"
          rel="noopener"
          style={{ marginLeft: 'auto', color: 'hsl(var(--primary))', fontSize: 12, textDecoration: 'none' }}
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
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card))',
};
