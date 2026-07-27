/**
 * The chart "library": saved chart templates and saved chart documents, plus
 * every lifecycle action on them — save/apply/delete template, save/save-as/
 * open/delete document, "New chart", and "Finish editing". Builds on
 * useChartDocumentIO for serialization, application, and the dirty guard.
 */
import { useCallback, useState } from 'react';
import { listChartTemplates, saveChartTemplate, deleteChartTemplate, newTemplateId } from '../../../lib/chartTemplates.js';
import { listChartDocuments, saveChartDocument, deleteChartDocument, newChartDocumentId } from '../../../lib/chartDocuments.js';
import { useModal } from '../../../contexts/ModalContext.jsx';

export function useChartLibrary({ selection, theming, pageSetup, chartDoc, overlayCommands, documentIO }) {
  const modal = useModal();
  const { chartType, setChartType, generations, setGenerations } = selection;
  const { themeId, setThemeId } = theming;
  const {
    chartTitle, setChartTitle,
    chartNote, setChartNote,
    pageSize, setPageSize,
    pageOrientation, setPageOrientation,
    chartBackground, setChartBackground,
  } = pageSetup;
  const {
    currentDocumentId, setCurrentDocumentId,
    currentDocumentName, setCurrentDocumentName,
    isDirty, setIsDirty,
    isReadOnly, setIsReadOnly,
  } = chartDoc;
  const { setFromSource } = overlayCommands;
  const {
    suppressDirtyOnce, applyDocumentState,
    currentDocumentState, confirmDiscardIfDirty,
  } = documentIO;

  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);

  const onSaveTemplate = useCallback(async () => {
    const name = await modal.prompt('Name for this chart template:', '', { title: 'Save chart template' });
    if (!name) return;
    const tpl = {
      id: newTemplateId(),
      name,
      chartType,
      themeId,
      generations,
      title: chartTitle,
      note: chartNote,
      page: { size: pageSize, orientation: pageOrientation, backgroundColor: chartBackground },
    };
    await saveChartTemplate(tpl);
    setTemplates(await listChartTemplates());
  }, [chartType, themeId, generations, chartTitle, chartNote, pageSize, pageOrientation, chartBackground, modal]);

  const onApplyTemplate = useCallback(async (id) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (!(await confirmDiscardIfDirty('load'))) return;
    setChartType(tpl.chartType);
    setThemeId(tpl.themeId);
    setGenerations(tpl.generations);
    setChartTitle(tpl.title || '');
    setChartNote(tpl.note || '');
    setPageSize(tpl.page?.size || 'letter');
    setPageOrientation(tpl.page?.orientation || 'landscape');
    setChartBackground(tpl.page?.backgroundColor || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, confirmDiscardIfDirty]);

  const onSaveDocument = useCallback(async () => {
    if (isReadOnly) {
      await modal.alert('This chart is read-only (imported). Use "Save as new…" to make an editable copy.', { title: 'Read-only chart' });
      return;
    }
    if (currentDocumentId) {
      suppressDirtyOnce();
      await saveChartDocument(currentDocumentState(currentDocumentName || 'Untitled Chart', currentDocumentId));
      setDocuments(await listChartDocuments());
      setIsDirty(false);
      return;
    }
    const name = await modal.prompt('Name for this chart document:', '', { title: 'Save chart document' });
    if (!name) return;
    suppressDirtyOnce();
    const id = newChartDocumentId();
    await saveChartDocument(currentDocumentState(name, id));
    setCurrentDocumentId(id);
    setCurrentDocumentName(name);
    setDocuments(await listChartDocuments());
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDocumentState, currentDocumentId, currentDocumentName, isReadOnly, suppressDirtyOnce, modal]);

  const onSaveAsDocument = useCallback(async () => {
    const name = await modal.prompt('Save as new chart — name:', currentDocumentName || '', { title: 'Save as new chart' });
    if (!name) return;
    suppressDirtyOnce();
    const id = newChartDocumentId();
    await saveChartDocument(currentDocumentState(name, id));
    setCurrentDocumentId(id);
    setCurrentDocumentName(name);
    setIsReadOnly(false);
    setDocuments(await listChartDocuments());
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDocumentState, currentDocumentName, suppressDirtyOnce, modal]);

  const onApplyDocument = useCallback(async (id) => {
    const doc = documents.find((item) => item.id === id);
    if (!doc) return;
    if (!(await confirmDiscardIfDirty('load'))) return;
    applyDocumentState(doc, { preserveSelection: false });
  }, [applyDocumentState, confirmDiscardIfDirty, documents]);

  const onNewChart = useCallback(async () => {
    if (!(await confirmDiscardIfDirty('new'))) return;
    suppressDirtyOnce();
    setCurrentDocumentId(null);
    setCurrentDocumentName('');
    setIsReadOnly(false);
    setIsDirty(false);
    setFromSource([], { preserveSelection: false });
    setChartTitle('');
    setChartNote('');
    setChartBackground('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmDiscardIfDirty, setFromSource, suppressDirtyOnce]);

  const onFinishEditing = useCallback(async () => {
    if (isDirty) {
      const save = await modal.confirm('Save changes before finishing?', {
        title: 'Finish editing',
        okLabel: 'Save',
        cancelLabel: 'Discard',
      });
      if (save) {
        await onSaveDocument();
      } else {
        suppressDirtyOnce();
        setIsDirty(false);
      }
    }
    setIsReadOnly(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, modal, onSaveDocument, suppressDirtyOnce]);

  const onDeleteDocument = useCallback(async (id) => {
    if (!(await modal.confirm('Delete this chart document?', { title: 'Delete chart', okLabel: 'Delete', destructive: true }))) return;
    await deleteChartDocument(id);
    setDocuments(await listChartDocuments());
  }, [modal]);

  const onDeleteTemplate = useCallback(async (id) => {
    if (!(await modal.confirm('Delete this template?', { title: 'Delete template', okLabel: 'Delete', destructive: true }))) return;
    await deleteChartTemplate(id);
    setTemplates(await listChartTemplates());
  }, [modal]);

  return {
    templates,
    setTemplates,
    documents,
    setDocuments,
    onSaveTemplate,
    onApplyTemplate,
    onDeleteTemplate,
    onSaveDocument,
    onSaveAsDocument,
    onApplyDocument,
    onNewChart,
    onFinishEditing,
    onDeleteDocument,
  };
}
