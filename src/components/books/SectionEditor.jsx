/**
 * Inline editor for a single book section — kind + target person + options.
 */
import React from 'react';
import { SECTION_KINDS } from '../../lib/books.js';
import { PersonPicker } from '../charts/PersonPicker.jsx';

export function SectionEditor({ section, persons, groups = [], sources = [], onChange, onRemove, onMoveUp, onMoveDown, index, total }) {
  const def = SECTION_KINDS.find((k) => k.id === section.kind);
  return (
    <div style={card}>
      <div style={head}>
        <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}>SECTION {index + 1}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button disabled={index === 0} onClick={onMoveUp} style={iconBtn}>↑</button>
          <button disabled={index === total - 1} onClick={onMoveDown} style={iconBtn}>↓</button>
          <button onClick={onRemove} style={{ ...iconBtn, color: 'hsl(var(--destructive))' }}>×</button>
        </div>
      </div>
      <div style={row}>
        <select value={section.kind} onChange={(e) => onChange({ ...section, kind: e.target.value })} style={input}>
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
            {section.kind === 'cover' && (
              <>
                <input
                  value={section.author || ''}
                  onChange={(e) => onChange({ ...section, author: e.target.value })}
                  placeholder="Author"
                  style={{ ...input, flex: 1 }}
                />
                <input
                  value={section.date || ''}
                  onChange={(e) => onChange({ ...section, date: e.target.value })}
                  placeholder="Date"
                  style={{ ...input, width: 110 }}
                />
                <input
                  value={section.publisher || ''}
                  onChange={(e) => onChange({ ...section, publisher: e.target.value })}
                  placeholder="Publisher"
                  style={{ ...input, flex: 1 }}
                />
              </>
            )}
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
          <input
            type="number"
            min={2}
            max={10}
            value={section.generations || 5}
            onChange={(e) => onChange({ ...section, generations: +e.target.value || 5 })}
            style={{ ...input, width: 70 }}
          />
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
      </div>
    </div>
  );
}

const card = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: 12, marginBottom: 10 };
const head = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 };
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
const iconBtn = {
  background: 'hsl(var(--secondary))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 12,
  cursor: 'pointer',
};

export default SectionEditor;
