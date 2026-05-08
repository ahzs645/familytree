/**
 * Footer toolbar of the charts page — find box plus action buttons
 * (size-to-fit, focus, save, share, theme, chart options, style, export).
 *
 * Stateless; every action is wired to a callback. The "active" prop is
 * used to indicate whether the corresponding panel is currently open.
 */
import React from 'react';
import { FileDown, Focus, Palette, Search, Settings2, Share2, SlidersHorizontal, Users, ZoomIn } from 'lucide-react';
import { chartToolbarStyle, optionSelect } from './styles.js';

export function ChartBottomToolbar({
  personBrowserOpen,
  onTogglePersonBrowser,
  onFocus,
  findText,
  onFindTextChange,
  onFind,
  onSave,
  onShare,
  onExport,
  onTheme,
  onChart,
  onStyle,
  chartOptionsOpen,
}) {
  const buttons = [
    { label: 'Size to Fit', icon: ZoomIn, onClick: onFocus },
    { label: 'Focus', icon: Focus, onClick: onFocus },
    { label: 'Save Chart', icon: FileDown, onClick: onSave },
    { label: 'Share', icon: Share2, onClick: onShare },
    { label: 'Edit', icon: Settings2, onClick: onTogglePersonBrowser, active: personBrowserOpen },
    { label: 'Theme', icon: Palette, onClick: onTheme },
    { label: 'Chart', icon: SlidersHorizontal, onClick: onChart, active: chartOptionsOpen },
    { label: 'Style', icon: Users, onClick: onStyle },
  ];
  return (
    <footer style={chartToolbarStyle}>
      {buttons.slice(0, 2).map((button) => <ChartToolButton key={button.label} {...button} />)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 220 }}>
        <Search size={14} />
        <input value={findText} onChange={(event) => onFindTextChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onFind()} placeholder="Find" style={{ ...optionSelect, height: 30 }} />
        <button type="button" onClick={onFind} style={{ ...optionSelect, width: 'auto', height: 30 }}>Find</button>
      </div>
      {buttons.slice(2).map((button) => <ChartToolButton key={button.label} {...button} />)}
      <button type="button" onClick={onExport} style={{ ...optionSelect, width: 'auto', marginInlineStart: 'auto' }}>Export PNG</button>
    </footer>
  );
}

function ChartToolButton({ label, icon: Icon, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...optionSelect,
        width: 'auto',
        minHeight: 30,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: active ? 'hsl(var(--accent))' : optionSelect.background,
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
