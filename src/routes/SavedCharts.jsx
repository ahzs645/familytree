/**
 * Saved Charts gallery — every chart template the user has saved.
 * Click a card to open /charts pre-configured with that template.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { listChartTemplates, deleteChartTemplate, saveChartTemplate, newTemplateId } from '../lib/chartTemplates.js';
import { listChartDocuments, deleteChartDocument, saveChartDocument } from '../lib/chartDocuments.js';
import { useRecords } from '../lib/data/useRecords.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { PageTitle } from '../components/ui/PageTitle.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

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

function importedLayoutStatus(view, t) {
  const decodedRaw = view.fields?.chartObjectsContainerDataDecoded?.value;
  if (decodedRaw) {
    try {
      const decoded = JSON.parse(decodedRaw);
      if (decoded.status === 'decoded') return t('savedCharts.importStatus.decoded');
      if (decoded.status === 'unsupported-binary') return t('savedCharts.importStatus.binary');
    } catch {
      // Fall through to byte-preservation wording.
    }
  }
  if (view.fields?.chartObjectsContainerData?.value) return t('savedCharts.importStatus.archived');
  return t('savedCharts.importStatus.metadataOnly');
}

export default function SavedCharts() {
  const { t, localization } = useTranslation();
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
    if (!(await modal.confirm(t('savedCharts.deleteTemplateConfirm'), { title: t('savedCharts.deleteChartTitle'), okLabel: t('savedCharts.delete'), destructive: true }))) return;
    await deleteChartTemplate(id);
    reloadAll();
  };

  const onDeleteDocument = async (id) => {
    if (!(await modal.confirm(t('savedCharts.deleteDocumentConfirm'), { title: t('savedCharts.deleteDocumentTitle'), okLabel: t('savedCharts.delete'), destructive: true }))) return;
    await deleteChartDocument(id);
    reloadAll();
  };

  const onDuplicate = async (tpl) => {
    const name = await modal.prompt(t('savedCharts.copyPrompt'), t('savedCharts.copyName', { name: tpl.name }), { title: t('savedCharts.copyTitle') });
    if (!name) return;
    await saveChartTemplate({ ...tpl, id: newTemplateId(), name });
    reloadAll();
  };

  const onRenameTemplate = async (template) => {
    const name = await modal.prompt(t('savedCharts.renamePrompt'), template.name || '', { title: t('savedCharts.renameTitle') });
    if (!name?.trim() || name.trim() === template.name) return;
    await saveChartTemplate({ ...template, name: name.trim() });
    reloadAll();
  };

  const onRenameDocument = async (document) => {
    const name = await modal.prompt(t('savedCharts.renamePrompt'), document.name || '', { title: t('savedCharts.renameTitle') });
    if (!name?.trim() || name.trim() === document.name) return;
    await saveChartDocument({ ...document, name: name.trim() });
    reloadAll();
  };

  if (templates == null) return <div className="p-10 text-muted-foreground">{t('savedCharts.loading')}</div>;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5">
        <header className="mb-5">
          <PageTitle className="text-xl font-bold">{t('savedCharts.title')}</PageTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.length + documents.length + importedViews.length === 0
              ? t('savedCharts.empty')
              : t('savedCharts.count', { count: templates.length + documents.length + importedViews.length })}
          </p>
        </header>

        {documents.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-3">{t('savedCharts.documentsTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-2xs font-bold uppercase tracking-wider rounded px-2 py-0.5 ${ACCENT[doc.chartType] || 'bg-muted text-muted-foreground'}`}>
                      {t(`charts.chartType.${doc.chartType}`, { defaultValue: doc.chartType })}
                    </span>
                    <span className="text-2xs text-muted-foreground">{t('savedCharts.overlayCount', { count: doc.overlays?.length || 0 })}</span>
                  </div>
                  <div className="text-sm font-semibold mb-1 truncate">{doc.name}</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {doc.generations ? t('savedCharts.generationCount', { count: doc.generations }) : ''}
                    {doc.savedAt && ` · ${t('savedCharts.savedDate', { date: new Date(doc.savedAt).toLocaleDateString(localization.locale) })}`}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={() => navigate(`/charts?document=${doc.id}`)} className="flex-1">
                      {t('savedCharts.open')}
                    </Button>
                    <Button size="sm" onClick={() => onRenameDocument(doc)}>{t('savedCharts.rename')}</Button>
                    <Button onClick={() => onDeleteDocument(doc.id)}
                      variant="destructiveOutline"
                      size="sm"
                      aria-label={t('savedCharts.deleteNamed', { name: doc.name })}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {templates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((template) => (
              <div key={template.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-2xs font-bold uppercase tracking-wider rounded px-2 py-0.5 ${ACCENT[template.chartType] || 'bg-muted text-muted-foreground'}`}>
                    {t(`charts.chartType.${template.chartType}`, { defaultValue: template.chartType })}
                  </span>
                  {template.themeId && template.themeId !== 'auto' && (
                    <span className="text-2xs text-muted-foreground">{template.themeId}</span>
                  )}
                </div>
                <div className="text-sm font-semibold mb-1 truncate">{template.name}</div>
                <div className="text-xs text-muted-foreground mb-3">
                  {template.generations ? t('savedCharts.generationCount', { count: template.generations }) : ''}
                  {template.savedAt && ` · ${t('savedCharts.savedDate', { date: new Date(template.savedAt).toLocaleDateString(localization.locale) })}`}
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => navigate(`/charts?type=${template.chartType}&template=${template.id}`)} className="flex-1">
                    {t('savedCharts.open')}
                  </Button>
                  <Button size="sm" onClick={() => onRenameTemplate(template)}>{t('savedCharts.rename')}</Button>
                  <Button size="sm" onClick={() => onDuplicate(template)}>
                    {t('savedCharts.copy')}
                  </Button>
                  <Button onClick={() => onDelete(template.id)}
                    variant="destructiveOutline"
                    size="sm"
                    aria-label={t('savedCharts.deleteNamed', { name: template.name })}
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {importedViews.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold mb-3">{t('savedCharts.importedTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {importedViews.map((view) => (
                <div key={view.recordName} className="rounded-lg border border-border bg-card p-4">
                  <span className="text-2xs font-bold uppercase tracking-wider rounded px-2 py-0.5 bg-secondary text-muted-foreground">{t('savedCharts.importedBadge')}</span>
                  <div className="text-sm font-semibold mt-2 mb-1 truncate">{view.fields?.title?.value || view.fields?.name?.value || view.recordName}</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {view.fields?.author?.value || t('savedCharts.macImport')}
                    {' · '}{importedLayoutStatus(view, t)}
                  </div>
                  <Button variant="primary" size="sm" onClick={() => navigate(`/charts?imported=${encodeURIComponent(view.recordName)}`)}>
                    {t('savedCharts.openWebChart')}
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
