/**
 * AppShell — top nav + routed outlet. Shared chrome for every route.
 * Import status shows a red dot when no data is loaded.
 */
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/tree', label: 'Tree' },
  { to: '/charts', label: 'Charts' },
  { to: '/search', label: 'Search' },
  { to: '/duplicates', label: 'Duplicates' },
  { to: '/reports', label: 'Reports' },
  { to: '/books', label: 'Books' },
];

export function AppShell() {
  const { hasData, summary, loading } = useDatabaseStatus();

  return (
    <div style={shell}>
      <header style={nav}>
        <span style={brand}>CloudTreeWeb</span>
        <div style={links}>
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              style={({ isActive }) => ({
                ...linkStyle,
                color: isActive ? '#e2e4eb' : '#8b90a0',
                borderBottom: isActive ? '2px solid #6c8aff' : '2px solid transparent',
              })}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
        <div style={status}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: loading ? '#8b90a0' : hasData ? '#4ade80' : '#f87171',
              display: 'inline-block',
              marginRight: 8,
            }}
          />
          {loading ? 'Loading…' : hasData ? `${summary?.total || 0} records` : 'No data'}
        </div>
      </header>
      <main style={main}>
        <Outlet />
      </main>
    </div>
  );
}

const shell = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: '#0f1117',
  color: '#e2e4eb',
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
};
const nav = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '0 20px',
  height: 52,
  borderBottom: '1px solid #2e3345',
  background: '#13161f',
  flexShrink: 0,
};
const brand = { fontSize: 15, fontWeight: 700, color: '#e2e4eb', marginRight: 8 };
const links = { display: 'flex', gap: 4, flex: 1 };
const linkStyle = {
  padding: '14px 12px',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 600,
};
const status = { color: '#8b90a0', fontSize: 12, display: 'flex', alignItems: 'center' };
const main = { flex: 1, position: 'relative', overflow: 'hidden' };

export default AppShell;
