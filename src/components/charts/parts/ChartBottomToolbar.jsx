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
import { Button } from '../../ui/Button.jsx';
import { Input } from '../../ui/Input.jsx';
import { cn } from '../../../lib/utils.js';

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
    <footer className="relative flex items-center gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2 text-card-foreground">
      <ChartToolButton label="Focus" icon={Focus} onClick={onFocus} />
      <ChartToolButton label="Save" icon={FileDown} onClick={onSave} />
      <ChartToolButton label="Share" icon={Share2} onClick={onShare} />
      <div className="flex min-w-0 flex-[1_1_220px] items-center gap-1.5">
        <Search size={14} />
        <Input
          compact
          value={findText}
          onChange={(event) => onFindTextChange(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && onFind()}
          placeholder="Find"
          className="h-[30px] min-w-0 flex-1"
        />
        <Button onClick={onFind} className="h-[30px]">Find</Button>
      </div>
      <ChartToolButton label="People" icon={Settings2} onClick={onTogglePersonBrowser} active={personBrowserOpen} />
      <ChartToolButton label="Options" icon={SlidersHorizontal} onClick={onChart} active={chartOptionsOpen} />
      <Button onClick={onExport} className="ms-auto">
        Export
      </Button>
    </footer>
  );
}

// Buttons collapse to icon-only at narrow widths so the row never spills off
// the screen on phones. The `aria-label` keeps the action readable to AT.
function ChartToolButton({ label, icon: Icon, onClick, active }) {
  return (
    <Button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('min-h-[30px]', active && 'bg-accent')}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
