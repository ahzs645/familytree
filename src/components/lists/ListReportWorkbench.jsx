import React, { useMemo, useRef, useState } from 'react';
import { Edit3, FileDown, FileText, LayoutTemplate, Palette, Printer, Rows3, Send, Settings2 } from 'lucide-react';
import { formatInteger, getCurrentLocalization } from '../../lib/i18n.js';

const INFO_COLUMNS = [
  { value: '', label: 'Do not show' },
  { value: 'fullName', label: 'Name' },
  { value: 'birthDate', label: 'Birth Date' },
  { value: 'birthPlace', label: 'Birth Place' },
  { value: 'deathDate', label: 'Death Date' },
  { value: 'deathPlace', label: 'Death Place' },
  { value: 'genderLabel', label: 'Gender' },
  { value: 'lifespan', label: 'Lifespan' },
  { value: 'id', label: 'Record ID' },
];

export const DEFAULT_LIST_REPORT_OPTIONS = Object.freeze({
  previewMode: false,
  sorting: 'current',
  separateSections: true,
  sortAscending: true,
  smartFilter: 'none',
  hidePrivate: false,
  separateNameComponents: false,
  personPictureColumn: true,
  informationColumns: ['birthDate', 'birthPlace', '', '', '', ''],
  localization: 'en',
  sourceCitations: false,
  citationMode: 'short',
  includeCitationText: true,
  includeSourceCitationNotes: false,
  includeSourceNotes: false,
  includeReferencedEntries: false,
  includeSourceRepository: false,
  includePictures: false,
  pictureSize: 'small',
  theme: 'classic',
  style: 'compact',
  paperSize: 'letter',
  orientation: 'portrait',
});

export function useListReportOptions(initial = {}) {
  const [options, setOptions] = useState(() => ({ ...DEFAULT_LIST_REPORT_OPTIONS, ...initial }));
  const update = (key, value) => setOptions((current) => ({ ...current, [key]: value }));
  const updateInfoColumn = (index, value) => setOptions((current) => {
    const informationColumns = [...current.informationColumns];
    informationColumns[index] = value;
    return { ...current, informationColumns };
  });
  return { options, setOptions, update, updateInfoColumn };
}

export function ListReportToolbar({
  title,
  rows = [],
  columns = [],
  options,
  update,
  updateInfoColumn,
  onPreviewChange,
  compact = false,
}) {
  const [panel, setPanel] = useState(null);
  const ref = useRef(null);
  const previewMode = Boolean(options.previewMode);
  const actions = [
    { id: 'save', label: 'Save Report', icon: FileDown, onClick: () => downloadReportHtml(title, rows, columns, options) },
    { id: 'share', label: 'Share', icon: Send, onClick: () => shareReport(title, rows) },
    { id: 'edit', label: 'Edit', icon: Edit3, onClick: () => onPreviewChange?.(!previewMode) },
    { id: 'theme', label: 'Theme', icon: Palette, panel: 'theme' },
    { id: 'report', label: 'Report', icon: FileText, panel: 'report' },
    { id: 'style', label: 'Style', icon: LayoutTemplate, panel: 'style' },
    { id: 'page', label: 'Page', icon: Printer, panel: 'page' },
  ];

  return (
    <div ref={ref} className={`relative flex flex-wrap items-center gap-1.5 ${compact ? '' : 'ms-auto'}`}>
      <button
        type="button"
        onClick={() => onPreviewChange?.(!previewMode)}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs hover:bg-accent"
        aria-pressed={previewMode}
      >
        {previewMode ? <Rows3 size={14} /> : <FileText size={14} />}
        {previewMode ? 'List' : 'Preview'}
      </button>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            type="button"
            key={action.id}
            onClick={() => action.panel ? setPanel((current) => current === action.panel ? null : action.panel) : action.onClick?.()}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs hover:bg-accent"
            title={action.label}
          >
            <Icon size={14} />
            <span className={compact ? 'sr-only' : ''}>{action.label}</span>
          </button>
        );
      })}
      {panel && (
        <ListReportOptionsPanel
          panel={panel}
          options={options}
          update={update}
          updateInfoColumn={updateInfoColumn}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}

export function ListReportPreview({ title, rows = [], columns = [], options = DEFAULT_LIST_REPORT_OPTIONS }) {
  const localization = getCurrentLocalization();
  const visibleColumns = useMemo(() => reportColumns(columns, options), [columns, options]);
  const grouped = useMemo(() => {
    if (!options.separateSections) return [{ key: '', label: '', rows }];
    const map = new Map();
    for (const row of rows) {
      const value = String(row.fullName || row.name || row.label || row.title || row.id || '').trim();
      const key = value ? value[0].toLocaleUpperCase() : '#';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, groupRows]) => ({
      key,
      label: key === '#' ? 'Persons without Last Name' : key,
      rows: groupRows,
    }));
  }, [rows, options.separateSections]);

  return (
    <div className="h-full overflow-auto bg-muted/30 p-4 md:p-8">
      <article className={`mx-auto min-h-full max-w-5xl border border-border bg-white p-6 text-slate-950 shadow-sm ${options.orientation === 'landscape' ? 'aspect-[11/8.5]' : 'aspect-[8.5/11]'}`}>
        <header className="mb-5 border-b border-slate-200 pb-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Report Preview</div>
          <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
          <div className="mt-1 text-xs text-slate-500">
            {formatInteger(rows.length, localization)} rows · {options.localization === 'en' ? 'English' : options.localization}
            {options.sourceCitations ? ` · ${options.citationMode} citations` : ''}
          </div>
        </header>
        {grouped.map((group) => (
          <section key={group.key || 'all'} className="mb-6 break-inside-avoid">
            {group.label && <h3 className="mb-2 text-sm font-semibold text-slate-700">{group.label}</h3>}
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50">
                  {options.personPictureColumn && <th className="w-16 px-2 py-2 text-start font-semibold text-slate-600">Picture</th>}
                  {visibleColumns.map((column) => <th key={column.key} className="px-2 py-2 text-start font-semibold text-slate-600">{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, index) => (
                  <tr key={`${row.id || row.recordName || 'row'}-${index}`} className="border-b border-slate-100">
                    {options.personPictureColumn && (
                      <td className="px-2 py-2">
                        <div className="h-8 w-8 rounded-sm border border-slate-200 bg-slate-100" />
                      </td>
                    )}
                    {visibleColumns.map((column) => (
                      <td key={column.key} className="px-2 py-2 align-top">{renderCell(row, column)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </article>
    </div>
  );
}

function ListReportOptionsPanel({ panel, options, update, updateInfoColumn, onClose }) {
  return (
    <div className="absolute end-0 top-[calc(100%+0.4rem)] z-30 w-[min(360px,calc(100vw-2rem))] rounded-md border border-border bg-card p-4 text-sm shadow-xl">
      <div className="mb-3 flex items-center gap-3">
        <div className="text-sm font-semibold">{panelLabel(panel)}</div>
        <button type="button" onClick={onClose} className="ms-auto rounded-md border border-border bg-secondary px-2 py-1 text-xs hover:bg-accent">Close</button>
      </div>
      {panel === 'report' && (
        <div className="space-y-4">
          <OptionGroup title="General">
            <SelectField label="Sorting" value={options.sorting} onChange={(value) => update('sorting', value)} options={[
              ['current', 'Current sort'],
              ['lastName', 'By Last Name'],
              ['birthDate', 'By Birth Date'],
              ['recordId', 'By Record ID'],
            ]} />
            <CheckField label="Separate Sections" checked={options.separateSections} onChange={(value) => update('separateSections', value)} />
            <CheckField label="Sort Ascending" checked={options.sortAscending} onChange={(value) => update('sortAscending', value)} />
            <SelectField label="Smart Filter" value={options.smartFilter} onChange={(value) => update('smartFilter', value)} options={[
              ['none', 'No Smart Filter'],
              ['bookmarked', 'Bookmarked'],
              ['private', 'Private records'],
              ['missingDates', 'Missing dates'],
            ]} />
            <CheckField label="Hide Information marked as Private" checked={options.hidePrivate} onChange={(value) => update('hidePrivate', value)} />
          </OptionGroup>
          <OptionGroup title="Columns">
            <CheckField label="Separate Columns for Name Components" checked={options.separateNameComponents} onChange={(value) => update('separateNameComponents', value)} />
            <CheckField label="Separate Column for Person Picture" checked={options.personPictureColumn} onChange={(value) => update('personPictureColumn', value)} />
            {options.informationColumns.map((value, index) => (
              <SelectField key={index} label={`Information Column ${index + 1}`} value={value} onChange={(next) => updateInfoColumn(index, next)} options={INFO_COLUMNS.map((item) => [item.value, item.label])} />
            ))}
          </OptionGroup>
          <OptionGroup title="Localization">
            <SelectField label="Localization" value={options.localization} onChange={(value) => update('localization', value)} options={[
              ['en', 'English'],
              ['ar', 'Arabic'],
              ['he', 'Hebrew'],
              ['system', 'System default'],
            ]} />
          </OptionGroup>
          <OptionGroup title="Citations">
            <CheckField label="Source Citations" checked={options.sourceCitations} onChange={(value) => update('sourceCitations', value)} />
            <SelectField label="Citations Mode" value={options.citationMode} onChange={(value) => update('citationMode', value)} options={[
              ['short', 'Short Citations Style'],
              ['full', 'Full Citations Style'],
              ['footnotes', 'Footnotes'],
            ]} />
            <CheckField label="Text" checked={options.includeCitationText} onChange={(value) => update('includeCitationText', value)} />
            <CheckField label="Source Citation Notes" checked={options.includeSourceCitationNotes} onChange={(value) => update('includeSourceCitationNotes', value)} />
            <CheckField label="Source Notes" checked={options.includeSourceNotes} onChange={(value) => update('includeSourceNotes', value)} />
            <CheckField label="Referenced Entries" checked={options.includeReferencedEntries} onChange={(value) => update('includeReferencedEntries', value)} />
            <CheckField label="Source Repository" checked={options.includeSourceRepository} onChange={(value) => update('includeSourceRepository', value)} />
            <CheckField label="Pictures" checked={options.includePictures} onChange={(value) => update('includePictures', value)} />
            <SelectField label="Pictures Size" value={options.pictureSize} onChange={(value) => update('pictureSize', value)} options={[
              ['small', 'Small'],
              ['medium', 'Medium'],
              ['large', 'Large'],
            ]} />
          </OptionGroup>
        </div>
      )}
      {panel === 'theme' && (
        <OptionGroup title="Theme">
          <SelectField label="Report Theme" value={options.theme} onChange={(value) => update('theme', value)} options={[
            ['classic', 'Classic'],
            ['compact', 'Compact'],
            ['archive', 'Archive'],
            ['presentation', 'Presentation'],
          ]} />
        </OptionGroup>
      )}
      {panel === 'style' && (
        <OptionGroup title="Style">
          <SelectField label="Table Style" value={options.style} onChange={(value) => update('style', value)} options={[
            ['compact', 'Compact rows'],
            ['comfortable', 'Comfortable rows'],
            ['ruled', 'Ruled table'],
          ]} />
        </OptionGroup>
      )}
      {panel === 'page' && (
        <OptionGroup title="Page">
          <SelectField label="Paper" value={options.paperSize} onChange={(value) => update('paperSize', value)} options={[
            ['letter', 'Letter'],
            ['a4', 'A4'],
            ['legal', 'Legal'],
          ]} />
          <SelectField label="Orientation" value={options.orientation} onChange={(value) => update('orientation', value)} options={[
            ['portrait', 'Portrait'],
            ['landscape', 'Landscape'],
          ]} />
        </OptionGroup>
      )}
    </div>
  );
}

function reportColumns(columns, options) {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const selected = options.informationColumns
    .map((key) => byKey.get(key) || INFO_COLUMNS.find((column) => column.value === key))
    .filter(Boolean)
    .map((column) => ({ key: column.key || column.value, label: column.label }));
  if (selected.length) return selected;
  return columns.slice(0, 6);
}

function renderCell(row, column) {
  if (column.render) return column.render(row);
  const value = row[column.key];
  if (value == null || value === '') return '—';
  return String(value);
}

function panelLabel(panel) {
  if (panel === 'theme') return 'Theme';
  if (panel === 'style') return 'Style';
  if (panel === 'page') return 'Page';
  return 'Report';
}

function OptionGroup({ title, children }) {
  return (
    <section>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-border bg-secondary px-2 text-xs text-foreground">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label className="flex min-h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function downloadReportHtml(title, rows, columns, options) {
  const safeTitle = String(title || 'Report').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') || 'report';
  const header = reportColumns(columns, options).map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = rows.map((row) => `<tr>${reportColumns(columns, options).map((column) => `<td>${escapeHtml(row[column.key] ?? '')}</td>`).join('')}</tr>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(title)}</title><h1>${escapeHtml(title)}</h1><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

async function shareReport(title, rows) {
  const text = `${title}\n${rows.length.toLocaleString()} rows`;
  if (navigator.share) {
    await navigator.share({ title, text });
    return;
  }
  await navigator.clipboard?.writeText(text).catch(() => {});
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}
