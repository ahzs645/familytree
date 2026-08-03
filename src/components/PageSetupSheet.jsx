import React, { useEffect, useRef, useState } from 'react';
import { Sheet } from './ui/Sheet.jsx';
import { Button } from './ui/Button.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

/**
 * PageSetupSheet — modal that edits a pageSetup block
 * (paperSize, orientation, margins, overlap, omitEmptyPages, cutMarks,
 * printPageNumbers). Calls onApply(nextPageSetup) when confirmed.
 *
 * Mirrors MacFamilyTree's Print Settings pane plus the NSPrintInfo page
 * setup dialog. Designed to work with `pageLayout.js` helpers.
 */
export function PageSetupSheet({ pageSetup, exportSettings, onApply, onCancel, title }) {
  const { t } = useTranslation();
  const firstControlRef = useRef(null);
  const [draft, setDraft] = useState(() => ({
    paperSize: pageSetup?.paperSize || 'letter',
    orientation: pageSetup?.orientation || 'portrait',
    marginTop: pageSetup?.margins?.top ?? 36,
    marginRight: pageSetup?.margins?.right ?? 36,
    marginBottom: pageSetup?.margins?.bottom ?? 36,
    marginLeft: pageSetup?.margins?.left ?? 36,
    printMarginTop: pageSetup?.printMargins?.top ?? pageSetup?.margins?.top ?? 36,
    printMarginRight: pageSetup?.printMargins?.right ?? pageSetup?.margins?.right ?? 36,
    printMarginBottom: pageSetup?.printMargins?.bottom ?? pageSetup?.margins?.bottom ?? 36,
    printMarginLeft: pageSetup?.printMargins?.left ?? pageSetup?.margins?.left ?? 36,
    overlap: pageSetup?.overlap ?? 0,
    omitEmptyPages: pageSetup?.omitEmptyPages !== false,
    cutMarks: !!pageSetup?.cutMarks,
    printPageNumbers: !!pageSetup?.printPageNumbers,
    watermark: pageSetup?.watermark || '',
    backgroundColor: pageSetup?.backgroundColor || '',
    exportFormat: exportSettings?.format || 'png',
    exportScale: exportSettings?.scale ?? 1,
    exportJpegQuality: exportSettings?.jpegQuality ?? 0.92,
    exportIncludeBackground: exportSettings?.includeBackground !== false,
  }));

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    const previousFocus = document.activeElement;
    firstControlRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [onCancel]);

  const apply = () => {
    onApply({
      paperSize: draft.paperSize,
      orientation: draft.orientation,
      margins: {
        top: Number(draft.marginTop) || 0,
        right: Number(draft.marginRight) || 0,
        bottom: Number(draft.marginBottom) || 0,
        left: Number(draft.marginLeft) || 0,
      },
      printMargins: {
        top: Number(draft.printMarginTop) || 0,
        right: Number(draft.printMarginRight) || 0,
        bottom: Number(draft.printMarginBottom) || 0,
        left: Number(draft.printMarginLeft) || 0,
      },
      overlap: Number(draft.overlap) || 0,
      omitEmptyPages: !!draft.omitEmptyPages,
      cutMarks: !!draft.cutMarks,
      printPageNumbers: !!draft.printPageNumbers,
      watermark: draft.watermark || '',
      backgroundColor: draft.backgroundColor || '',
    }, {
      format: draft.exportFormat,
      scale: Number(draft.exportScale) || 1,
      jpegQuality: Number(draft.exportJpegQuality) || 0.92,
      includeBackground: !!draft.exportIncludeBackground,
    });
  };

  return (
    <Sheet
      title={title || t('charts.pageSetup.title')}
      ariaLabel={title || t('charts.pageSetup.title')}
      maxWidth="max-w-md"
      bodyClassName="p-4 space-y-3 text-xs"
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={apply}>{t('common.apply')}</Button>
        </>
      )}
    >
      <div className="grid grid-cols-2 gap-2">
            <label className="block">{t('charts.pageSetup.paperSize')}
              <select ref={firstControlRef} value={draft.paperSize} onChange={(e) => set('paperSize', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2">
                <option value="letter">{t('charts.pageSetup.paper.letter')}</option>
                <option value="legal">{t('charts.pageSetup.paper.legal')}</option>
                <option value="tabloid">{t('charts.pageSetup.paper.tabloid')}</option>
                <option value="a3">{t('charts.pageSetup.paper.a3')}</option>
                <option value="a4">{t('charts.pageSetup.paper.a4')}</option>
                <option value="a5">{t('charts.pageSetup.paper.a5')}</option>
              </select>
            </label>
            <label className="block">{t('charts.pageSetup.orientation')}
              <select value={draft.orientation} onChange={(e) => set('orientation', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2">
                <option value="portrait">{t('charts.pageSetup.portrait')}</option>
                <option value="landscape">{t('charts.pageSetup.landscape')}</option>
              </select>
            </label>
          </div>
          <fieldset className="border border-border rounded-md p-2">
            <legend className="text-muted-foreground px-1">{t('charts.pageSetup.margins')}</legend>
            <div className="grid grid-cols-4 gap-2">
              {['Top', 'Right', 'Bottom', 'Left'].map((side) => (
                <label key={side} className="block">{t(`charts.pageSetup.side.${side.toLowerCase()}`)}
                  <input
                    type="number"
                    min={0}
                    value={draft[`margin${side}`]}
                    onChange={(e) => set(`margin${side}`, e.target.value)}
                    className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2"
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">{t('charts.pageSetup.overlap')}
            <input type="number" min={0} max={200} value={draft.overlap} onChange={(e) => set('overlap', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
          </label>
          <div className="space-y-1">
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.omitEmptyPages} onChange={(e) => set('omitEmptyPages', e.target.checked)} /> {t('charts.pageSetup.omitEmpty')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.cutMarks} onChange={(e) => set('cutMarks', e.target.checked)} /> {t('charts.pageSetup.cutMarks')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.printPageNumbers} onChange={(e) => set('printPageNumbers', e.target.checked)} /> {t('charts.pageSetup.pageNumbers')}</label>
          </div>
          <label className="block">{t('charts.pageSetup.watermark')}
            <input type="text" value={draft.watermark} placeholder={t('charts.pageSetup.watermarkPlaceholder')} onChange={(e) => set('watermark', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
          </label>
          <label className="block">{t('charts.pageSetup.backgroundColor')}
            <input type="text" value={draft.backgroundColor} placeholder={t('charts.pageSetup.backgroundPlaceholder')} onChange={(e) => set('backgroundColor', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
          </label>
          <fieldset className="border border-border rounded-md p-2">
            <legend className="text-muted-foreground px-1">{t('charts.pageSetup.printMargins')}</legend>
            <div className="grid grid-cols-4 gap-2">
              {['Top', 'Right', 'Bottom', 'Left'].map((side) => (
                <label key={`print-${side}`} className="block">{t(`charts.pageSetup.side.${side.toLowerCase()}`)}
                  <input
                    type="number"
                    min={0}
                    value={draft[`printMargin${side}`]}
                    onChange={(e) => set(`printMargin${side}`, e.target.value)}
                    className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2"
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="border border-border rounded-md p-2">
            <legend className="text-muted-foreground px-1">{t('charts.pageSetup.exportSettings')}</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">{t('charts.pageSetup.format')}
                <select value={draft.exportFormat} onChange={(e) => set('exportFormat', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2">
                  <option value="png">{t('charts.pageSetup.formatName.png')}</option>
                  <option value="jpeg">{t('charts.pageSetup.formatName.jpeg')}</option>
                  <option value="svg">{t('charts.pageSetup.formatName.svg')}</option>
                  <option value="pdf">{t('charts.pageSetup.formatName.pdf')}</option>
                </select>
              </label>
              <label className="block">{t('charts.pageSetup.scale')}
                <input type="number" min={0.25} max={4} step={0.25} value={draft.exportScale} onChange={(e) => set('exportScale', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
              </label>
            </div>
            {draft.exportFormat === 'jpeg' && (
              <label className="block mt-2">{t('charts.pageSetup.jpegQuality')}
                <input type="number" min={0.1} max={1} step={0.05} value={draft.exportJpegQuality} onChange={(e) => set('exportJpegQuality', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
              </label>
            )}
            <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={draft.exportIncludeBackground} onChange={(e) => set('exportIncludeBackground', e.target.checked)} /> {t('charts.pageSetup.includeBackground')}</label>
          </fieldset>
    </Sheet>
  );
}

export default PageSetupSheet;
