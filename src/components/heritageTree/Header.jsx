/**
 * Heritage Tree toolbar.
 *
 * Uses the app's header pattern (bg-card surface, bordered base, semibold
 * title over a muted summary line) and the shared Button primitive, so the
 * page reads as part of the app rather than a standalone display piece. The
 * canvas below keeps its own themeable look — see heritageTree.css.
 */
import React, { useRef } from 'react';
import { ChartColumn, House, LocateFixed, Minus, Plus, Printer, RotateCw, Search, Upload } from 'lucide-react';
import Tooltip from './Tooltip.jsx';
import { exportTreeToPdf } from './exportTree.js';
import BdiText from '../BdiText.jsx';
import { Button } from '../ui/Button.jsx';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';

const THEME_KEYS = ['app', 'classic', 'ink', 'ocean', 'forest', 'monochrome'];

const ICON_BUTTON = 'h-9 w-9';
const SELECT = 'h-9 rounded-md border border-border bg-secondary text-foreground text-sm outline-none cursor-pointer hover:bg-accent focus:border-primary';

function Separator() {
  return <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />;
}

export default function Header({
  maxGen,
  rootName,
  searchTerm,
  setSearchTerm,
  filteredIndividuals,
  rootId,
  setSelectedRootId,
  theme,
  setTheme,
  handleFileUpload,
  setShowAnalytics,
  view,
  setView,
  handleRecenter,
  handleResetToDatasetDefault,
  handleHardReset,
  headerRef,
}) {
  const fileInputRef = useRef(null);
  const { t } = useTranslation();

  return (
    <header
      ref={headerRef}
      className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card px-3 py-2 md:px-5"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold leading-tight">{t('heritageTree.title')}</h2>
        <p className="truncate text-xs text-muted-foreground">
          {rootName
            ? <>{t('heritageTree.subtitleForRoot', { count: maxGen })} <BdiText>{rootName}</BdiText></>
            : t('heritageTree.subtitle', { count: maxGen })}
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <Tooltip text={t('heritageTree.tooltips.search')}>
          <div className="flex min-h-9 items-center gap-1 rounded-md border border-border bg-secondary ps-2">
            <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              className="w-20 bg-transparent py-1.5 text-sm outline-none transition-[width] placeholder:text-muted-foreground focus:w-32"
              placeholder={t('heritageTree.searchPlaceholder')}
              title={t('heritageTree.searchTitle')}
              aria-label={t('heritageTree.searchAria')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredIndividuals.length > 0) {
                  setSelectedRootId(filteredIndividuals[0].id);
                  setSearchTerm('');
                  e.target.blur(); // Drops focus so the dropdown hides
                }
              }}
            />
            <div className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
            <select
              value={searchTerm ? 'search_prompt' : (rootId || '')}
              aria-label={t('heritageTree.selectRootAria')}
              onChange={(e) => {
                if (e.target.value !== 'search_prompt') {
                  setSelectedRootId(e.target.value);
                  setSearchTerm('');
                }
              }}
              className="max-w-[9rem] cursor-pointer truncate bg-transparent py-1.5 ps-1 text-sm outline-none"
            >
              {searchTerm && filteredIndividuals.length > 0 && <option value="search_prompt" disabled>{t('heritageTree.searchResults', { count: filteredIndividuals.length })}</option>}
              {filteredIndividuals.length === 0 && <option value="search_prompt" disabled>{t('heritageTree.noResults')}</option>}
              {filteredIndividuals.map((ind) => (
                <option key={ind.id} value={ind.id}>{ind.name}</option>
              ))}
            </select>
          </div>
        </Tooltip>

        <Tooltip text={t('heritageTree.tooltips.theme')}>
          <select
            value={theme}
            aria-label={t('heritageTree.themeAria')}
            onChange={(e) => setTheme(e.target.value)}
            className={`${SELECT} ps-2.5`}
          >
            {THEME_KEYS.map((key) => (
              <option key={key} value={key}>{t(`heritageTree.themes.${key}`)}</option>
            ))}
          </select>
        </Tooltip>

        {handleFileUpload && (
          <>
            <input type="file" accept=".ged" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <Tooltip text={t('heritageTree.tooltips.upload')}>
              <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.uploadAria')} onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} />
              </Button>
            </Tooltip>
          </>
        )}

        <Tooltip text={t('heritageTree.tooltips.exportPdf')}>
          <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.exportPdfAria')} onClick={() => exportTreeToPdf()}>
            <Printer size={16} />
          </Button>
        </Tooltip>
        <Tooltip text={t('heritageTree.tooltips.analytics')}>
          <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.analyticsAria')} onClick={() => setShowAnalytics(true)}>
            <ChartColumn size={16} />
          </Button>
        </Tooltip>

        <Separator />

        <Tooltip text={t('heritageTree.tooltips.zoomOut')}>
          <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.zoomOutAria')} onClick={() => setView((prev) => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.12) }))}>
            <Minus size={16} />
          </Button>
        </Tooltip>
        <span className="min-w-[2.75rem] text-center text-xs tabular-nums text-muted-foreground">{Math.round(view.scale * 100)}%</span>
        <Tooltip text={t('heritageTree.tooltips.zoomIn')}>
          <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.zoomInAria')} onClick={() => setView((prev) => ({ ...prev, scale: Math.min(2, prev.scale + 0.12) }))}>
            <Plus size={16} />
          </Button>
        </Tooltip>

        <Separator />

        <Tooltip text={t('heritageTree.tooltips.recenter')}>
          <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.recenterAria')} onClick={handleRecenter}>
            <LocateFixed size={16} />
          </Button>
        </Tooltip>
        <Tooltip text={t('heritageTree.tooltips.resetRoot')}>
          <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.resetRootAria')} onClick={handleResetToDatasetDefault}>
            <House size={16} />
          </Button>
        </Tooltip>
        <Tooltip text={t('heritageTree.tooltips.reload')}>
          <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.reloadAria')} onClick={handleHardReset}>
            <RotateCw size={16} />
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}
