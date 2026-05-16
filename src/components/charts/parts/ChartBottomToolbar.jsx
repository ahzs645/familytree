/**
 * Footer toolbar of the charts page — find box plus action buttons
 * (focus, save, share, people browser, chart options, export).
 *
 * Stateless; every action is wired to a callback. The "active" prop is
 * used to indicate whether the corresponding panel is currently open.
 *
 * Earlier versions had Size-to-Fit + Focus (same handler) and three buttons
 * — Theme / Chart / Style — that all opened the same options panel with
 * different default tabs. They were folded into a single Options button to
 * stop the toolbar overflowing on phones; the panel itself still exposes
 * the underlying tab strip.
 */
import React from 'react';
import { FileDown, Focus, Search, Settings2, Share2, SlidersHorizontal } from 'lucide-react';
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
  onChart,
  chartOptionsOpen,
}) {
  return (
    <footer style={chartToolbarStyle}>
      <ChartToolButton label="Focus" icon={Focus} onClick={onFocus} />
      <ChartToolButton label="Save" icon={FileDown} onClick={onSave} />
      <ChartToolButton label="Share" icon={Share2} onClick={onShare} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 220px' }}>
        <Search size={14} />
        <input
          value={findText}
          onChange={(event) => onFindTextChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onFind()}
          placeholder="Find"
          style={{ ...optionSelect, height: 30, minWidth: 0, flex: 1 }}
        />
        <button type="button" onClick={onFind} style={{ ...optionSelect, width: 'auto', height: 30 }}>Find</button>
      </div>
      <ChartToolButton label="People" icon={Settings2} onClick={onTogglePersonBrowser} active={personBrowserOpen} />
      <ChartToolButton label="Options" icon={SlidersHorizontal} onClick={onChart} active={chartOptionsOpen} />
      <button
        type="button"
        onClick={onExport}
        style={{ ...optionSelect, width: 'auto', marginInlineStart: 'auto', whiteSpace: 'nowrap' }}
      >
        Export
      </button>
    </footer>
  );
}

// Buttons collapse to icon-only at narrow widths so the row never spills off
// the screen on phones. The `aria-label` keeps the action readable to AT.
function ChartToolButton({ label, icon: Icon, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        ...optionSelect,
        width: 'auto',
        minHeight: 30,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: active ? 'hsl(var(--accent))' : optionSelect.background,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
