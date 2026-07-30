/**
 * Export hub — GEDCOM, full backup, static website.
 */
import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { buttonClasses } from '../components/ui/Button.jsx';
import { useDatabaseStatus } from '../contexts/DatabaseStatusContext.jsx';
import { listAllPersons, findStartPerson } from '../lib/treeQuery.js';
import { downloadGedcom, downloadGedZip } from '../lib/gedcomExport.js';
import { downloadGraphvizDot } from '../lib/graphvizExport.js';
import { analyzeGedcomText, canImportGedcomAnalysis, gedcomImportModeLabel, importGedcomText } from '../lib/gedcomImport.js';
import { GEDCOM_ACCEPT, readGedcomTextFromFile } from '../lib/genealogyFileFormats.js';
import { downloadBackup, downloadMFTPackage } from '../lib/backup.js';
import { analyzeBackupMergeJSON, mergeBackupJSON, planMerge, mergeBackupJSONWithResolutions, loadMergeFileToBackupJSON } from '../lib/mergeImport.js';
import { MergeConflictSheet } from '../components/MergeConflictSheet.jsx';
import { MergeTreesWizardSheet } from '../components/MergeTreesWizardSheet.jsx';
import { downloadSubtreeBackup, removeSubtree } from '../lib/subtree.js';
import { contactPickerSupported, importContactsFile, importContactsViaPicker } from '../lib/contactImport.js';
import {
  deleteTreeSnapshot,
  listTreeSnapshots,
  renameTreeSnapshot,
  restoreTreeSnapshot,
  saveCurrentTreeSnapshot,
  setTreeSnapshotFavorite,
  setTreeSnapshotLabel,
  sendTreeSnapshotAsCopy,
} from '../lib/treeLibrary.js';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { getAppPreferences } from '../lib/appPreferences.js';
import { useActivePerson } from '../contexts/ActivePersonContext.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

function Card({ title, description, children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 mb-4">
      <h2 className="text-sm font-semibold mb-1">{title}</h2>
      <p className="text-xs text-muted-foreground mb-4">{description}</p>
      {children}
    </div>
  );
}

const btn = buttonClasses({ variant: 'primary', size: 'md' });
const btnSecondary = 'bg-secondary border border-border text-foreground rounded-md px-4 py-2 text-sm hover:bg-accent disabled:opacity-60';

export default function Export() {
  const { t } = useTranslation();
  const { summary, refresh } = useDatabaseStatus();
  const modal = useModal();
  const { recordName: activePersonId, setActivePerson } = useActivePerson();
  const [searchParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [gedHideLiving, setGedHideLiving] = useState(false);
  const [gedMaskOnly, setGedMaskOnly] = useState(false);
  const [status, setStatus] = useState(null);
  const [gedIssues, setGedIssues] = useState(null);
  const [pendingGedcom, setPendingGedcom] = useState(null);
  const [gedcomImportMode, setGedcomImportMode] = useState('review');
  const [pendingMerge, setPendingMerge] = useState(null);
  const [rollbackNote, setRollbackNote] = useState('');
  const [conflictPlan, setConflictPlan] = useState(null);
  const [mergeWizardOpen, setMergeWizardOpen] = useState(false);
  const [persons, setPersons] = useState([]);
  const [subtreeRoot, setSubtreeRoot] = useState(null);
  const [treeSnapshots, setTreeSnapshots] = useState([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [selectedSnapshot, setSelectedSnapshot] = useState('');
  const [snapshotSortBy, setSnapshotSortBy] = useState(() => {
    try { return localStorage.getItem('treeLibrary.sortBy') || 'updatedAt'; } catch { return 'updatedAt'; }
  });
  const gedRef = useRef(null);
  const mergeRef = useRef(null);
  const contactsRef = useRef(null);
  const gedMediaFolderRef = useRef(null);

  React.useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setPersons(list);
      const start = await findStartPerson();
      const initialRoot = list.some((person) => person.recordName === activePersonId)
        ? activePersonId
        : start?.recordName || list[0]?.recordName || null;
      setSubtreeRoot(initialRoot);
      if (initialRoot) setActivePerson(initialRoot);
      const snapshots = await listTreeSnapshots({ sortBy: snapshotSortBy });
      setTreeSnapshots(snapshots);
      setSelectedSnapshot((current) => current || snapshots[0]?.id || '');
      const prefs = await getAppPreferences();
      setGedcomImportMode(prefs.importDefaults?.gedcomMode || 'review');
    })();
    // activePersonId is intentionally only used as the initial default.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotSortBy]);

  React.useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus) return;
    requestAnimationFrame(() => {
      const section = document.getElementById(focus);
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [searchParams]);

  React.useEffect(() => {
    try { localStorage.setItem('treeLibrary.sortBy', snapshotSortBy); } catch {}
  }, [snapshotSortBy]);

  const wrap = (label, fn) => async () => {
    setBusy(true);
    setStatus(label);
    try {
      const result = await fn();
      setStatus(typeof result === 'string' ? result : t('exportPage.status.done', { label, defaultValue: `${label} — done.` }));
    } catch (e) {
      setStatus(t('exportPage.status.failed', { label, message: e.message, defaultValue: `${label} failed: ${e.message}` }));
    }
    setBusy(false);
  };

  const onGedFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus(t('exportPage.status.reviewingGedcom', { defaultValue: 'Reviewing GEDCOM/GedZip…' }));
    try {
      const { text, sourceName, format, resourceFiles = [] } = await readGedcomTextFromFile(file);
      const analysis = analyzeGedcomText(text);
      setGedIssues(analysis);
      setPendingGedcom({ fileName: sourceName || file.name, format, text, analysis, resourceFiles });
      setStatus(canImportGedcomAnalysis(analysis, gedcomImportMode)
        ? t('exportPage.status.gedcomReady', { defaultValue: 'GEDCOM ready for review.' })
        : t('exportPage.status.gedcomBlocked', { mode: gedcomImportModeLabel(gedcomImportMode), defaultValue: `GEDCOM blocked by ${gedcomImportModeLabel(gedcomImportMode)} mode.` }));
    } catch (e) {
      setStatus(t('exportPage.status.gedcomReviewFailed', { message: e.message, defaultValue: `GEDCOM review failed: ${e.message}` }));
    }
    setBusy(false);
  };

  const onConfirmGedImport = wrap(t('exportPage.status.importingGedcom', { defaultValue: 'Importing GEDCOM…' }), async () => {
    if (!pendingGedcom) return t('exportPage.status.chooseGedcomFirst', { defaultValue: 'Choose a GEDCOM file first.' });
    if (!canImportGedcomAnalysis(pendingGedcom.analysis, gedcomImportMode)) return t('exportPage.status.gedcomBlockedReview', { mode: gedcomImportModeLabel(gedcomImportMode), defaultValue: `GEDCOM blocked by ${gedcomImportModeLabel(gedcomImportMode)} mode. Review issues before importing.` });
    const n = await importGedcomText(pendingGedcom.text, {
      sourceName: pendingGedcom.fileName,
      resourceFiles: pendingGedcom.resourceFiles || [],
    });
    await refresh();
    setPendingGedcom(null);
    if (gedRef.current) gedRef.current.value = '';
    if (gedMediaFolderRef.current) gedMediaFolderRef.current.value = '';
    return t('exportPage.status.importedRecords', { count: n, formatted: n.toLocaleString(), defaultValue: `Imported ${n.toLocaleString()} new records.` });
  });

  const onGedMediaFolder = async (files) => {
    if (!files?.length || !pendingGedcom) return;
    setBusy(true);
    setStatus(t('exportPage.status.readingMediaFolder', { defaultValue: 'Reading GEDCOM media folder…' }));
    try {
      const resourceFiles = await Promise.all([...files].map(async (file) => ({
        path: file.webkitRelativePath || file.name,
        name: file.name,
        size: file.size,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })));
      setPendingGedcom((current) => current ? {
        ...current,
        resourceFiles: dedupeResources([...(current.resourceFiles || []), ...resourceFiles]),
      } : current);
      setStatus(t('exportPage.status.attachedMedia', { count: resourceFiles.length, formatted: resourceFiles.length.toLocaleString(), defaultValue: `Attached ${resourceFiles.length.toLocaleString()} media folder files for OBJE matching.` }));
    } catch (error) {
      setStatus(t('exportPage.status.mediaFolderFailed', { message: error.message, defaultValue: `Media folder read failed: ${error.message}` }));
    } finally {
      if (gedMediaFolderRef.current) gedMediaFolderRef.current.value = '';
      setBusy(false);
    }
  };

  const onBackupMergeFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus(t('exportPage.status.reviewingMerge', { defaultValue: 'Reviewing merge source…' }));
    try {
      const json = await loadMergeFileToBackupJSON(file);
      const preview = await analyzeBackupMergeJSON(json);
      setPendingMerge({ fileName: file.name, json, preview });
      setRollbackNote(t('exportPage.merge.rollbackNoteDefault', { file: file.name, defaultValue: `Rollback note for ${file.name}: restore a backup captured before this merge if the result is not wanted.` }));
      setStatus(t('exportPage.status.mergeReady', { defaultValue: 'Merge source ready for review.' }));
    } catch (e) {
      setStatus(t('exportPage.status.mergeReviewFailed', { message: e.message, defaultValue: `Merge review failed: ${e.message}` }));
    }
    setBusy(false);
  };

  const onContactsFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus(t('exportPage.status.importingContacts', { defaultValue: 'Importing contacts…' }));
    try {
      const result = await importContactsFile(file);
      await refresh();
      setStatus(t('exportPage.status.importedContacts', { count: result.created, formatted: result.created.toLocaleString(), defaultValue: `Imported ${result.created.toLocaleString()} contacts as person records.` }));
    } catch (error) {
      setStatus(t('exportPage.status.contactsFailed', { message: error.message, defaultValue: `Contacts import failed: ${error.message}` }));
    } finally {
      if (contactsRef.current) contactsRef.current.value = '';
      setBusy(false);
    }
  };

  const onContactsPicker = async () => {
    setBusy(true);
    setStatus(t('exportPage.status.openingContactPicker', { defaultValue: 'Opening Contact Picker…' }));
    try {
      const result = await importContactsViaPicker();
      await refresh();
      setStatus(t('exportPage.status.importedContacts', { count: result.created, formatted: result.created.toLocaleString(), defaultValue: `Imported ${result.created.toLocaleString()} contacts as person records.` }));
    } catch (error) {
      setStatus(t('exportPage.status.contactsFailed', { message: error.message, defaultValue: `Contacts import failed: ${error.message}` }));
    } finally {
      setBusy(false);
    }
  };

  const finalizeMerge = async (result) => {
    await refresh();
    setPendingMerge(null);
    setRollbackNote('');
    setConflictPlan(null);
    if (mergeRef.current) mergeRef.current.value = '';
    const assetPart = result.assetRenamed ? ` ${t('exportPage.merge.assetsRenamed', { formatted: result.assetRenamed.toLocaleString(), defaultValue: `${result.assetRenamed.toLocaleString()} colliding asset IDs were renamed.` })}` : '';
    const renamedPart = result.renamed ? t('exportPage.merge.namesRenamed', { formatted: result.renamed.toLocaleString(), defaultValue: `${result.renamed.toLocaleString()} colliding record names were renamed.` }) : '';
    const resolvedPart = result.resolvedConflicts ? ` ${t('exportPage.merge.resolvedConflicts', { count: result.resolvedConflicts, formatted: result.resolvedConflicts.toLocaleString(), defaultValue: `Resolved ${result.resolvedConflicts.toLocaleString()} conflicts.` })}` : '';
    const deletedPart = result.deleted ? ` ${t('exportPage.merge.appliedDeletions', { count: result.deleted, formatted: result.deleted.toLocaleString(), defaultValue: `Applied ${result.deleted.toLocaleString()} deletions.` })}` : '';
    const merged = t('exportPage.merge.mergedSummary', { records: result.records.toLocaleString(), assets: result.assets.toLocaleString(), defaultValue: `Merged ${result.records.toLocaleString()} records and ${result.assets.toLocaleString()} assets.` });
    return `${merged}${resolvedPart}${deletedPart} ${renamedPart}${assetPart}`.trim();
  };

  const onConfirmMergeBackup = wrap(t('exportPage.status.reviewingConflicts', { defaultValue: 'Reviewing merge conflicts…' }), async () => {
    if (!pendingMerge) return t('exportPage.status.chooseBackupFirst', { defaultValue: 'Choose a backup file first.' });
    const plan = await planMerge(pendingMerge.json);
    // Deletions need a decision too, so they keep the sheet open even when
    // nothing else conflicts.
    if ((plan.conflicts?.length || 0) === 0
      && (plan.assetCollisions?.length || 0) === 0
      && (plan.deletions?.length || 0) === 0) {
      const result = await mergeBackupJSON(pendingMerge.json, { rollbackNote });
      return finalizeMerge(result);
    }
    setConflictPlan(plan);
    return t('exportPage.merge.conflictsToResolve', { count: plan.conflicts.length, formatted: plan.conflicts.length.toLocaleString(), defaultValue: `${plan.conflicts.length} conflicts to resolve.` });
  });

  const onApplyResolutions = async (resolutions) => {
    if (!pendingMerge) return;
    setBusy(true);
    setStatus(t('exportPage.status.applyingMerge', { defaultValue: 'Applying merge…' }));
    try {
      const result = await mergeBackupJSONWithResolutions(pendingMerge.json, resolutions, { rollbackNote });
      setStatus(await finalizeMerge(result));
    } catch (error) {
      setStatus(t('exportPage.status.mergeFailed', { message: error.message, defaultValue: `Merge failed: ${error.message}` }));
    } finally {
      setBusy(false);
    }
  };

  const onSubtreeExport = wrap(t('exportPage.status.exportingSubtree', { defaultValue: 'Exporting subtree…' }), async () => {
    if (!subtreeRoot) return t('exportPage.status.pickSubtreeRoot', { defaultValue: 'Pick a subtree root first.' });
    const count = await downloadSubtreeBackup(subtreeRoot);
    return t('exportPage.status.exportedSubtree', { formatted: count.toLocaleString(), defaultValue: `Exported ${count.toLocaleString()} subtree records.` });
  });

  const onSubtreeRemove = wrap(t('exportPage.status.removingSubtree', { defaultValue: 'Removing subtree…' }), async () => {
    if (!subtreeRoot) return t('exportPage.status.pickSubtreeRoot', { defaultValue: 'Pick a subtree root first.' });
    if (!(await modal.confirm(
      t('exportPage.subtree.removeConfirm', { defaultValue: 'Remove this person and descendant subtree from the current database? This cannot be undone from inside the app.' }),
      { title: t('exportPage.subtree.remove', { defaultValue: 'Remove subtree' }), okLabel: t('common.remove', { defaultValue: 'Remove' }), destructive: true },
    ))) return;
    const count = await removeSubtree(subtreeRoot);
    await refresh();
    return t('exportPage.status.removedSubtree', { formatted: count.toLocaleString(), defaultValue: `Removed ${count.toLocaleString()} subtree records.` });
  });

  const reloadSnapshots = async () => {
    const snapshots = await listTreeSnapshots({ sortBy: snapshotSortBy });
    setTreeSnapshots(snapshots);
    setSelectedSnapshot((current) => snapshots.some((snapshot) => snapshot.id === current) ? current : snapshots[0]?.id || '');
    return snapshots;
  };

  const chooseSnapshotFirst = () => t('exportPage.status.chooseSnapshotFirst', { defaultValue: 'Choose a tree snapshot first.' });

  const onToggleFavorite = wrap(t('exportPage.status.updatingFavorite', { defaultValue: 'Updating favorite…' }), async () => {
    if (!selectedSnapshot) return chooseSnapshotFirst();
    const current = treeSnapshots.find((s) => s.id === selectedSnapshot);
    await setTreeSnapshotFavorite(selectedSnapshot, !current?.favorite);
    await reloadSnapshots();
    return current?.favorite
      ? t('exportPage.status.favoriteRemoved', { defaultValue: 'Removed from favorites.' })
      : t('exportPage.status.favoriteAdded', { defaultValue: 'Marked as favorite.' });
  });

  const onSetLabel = wrap(t('exportPage.status.updatingLabel', { defaultValue: 'Updating label…' }), async () => {
    if (!selectedSnapshot) return chooseSnapshotFirst();
    const current = treeSnapshots.find((s) => s.id === selectedSnapshot);
    const label = await modal.prompt(
      t('exportPage.library.labelPrompt', { defaultValue: 'Label (e.g. "active", "draft"):' }),
      current?.label || '',
      { title: t('exportPage.library.setLabel', { defaultValue: 'Set label' }) },
    );
    if (label === null) return t('exportPage.status.labelCanceled', { defaultValue: 'Label canceled.' });
    await setTreeSnapshotLabel(selectedSnapshot, label);
    await reloadSnapshots();
    return t('exportPage.status.labelUpdated', { defaultValue: 'Label updated.' });
  });

  const onSendAsCopy = wrap(t('exportPage.status.exportingSnapshot', { defaultValue: 'Exporting snapshot…' }), async () => {
    if (!selectedSnapshot) return chooseSnapshotFirst();
    await sendTreeSnapshotAsCopy(selectedSnapshot);
    return t('exportPage.status.snapshotCopied', { defaultValue: 'Snapshot exported as a JSON copy.' });
  });

  const onSaveTreeSnapshot = wrap(t('exportPage.status.savingSnapshot', { defaultValue: 'Saving tree snapshot…' }), async () => {
    const snapshot = await saveCurrentTreeSnapshot(snapshotName);
    setSnapshotName('');
    await reloadSnapshots();
    return t('exportPage.status.snapshotSaved', { name: snapshot.name, defaultValue: `Saved tree snapshot "${snapshot.name}".` });
  });

  const onRestoreTreeSnapshot = wrap(t('exportPage.status.restoringSnapshot', { defaultValue: 'Restoring tree snapshot…' }), async () => {
    if (!selectedSnapshot) return chooseSnapshotFirst();
    if (!(await modal.confirm(
      t('exportPage.library.restoreConfirm', { defaultValue: 'Replace the current database with this saved tree snapshot?' }),
      { title: t('exportPage.library.restoreTitle', { defaultValue: 'Restore snapshot' }), okLabel: t('exportPage.library.replace', { defaultValue: 'Replace' }), destructive: true },
    ))) return t('exportPage.status.restoreCanceled', { defaultValue: 'Restore canceled.' });
    const result = await restoreTreeSnapshot(selectedSnapshot);
    await refresh();
    await reloadSnapshots();
    return t('exportPage.status.restored', { records: result.records.toLocaleString(), assets: result.assets.toLocaleString(), defaultValue: `Restored ${result.records.toLocaleString()} records and ${result.assets.toLocaleString()} assets.` });
  });

  const onRenameTreeSnapshot = wrap(t('exportPage.status.renamingSnapshot', { defaultValue: 'Renaming tree snapshot…' }), async () => {
    if (!selectedSnapshot) return chooseSnapshotFirst();
    const current = treeSnapshots.find((snapshot) => snapshot.id === selectedSnapshot);
    const name = await modal.prompt(
      t('exportPage.library.namePrompt', { defaultValue: 'Snapshot name:' }),
      current?.name || '',
      { title: t('exportPage.library.renameTitle', { defaultValue: 'Rename snapshot' }) },
    );
    if (!name) return t('exportPage.status.renameCanceled', { defaultValue: 'Rename canceled.' });
    await renameTreeSnapshot(selectedSnapshot, name);
    await reloadSnapshots();
    return t('exportPage.status.snapshotRenamed', { defaultValue: 'Tree snapshot renamed.' });
  });

  const onDeleteTreeSnapshot = wrap(t('exportPage.status.deletingSnapshot', { defaultValue: 'Deleting tree snapshot…' }), async () => {
    if (!selectedSnapshot) return chooseSnapshotFirst();
    if (!(await modal.confirm(
      t('exportPage.library.deleteConfirm', { defaultValue: 'Delete this saved tree snapshot?' }),
      { title: t('exportPage.library.deleteTitle', { defaultValue: 'Delete snapshot' }), okLabel: t('common.delete', { defaultValue: 'Delete' }), destructive: true },
    ))) return t('exportPage.status.deleteCanceled', { defaultValue: 'Delete canceled.' });
    await deleteTreeSnapshot(selectedSnapshot);
    await reloadSnapshots();
    return t('exportPage.status.snapshotDeleted', { defaultValue: 'Tree snapshot deleted.' });
  });

  const selectedSnapshotInfo = treeSnapshots.find((snapshot) => snapshot.id === selectedSnapshot);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-2xl mx-auto p-5">
        <h1 className="text-xl font-bold mb-1">{t('exportPage.title', { defaultValue: 'Import & Export' })}</h1>
        <p className="text-sm text-muted-foreground mb-5">
          {t('exportPage.intro', { defaultValue: 'Move data in and out of your tree.' })}{' '}
          {summary && t('exportPage.currentRecords', { formatted: summary.total.toLocaleString(), defaultValue: `Currently ${summary.total.toLocaleString()} records.` })}{' '}
          {t('exportPage.publishHint', { defaultValue: 'Publishing tools are available in Publish.' })}{' '}
          <Link to="/publish" className="text-interactive hover:underline">{t('exportPage.openPublishHub', { defaultValue: 'Open Publish hub' })}</Link>
        </p>

        <div id="gedcom-export">
          <Card
            title={t('exportPage.gedcomExport.title', { defaultValue: 'GEDCOM export' })}
            description={t('exportPage.gedcomExport.description', { defaultValue: 'Standard genealogy interchange format. Lossy for app-specific fields.' })}
          >
            <div className="flex flex-col gap-2 mb-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={gedHideLiving} onChange={(e) => setGedHideLiving(e.target.checked)} />
                {t('exportPage.gedcomExport.excludeLiving', { defaultValue: 'Exclude living persons' })}
              </label>
              {gedHideLiving && (
                <label className="flex items-center gap-2 ps-6 text-xs text-muted-foreground">
                  <input type="checkbox" checked={gedMaskOnly} onChange={(e) => setGedMaskOnly(e.target.checked)} />
                  {t('exportPage.gedcomExport.maskLiving', { defaultValue: 'Keep living persons but strip their dates/contact details' })}
                </label>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={wrap(t('exportPage.status.buildingGedcom', { defaultValue: 'Building GEDCOM…' }), () => downloadGedcom({ hideLiving: gedHideLiving, hideLivingDetailsOnly: gedHideLiving && gedMaskOnly }))}
                disabled={busy}
                className={btn}
              >
                {t('exportPage.gedcomExport.downloadGed', { defaultValue: 'Download .ged' })}
              </button>
              <button
                onClick={wrap(t('exportPage.status.buildingGedZip', { defaultValue: 'Building GedZip…' }), () => downloadGedZip({ hideLiving: gedHideLiving, hideLivingDetailsOnly: gedHideLiving && gedMaskOnly }))}
                disabled={busy}
                className={btn}
                title={t('exportPage.gedcomExport.gdzHint', { defaultValue: 'GEDCOM plus attached photos, bundled as a .gdz archive' })}
              >
                {t('exportPage.gedcomExport.downloadGdz', { defaultValue: 'Download .gdz (with media)' })}
              </button>
            </div>
          </Card>
        </div>

        <Card
          title={t('exportPage.graphviz.title', { defaultValue: 'Graphviz export' })}
          description={t('exportPage.graphviz.description', { defaultValue: 'Static DOT graph with union nodes, dashed secondary parent-child links, and group clusters.' })}
        >
          <button onClick={wrap(t('exportPage.status.buildingDot', { defaultValue: 'Building Graphviz DOT…' }), downloadGraphvizDot)} disabled={busy} className={btn}>
            {t('exportPage.graphviz.download', { defaultValue: 'Download .dot' })}
          </button>
        </Card>

        <div id="gedcom-import">
          <Card
            title={t('exportPage.gedcomImport.title', { defaultValue: 'GEDCOM / GedZip import' })}
            description={t('exportPage.gedcomImport.description', { defaultValue: 'Merge .ged, .uged, .uged16, or GedZip .zip files from another tool. Records are added with new local IDs.' })}
          >
            <input ref={gedRef} type="file" accept={GEDCOM_ACCEPT} className="hidden"
              onChange={(e) => onGedFile(e.target.files?.[0])} />
            <input
              ref={gedMediaFolderRef}
              type="file"
              multiple
              webkitdirectory=""
              className="hidden"
              onChange={(e) => onGedMediaFolder(e.target.files)}
            />
            <button onClick={() => gedRef.current?.click()} disabled={busy} className={btnSecondary}>
              {t('exportPage.gedcomImport.choose', { defaultValue: 'Choose GEDCOM or GedZip…' })}
            </button>
            {(gedIssues || pendingGedcom) && (
              <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs">
                <div className="font-semibold mb-1">{t('exportPage.gedcomImport.review', { defaultValue: 'GEDCOM review' })}</div>
                <label className="block text-muted-foreground mb-2">
                  {t('exportPage.gedcomImport.mode', { defaultValue: 'Import mode' })}
                  <select
                    value={gedcomImportMode}
                    onChange={(event) => setGedcomImportMode(event.target.value)}
                    className="ms-2 h-8 rounded-md border border-border bg-secondary px-2 text-foreground"
                  >
                    <option value="review">{t('exportPage.gedcomImport.modeReview', { defaultValue: 'Review warnings' })}</option>
                    <option value="strict">{t('exportPage.gedcomImport.modeStrict', { defaultValue: 'Strict' })}</option>
                    <option value="lenient">{t('exportPage.gedcomImport.modeLenient', { defaultValue: 'Lenient' })}</option>
                  </select>
                </label>
                <div className="text-muted-foreground mb-2">
                  {pendingGedcom?.fileName && <span className="text-foreground">{pendingGedcom.fileName} · </span>}
                  {pendingGedcom?.format && <span>{pendingGedcom.format} · </span>}
                  {t('exportPage.gedcomImport.counts', {
                    persons: gedIssues.counts.INDI,
                    families: gedIssues.counts.FAM,
                    sources: gedIssues.counts.SOUR,
                    issues: gedIssues.issues.length,
                    defaultValue: `${gedIssues.counts.INDI} persons · ${gedIssues.counts.FAM} families · ${gedIssues.counts.SOUR} sources · ${gedIssues.issues.length} issue(s)`,
                  })}
                </div>
                <div className="text-muted-foreground mb-2">
                  {t('exportPage.gedcomImport.mediaReady', { formatted: (pendingGedcom?.resourceFiles?.length || 0).toLocaleString(), defaultValue: `Media resources ready for OBJE matching: ${(pendingGedcom?.resourceFiles?.length || 0).toLocaleString()}.` })}
                </div>
                <div className="text-muted-foreground mb-2">
                  {t('exportPage.gedcomImport.conflictSummary', { defaultValue: 'Conflict summary: GEDCOM records are imported with new local IDs, so existing records are not overwritten.' })}
                </div>
                {gedIssues.issues.slice(0, 8).map((issue, i) => (
                  <div key={i} className={issue.severity === 'error' ? 'text-destructive-text' : 'text-muted-foreground'}>
                    {issue.line ? `${t('exportPage.gedcomImport.line', { line: issue.line, defaultValue: `Line ${issue.line}` })}: ` : ''}{issue.message}
                  </div>
                ))}
                {gedIssues.issues.length > 8 && (
                  <div className="text-muted-foreground italic">
                    {t('exportPage.gedcomImport.moreIssues', { count: gedIssues.issues.length - 8, defaultValue: `+${gedIssues.issues.length - 8} more issue(s) — resolve blocking errors or switch to Lenient mode to proceed.` })}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button onClick={onConfirmGedImport} disabled={busy || !canImportGedcomAnalysis(pendingGedcom?.analysis, gedcomImportMode)} className={btn}>
                    {t('exportPage.gedcomImport.importReviewed', { defaultValue: 'Import reviewed GEDCOM' })}
                  </button>
                  <button onClick={() => gedMediaFolderRef.current?.click()} disabled={busy || !pendingGedcom} className={btnSecondary}>
                    {t('exportPage.gedcomImport.attachMedia', { defaultValue: 'Attach media folder…' })}
                  </button>
                  <button
                    onClick={() => { setPendingGedcom(null); setGedIssues(null); if (gedRef.current) gedRef.current.value = ''; if (gedMediaFolderRef.current) gedMediaFolderRef.current.value = ''; }}
                    disabled={busy}
                    className={btnSecondary}
                  >
                    {t('exportPage.clearReview', { defaultValue: 'Clear review' })}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div id="merge-tree">
          <Card
            title={t('exportPage.merge.title', { defaultValue: 'Merge another tree' })}
            description={t('exportPage.merge.description', { defaultValue: 'Merge a CloudTreeWeb backup (.json) or a MacFamilyTree package (.mftpkg) into the current database — for example a copy someone else reviewed and edited. Records that differ are resolved one by one; name collisions are renamed and references are rewritten.' })}
          >
            <input ref={mergeRef} type="file" accept="application/json,.json,.mftpkg,.mftsql,.zip" className="hidden"
              onChange={(e) => onBackupMergeFile(e.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => mergeRef.current?.click()} disabled={busy} className={btnSecondary}>
                {t('exportPage.merge.choose', { defaultValue: 'Choose backup or .mftpkg to merge…' })}
              </button>
              <button onClick={() => setMergeWizardOpen(true)} disabled={busy} className={btnSecondary}>
                {t('exportPage.merge.wizard', { defaultValue: 'Guided merge wizard…' })}
              </button>
            </div>
            {pendingMerge && (
              <div className="mt-4 rounded-md border border-border bg-background p-3 text-xs">
                <div className="font-semibold mb-1">{t('exportPage.merge.preview', { defaultValue: 'Merge preview' })}</div>
                <div className="text-muted-foreground mb-2">
                  <span className="text-foreground" dir="auto">{pendingMerge.fileName}</span> ·{' '}
                  {t('exportPage.merge.previewCounts', {
                    records: pendingMerge.preview.records.toLocaleString(),
                    added: (pendingMerge.preview.newRecords ?? 0).toLocaleString(),
                    changed: (pendingMerge.preview.changed ?? 0).toLocaleString(),
                    unchanged: (pendingMerge.preview.unchanged ?? 0).toLocaleString(),
                    defaultValue: `${pendingMerge.preview.records.toLocaleString()} records in the file — ${(pendingMerge.preview.newRecords ?? 0).toLocaleString()} new, ${(pendingMerge.preview.changed ?? 0).toLocaleString()} changed, ${(pendingMerge.preview.unchanged ?? 0).toLocaleString()} identical`,
                  })}
                  {pendingMerge.preview.assets > 0 && ` · ${t('exportPage.merge.previewAssets', {
                    assets: pendingMerge.preview.assets.toLocaleString(),
                    colliding: pendingMerge.preview.assetCollisions.toLocaleString(),
                    defaultValue: `${pendingMerge.preview.assets.toLocaleString()} assets (${pendingMerge.preview.assetCollisions.toLocaleString()} already present)`,
                  })}`}
                </div>
                {pendingMerge.preview.collisionSamples.length > 0 && (
                  <div className="text-muted-foreground mb-2" dir="auto">
                    {t('exportPage.merge.changedSamples', { defaultValue: 'Changed records include' })}: {pendingMerge.preview.collisionSamples.map((item) => `${item.recordName} (${item.recordType})`).join(', ')}
                  </div>
                )}
                <label className="block text-muted-foreground mb-1">{t('exportPage.merge.rollbackNote', { defaultValue: 'Rollback note saved with changelog metadata' })}</label>
                <textarea
                  value={rollbackNote}
                  onChange={(e) => setRollbackNote(e.target.value)}
                  className="w-full min-h-20 rounded-md border border-border bg-card text-foreground p-2 text-xs"
                />
                <div className="mt-3 flex gap-2">
                  <button onClick={onConfirmMergeBackup} disabled={busy} className={btn}>{t('exportPage.merge.mergeReviewed', { defaultValue: 'Merge reviewed backup' })}</button>
                  <button
                    onClick={() => { setPendingMerge(null); setRollbackNote(''); if (mergeRef.current) mergeRef.current.value = ''; }}
                    disabled={busy}
                    className={btnSecondary}
                  >
                    {t('exportPage.clearReview', { defaultValue: 'Clear review' })}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div id="contacts-import">
          <Card
            title={t('exportPage.contacts.title', { defaultValue: 'Contacts import' })}
            description={t('exportPage.contacts.description', { defaultValue: 'Import CSV or vCard contacts as new person records. This is the browser equivalent of MacFamilyTree contact import.' })}
          >
            <input
              ref={contactsRef}
              type="file"
              accept=".csv,text/csv,.vcf,.vcard,text/vcard,text/x-vcard"
              className="hidden"
              onChange={(e) => onContactsFile(e.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => contactsRef.current?.click()} disabled={busy} className={btnSecondary}>
                {t('exportPage.contacts.choose', { defaultValue: 'Choose CSV or vCard…' })}
              </button>
              {contactPickerSupported() && (
                <button onClick={onContactsPicker} disabled={busy} className={btnSecondary}>
                  {t('exportPage.contacts.picker', { defaultValue: 'Pick from device contacts…' })}
                </button>
              )}
            </div>
          </Card>
        </div>

        <div id="subtree-actions">
          <Card
            title={t('exportPage.subtree.title', { defaultValue: 'Subtree export / remove' })}
            description={t('exportPage.subtree.description', { defaultValue: 'Export or remove a person and their descendant subtree, including related events, facts, notes, labels, media/source relations, and assets.' })}
          >
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('exportPage.subtree.rootPerson', { defaultValue: 'Root person' })}</label>
                <PersonPicker persons={persons} value={subtreeRoot} onChange={(id) => { setSubtreeRoot(id); setActivePerson(id); }} />
              </div>
              <button onClick={onSubtreeExport} disabled={busy || !subtreeRoot} className={btn}>{t('exportPage.subtree.export', { defaultValue: 'Export subtree' })}</button>
              <button onClick={onSubtreeRemove} disabled={busy || !subtreeRoot} className={btnSecondary}>{t('exportPage.subtree.remove', { defaultValue: 'Remove subtree' })}</button>
            </div>
          </Card>
        </div>

        <div id="tree-picker">
          <Card
            title={t('exportPage.library.title', { defaultValue: 'Tree picker library' })}
            description={t('exportPage.library.description', { defaultValue: 'Save, restore, rename, and delete local tree snapshots without relying on iCloud. Restoring replaces the active database.' })}
          >
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <input
                  value={snapshotName}
                  onChange={(event) => setSnapshotName(event.target.value)}
                  placeholder={t('exportPage.library.snapshotName', { defaultValue: 'Snapshot name' })}
                  aria-label={t('exportPage.library.snapshotName', { defaultValue: 'Snapshot name' })}
                  className="min-w-0 flex-1 rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
                />
                <button onClick={onSaveTreeSnapshot} disabled={busy || !summary} className={btn}>{t('exportPage.library.saveCurrent', { defaultValue: 'Save current tree' })}</button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={snapshotSortBy}
                  onChange={(event) => setSnapshotSortBy(event.target.value)}
                  className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
                  aria-label={t('exportPage.library.sortSnapshots', { defaultValue: 'Sort snapshots' })}
                >
                  <option value="updatedAt">{t('exportPage.library.sortChangeDate', { defaultValue: 'Sort: Change date' })}</option>
                  <option value="name">{t('exportPage.library.sortName', { defaultValue: 'Sort: Name' })}</option>
                  <option value="favorites">{t('exportPage.library.sortFavorites', { defaultValue: 'Sort: Favorites first' })}</option>
                </select>
                <select
                  value={selectedSnapshot}
                  onChange={(event) => setSelectedSnapshot(event.target.value)}
                  aria-label={t('exportPage.library.savedTrees', { defaultValue: 'Saved trees' })}
                  className="min-w-[220px] flex-1 rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
                >
                  <option value="">{t('exportPage.library.noSavedTrees', { defaultValue: 'No saved trees' })}</option>
                  {treeSnapshots.map((snapshot) => (
                    <option key={snapshot.id} value={snapshot.id}>
                      {snapshot.favorite ? '★ ' : ''}{snapshot.name}{snapshot.label ? ` [${snapshot.label}]` : ''} · {t('common.records', { count: snapshot.recordCount, defaultValue: `${snapshot.recordCount.toLocaleString()} records` })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={onRestoreTreeSnapshot} disabled={busy || !selectedSnapshot} className={btnSecondary}>{t('exportPage.library.restore', { defaultValue: 'Restore' })}</button>
                <button onClick={onRenameTreeSnapshot} disabled={busy || !selectedSnapshot} className={btnSecondary}>{t('exportPage.library.rename', { defaultValue: 'Rename' })}</button>
                <button onClick={onToggleFavorite} disabled={busy || !selectedSnapshot} className={btnSecondary}>{t('exportPage.library.favorite', { defaultValue: 'Favorite' })}</button>
                <button onClick={onSetLabel} disabled={busy || !selectedSnapshot} className={btnSecondary}>{t('exportPage.library.label', { defaultValue: 'Label' })}</button>
                <button onClick={onSendAsCopy} disabled={busy || !selectedSnapshot} className={btnSecondary}>{t('exportPage.library.sendAsCopy', { defaultValue: 'Send as Copy' })}</button>
                <button onClick={onDeleteTreeSnapshot} disabled={busy || !selectedSnapshot} className={btnSecondary}>{t('common.delete', { defaultValue: 'Delete' })}</button>
              </div>
              {selectedSnapshotInfo && (
                <div className="text-xs text-muted-foreground">
                  {t('exportPage.library.selectedSummary', {
                    records: selectedSnapshotInfo.recordCount.toLocaleString(),
                    assets: selectedSnapshotInfo.assetCount.toLocaleString(),
                    updated: new Date(selectedSnapshotInfo.updatedAt).toLocaleString(),
                    defaultValue: `Selected: ${selectedSnapshotInfo.recordCount.toLocaleString()} records · ${selectedSnapshotInfo.assetCount.toLocaleString()} assets · updated ${new Date(selectedSnapshotInfo.updatedAt).toLocaleString()}`,
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div id="full-backup">
          <Card
            title={t('exportPage.backup.title', { defaultValue: 'Full backup' })}
            description={t('exportPage.backup.description', { defaultValue: 'Every record packaged into a single JSON file.' })}
          >
            <button onClick={wrap(t('exportPage.status.preparingBackup', { defaultValue: 'Preparing backup…' }), downloadBackup)} disabled={busy} className={btn}>{t('exportPage.backup.download', { defaultValue: 'Download backup' })}</button>
          </Card>
        </div>

        <div id="mftpkg">
          <Card
            title={t('exportPage.package.title', { defaultValue: 'CloudTreeWeb .mftpkg package' })}
            description={t('exportPage.package.description', { defaultValue: 'Round-trip package for this app: database.json plus bundled media copies in a .mftpkg zip container. This is the file to send back when someone else has reviewed your tree.' })}
          >
            <button onClick={wrap(t('exportPage.status.preparingPackage', { defaultValue: 'Preparing .mftpkg…' }), downloadMFTPackage)} disabled={busy} className={btn}>{t('exportPage.package.download', { defaultValue: 'Download .mftpkg' })}</button>
          </Card>
        </div>

        <div id="publish">
          <Card
            title={t('exportPage.publish.title', { defaultValue: 'Publish surfaces' })}
            description={t('exportPage.publish.description', { defaultValue: 'Use dedicated publish pages for websites and book bundles. This page stays focused on data transfer.' })}
          >
            <div className="flex flex-wrap gap-2">
              <Link to="/websites" className={btnSecondary}>{t('exportPage.publish.websites', { defaultValue: 'Open Websites' })}</Link>
              <Link to="/books" className={btnSecondary}>{t('exportPage.publish.books', { defaultValue: 'Open Books' })}</Link>
              <Link to="/publish" className={btn}>{t('exportPage.openPublishHub', { defaultValue: 'Open Publish hub' })}</Link>
            </div>
          </Card>
        </div>

        {status && <div className="rounded-md border border-border bg-card p-3 text-sm">{status}</div>}
      </div>
      {conflictPlan && (
        <MergeConflictSheet
          plan={conflictPlan}
          onApply={onApplyResolutions}
          onCancel={() => setConflictPlan(null)}
        />
      )}
      {mergeWizardOpen && (
        <MergeTreesWizardSheet
          onClose={() => setMergeWizardOpen(false)}
          onComplete={async (result) => {
            await refresh();
            setStatus(t('exportPage.merge.wizardSummary', { records: (result.records ?? 0).toLocaleString(), assets: (result.assets ?? 0).toLocaleString(), defaultValue: `Merged ${(result.records ?? 0).toLocaleString()} records and ${(result.assets ?? 0).toLocaleString()} assets via the merge wizard.` }));
          }}
        />
      )}
    </div>
  );
}

function dedupeResources(resources) {
  const seen = new Set();
  const out = [];
  for (const resource of resources || []) {
    const key = String(resource.path || resource.name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(resource);
  }
  return out;
}
