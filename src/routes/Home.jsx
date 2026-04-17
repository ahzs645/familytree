/**
 * Home route — import card + live tree stats + shortcut cards to each section.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportDropZone } from '../components/ImportDropZone.jsx';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';

const SECTIONS = [
  { to: '/tree', title: 'Interactive Tree', body: 'Alphabetical person list with live search, plus parents / partners / children for the focused person.' },
  { to: '/charts', title: 'Charts', body: 'Ancestor, descendant, hourglass, tree, fan, double-ancestor, relationship-path, and configurable virtual-tree views.' },
  { to: '/search', title: 'Search', body: 'Multi-criteria filters across persons, families, places, sources, events — plus smart scopes like "childless persons" or "born in the 19th century".' },
  { to: '/duplicates', title: 'Find Duplicates', body: 'Scan for duplicate persons, families, or sources and merge them side-by-side with per-field choices.' },
  { to: '/reports', title: 'Reports', body: 'Person summaries, ancestor / descendant narratives, family group sheets. Save, paginate, export to PDF, HTML, RTF, CSV, or text.' },
  { to: '/books', title: 'Books', body: 'Compose multi-section books with custom titles, a TOC, and any number of report sections.' },
];

export function Home() {
  const navigate = useNavigate();
  const { hasData, summary, clear } = useDatabaseStatus();

  return (
    <div style={container}>
      <section style={{ marginBottom: 28 }}>
        <h1 style={h1}>Your family tree, in the browser</h1>
        <p style={lead}>
          Import a MacFamilyTree <code>.mftpkg</code> once, then explore it through every view without another round-trip.
          Everything runs locally — no account, no upload, no sync.
        </p>
      </section>

      <section style={{ marginBottom: 28 }}>
        <ImportDropZone onImported={() => { window.location.hash = ''; navigate('/tree'); }} />
      </section>

      {hasData && summary && (
        <section style={summaryCard}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#8b90a0' }}>Loaded</div>
            <div style={{ fontSize: 22, color: '#e2e4eb', fontWeight: 700 }}>
              {summary.total.toLocaleString()} records
            </div>
            <div style={{ fontSize: 12, color: '#8b90a0', marginTop: 6 }}>
              {summary.types.Person || 0} persons · {summary.types.Family || 0} families ·{' '}
              {summary.types.PersonEvent || 0} events · {summary.types.Place || 0} places ·{' '}
              {summary.types.Source || 0} sources
            </div>
          </div>
          <button onClick={async () => { if (confirm('Clear all local data?')) await clear(); }} style={clearBtn}>
            Clear data
          </button>
        </section>
      )}

      <section>
        <h2 style={h2}>Sections</h2>
        <div style={grid}>
          {SECTIONS.map((s) => (
            <div
              key={s.to}
              style={card}
              onClick={() => navigate(s.to)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#3a4054')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2e3345')}
            >
              <div style={cardTitle}>{s.title} <span style={chevron}>→</span></div>
              <div style={cardBody}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const container = { maxWidth: 960, margin: '0 auto', padding: '32px 24px 60px', overflow: 'auto', height: '100%' };
const h1 = { fontSize: 28, margin: '0 0 10px', color: '#e2e4eb', fontWeight: 700 };
const h2 = { fontSize: 15, margin: '0 0 14px', color: '#8b90a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 };
const lead = { fontSize: 15, color: '#8b90a0', lineHeight: 1.6, margin: 0 };
const summaryCard = {
  marginBottom: 28,
  padding: 18,
  borderRadius: 12,
  background: '#13161f',
  border: '1px solid #2e3345',
  display: 'flex',
  alignItems: 'center',
  gap: 20,
};
const clearBtn = {
  background: 'transparent',
  color: '#f87171',
  border: '1px solid #2e3345',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 12,
  cursor: 'pointer',
};
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 };
const card = {
  border: '1px solid #2e3345',
  borderRadius: 12,
  padding: 18,
  background: '#13161f',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};
const cardTitle = { fontSize: 15, fontWeight: 600, color: '#e2e4eb', marginBottom: 6, display: 'flex', justifyContent: 'space-between' };
const cardBody = { fontSize: 13, color: '#8b90a0', lineHeight: 1.55 };
const chevron = { color: '#6c8aff' };

export default Home;
