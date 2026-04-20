import React, { useState } from 'react';

/**
 * PageSetupSheet — modal that edits a pageSetup block
 * (paperSize, orientation, margins, overlap, omitEmptyPages, cutMarks,
 * printPageNumbers). Calls onApply(nextPageSetup) when confirmed.
 *
 * Mirrors MacFamilyTree's Print Settings pane plus the NSPrintInfo page
 * setup dialog. Designed to work with `pageLayout.js` helpers.
 */
export function PageSetupSheet({ pageSetup, exportSettings, onApply, onCancel, title = 'Page setup' }) {
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
    backgroundColor: pageSetup?.backgroundColor || '',
    exportFormat: exportSettings?.format || 'png',
    exportScale: exportSettings?.scale ?? 1,
    exportJpegQuality: exportSettings?.jpegQuality ?? 0.92,
    exportIncludeBackground: exportSettings?.includeBackground !== false,
  }));

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

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
      backgroundColor: draft.backgroundColor || '',
    }, {
      format: draft.exportFormat,
      scale: Number(draft.exportScale) || 1,
      jpegQuality: Number(draft.exportJpegQuality) || 0.92,
      includeBackground: !!draft.exportIncludeBackground,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{title}</h2>
        </header>
        <div className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">Paper size
              <select value={draft.paperSize} onChange={(e) => set('paperSize', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2">
                <option value="letter">Letter (8.5 × 11)</option>
                <option value="legal">Legal (8.5 × 14)</option>
                <option value="tabloid">Tabloid (11 × 17)</option>
                <option value="a3">A3</option>
                <option value="a4">A4</option>
                <option value="a5">A5</option>
              </select>
            </label>
            <label className="block">Orientation
              <select value={draft.orientation} onChange={(e) => set('orientation', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          </div>
          <fieldset className="border border-border rounded-md p-2">
            <legend className="text-muted-foreground px-1">Margins (px)</legend>
            <div className="grid grid-cols-4 gap-2">
              {['Top', 'Right', 'Bottom', 'Left'].map((side) => (
                <label key={side} className="block">{side}
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
          <label className="block">Overlap (px)
            <input type="number" min={0} max={200} value={draft.overlap} onChange={(e) => set('overlap', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
          </label>
          <div className="space-y-1">
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.omitEmptyPages} onChange={(e) => set('omitEmptyPages', e.target.checked)} /> Omit empty pages when printing or exporting</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.cutMarks} onChange={(e) => set('cutMarks', e.target.checked)} /> Cut marks</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={draft.printPageNumbers} onChange={(e) => set('printPageNumbers', e.target.checked)} /> Print page numbers</label>
          </div>
          <label className="block">Background color
            <input type="text" value={draft.backgroundColor} placeholder="e.g. #ffffff or leave blank" onChange={(e) => set('backgroundColor', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
          </label>
          <fieldset className="border border-border rounded-md p-2">
            <legend className="text-muted-foreground px-1">Print margins (px)</legend>
            <div className="grid grid-cols-4 gap-2">
              {['Top', 'Right', 'Bottom', 'Left'].map((side) => (
                <label key={`print-${side}`} className="block">{side}
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
            <legend className="text-muted-foreground px-1">Export settings</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">Format
                <select value={draft.exportFormat} onChange={(e) => set('exportFormat', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2">
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="svg">SVG</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
              <label className="block">Scale
                <input type="number" min={0.25} max={4} step={0.25} value={draft.exportScale} onChange={(e) => set('exportScale', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
              </label>
            </div>
            {draft.exportFormat === 'jpeg' && (
              <label className="block mt-2">JPEG quality (0.1–1)
                <input type="number" min={0.1} max={1} step={0.05} value={draft.exportJpegQuality} onChange={(e) => set('exportJpegQuality', e.target.value)} className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2" />
              </label>
            )}
            <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={draft.exportIncludeBackground} onChange={(e) => set('exportIncludeBackground', e.target.checked)} /> Include background in export</label>
          </fieldset>
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
          <button type="button" onClick={apply} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90">Apply</button>
        </footer>
      </div>
    </div>
  );
}

export default PageSetupSheet;
