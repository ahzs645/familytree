import React, { useMemo, useRef, useState } from 'react';
import { FileDown, FileText, Rows3, Send, Settings2 } from 'lucide-react';
import { formatInteger, getCurrentLocalization } from '../../lib/i18n.js';
import { useTranslation } from '../../contexts/LocalizationContext.jsx';
import { Select } from '../ui/Select.jsx';
import { listToolbarButtonClass, listToolbarIconButtonClass } from './listToolbarClasses.js';

const INFO_COLUMN_DEFS = [
  { value: '', labelKey: 'lists.infoDoNotShow' },
  { value: 'fullName', labelKey: 'lists.infoName' },
  { value: 'birthDate', labelKey: 'lists.infoBirthDate' },
  { value: 'birthPlace', labelKey: 'lists.infoBirthPlace' },
  { value: 'deathDate', labelKey: 'lists.infoDeathDate' },
  { value: 'deathPlace', labelKey: 'lists.infoDeathPlace' },
  { value: 'genderLabel', labelKey: 'lists.infoGender' },
  { value: 'lifespan', labelKey: 'lists.infoLifespan' },
  { value: 'id', labelKey: 'lists.infoRecordId' },
];

export const DEFAULT_LIST_REPORT_OPTIONS = Object.freeze({
  previewMode: false,
  sorting: 'current',
  separateSections: true,
  sortAscending: true,
  hidePrivate: false,
  personPictureColumn: true,
  informationColumns: ['birthDate', 'birthPlace', '', '', '', ''],
  localization: 'en',
  sourceCitations: false,
  citationMode: 'short',
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
  const { t } = useTranslation();
  // Single panel state: which tab is active inside the Customize popover.
  // When `panel` is null the popover is closed.
  const [panel, setPanel] = useState(null);
  const ref = useRef(null);
  const previewMode = Boolean(options.previewMode);

  const directActions = [
    { id: 'save', label: t('lists.saveReport'), icon: FileDown, onClick: () => downloadReportHtml(title, rows, columns, options) },
    { id: 'share', label: t('lists.share'), icon: Send, onClick: () => shareReport(title, rows) },
  ];

  const openCustomize = () => setPanel((current) => (current ? null : 'report'));

  return (
    <div ref={ref} className={`relative flex flex-wrap items-center gap-1.5 ${compact ? '' : 'ms-auto'}`}>
      <button
        type="button"
        onClick={() => onPreviewChange?.(!previewMode)}
        className={listToolbarButtonClass}
        aria-pressed={previewMode}
      >
        {previewMode ? <Rows3 size={14} /> : <FileText size={14} />}
        {previewMode ? t('lists.list') : t('lists.preview')}
      </button>
      {directActions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            type="button"
            key={action.id}
            onClick={action.onClick}
            className={listToolbarIconButtonClass}
            title={action.label}
            aria-label={action.label}
          >
            <Icon size={14} />
          </button>
        );
      })}
      <button
        type="button"
        onClick={openCustomize}
        className={listToolbarButtonClass}
        title={t('lists.customize')}
        aria-haspopup="dialog"
        aria-expanded={Boolean(panel)}
      >
        <Settings2 size={14} />
        <span className={compact ? 'sr-only' : ''}>{t('lists.customize')}</span>
      </button>
      {panel && (
        <ListReportOptionsPanel
          panel={panel}
          setPanel={setPanel}
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
  const { t } = useTranslation();
  const localization = getCurrentLocalization();
  const visibleColumns = useMemo(() => reportColumns(columns, options), [columns, options]);
  const preparedRows = useMemo(() => prepareRows(rows, options), [rows, options]);
  const grouped = useMemo(() => {
    if (!options.separateSections) return [{ key: '', label: '', rows: preparedRows }];
    const map = new Map();
    for (const row of preparedRows) {
      const value = String(row.fullName || row.name || row.label || row.title || row.id || '').trim();
      const key = value ? value[0].toLocaleUpperCase() : '#';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, groupRows]) => ({
      key,
      label: key === '#' ? t('lists.personsWithoutLastName') : key,
      rows: groupRows,
    }));
  }, [preparedRows, options.separateSections, t]);

  const languageLabel = options.localization === 'en' ? t('lists.langEnglish') : options.localization;
  const headerLine = options.sourceCitations
    ? t('lists.rowsWithCitations', { count: formatInteger(preparedRows.length, localization), language: languageLabel, mode: options.citationMode })
    : t('lists.rowsCount', { count: formatInteger(preparedRows.length, localization), language: languageLabel });

  return (
    <div className="h-full overflow-auto bg-muted/30 p-4 md:p-8">
      <article className={`mx-auto min-h-full max-w-5xl border border-border bg-white p-6 text-slate-950 shadow-sm ${options.orientation === 'landscape' ? 'aspect-[11/8.5]' : 'aspect-[8.5/11]'}`}>
        <header className="mb-5 border-b border-slate-200 pb-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{t('lists.reportPreview')}</div>
          <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
          <div className="mt-1 text-xs text-slate-500">{headerLine}</div>
        </header>
        {grouped.map((group) => (
          <section key={group.key || 'all'} className="mb-6 break-inside-avoid">
            {group.label && <h3 className="mb-2 text-sm font-semibold text-slate-700">{group.label}</h3>}
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50">
                  {options.personPictureColumn && <th className="w-16 px-2 py-2 text-start font-semibold text-slate-600">{t('lists.picture')}</th>}
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

function ListReportOptionsPanel({ panel, setPanel, options, update, updateInfoColumn, onClose }) {
  const { t } = useTranslation();
  const infoColumnOptions = INFO_COLUMN_DEFS.map((item) => [item.value, t(item.labelKey)]);
  const tabs = [
    { id: 'report', label: t('lists.report') },
    { id: 'page', label: t('lists.page') },
  ];
  return (
    <div className="absolute end-0 top-[calc(100%+0.4rem)] z-30 w-[min(360px,calc(100vw-2rem))] rounded-md border border-border bg-card p-4 text-sm shadow-xl">
      <div className="mb-3 flex items-center gap-3">
        <div className="text-sm font-semibold">{t('lists.customize')}</div>
        <button type="button" onClick={onClose} className="ms-auto rounded-md border border-border bg-secondary px-2 py-1 text-xs hover:bg-accent">{t('lists.close')}</button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPanel?.(tab.id)}
            className={`px-2.5 py-1.5 text-xs font-semibold border-b-2 ${panel === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            aria-pressed={panel === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {panel === 'report' && (
        <div className="space-y-4">
          <OptionGroup title={t('lists.general')}>
            <SelectField label={t('lists.sorting')} value={options.sorting} onChange={(value) => update('sorting', value)} options={[
              ['current', t('lists.sortCurrent')],
              ['lastName', t('lists.sortLastName')],
              ['birthDate', t('lists.sortBirthDate')],
              ['recordId', t('lists.sortRecordId')],
            ]} />
            <CheckField label={t('lists.separateSections')} checked={options.separateSections} onChange={(value) => update('separateSections', value)} />
            <CheckField label={t('lists.sortAscending')} checked={options.sortAscending} onChange={(value) => update('sortAscending', value)} />
            <CheckField label={t('lists.hidePrivate')} checked={options.hidePrivate} onChange={(value) => update('hidePrivate', value)} />
          </OptionGroup>
          <OptionGroup title={t('lists.columnsHeading')}>
            <CheckField label={t('lists.personPictureColumn')} checked={options.personPictureColumn} onChange={(value) => update('personPictureColumn', value)} />
            {options.informationColumns.map((value, index) => (
              <SelectField key={index} label={t('lists.informationColumn', { index: index + 1 })} value={value} onChange={(next) => updateInfoColumn(index, next)} options={infoColumnOptions} />
            ))}
          </OptionGroup>
          <OptionGroup title={t('lists.localization')}>
            <SelectField label={t('lists.localization')} value={options.localization} onChange={(value) => update('localization', value)} options={[
              ['en', t('lists.langEnglish')],
              ['ar', t('lists.langArabic')],
              ['he', t('lists.langHebrew')],
              ['system', t('lists.langSystem')],
            ]} />
          </OptionGroup>
          <OptionGroup title={t('lists.citations')}>
            <CheckField label={t('lists.sourceCitations')} checked={options.sourceCitations} onChange={(value) => update('sourceCitations', value)} />
            <SelectField label={t('lists.citationsMode')} value={options.citationMode} onChange={(value) => update('citationMode', value)} options={[
              ['short', t('lists.citationShort')],
              ['full', t('lists.citationFull')],
              ['footnotes', t('lists.citationFootnotes')],
            ]} />
          </OptionGroup>
        </div>
      )}
      {panel === 'page' && (
        <OptionGroup title={t('lists.page')}>
          <SelectField label={t('lists.orientation')} value={options.orientation} onChange={(value) => update('orientation', value)} options={[
            ['portrait', t('lists.orientationPortrait')],
            ['landscape', t('lists.orientationLandscape')],
          ]} />
        </OptionGroup>
      )}
    </div>
  );
}

// Maps a `sorting` option value to the row field used for comparison.
// `current`/`none` (or anything unrecognized) means "leave order unchanged".
const SORT_KEY_BY_OPTION = {
  lastName: 'lastName',
  birthDate: 'birthYear',
  recordId: 'id',
};

// Returns a copy of `rows` filtered (hidePrivate) and sorted per options.
// Never mutates the incoming array.
function prepareRows(rows, options) {
  let prepared = rows;
  if (options.hidePrivate) {
    prepared = prepared.filter((row) => !row.private);
  }
  const sortKey = SORT_KEY_BY_OPTION[options.sorting];
  if (sortKey) {
    const direction = options.sortAscending === false ? -1 : 1;
    prepared = [...prepared].sort((a, b) => compareValues(a[sortKey], b[sortKey]) * direction);
  } else if (prepared === rows) {
    // Ensure callers always get a fresh array they can safely reuse.
    prepared = [...prepared];
  }
  return prepared;
}

// Stable, locale-aware comparison: numeric where both sides are numbers,
// otherwise a locale-aware string compare. Nullish values sort last.
function compareValues(a, b) {
  const aMissing = a == null || a === '';
  const bMissing = b == null || b === '';
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return String(a).localeCompare(String(b));
}

function reportColumns(columns, options) {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const selected = options.informationColumns
    .map((key) => byKey.get(key) || INFO_COLUMN_DEFS.find((column) => column.value === key))
    .filter(Boolean)
    .map((column) => ({ key: column.key || column.value, label: column.label || column.labelKey }));
  if (selected.length) return selected;
  return columns.slice(0, 6);
}

function renderCell(row, column) {
  if (column.render) return column.render(row);
  const value = row[column.key];
  if (value == null || value === '') return '—';
  return String(value);
}

// Resolves a plain-text cell value for HTML export, mirroring how the
// on-screen `renderCell` resolves a displayable value. Prefers an explicit
// `exportValue`, then the raw key value, then a text extraction of `render`.
// Columns flagged `export: false` are skipped. Never throws.
function exportCellValue(row, column) {
  if (column.export === false) return '';
  try {
    if (typeof column.exportValue === 'function') {
      return stringifyCell(column.exportValue(row));
    }
    const value = row[column.key];
    if (value != null && value !== '') return stringifyCell(value);
    if (column.render) return stringifyCell(column.render(row));
    return '';
  } catch {
    return '';
  }
}

// Best-effort text extraction from a cell value, including React elements
// produced by a `render` function (pull readable strings out of children).
function stringifyCell(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringifyCell).join('');
  if (typeof value === 'object') {
    if ('props' in value && value.props && 'children' in value.props) {
      return stringifyCell(value.props.children);
    }
    return '';
  }
  return String(value);
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
      <Select
        value={value}
        onChange={onChange}
        options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))}
        triggerClassName="h-9 px-2 text-xs"
      />
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
  const exportColumns = reportColumns(columns, options);
  const preparedRows = prepareRows(rows, options);
  const header = exportColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
  const body = preparedRows.map((row) => `<tr>${exportColumns.map((column) => `<td>${escapeHtml(exportCellValue(row, column))}</td>`).join('')}</tr>`).join('');
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
