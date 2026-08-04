/**
 * Footer toolbar of the charts page — action buttons for focus, save, share,
 * the people browser, chart options, and export.
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
import { FileDown, Focus, Settings2, Share2, SlidersHorizontal } from 'lucide-react';
import { Button } from '../../ui/Button.jsx';
import { cn } from '../../../lib/utils.js';
import { useTranslation } from '../../../contexts/LocalizationContext.jsx';

export function ChartBottomToolbar({
  personBrowserOpen,
  onTogglePersonBrowser,
  onFocus,
  onSave,
  onShare,
  onExport,
  onChart,
  chartOptionsOpen,
}) {
  const { t } = useTranslation();
  return (
    <footer className="relative flex items-center gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2 text-card-foreground">
      <ChartToolButton label={t('charts.focus', { defaultValue: 'Focus' })} icon={Focus} onClick={onFocus} />
      <ChartToolButton label={t('common.save', { defaultValue: 'Save' })} icon={FileDown} onClick={onSave} />
      <ChartToolButton label={t('charts.share', { defaultValue: 'Share' })} icon={Share2} onClick={onShare} />
      <ChartToolButton label={t('charts.browsePeople', { defaultValue: 'Browse people' })} icon={Settings2} onClick={onTogglePersonBrowser} active={personBrowserOpen} />
      <ChartToolButton label={t('charts.options', { defaultValue: 'Options' })} icon={SlidersHorizontal} onClick={onChart} active={chartOptionsOpen} />
      <Button onClick={onExport} className="ms-auto">
        {t('charts.tab.export', { defaultValue: 'Export' })}
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
