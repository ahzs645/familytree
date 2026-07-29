/**
 * Inline editor for a single book section — kind + target person + options.
 */
import React from 'react';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import { SECTION_KINDS, TITLE_PAGE_PRESETS } from '../../lib/books.js';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { DatePicker } from '../ui/DatePicker.jsx';
import { Button } from '../ui/Button.jsx';
import { cn } from '../../lib/utils.js';

/**
 * Compact control chrome for this dense editor row. Native inputs/selects are
 * kept (instead of ui/Input and ui/Select) because these controls mix fixed
 * widths and flex-1 inside a flex-wrap row, which the w-full primitives fight.
 */
const controlClass = 'rounded-md border border-border bg-secondary text-secondary-foreground px-2.5 py-1.5 text-sm outline-none focus:border-primary';

export function SectionEditor({
  section,
  persons,
  groups = [],
  sources = [],
  savedReports = [],
  savedCharts = [],
  onChange,
  onKindChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  index,
  total,
}) {
  const def = SECTION_KINDS.find((k) => k.id === section.kind);
  const sectionTitle = titleForSection(section, def);
  return (
    <div className="mb-2.5 rounded-md border border-border bg-card p-3 text-card-foreground">
      <div className="mb-2.5 flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-wider text-muted-foreground">SECTION {index + 1}</div>
            <div className="truncate text-sm font-semibold text-foreground" title={sectionTitle}>{sectionTitle}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" disabled={index === 0} onClick={onMoveUp} title="Move up" aria-label="Move section up">
            <ChevronUp size={15} />
          </Button>
          <Button size="icon" disabled={index === total - 1} onClick={onMoveDown} title="Move down" aria-label="Move section down">
            <ChevronDown size={15} />
          </Button>
          <Button size="icon" onClick={onRemove} className="text-destructive-text" title="Remove section" aria-label="Remove section">
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={section.kind}
          onChange={(e) => (onKindChange ? onKindChange(e.target.value) : onChange({ ...section, kind: e.target.value }))}
          className={controlClass}
          aria-label="Section type"
        >
          {SECTION_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        {(section.kind === 'title' || section.kind === 'cover' || section.kind === 'chapter') && (
          <>
            <input
              value={section.text || ''}
              onChange={(e) => onChange({ ...section, text: e.target.value })}
              placeholder={section.kind === 'chapter' ? 'Chapter title' : 'Book title'}
              className={cn(controlClass, 'flex-1')}
            />
            <input
              value={section.subtitle || ''}
              onChange={(e) => onChange({ ...section, subtitle: e.target.value })}
              placeholder="Subtitle (optional)"
              className={cn(controlClass, 'flex-1')}
            />
            {(section.kind === 'title' || section.kind === 'cover') && (
              <select
                value={section.titlePreset || ''}
                onChange={(e) => onChange({ ...section, titlePreset: e.target.value || undefined })}
                className={cn(controlClass, 'min-w-[210px]')}
                aria-label="Title page contents"
              >
                <option value="">Default title page contents</option>
                {TITLE_PAGE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            )}
            {section.kind === 'chapter' && (
              <>
                <select
                  value={section.chapterType || 'content'}
                  onChange={(e) => onChange({ ...section, chapterType: e.target.value })}
                  className={cn(controlClass, 'min-w-[150px]')}
                  aria-label="Chapter type"
                >
                  <option value="preface">Preface Chapter</option>
                  <option value="content">Content Chapter</option>
                  <option value="appendix">Appendix Chapter</option>
                </select>
                <input
                  value={section.chapterNumber || ''}
                  onChange={(e) => onChange({ ...section, chapterNumber: e.target.value })}
                  placeholder="Chapter number"
                  className={cn(controlClass, 'w-[140px]')}
                />
              </>
            )}
            {section.kind === 'cover' && (
              <>
                <input
                  value={section.author || ''}
                  onChange={(e) => onChange({ ...section, author: e.target.value })}
                  placeholder="Author"
                  className={cn(controlClass, 'flex-1')}
                />
                <div className="w-[180px]">
                  <DatePicker
                    value={section.date || ''}
                    onChange={(value) => onChange({ ...section, date: value })}
                    placeholder="Date"
                  />
                </div>
                <input
                  value={section.publisher || ''}
                  onChange={(e) => onChange({ ...section, publisher: e.target.value })}
                  placeholder="Publisher"
                  className={cn(controlClass, 'flex-1')}
                />
              </>
            )}
            {(section.kind === 'title' || section.kind === 'cover') && (
              <>
                <input
                  value={section.imageCaption || ''}
                  onChange={(e) => onChange({ ...section, imageCaption: e.target.value })}
                  placeholder="Title Page Image"
                  className={cn(controlClass, 'flex-1')}
                />
                <input
                  value={section.crestCaption || ''}
                  onChange={(e) => onChange({ ...section, crestCaption: e.target.value })}
                  placeholder="Family Crest"
                  className={cn(controlClass, 'flex-1')}
                />
              </>
            )}
            <input
              value={section.place || ''}
              onChange={(e) => onChange({ ...section, place: e.target.value })}
              placeholder="Place"
              className={cn(controlClass, 'flex-1')}
            />
            <input
              value={section.note || ''}
              onChange={(e) => onChange({ ...section, note: e.target.value })}
              placeholder="Note"
              className={cn(controlClass, 'flex-1')}
            />
          </>
        )}
        {section.kind === 'toc' && (
          <select
            value={section.tocStyle || 'numbered'}
            onChange={(e) => onChange({ ...section, tocStyle: e.target.value })}
            className={controlClass}
          >
            <option value="numbered">Numbered</option>
            <option value="plain">Plain</option>
            <option value="compact">Compact</option>
          </select>
        )}
        {def?.needsPerson && (
          <div className="min-w-[240px]">
            <PersonPicker
              persons={persons}
              value={section.targetRecordName}
              onChange={(v) => onChange({ ...section, targetRecordName: v })}
            />
          </div>
        )}
        {def?.needsGenerations && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Generations
            <input
              type="number"
              min={2}
              max={12}
              value={section.generations || 5}
              onChange={(e) => onChange({ ...section, generations: +e.target.value || 5 })}
              className={cn(controlClass, 'w-[84px]')}
            />
          </label>
        )}
        {def?.needsGroup && (
          <select
            value={section.groupRecordName || ''}
            onChange={(e) => onChange({ ...section, groupRecordName: e.target.value })}
            className={cn(controlClass, 'min-w-[220px]')}
          >
            <option value="">Select group...</option>
            {groups.map((group) => (
              <option key={group.recordName} value={group.recordName}>{group.label}</option>
            ))}
          </select>
        )}
        {def?.needsSource && (
          <select
            value={section.sourceRecordName || ''}
            onChange={(e) => onChange({ ...section, sourceRecordName: e.target.value })}
            className={cn(controlClass, 'min-w-[220px]')}
          >
            <option value="">Select source...</option>
            {sources.map((source) => (
              <option key={source.recordName} value={source.recordName}>{source.label}</option>
            ))}
          </select>
        )}
        {def?.needsSavedReport && (
          <select
            value={section.savedReportId || ''}
            onChange={(e) => onChange({ ...section, savedReportId: e.target.value })}
            className={cn(controlClass, 'min-w-[240px]')}
          >
            <option value="">Select saved report...</option>
            {savedReports.map((report) => (
              <option key={report.id} value={report.id}>{report.name || report.builderId || report.id}</option>
            ))}
          </select>
        )}
        {def?.needsSavedChart && (
          <select
            value={section.savedChartId || ''}
            onChange={(e) => onChange({ ...section, savedChartId: e.target.value })}
            className={cn(controlClass, 'min-w-[240px]')}
          >
            <option value="">Select saved chart...</option>
            {savedCharts.map((chart) => (
              <option key={chart.id} value={chart.id}>{chart.name || chart.chartType || chart.id}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

function titleForSection(section, def) {
  if (section.kind === 'cover' || section.kind === 'title' || section.kind === 'chapter') return section.text || def?.label || 'Untitled section';
  return def?.label || 'Section';
}

export default SectionEditor;
