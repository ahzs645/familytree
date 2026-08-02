import React, { useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Settings2, Trash2 } from 'lucide-react';
import { SECTION_KINDS } from '../../lib/books.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { Button } from '../ui/Button.jsx';
import { SectionConfigurationSheet } from './SectionConfigurationSheet.jsx';

const controlClass = 'h-10 min-w-0 flex-1 rounded-md border border-border bg-secondary px-2.5 text-sm text-secondary-foreground outline-none focus:border-primary';

export function SectionEditor({
  section,
  persons,
  families = [],
  groups = [],
  sources = [],
  media = [],
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
  const { t } = useTranslation();
  const [configOpen, setConfigOpen] = useState(false);
  const def = SECTION_KINDS.find((entry) => entry.id === section.kind);
  const sectionTitle = titleForSection(section, def, t);

  return (
    <div className="mb-2.5 rounded-md border border-border bg-card p-3 text-card-foreground">
      <div className="mb-2.5 flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-2xs font-bold tracking-wider text-muted-foreground">{t('books.sectionNumber', { number: index + 1 })}</div>
            <div className="truncate text-sm font-semibold text-foreground" title={sectionTitle}>{sectionTitle}</div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="icon" disabled={index === 0} onClick={onMoveUp} title={t('books.moveUp')} aria-label={t('books.moveUp')}><ChevronUp size={15} /></Button>
          <Button size="icon" disabled={index === total - 1} onClick={onMoveDown} title={t('books.moveDown')} aria-label={t('books.moveDown')}><ChevronDown size={15} /></Button>
          <Button size="icon" onClick={onRemove} className="text-destructive-text" title={t('books.removeSection')} aria-label={t('books.removeSection')}><Trash2 size={15} /></Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t('books.config.sectionType')}</span>
          <select value={section.kind} onChange={(event) => onKindChange?.(event.target.value)} className={controlClass} aria-label={t('books.config.sectionType')}>
            {SECTION_KINDS.map((entry) => <option key={entry.id} value={entry.id}>{t(entry.labelKey)}</option>)}
          </select>
        </label>
        <Button variant="outline" size="md" onClick={() => setConfigOpen(true)} title={t('books.configureSection')} aria-label={t('books.configureSection')}>
          <Settings2 size={15} />
          <span className="hidden xl:inline">{t('books.configure')}</span>
        </Button>
      </div>
      {configOpen && (
        <SectionConfigurationSheet
          section={section}
          persons={persons}
          families={families}
          groups={groups}
          sources={sources}
          media={media}
          savedReports={savedReports}
          savedCharts={savedCharts}
          onApply={(next) => { onChange(next); setConfigOpen(false); }}
          onCancel={() => setConfigOpen(false)}
        />
      )}
    </div>
  );
}

function titleForSection(section, def, t) {
  if (['cover', 'title', 'chapter', 'custom-page'].includes(section.kind)) return section.text || t('books.untitledSection');
  return def ? t(def.labelKey) : t('books.section');
}

export default SectionEditor;
