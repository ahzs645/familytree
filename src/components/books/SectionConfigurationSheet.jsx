import React, { useEffect, useRef, useState } from 'react';
import { SECTION_KINDS, TITLE_PAGE_PRESETS } from '../../lib/books.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { PersonPicker } from '../charts/PersonPicker.jsx';
import { FamilyPicker } from '../editors/FamilyPickerSheet.jsx';
import { Sheet } from '../ui/Sheet.jsx';
import { Button } from '../ui/Button.jsx';
import { Input, Textarea } from '../ui/Input.jsx';

const selectClass = 'mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary';
const labelClass = 'block text-xs font-medium text-foreground';

export function SectionConfigurationSheet({
  section,
  persons,
  families = [],
  groups = [],
  sources = [],
  media = [],
  savedReports = [],
  savedCharts = [],
  onApply,
  onCancel,
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => ({ ...section }));
  const firstFieldRef = useRef(null);
  const previousFocusRef = useRef(null);
  const def = SECTION_KINDS.find((entry) => entry.id === draft.kind) || SECTION_KINDS[0];

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    requestAnimationFrame(() => firstFieldRef.current?.focus?.());
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => previousFocusRef.current?.focus?.());
    };
  }, [onCancel]);

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const title = t(`books.config.sheetTitles.${def.configKind}`);

  return (
    <Sheet
      title={title}
      subtitle={t(def.labelKey)}
      maxWidth="max-w-2xl"
      scroll="card"
      maxHeight="max-h-[88vh]"
      bodyClassName="space-y-4 p-4"
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" onClick={() => onApply(draft)}>{t('common.apply')}</Button>
        </>
      )}
    >
      <label className={labelClass}>
        {t('books.config.sectionType')}
        <select ref={firstFieldRef} value={draft.kind} onChange={(event) => setDraft({ kind: event.target.value })} className={selectClass}>
          {SECTION_KINDS.map((entry) => <option key={entry.id} value={entry.id}>{t(entry.labelKey)}</option>)}
        </select>
      </label>

      {def.configKind === 'text' && <TextSectionForm draft={draft} set={set} t={t} />}
      {def.configKind === 'person' && <PersonSectionForm draft={draft} set={set} def={def} persons={persons} t={t} />}
      {def.configKind === 'family' && <FamilySectionForm draft={draft} set={set} persons={persons} families={families} t={t} />}
      {def.configKind === 'chart' && <ChartSectionForm draft={draft} set={set} savedCharts={savedCharts} t={t} />}
      {def.configKind === 'report' && (
        <ReportSectionForm
          draft={draft}
          set={set}
          def={def}
          persons={persons}
          groups={groups}
          sources={sources}
          media={media}
          savedReports={savedReports}
          t={t}
        />
      )}
    </Sheet>
  );
}

function TextSectionForm({ draft, set, t }) {
  if (draft.kind === 'toc') {
    return (
      <SelectField label={t('books.config.tocStyle')} value={draft.tocStyle || 'numbered'} onChange={(value) => set('tocStyle', value)} options={[
        ['numbered', t('books.config.numbered')], ['plain', t('books.config.plain')], ['compact', t('books.config.compact')],
      ]} />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label={t('books.config.title')} value={draft.text || ''} onChange={(value) => set('text', value)} />
      <TextField label={t('books.config.subtitle')} value={draft.subtitle || ''} onChange={(value) => set('subtitle', value)} />
      {draft.kind === 'custom-page' && (
        <label className={`${labelClass} sm:col-span-2`}>
          {t('books.config.pageText')}
          <Textarea className="mt-1" value={draft.body || ''} onChange={(event) => set('body', event.target.value)} />
        </label>
      )}
      {(draft.kind === 'cover' || draft.kind === 'title') && (
        <>
          <SelectField label={t('books.config.titlePageContents')} value={draft.titlePreset || ''} onChange={(value) => set('titlePreset', value || undefined)} options={[
            ['', t('books.config.defaultTitlePage')], ...TITLE_PAGE_PRESETS.map((preset) => [preset.id, t(preset.labelKey)]),
          ]} />
          <TextField label={t('books.config.author')} value={draft.author || ''} onChange={(value) => set('author', value)} />
          <TextField label={t('books.config.date')} value={draft.date || ''} onChange={(value) => set('date', value)} />
          <TextField label={t('books.config.publisher')} value={draft.publisher || ''} onChange={(value) => set('publisher', value)} />
          <TextField label={t('books.config.place')} value={draft.place || ''} onChange={(value) => set('place', value)} />
          <TextField label={t('books.config.titleImage')} value={draft.imageCaption || ''} onChange={(value) => set('imageCaption', value)} />
          <TextField label={t('books.config.familyCrest')} value={draft.crestCaption || ''} onChange={(value) => set('crestCaption', value)} />
        </>
      )}
      {draft.kind === 'chapter' && (
        <>
          <SelectField label={t('books.config.chapterType')} value={draft.chapterType || 'content'} onChange={(value) => set('chapterType', value)} options={[
            ['preface', t('books.config.preface')], ['content', t('books.config.content')], ['appendix', t('books.config.appendix')],
          ]} />
          <TextField label={t('books.config.chapterNumber')} value={draft.chapterNumber || ''} onChange={(value) => set('chapterNumber', value)} />
        </>
      )}
      <TextField label={t('books.config.note')} value={draft.note || ''} onChange={(value) => set('note', value)} className="sm:col-span-2" />
    </div>
  );
}

function PersonSectionForm({ draft, set, def, persons, t }) {
  return (
    <>
      <PickerField label={t('books.config.targetPerson')}><PersonPicker persons={persons} value={draft.targetRecordName || ''} onChange={(value) => set('targetRecordName', value)} ariaLabel={t('books.config.targetPerson')} /></PickerField>
      {def.needsGenerations && <NumberField label={t('books.config.generations')} value={draft.generations || 5} onChange={(value) => set('generations', value)} />}
      <ScopeAndSort draft={draft} set={set} t={t} person />
      <IncludeOptions draft={draft} set={set} t={t} />
    </>
  );
}

function FamilySectionForm({ draft, set, persons, families, t }) {
  return (
    <>
      <PickerField label={t('books.config.startPerson')}><PersonPicker persons={persons} value={draft.targetRecordName || ''} onChange={(value) => set('targetRecordName', value)} ariaLabel={t('books.config.startPerson')} /></PickerField>
      <PickerField label={t('books.config.targetFamily')}>
        <FamilyPicker value={draft.targetFamilyRecordName || ''} families={families} persons={persons} ariaLabel={t('books.config.targetFamily')} onChange={(value, family) => {
          set('targetFamilyRecordName', value);
          if (family?.primaryPersonRecordName) set('targetRecordName', family.primaryPersonRecordName);
        }} />
      </PickerField>
      <ScopeAndSort draft={draft} set={set} t={t} />
      <IncludeOptions draft={draft} set={set} t={t} />
    </>
  );
}

function ChartSectionForm({ draft, set, savedCharts, t }) {
  return (
    <>
      <SelectField label={t('books.config.savedChart')} value={draft.savedChartId || ''} onChange={(value) => set('savedChartId', value)} options={[
        ['', t('books.config.selectSavedChart')], ...savedCharts.map((chart) => [chart.id, chart.name || chart.chartType || chart.id]),
      ]} />
      <TextField label={t('books.config.caption')} value={draft.caption || ''} onChange={(value) => set('caption', value)} />
      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">{t('books.config.include')}</legend>
        <CheckField label={t('books.config.chartTitle')} checked={draft.includeTitle !== false} onChange={(value) => set('includeTitle', value)} />
        <CheckField label={t('books.config.legend')} checked={draft.includeLegend !== false} onChange={(value) => set('includeLegend', value)} />
        <CheckField label={t('books.config.notes')} checked={draft.includeNotes !== false} onChange={(value) => set('includeNotes', value)} />
        <CheckField label={t('books.config.newPage')} checked={draft.startOnNewPage !== false} onChange={(value) => set('startOnNewPage', value)} />
      </fieldset>
    </>
  );
}

function ReportSectionForm({ draft, set, def, persons, groups, sources, media, savedReports, t }) {
  return (
    <>
      {def.needsPerson && <PickerField label={t('books.config.targetPerson')}><PersonPicker persons={persons} value={draft.targetRecordName || ''} onChange={(value) => set('targetRecordName', value)} ariaLabel={t('books.config.targetPerson')} /></PickerField>}
      {def.needsGenerations && <NumberField label={t('books.config.generations')} value={draft.generations || 5} onChange={(value) => set('generations', value)} />}
      {def.needsGroup && <SelectField label={t('books.config.personGroup')} value={draft.groupRecordName || ''} onChange={(value) => set('groupRecordName', value)} options={[['', t('books.config.selectGroup')], ...groups.map((group) => [group.recordName, group.label])]} />}
      {def.needsSource && <SelectField label={t('books.config.source')} value={draft.sourceRecordName || ''} onChange={(value) => set('sourceRecordName', value)} options={[['', t('books.config.selectSource')], ...sources.map((source) => [source.recordName, source.label])]} />}
      {def.needsMedia && <SelectField label={t('books.config.targetMedia')} value={draft.targetRecordName || ''} onChange={(value) => set('targetRecordName', value)} options={[['', t('books.config.selectMedia')], ...media.map((entry) => [entry.recordName, entry.label])]} />}
      {def.needsSavedReport && <SelectField label={t('books.config.savedReport')} value={draft.savedReportId || ''} onChange={(value) => set('savedReportId', value)} options={[['', t('books.config.selectSavedReport')], ...savedReports.map((report) => [report.id, report.name || report.builderId || report.id])]} />}
      <ScopeAndSort draft={draft} set={set} t={t} person={draft.kind === 'persons-list'} />
      <IncludeOptions draft={draft} set={set} t={t} />
    </>
  );
}

function ScopeAndSort({ draft, set, t, person = false }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SelectField label={t('books.config.scope')} value={draft.scope || 'all'} onChange={(value) => set('scope', value)} options={[
        ['all', t('books.config.allRecords')], ['selected', t('books.config.selectedRecord')], ['relatives', t('books.config.relatives')], ['ancestors', t('books.config.ancestors')], ['descendants', t('books.config.descendants')],
      ]} />
      <SelectField label={t('books.config.sort')} value={draft.sort || 'name'} onChange={(value) => set('sort', value)} options={[
        ['name', t('books.config.sortName')], ['birth-asc', t('books.config.sortBirthAsc')], ['birth-desc', t('books.config.sortBirthDesc')], ['date', t('books.config.sortDate')],
      ]} />
      <SelectField label={t('books.config.filter')} value={draft.personFilter || 'all'} onChange={(value) => set('personFilter', value)} options={person ? [
        ['all', t('books.config.allPersons')], ['living', t('books.config.livingOnly')], ['deceased', t('books.config.deceasedOnly')],
      ] : [
        ['all', t('books.config.allFamilies')], ['married', t('books.config.marriedOnly')], ['divorced', t('books.config.divorcedOnly')],
      ]} />
    </div>
  );
}

function IncludeOptions({ draft, set, t }) {
  return (
    <fieldset className="rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{t('books.config.include')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <CheckField label={t('books.config.sources')} checked={draft.includeSources !== false} onChange={(value) => set('includeSources', value)} />
        <CheckField label={t('books.config.media')} checked={draft.includeMedia !== false} onChange={(value) => set('includeMedia', value)} />
        <CheckField label={t('books.config.notes')} checked={draft.includeNotes !== false} onChange={(value) => set('includeNotes', value)} />
        <CheckField label={t('books.config.privateInformation')} checked={!!draft.includePrivate} onChange={(value) => set('includePrivate', value)} />
      </div>
    </fieldset>
  );
}

function TextField({ label, value, onChange, className = '' }) {
  return <label className={`${labelClass} ${className}`}>{label}<Input className="mt-1" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberField({ label, value, onChange }) {
  return <label className={labelClass}>{label}<Input className="mt-1 max-w-28" type="number" min={1} max={12} value={value} onChange={(event) => onChange(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} /></label>;
}

function SelectField({ label, value, onChange, options }) {
  return <label className={labelClass}>{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function PickerField({ label, children }) {
  return <div><div className="mb-1 text-xs font-medium text-foreground">{label}</div>{children}</div>;
}

function CheckField({ label, checked, onChange }) {
  return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

export default SectionConfigurationSheet;
