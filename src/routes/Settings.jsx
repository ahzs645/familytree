import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import {
  getAppPreferences,
  preferenceDownloadPayload,
  resetAppPreferences,
  saveAppPreferences,
} from '../lib/appPreferences.js';
import { APP_FUNCTIONS, groupedFunctions } from '../lib/functionCatalog.js';
import {
  CALENDAR_OPTIONS,
  DIRECTION_OPTIONS,
  NUMBERING_SYSTEM_OPTIONS,
  SUPPORTED_LOCALES,
} from '../lib/i18n.js';
import { getMapPreferences, saveMapPreferences } from '../lib/placeGeocoding.js';
import { NAME_FORMAT_OPTIONS } from '../lib/nameFormat.js';
import { PLAUSIBILITY_ANALYZERS } from '../lib/plausibility.js';
import { GEDCOM_ENCODINGS } from '../lib/genealogyFileFormats.js';

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'formats', label: 'Formats' },
  { id: 'maps', label: 'Maps' },
  { id: 'export', label: 'Export' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'plausibility', label: 'Plausibility' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'functions', label: 'Functions' },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [prefs, setPrefs] = useState(null);
  const [mapPrefs, setMapPrefs] = useState(null);
  const [status, setStatus] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [app, map] = await Promise.all([getAppPreferences(), getMapPreferences()]);
      if (!cancelled) {
        setPrefs(app);
        setMapPrefs(map);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback((section, key, value) => {
    setPrefs((current) => ({
      ...current,
      [section]: {
        ...(current?.[section] || {}),
        [key]: value,
      },
    }));
  }, []);

  const updateMap = useCallback((key, value) => {
    setMapPrefs((current) => ({ ...(current || {}), [key]: value }));
  }, []);

  const save = useCallback(async () => {
    const [nextPrefs, nextMap] = await Promise.all([
      saveAppPreferences(prefs),
      mapPrefs ? saveMapPreferences(mapPrefs) : Promise.resolve(mapPrefs),
    ]);
    setPrefs(nextPrefs);
    setMapPrefs(nextMap);
    setStatus('Saved');
    setTimeout(() => setStatus(''), 1500);
  }, [mapPrefs, prefs]);

  const reset = useCallback(async () => {
    if (!confirm('Reset application preferences?')) return;
    const next = await resetAppPreferences();
    setPrefs(next);
    setStatus('Reset');
    setTimeout(() => setStatus(''), 1500);
  }, []);

  const exportPrefs = useCallback(() => {
    const blob = new Blob([JSON.stringify(preferenceDownloadPayload(prefs), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudtreeweb-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [prefs]);

  const importPrefs = useCallback(async (file) => {
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    const next = await saveAppPreferences(parsed.preferences || parsed);
    setPrefs(next);
    setStatus('Imported');
    setTimeout(() => setStatus(''), 1500);
  }, []);

  if (!prefs || !mapPrefs) return <div className="p-10 text-muted-foreground">Loading settings...</div>;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5">
        <header className="flex items-center gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Shared defaults for local editing, display, exports, and function shortcuts.</p>
          </div>
          {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
          <button onClick={save} className={primaryButton}>Save</button>
          <button onClick={reset} className={secondaryButton}>Reset</button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-border mb-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 ${activeTab === tab.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'general' && (
          <Panel title="General">
            <Grid>
              <Field label="Theme">
                <select value={theme} onChange={(event) => setTheme(event.target.value)} className={inputClass}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </Field>
              <Field label="Start View">
                <select value={prefs.general.startRoute} onChange={(event) => update('general', 'startRoute', event.target.value)} className={inputClass}>
                  {APP_FUNCTIONS.filter((item) => !item.unavailable).map((item) => <option key={item.to} value={item.to}>{item.label}</option>)}
                </select>
              </Field>
              <Switch label="Confirm Deletes" checked={prefs.general.confirmDeletes} onChange={(value) => update('general', 'confirmDeletes', value)} />
              <Switch label="Auto-save Editors" checked={prefs.general.autoSaveEditors} onChange={(value) => update('general', 'autoSaveEditors', value)} />
              <Switch label="Show Private Records" checked={prefs.general.showPrivateRecords} onChange={(value) => update('general', 'showPrivateRecords', value)} />
              <Switch label="Compact Lists" checked={prefs.general.compactLists} onChange={(value) => update('general', 'compactLists', value)} />
            </Grid>
          </Panel>
        )}

        {activeTab === 'formats' && (
          <Panel title="Names, Dates, and Locale">
            <Grid>
              <Field label="Name Order">
                <select value={prefs.formats.nameOrder} onChange={(event) => update('formats', 'nameOrder', event.target.value)} className={inputClass}>
                  <option value="given-family">Given Family</option>
                  <option value="family-given">Family, Given</option>
                  <option value="display">Stored Display Name</option>
                </select>
              </Field>
              <Field label="Name Display Format">
                <select value={prefs.formats.nameDisplayFormat} onChange={(event) => update('formats', 'nameDisplayFormat', event.target.value)} className={inputClass}>
                  {NAME_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Name Sort Format">
                <select value={prefs.formats.nameSortFormat} onChange={(event) => update('formats', 'nameSortFormat', event.target.value)} className={inputClass}>
                  {NAME_FORMAT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Surname Case">
                <select value={prefs.formats.surnameCase} onChange={(event) => update('formats', 'surnameCase', event.target.value)} className={inputClass}>
                  <option value="as-entered">As Entered</option>
                  <option value="upper">UPPERCASE</option>
                  <option value="title">Title Case</option>
                </select>
              </Field>
              <Field label="Date Display Format">
                <select value={prefs.formats.dateDisplayFormat} onChange={(event) => update('formats', 'dateDisplayFormat', event.target.value)} className={inputClass}>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD MM YYYY">DD MM YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="D MMM YYYY">D MMM YYYY</option>
                </select>
              </Field>
              <Field label="Readable Date Formats">
                <textarea value={prefs.formats.readableDateFormats} onChange={(event) => update('formats', 'readableDateFormats', event.target.value)} rows={5} className={inputClass} />
              </Field>
              <Field label="Language">
                <select value={prefs.localization?.locale || 'en'} onChange={(event) => update('localization', 'locale', event.target.value)} className={inputClass}>
                  {SUPPORTED_LOCALES.map((locale) => (
                    <option key={locale.value} value={locale.value}>{locale.label} - {locale.nativeLabel}</option>
                  ))}
                </select>
              </Field>
              <Field label="Text Direction">
                <select value={prefs.localization?.direction || 'auto'} onChange={(event) => update('localization', 'direction', event.target.value)} className={inputClass}>
                  {DIRECTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Numbering System">
                <select value={prefs.localization?.numberingSystem || 'auto'} onChange={(event) => update('localization', 'numberingSystem', event.target.value)} className={inputClass}>
                  {NUMBERING_SYSTEM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Calendar">
                <select value={prefs.localization?.calendar || 'gregory'} onChange={(event) => update('localization', 'calendar', event.target.value)} className={inputClass}>
                  {CALENDAR_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
            </Grid>
          </Panel>
        )}

        {activeTab === 'maps' && (
          <Panel title="Maps">
            <Grid>
              <Field label="Basemap">
                <select value={mapPrefs.basemap} onChange={(event) => updateMap('basemap', event.target.value)} className={inputClass}>
                  <option value="auto">Auto</option>
                  <option value="positron">Light</option>
                  <option value="voyager">Voyager</option>
                  <option value="dark">Dark</option>
                </select>
              </Field>
              <Field label="Default Zoom">
                <input type="number" min="1" max="18" value={mapPrefs.defaultZoom} onChange={(event) => updateMap('defaultZoom', Number(event.target.value))} className={inputClass} />
              </Field>
              <Field label="Batch Lookup Limit">
                <input type="number" min="1" max="50" value={mapPrefs.batchLimit} onChange={(event) => updateMap('batchLimit', Number(event.target.value))} className={inputClass} />
              </Field>
              <Switch label="Show Labels" checked={mapPrefs.showLabels} onChange={(value) => updateMap('showLabels', value)} />
              <Switch label="Marker Clustering" checked={mapPrefs.markerClustering} onChange={(value) => updateMap('markerClustering', value)} />
            </Grid>
          </Panel>
        )}

        {activeTab === 'export' && (
          <Panel title="Export and PDF">
            <Grid>
              <Field label="PDF Page Size">
                <select value={prefs.pdf.pageSize} onChange={(event) => update('pdf', 'pageSize', event.target.value)} className={inputClass}>
                  <option value="letter">Letter</option>
                  <option value="a4">A4</option>
                  <option value="legal">Legal</option>
                </select>
              </Field>
              <Field label="PDF Orientation">
                <select value={prefs.pdf.orientation} onChange={(event) => update('pdf', 'orientation', event.target.value)} className={inputClass}>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </Field>
              <Field label="PDF Margin">
                <input type="number" min="12" max="144" value={prefs.pdf.margin} onChange={(event) => update('pdf', 'margin', Number(event.target.value))} className={inputClass} />
              </Field>
              <Field label="GEDCOM Encoding (Export)">
                <select value={prefs.exportDefaults.gedcomEncoding} onChange={(event) => update('exportDefaults', 'gedcomEncoding', event.target.value)} className={inputClass}>
                  <option value="utf-8">UTF-8</option>
                  <option value="utf-16">UTF-16</option>
                  <option value="ansi">ANSI</option>
                </select>
              </Field>
              <Field label="GEDCOM Encoding (Import)">
                <select
                  value={prefs.importDefaults?.gedcomEncoding || 'auto'}
                  onChange={(event) => update('importDefaults', 'gedcomEncoding', event.target.value)}
                  className={inputClass}
                >
                  {GEDCOM_ENCODINGS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Website Theme">
                <select value={prefs.exportDefaults.websiteTheme} onChange={(event) => update('exportDefaults', 'websiteTheme', event.target.value)} className={inputClass}>
                  <option value="classic">Classic</option>
                  <option value="compact">Compact</option>
                  <option value="archive">Archive</option>
                </select>
              </Field>
              <Switch label="Include Private Records" checked={prefs.exportDefaults.includePrivate} onChange={(value) => update('exportDefaults', 'includePrivate', value)} />
              <Switch label="Include Media" checked={prefs.exportDefaults.includeMedia} onChange={(value) => update('exportDefaults', 'includeMedia', value)} />
            </Grid>
            <div className="flex gap-2 mt-5">
              <button onClick={exportPrefs} className={secondaryButton}>Download Preferences</button>
              <button onClick={() => fileRef.current?.click()} className={secondaryButton}>Import Preferences</button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => importPrefs(event.target.files?.[0])} />
            </div>
          </Panel>
        )}

        {activeTab === 'privacy' && (
          <Panel title="Privacy">
            <Grid>
              <Switch label="Hide Marked-Private Records" checked={prefs.privacy.hideMarkedPrivate !== false} onChange={(value) => update('privacy', 'hideMarkedPrivate', value)} />
              <Switch label="Hide Living Persons" checked={!!prefs.privacy.hideLivingPersons} onChange={(value) => update('privacy', 'hideLivingPersons', value)} />
              <Switch label="Mask Details Only (Keep Person Visible)" checked={!!prefs.privacy.hideLivingDetailsOnly} onChange={(value) => update('privacy', 'hideLivingDetailsOnly', value)} />
              <Field label="Living Person Threshold (years)">
                <input type="number" min="1" max="200" value={prefs.privacy.livingPersonThresholdYears} onChange={(event) => update('privacy', 'livingPersonThresholdYears', Number(event.target.value))} className={inputClass} />
              </Field>
            </Grid>
            <p className="mt-3 text-xs text-muted-foreground">
              These defaults apply to GEDCOM and website exports. A person is considered living when no death date is recorded and their birth year is within the threshold.
            </p>
          </Panel>
        )}

        {activeTab === 'plausibility' && (
          <Panel title="Plausibility Analyzers">
            <div className="space-y-2">
              {PLAUSIBILITY_ANALYZERS.map((a) => (
                <label key={a.id} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={prefs.plausibility?.enabled?.[a.id] !== false}
                    onChange={(e) => update('plausibility', 'enabled', { ...(prefs.plausibility?.enabled || {}), [a.id]: e.target.checked })}
                  />
                  <span className="flex-1">{a.label}</span>
                </label>
              ))}
            </div>
            <Grid>
              <Field label="Max lifespan (years)">
                <input type="number" min="1" max="200" value={prefs.plausibility.thresholds.maxLifespan} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, maxLifespan: Number(e.target.value) })} className={inputClass} />
              </Field>
              <Field label="Min marriage age">
                <input type="number" min="1" max="50" value={prefs.plausibility.thresholds.minMarriageAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, minMarriageAge: Number(e.target.value) })} className={inputClass} />
              </Field>
              <Field label="Min parent age">
                <input type="number" min="1" max="50" value={prefs.plausibility.thresholds.minParentAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, minParentAge: Number(e.target.value) })} className={inputClass} />
              </Field>
              <Field label="Max parent age">
                <input type="number" min="1" max="100" value={prefs.plausibility.thresholds.maxParentAge} onChange={(e) => update('plausibility', 'thresholds', { ...prefs.plausibility.thresholds, maxParentAge: Number(e.target.value) })} className={inputClass} />
              </Field>
            </Grid>
          </Panel>
        )}

        {activeTab === 'integrations' && (
          <Panel title="Web Search and FamilySearch">
            <Grid>
              <Field label="Web Search Provider">
                <select value={prefs.webSearch.provider} onChange={(event) => update('webSearch', 'provider', event.target.value)} className={inputClass}>
                  <option value="familysearch">FamilySearch</option>
                  <option value="ancestry">Ancestry</option>
                  <option value="findagrave">Find a Grave</option>
                  <option value="google">Google</option>
                  <option value="custom">Custom</option>
                </select>
              </Field>
              <Field label="Custom Search URL">
                <input value={prefs.webSearch.customUrl} onChange={(event) => update('webSearch', 'customUrl', event.target.value)} className={inputClass} />
              </Field>
              <Field label="Default FamilySearch Task">
                <select value={prefs.familySearch.defaultTaskType} onChange={(event) => update('familySearch', 'defaultTaskType', event.target.value)} className={inputClass}>
                  <option value="match-review">Match Review</option>
                  <option value="record-match-review">Record Match Review</option>
                  <option value="picture-review">Picture Review</option>
                  <option value="ordinance-review">Ordinance Review</option>
                  <option value="sync-review">Sync Review</option>
                </select>
              </Field>
              <Switch label="Open Search in New Tab" checked={prefs.webSearch.openInNewTab} onChange={(value) => update('webSearch', 'openInNewTab', value)} />
              <Switch label="Show Matched People" checked={prefs.familySearch.showMatched} onChange={(value) => update('familySearch', 'showMatched', value)} />
              <Switch label="Show Unmatched People" checked={prefs.familySearch.showUnmatched} onChange={(value) => update('familySearch', 'showUnmatched', value)} />
            </Grid>
          </Panel>
        )}

        {activeTab === 'functions' && (
          <FunctionsPanel prefs={prefs} setPrefs={setPrefs} />
        )}
      </div>
    </div>
  );
}

function FunctionsPanel({ prefs, setPrefs }) {
  const groups = useMemo(() => groupedFunctions(APP_FUNCTIONS.filter((item) => !item.unavailable)), []);
  const toggleList = (listName, route) => {
    setPrefs((current) => {
      const set = new Set(current.functions[listName] || []);
      if (set.has(route)) set.delete(route);
      else set.add(route);
      return {
        ...current,
        functions: {
          ...current.functions,
          [listName]: [...set],
        },
      };
    });
  };

  return (
    <Panel title="Functions">
      <div className="space-y-5">
        {Object.entries(groups).map(([category, items]) => (
          <section key={category}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{category}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((item) => (
                <div key={item.to} className="rounded-md border border-border bg-card p-3">
                  <div className="text-sm font-medium mb-2">{item.label}</div>
                  <div className="flex flex-wrap gap-2">
                    <CheckButton active={prefs.functions.favorites.includes(item.to)} onClick={() => toggleList('favorites', item.to)}>Favorite</CheckButton>
                    <CheckButton active={prefs.functions.emphasized.includes(item.to)} onClick={() => toggleList('emphasized', item.to)}>Emphasized</CheckButton>
                    <CheckButton active={prefs.functions.hidden.includes(item.to)} onClick={() => toggleList('hidden', item.to)}>Hidden</CheckButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Panel>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <span className="text-sm">{label}</span>
      <input type="checkbox" checked={!!checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function CheckButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary text-foreground'}`}
    >
      {children}
    </button>
  );
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';
const primaryButton = 'rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60';
const secondaryButton = 'rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60';
