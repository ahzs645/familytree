/**
 * Library / Overlays / Export tabs of the chart "More" popover.
 * Pure presentation: each prop keeps the exact name of the ChartsApp state or
 * callback it mirrors, so these stay thin controlled surfaces.
 */
import React from 'react';
import { Section } from './FormFields.jsx';
import { Select } from '../../ui/Select.jsx';
import { Input } from '../../ui/Input.jsx';
import { Button } from '../../ui/Button.jsx';
import { ChartObjectInspector } from '../ChartObjectInspector.jsx';
import { useTranslation } from '../../../contexts/LocalizationContext.jsx';
import { COMPACT_SELECT_TRIGGER } from './controlStyles.js';

export function MoreLibraryTab({
  templates,
  documents,
  currentDocumentId,
  currentDocumentName,
  isDirty,
  isReadOnly,
  rootId,
  onApplyTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onApplyDocument,
  onSaveDocument,
  onSaveAsDocument,
  onNewChart,
  onFinishEditing,
  onCopyShareLink,
  onShareChart,
  onShareByEmail,
  onShowShareQr,
  onDeleteDocument,
}) {
  return (<>
    <Section label="Templates">
      <div className="flex gap-1.5">
        <Select
          value=""
          onChange={(value) => value && onApplyTemplate(value)}
          options={[
            { value: '', label: 'Load saved…' },
            ...templates.map((template) => ({ value: template.id, label: template.name })),
          ]}
          className="flex-1"
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
        <Button onClick={onSaveTemplate}>Save</Button>
      </div>
      {templates.length > 0 && (
        <Select
          value=""
          onChange={(value) => value && onDeleteTemplate(value)}
          options={[
            { value: '', label: 'Delete…' },
            ...templates.map((template) => ({ value: template.id, label: template.name })),
          ]}
          className="mt-1.5"
          triggerClassName={COMPACT_SELECT_TRIGGER}
          ariaLabel="Delete a saved template"
        />
      )}
    </Section>

    <Section label={`Documents${currentDocumentName ? ` — ${currentDocumentName}${isDirty ? ' •' : ''}${isReadOnly ? ' (read-only)' : ''}` : ''}`}>
      <div className="flex gap-1.5">
        <Select
          value=""
          onChange={(value) => value && onApplyDocument(value)}
          options={[
            { value: '', label: 'Open…' },
            ...documents.map((doc) => ({ value: doc.id, label: doc.name })),
          ]}
          className="flex-1"
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
        <Button onClick={onSaveDocument} disabled={isReadOnly} title={isReadOnly ? 'Read-only — use Save as new' : currentDocumentId ? 'Overwrite existing document' : 'Save new document'}>
          {currentDocumentId ? 'Save' : 'Save…'}
        </Button>
        <Button onClick={onSaveAsDocument} title="Save a new copy">Save as…</Button>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Button onClick={onNewChart} title="Start a new blank chart. Prompts if there are unsaved changes.">New chart</Button>
        <Button onClick={onFinishEditing} disabled={isReadOnly} title="Exit edit mode. Prompts to save unsaved changes, then locks the chart as read-only.">Finish editing</Button>
      </div>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        <Button
          onClick={onCopyShareLink}
          title="Copy a compressed read-only link to the clipboard."
          disabled={!rootId}
        >
          Copy link
        </Button>
        <Button
          onClick={onShareChart}
          title="Open the system share sheet (iOS/macOS/Android) or copy if unsupported."
          disabled={!rootId}
        >
          Share…
        </Button>
        <Button
          onClick={onShareByEmail}
          title="Open a new email with the share link."
          disabled={!rootId}
        >
          Email
        </Button>
        <Button
          onClick={onShowShareQr}
          title="Show a QR code for the chart share link."
          disabled={!rootId}
        >
          QR
        </Button>
      </div>
      {documents.length > 0 && (
        <Select
          value=""
          onChange={(value) => value && onDeleteDocument(value)}
          options={[
            { value: '', label: 'Delete…' },
            ...documents.map((doc) => ({ value: doc.id, label: doc.name })),
          ]}
          className="mt-1.5"
          triggerClassName={COMPACT_SELECT_TRIGGER}
        />
      )}
    </Section>
  </>);
}

export function MoreOverlaysTab({
  overlays,
  selectedOverlayId,
  isReadOnly,
  hasUndo,
  hasRedo,
  addTextOverlay,
  addLineOverlay,
  addImageOverlay,
  removeSelected,
  undo,
  redo,
  alignHorizontal,
  alignVertical,
  bringToFront,
  sendToBack,
  distributeEvenly,
  focusRootInCanvas,
  moveAwayFromPageCuts,
  distributeBorderToBorder,
  pageSize,
  pageOrientation,
  onUpdateOverlay,
}) {
  return (<>
    <Section label={`Overlays${isReadOnly ? ' (read-only)' : ''}`}>
      <div className="grid grid-cols-4 gap-1.5">
        <Button onClick={addTextOverlay} disabled={isReadOnly}>Text</Button>
        <Button onClick={addLineOverlay} disabled={isReadOnly}>Line</Button>
        <Button onClick={addImageOverlay} disabled={isReadOnly}>Image</Button>
        <Button onClick={removeSelected} disabled={!selectedOverlayId || isReadOnly}>Delete</Button>
      </div>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        <Button onClick={undo} disabled={!hasUndo || isReadOnly}>Undo</Button>
        <Button onClick={redo} disabled={!hasRedo || isReadOnly}>Redo</Button>
        <Button onClick={() => alignHorizontal('left')} disabled={!selectedOverlayId || isReadOnly}>Align left</Button>
        <Button onClick={() => alignHorizontal('center')} disabled={!selectedOverlayId || isReadOnly}>Align center</Button>
      </div>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        <Button onClick={() => alignVertical('top')} disabled={!selectedOverlayId || isReadOnly}>Align top</Button>
        <Button onClick={() => alignVertical('middle')} disabled={!selectedOverlayId || isReadOnly}>Align middle</Button>
        <Button onClick={bringToFront} disabled={!selectedOverlayId || isReadOnly}>Bring to front</Button>
        <Button onClick={sendToBack} disabled={!selectedOverlayId || isReadOnly}>Send to back</Button>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <Button onClick={() => distributeEvenly('horizontal')} disabled={!selectedOverlayId || isReadOnly}>Distribute H</Button>
        <Button onClick={() => distributeEvenly('vertical')} disabled={!selectedOverlayId || isReadOnly}>Distribute V</Button>
        <Button onClick={focusRootInCanvas}>Focus root</Button>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5">
        <Button className="whitespace-normal" onClick={() => moveAwayFromPageCuts({ paperSize: pageSize, orientation: pageOrientation })} disabled={!overlays.length || isReadOnly} title="Shift objects that cross a page-tile boundary so they fit inside one page">Away from cuts</Button>
        <Button className="whitespace-normal" onClick={() => distributeBorderToBorder('horizontal', { paperSize: pageSize, orientation: pageOrientation })} disabled={overlays.length < 2 || isReadOnly} title="Distribute objects evenly across the page content rect">Border-to-border H</Button>
        <Button className="whitespace-normal" onClick={() => distributeBorderToBorder('vertical', { paperSize: pageSize, orientation: pageOrientation })} disabled={overlays.length < 2 || isReadOnly} title="Distribute objects evenly from top to bottom">Border-to-border V</Button>
      </div>
    </Section>

    {selectedOverlayId && (
      <Section label="Object inspector">
        <ChartObjectInspector
          overlays={overlays}
          selectedOverlayId={selectedOverlayId}
          onUpdateOverlay={onUpdateOverlay}
        />
      </Section>
    )}
  </>);
}

export function MoreExportTab({
  findText, setFindText,
  onFindPerson,
  exportFormat, setExportFormat,
  exportScale, setExportScale,
  exportJpegQuality, setExportJpegQuality,
  exportIncludeBackground, setExportIncludeBackground,
  exportFileNameTemplate, setExportFileNameTemplate,
  exportSvg,
  exportPng,
  exportPdf,
}) {
  const { t } = useTranslation();
  return (
    <Section label="Find + Export">
      <div className="mb-1.5 grid grid-cols-[1fr_auto] gap-1.5">
        <Input
          compact
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          placeholder="Find person name/record"
        />
        <Button onClick={onFindPerson}>Find</Button>
      </div>
      <div className="mb-1.5 grid grid-cols-2 gap-1.5">
        <label className="block">
          <div className="mb-1 text-xs text-muted-foreground">Format</div>
          <Select
            value={exportFormat}
            onChange={setExportFormat}
            options={[
              { value: 'png', label: 'PNG' },
              { value: 'jpeg', label: 'JPEG' },
            ]}
            triggerClassName={COMPACT_SELECT_TRIGGER}
          />
        </label>
        <label className="block">
          <div className="mb-1 text-xs text-muted-foreground">Scale ({exportScale.toFixed(2)}×)</div>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.25}
            value={exportScale}
            onChange={(e) => setExportScale(+e.target.value)}
            className="w-full"
          />
        </label>
      </div>
      {exportFormat === 'jpeg' && (
        <label className="mb-1.5 block">
          <div className="mb-1 text-xs text-muted-foreground">JPEG quality ({Math.round(exportJpegQuality * 100)}%)</div>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={exportJpegQuality}
            onChange={(e) => setExportJpegQuality(+e.target.value)}
            className="w-full"
          />
        </label>
      )}
      <label className="mb-1.5 flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={exportIncludeBackground}
          onChange={(e) => setExportIncludeBackground(e.target.checked)}
        />
        Include background
      </label>
      <label className="mb-1.5 block">
        <div className="mb-1 text-xs text-muted-foreground">File name template</div>
        <Input
          compact
          value={exportFileNameTemplate}
          onChange={(e) => setExportFileNameTemplate(e.target.value)}
          placeholder="{title}-{date}"
        />
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        <Button onClick={exportSvg}>Save SVG</Button>
        <Button onClick={exportPng}>Save {exportFormat === 'jpeg' ? 'JPEG' : 'PNG'}</Button>
        <Button onClick={exportPdf} title={t('charts.printHint')}>{t('charts.print')}</Button>
      </div>
    </Section>
  );
}
