/**
 * Saved Charts gallery — every chart template the user has saved.
 * Click a card to open /charts pre-configured with that template.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { listChartTemplates, deleteChartTemplate, saveChartTemplate, newTemplateId } from '../lib/chartTemplates.js';
import { listChartDocuments, deleteChartDocument } from '../lib/chartDocuments.js';
import { useRecords } from '../lib/data/useRecords.js';
import { useModal } from '../contexts/ModalContext.jsx';

const CHART_LABELS = {
  ancestor: 'Ancestor',
  descendant: 'Descendant',
  hourglass: 'Hourglass',
  tree: 'Tree (horizontal)',
  'family-chart': 'Family Chart',
  'double-ancestor': 'Double Ancestor',
  fan: 'Fan',
  circular: 'Circular Tree',
  'radial-descendant': 'Radial Descendant',
  symmetrical: 'Symmetrical Tree',
  distribution: 'Distribution',
  lifespan: 'Lifespan',
  timeline: 'Timeline',
  genogram: 'Genogram',
  sociogram: 'Sociogram',
  'fractal-h-tree': 'Fractal H-Tree',
  'square-tree': 'Square Tree',
  'fractal-tree': 'Fractal Tree',
  relationship: 'Relationship Path',
  virtual: 'Virtual Tree',
};

const ACCENT = {
  ancestor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  descendant: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  hourglass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  tree: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  'family-chart': 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  'double-ancestor': 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  fan: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  circular: 'bg-lime-500/15 text-lime-700 dark:text-lime-300',
  'radial-descendant': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  symmetrical: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  distribution: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  lifespan: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  timeline: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  genogram: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300',
  sociogram: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  'fractal-h-tree': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  'square-tree': 'bg-green-500/15 text-green-700 dark:text-green-300',
  'fractal-tree': 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  relationship: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  virtual: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

function importedLayoutStatus(view) {
  const decodedRaw = view.fields?.chartObjectsContainerDataDecoded?.value;
  if (decodedRaw) {
    try {
      const decoded = JSON.parse(decodedRaw);
      if (decoded.status === 'decoded') return 'decoded Mac layout';
      if (decoded.status === 'unsupported-binary') return 'archived binary layout preserved';
    } catch {
      // Fall through to byte-preservation wording.
    }
  }
  if (view.fields?.chartObjectsContainerData?.value) return 'archived layout preserved';
  return 'metadata only; no Mac layout payload in this file';
}

export default function SavedCharts() {
  const modal = useModal();
  const [templates, setTemplates] = useState(null);
  const [documents, setDocuments] = useState([]);
  const navigate = useNavigate();

  const { records: importedViews } = useRecords('SavedChart');
  const reloadAll = useCallback(async () => {
    setTemplates(await listChartTemplates());
    setDocuments(await listChartDocuments());
  }, []);
  useEffect(() => { reloadAll(); }, [reloadAll]);

  const onDelete = async (id) => {
    if (!(await modal.confirm('Delete this saved chart?', { title: 'Delete chart', okLabel: 'Delete', destructive: true }))) return;
    await deleteChartTemplate(id);
    reloadAll();
  };

  const onDeleteDocument = async (id) => {
    if (!(await modal.confirm('Delete this chart document?', { title: 'Delete document', okLabel: 'Delete', destructive: true }))) return;
    await deleteChartDocument(id);
    reloadAll();
  };

  const onDuplicate = async (tpl) => {
    const name = await modal.prompt('Name for the copy:', `${tpl.name} (copy)`, { title: 'Duplicate chart' });
    if (!name) return;
    await saveChartTemplate({ ...tpl, id: newTemplateId(), name });
    reloadAll();
  };

  if (templates == null) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5">
        <header className="mb-5">
          <h2 className="text-xl font-bold">Saved Charts</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.length + documents.length + importedViews.length === 0
              ? 'No saved charts yet. Configure a chart in Charts and click Save to store the layout.'
              : `${templates.length + documents.length + importedViews.length} saved chart configuration${templates.length + documents.length + importedViews.length === 1 ? '' : 's'}`}
          </p>
        </header>

        {documents.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-3">Editable Web Chart Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 ${ACCENT[doc.chartType] || 'bg-muted text-muted-foreground'}`}>
                      {CHART_LABELS[doc.chartType] || doc.chartType}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{doc.overlays?.length || 0} overlays</span>
                  </div>
                  <div className="text-sm font-semibold mb-1 truncate">{doc.name}</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {doc.generations ? `${doc.generations} generations` : ''}
                    {doc.savedAt && ` · saved ${new Date(doc.savedAt).toLocaleDateString()}`}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => navigate(`/charts?document=${doc.id}`)} className="flex-1">
                      Open
                    </Button>
                    <button onClick={() => onDeleteDocument(doc.id)}
                      className="border border-border text-destructive-text rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {templates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <div key={t.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 ${ACCENT[t.chartType] || 'bg-muted text-muted-foreground'}`}>
                    {CHART_LABELS[t.chartType] || t.chartType}
                  </span>
                  {t.themeId && t.themeId !== 'auto' && (
                    <span className="text-[10px] text-muted-foreground">{t.themeId}</span>
                  )}
                </div>
                <div className="text-sm font-semibold mb-1 truncate">{t.name}</div>
                <div className="text-xs text-muted-foreground mb-3">
                  {t.generations ? `${t.generations} generations` : ''}
                  {t.savedAt && ` · saved ${new Date(t.savedAt).toLocaleDateString()}`}
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => navigate(`/charts?type=${t.chartType}&template=${t.id}`)} className="flex-1">
                    Open
                  </Button>
                  <button onClick={() => onDuplicate(t)}
                    className="border border-border bg-secondary text-foreground rounded-md px-3 py-1.5 text-xs">
                    Copy
                  </button>
                  <button onClick={() => onDelete(t.id)}
                    className="border border-border text-destructive-text rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {importedViews.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold mb-3">Imported MacFamilyTree Saved Charts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {importedViews.map((view) => (
                <div key={view.recordName} className="rounded-lg border border-border bg-card p-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5 bg-secondary text-muted-foreground">SavedChart</span>
                  <div className="text-sm font-semibold mt-2 mb-1 truncate">{view.fields?.title?.value || view.fields?.name?.value || view.recordName}</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {view.fields?.author?.value || 'MacFamilyTree import'}
                    {' · '}{importedLayoutStatus(view)}
                  </div>
                  <Button variant="primary" size="sm" onClick={() => navigate(`/charts?imported=${encodeURIComponent(view.recordName)}`)}>
                    Open Web Chart
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
