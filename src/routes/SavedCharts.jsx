/**
 * Saved Charts gallery — every chart template the user has saved.
 * Click a card to open /charts pre-configured with that template.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listChartTemplates, deleteChartTemplate, saveChartTemplate, newTemplateId } from '../lib/chartTemplates.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';

const CHART_LABELS = {
  ancestor: 'Ancestor',
  descendant: 'Descendant',
  hourglass: 'Hourglass',
  tree: 'Tree (horizontal)',
  'double-ancestor': 'Double Ancestor',
  fan: 'Fan',
  relationship: 'Relationship Path',
  virtual: 'Virtual Tree',
};

const ACCENT = {
  ancestor: 'bg-blue-500/15 text-blue-500',
  descendant: 'bg-emerald-500/15 text-emerald-500',
  hourglass: 'bg-amber-500/15 text-amber-500',
  tree: 'bg-violet-500/15 text-violet-500',
  'double-ancestor': 'bg-pink-500/15 text-pink-500',
  fan: 'bg-orange-500/15 text-orange-500',
  relationship: 'bg-cyan-500/15 text-cyan-500',
  virtual: 'bg-rose-500/15 text-rose-500',
};

export default function SavedCharts() {
  const [templates, setTemplates] = useState(null);
  const navigate = useNavigate();

  const [importedViews, setImportedViews] = useState([]);
  const reloadAll = useCallback(async () => {
    setTemplates(await listChartTemplates());
    const db = getLocalDatabase();
    const { records } = await db.query('SavedChart', { limit: 100000 });
    setImportedViews(records);
  }, []);
  useEffect(() => { reloadAll(); }, [reloadAll]);

  const onDelete = async (id) => {
    if (!confirm('Delete this saved chart?')) return;
    await deleteChartTemplate(id);
    reloadAll();
  };

  const onDuplicate = async (tpl) => {
    const name = prompt('Name for the copy:', `${tpl.name} (copy)`);
    if (!name) return;
    await saveChartTemplate({ ...tpl, id: newTemplateId(), name });
    reloadAll();
  };

  if (templates == null) return <div className="p-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5">
        <header className="mb-5">
          <h1 className="text-xl font-bold">Saved Charts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.length + importedViews.length === 0
              ? 'No saved charts yet. Configure a chart in Charts and click Save to store the layout.'
              : `${templates.length + importedViews.length} saved chart configuration${templates.length + importedViews.length === 1 ? '' : 's'}`}
          </p>
        </header>

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
                  <button onClick={() => navigate(`/charts?type=${t.chartType}&template=${t.id}`)}
                    className="flex-1 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">
                    Open
                  </button>
                  <button onClick={() => onDuplicate(t)}
                    className="border border-border bg-secondary text-foreground rounded-md px-3 py-1.5 text-xs">
                    Copy
                  </button>
                  <button onClick={() => onDelete(t.id)}
                    className="border border-border text-destructive rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10">
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
                    {view.fields?.chartObjectsContainerData?.value ? ' · archived layout preserved' : ' · metadata only'}
                  </div>
                  <button onClick={() => navigate('/charts?type=tree')}
                    className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold">
                    Open Web Chart
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
