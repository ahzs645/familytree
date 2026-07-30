/**
 * Heritage Tree toolbar.
 *
 * Uses the app's header pattern (bg-card surface, bordered base, semibold
 * title over a muted summary line) and the shared Button primitive, so the
 * page reads as part of the app rather than a standalone display piece. The
 * canvas below keeps its own themeable look — see heritageTree.css.
 *
 * On a phone the secondary actions collapse into an overflow sheet, the same
 * `<details>` pattern the Persons toolbar uses. Laid out flat, the controls
 * wrapped onto three rows and ate a third of the screen.
 */
import React, { useRef } from 'react';
import { ChartColumn, Ellipsis, House, LocateFixed, Minus, Plus, Printer, RotateCw, Upload } from 'lucide-react';
import Tooltip from './Tooltip.jsx';
import { exportTreeToPdf } from './exportTree.js';
import BdiText from '../BdiText.jsx';
import { Button } from '../ui/Button.jsx';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { useIsMobile } from '../../lib/useIsMobile.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { PageTitle } from '../ui/PageTitle.jsx';

const THEME_KEYS = ['app', 'classic', 'ink', 'ocean', 'forest', 'monochrome'];

const ICON_BUTTON = 'h-9 w-9';
const SELECT = 'h-9 rounded-md border border-border bg-secondary text-foreground text-sm outline-none cursor-pointer hover:bg-accent focus:border-primary';
const MENU_ITEM = 'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-start text-sm hover:bg-accent';

/**
 * Related controls travel together. The toolbar wraps rather than scrolls (a
 * scrolling strip hid four of its controls on a phone), so without this the
 * break can land between − and +.
 */
function Group({ children }) {
  return <div className="flex items-center gap-1.5">{children}</div>;
}

export default function Header({
  maxGen,
  rootName,
  individuals,
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
  const overflowRef = useRef(null);
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const zoomOut = () => setView((prev) => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.12) }));
  const zoomIn = () => setView((prev) => ({ ...prev, scale: Math.min(2, prev.scale + 0.12) }));
  // <details> stays open after a click, so an action would leave the sheet
  // covering the result it just produced.
  const closeOverflow = () => { if (overflowRef.current) overflowRef.current.open = false; };
  const run = (action) => () => { closeOverflow(); action(); };

  const personPicker = (
    <PersonPicker
      persons={individuals}
      value={rootId || ''}
      onChange={setSelectedRootId}
      triggerClassName="h-9"
      note={(person) => (person.disconnected ? t('heritageTree.notConnected') : null)}
    />
  );

  const themeSelect = (
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
  );

  const zoomControls = (
    <Group>
      <Tooltip text={t('heritageTree.tooltips.zoomOut')}>
        <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.zoomOutAria')} onClick={zoomOut}>
          <Minus size={16} />
        </Button>
      </Tooltip>
      <span className="min-w-[2.75rem] text-center text-xs tabular-nums text-muted-foreground">{Math.round(view.scale * 100)}%</span>
      <Tooltip text={t('heritageTree.tooltips.zoomIn')}>
        <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.zoomInAria')} onClick={zoomIn}>
          <Plus size={16} />
        </Button>
      </Tooltip>
    </Group>
  );

  const uploadControl = handleFileUpload ? (
    <>
      <input type="file" accept=".ged" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      <Tooltip text={t('heritageTree.tooltips.upload')}>
        <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.uploadAria')} onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} />
        </Button>
      </Tooltip>
    </>
  ) : null;

  return (
    <header
      ref={headerRef}
      className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card px-3 py-2 md:px-5"
    >
      <div className="min-w-0 flex-1">
        <PageTitle className="text-base font-semibold leading-tight">{t('heritageTree.title')}</PageTitle>
        <p className="truncate text-xs text-muted-foreground">
          {rootName
            ? <>{t('heritageTree.subtitleForRoot', { count: maxGen })} <BdiText>{rootName}</BdiText></>
            : t('heritageTree.subtitle', { count: maxGen })}
        </p>
      </div>

      {isMobile ? (
        <div className="flex w-full min-w-0 items-center gap-1.5">
          <div className="min-w-0 flex-1">{personPicker}</div>
          <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.recenterAria')} onClick={handleRecenter}>
            <LocateFixed size={16} />
          </Button>
          <details ref={overflowRef} className="relative">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-secondary text-foreground hover:bg-accent [&::-webkit-details-marker]:hidden"
              aria-label={t('heritageTree.moreActions')}
            >
              <Ellipsis size={18} />
            </summary>
            <div className="absolute end-0 top-full z-40 mt-2 w-[min(17rem,calc(100vw-1.5rem))] rounded-md border border-border bg-card p-2 shadow-xl">
              <div className="px-2 pb-2">
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor="heritage-theme">
                  {t('heritageTree.themeAria')}
                </label>
                <select
                  id="heritage-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className={`${SELECT} w-full ps-2.5`}
                >
                  {THEME_KEYS.map((key) => (
                    <option key={key} value={key}>{t(`heritageTree.themes.${key}`)}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2">
                <span className="text-xs text-muted-foreground">{t('heritageTree.zoomLabel')}</span>
                <div className="flex items-center gap-1.5">
                  <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.zoomOutAria')} onClick={zoomOut}>
                    <Minus size={16} />
                  </Button>
                  <span className="min-w-[2.75rem] text-center text-xs tabular-nums text-muted-foreground">{Math.round(view.scale * 100)}%</span>
                  <Button size="icon" className={ICON_BUTTON} aria-label={t('heritageTree.zoomInAria')} onClick={zoomIn}>
                    <Plus size={16} />
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-1">
                {handleFileUpload && (
                  <>
                    <input type="file" accept=".ged" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                    <button type="button" className={MENU_ITEM} onClick={run(() => fileInputRef.current?.click())}>
                      <Upload size={16} className="shrink-0 text-muted-foreground" />
                      {t('heritageTree.tooltips.upload')}
                    </button>
                  </>
                )}
                <button type="button" className={MENU_ITEM} onClick={run(() => exportTreeToPdf())}>
                  <Printer size={16} className="shrink-0 text-muted-foreground" />
                  {t('heritageTree.tooltips.exportPdf')}
                </button>
                <button type="button" className={MENU_ITEM} onClick={run(() => setShowAnalytics(true))}>
                  <ChartColumn size={16} className="shrink-0 text-muted-foreground" />
                  {t('heritageTree.tooltips.analytics')}
                </button>
                <button type="button" className={MENU_ITEM} onClick={run(handleResetToDatasetDefault)}>
                  <House size={16} className="shrink-0 text-muted-foreground" />
                  {t('heritageTree.tooltips.resetRoot')}
                </button>
                <button type="button" className={MENU_ITEM} onClick={run(handleHardReset)}>
                  <RotateCw size={16} className="shrink-0 text-muted-foreground" />
                  {t('heritageTree.tooltips.reload')}
                </button>
              </div>
            </div>
          </details>
        </div>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="w-[min(16rem,40vw)]">{personPicker}</div>
          {themeSelect}

          <Group>
            {uploadControl}
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
          </Group>

          {zoomControls}

          <Group>
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
          </Group>
        </div>
      )}
    </header>
  );
}
