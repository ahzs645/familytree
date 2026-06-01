/**
 * Inline editor for a single book section — kind + target person + options.
 */
import React from 'react';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import { SECTION_KINDS, TITLE_PAGE_PRESETS } from '../../lib/books.js';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { DatePicker } from '../ui/DatePicker.jsx';

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
    <div style={card}>
      <div style={head}>
        <div style={titleBlock}>
          <GripVertical size={16} aria-hidden="true" style={{ color: 'hsl(var(--muted-foreground))', flex: '0 0 auto' }} />
          <div style={{ minWidth: 0 }}>
            <div style={eyebrow}>SECTION {index + 1}</div>
            <div style={sectionName} title={sectionTitle}>{sectionTitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" disabled={index === 0} onClick={onMoveUp} style={iconBtn} title="Move up" aria-label="Move section up">
            <ChevronUp size={15} />
          </button>
          <button type="button" disabled={index === total - 1} onClick={onMoveDown} style={iconBtn} title="Move down" aria-label="Move section down">
            <ChevronDown size={15} />
          </button>
          <button type="button" onClick={onRemove} style={{ ...iconBtn, color: 'hsl(var(--destructive))' }} title="Remove section" aria-label="Remove section">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div style={row}>
        <select
          value={section.kind}
          onChange={(e) => (onKindChange ? onKindChange(e.target.value) : onChange({ ...section, kind: e.target.value }))}
          style={input}
          aria-label="Section type"
        >
          {SECTION_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        {(section.kind === 'title' || section.kind === 'cover') && (
          <>
            <input
              value={section.text || ''}
              onChange={(e) => onChange({ ...section, text: e.target.value })}
              placeholder="Book title"
              style={{ ...input, flex: 1 }}
            />
            <input
              value={section.subtitle || ''}
              onChange={(e) => onChange({ ...section, subtitle: e.target.value })}
              placeholder="Subtitle (optional)"
              style={{ ...input, flex: 1 }}
            />
            <select
              value={section.titlePreset || ''}
              onChange={(e) => onChange({ ...section, titlePreset: e.target.value || undefined })}
              style={{ ...input, minWidth: 210 }}
              aria-label="Title page contents"
            >
              <option value="">Default title page contents</option>
              {TITLE_PAGE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            {section.kind === 'cover' && (
              <>
                <input
                  value={section.author || ''}
                  onChange={(e) => onChange({ ...section, author: e.target.value })}
                  placeholder="Author"
                  style={{ ...input, flex: 1 }}
                />
                <div style={{ width: 180 }}>
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
                  style={{ ...input, flex: 1 }}
                />
              </>
            )}
            <input
              value={section.place || ''}
              onChange={(e) => onChange({ ...section, place: e.target.value })}
              placeholder="Place"
              style={{ ...input, flex: 1 }}
            />
            <input
              value={section.note || ''}
              onChange={(e) => onChange({ ...section, note: e.target.value })}
              placeholder="Note"
              style={{ ...input, flex: 1 }}
            />
          </>
        )}
        {section.kind === 'toc' && (
          <select
            value={section.tocStyle || 'numbered'}
            onChange={(e) => onChange({ ...section, tocStyle: e.target.value })}
            style={input}
          >
            <option value="numbered">Numbered</option>
            <option value="plain">Plain</option>
            <option value="compact">Compact</option>
          </select>
        )}
        {def?.needsPerson && (
          <div style={{ minWidth: 240 }}>
            <PersonPicker
              persons={persons}
              value={section.targetRecordName}
              onChange={(v) => onChange({ ...section, targetRecordName: v })}
            />
          </div>
        )}
        {def?.needsGenerations && (
          <label style={fieldLabel}>
            Generations
            <input
              type="number"
              min={2}
              max={12}
              value={section.generations || 5}
              onChange={(e) => onChange({ ...section, generations: +e.target.value || 5 })}
              style={{ ...input, width: 84 }}
            />
          </label>
        )}
        {def?.needsGroup && (
          <select
            value={section.groupRecordName || ''}
            onChange={(e) => onChange({ ...section, groupRecordName: e.target.value })}
            style={{ ...input, minWidth: 220 }}
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
            style={{ ...input, minWidth: 220 }}
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
            style={{ ...input, minWidth: 240 }}
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
            style={{ ...input, minWidth: 240 }}
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
  if (section.kind === 'cover' || section.kind === 'title') return section.text || def?.label || 'Untitled section';
  return def?.label || 'Section';
}

const card = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, marginBottom: 10 };
const head = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 };
const titleBlock = { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 };
const eyebrow = { color: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700, letterSpacing: 0.4 };
const sectionName = { color: 'hsl(var(--foreground))', fontSize: 13, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const row = { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' };
const input = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '6px 10px',
  font: '13px -apple-system, system-ui, sans-serif',
  outline: 'none',
};
const fieldLabel = { display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--muted-foreground))', fontSize: 12 };
const iconBtn = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 4,
  width: 30,
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  fontSize: 12,
  cursor: 'pointer',
};

export default SectionEditor;
