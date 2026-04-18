/**
 * Views — desktop-style entry point for non-native visual modes.
 */
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils.js';

const TABS = [
  { to: '/views/virtual-map', label: 'Virtual Map', aliases: ['/map'] },
  { to: '/views/virtual-globe', label: 'Virtual Globe', aliases: ['/globe'] },
  { to: '/views/statistic-maps', label: 'Statistic Maps', aliases: ['/maps-diagram', '/statistic-maps'] },
  { to: '/views/media-gallery', label: 'Media Gallery', aliases: ['/media'] },
  { to: '/views/family-quiz', label: 'Family Quiz', aliases: ['/quiz'] },
];

export default function Views() {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="border-b border-border bg-card px-5 pt-3">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-base font-semibold">Views</h1>
            <p className="text-xs text-muted-foreground">Map, globe, statistic, media, and quiz workflows.</p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto" aria-label="Views">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

