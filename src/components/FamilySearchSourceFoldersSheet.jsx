/**
 * FamilySearch source folders + reference tag manager.
 * Mirrors `FamilySearchSourceFoldersSheet` + `FamilySearchEditSourceReferenceTagsWidget`.
 */
import React, { useEffect, useState } from 'react';
import {
  deleteFamilySearchSourceFolder,
  listFamilySearchSourceFolders,
  listFamilySearchSourceReferences,
  setFamilySearchSourceReferenceTags,
  upsertFamilySearchSourceFolder,
} from '../lib/familySearchSourceFolders.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { sourceSummary } from '../models/index.js';
import { useModal } from '../contexts/ModalContext.jsx';

function uuid() { return `fs-folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }

export function FamilySearchSourceFoldersSheet({ open, onClose }) {
  const modal = useModal();
  const [folders, setFolders] = useState([]);
  const [refs, setRefs] = useState([]);
  const [sources, setSources] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [foldersList, refList, sourcesQuery] = await Promise.all([
      listFamilySearchSourceFolders(),
      listFamilySearchSourceReferences(),
      getLocalDatabase().query('Source', { limit: 100000 }),
    ]);
    setFolders(foldersList);
    setRefs(refList);
    setSources(sourcesQuery.records.map((record) => ({
      recordName: record.recordName,
      label: sourceSummary(record)?.title || record.recordName,
    })).sort((a, b) => a.label.localeCompare(b.label)));
  };

  useEffect(() => { if (open) reload(); }, [open]);

  if (!open) return null;

  const onAddFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await upsertFamilySearchSourceFolder({ id: uuid(), name });
      setNewFolderName('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onRenameFolder = async (folder) => {
    const name = await modal.prompt('Rename folder:', folder.name, { title: 'Rename folder' });
    if (!name || name === folder.name) return;
    await upsertFamilySearchSourceFolder({ ...folder, name });
    await reload();
  };

  const onDeleteFolder = async (folder) => {
    if (!(await modal.confirm(`Delete folder "${folder.name}"? Sources will be unassigned.`, { title: 'Delete folder', okLabel: 'Delete', destructive: true }))) return;
    await deleteFamilySearchSourceFolder(folder.id);
    await reload();
  };

  const onMoveRef = async (sourceRecordName, folderId) => {
    const existing = refs.find((ref) => ref.sourceRecordName === sourceRecordName);
    await setFamilySearchSourceReferenceTags(sourceRecordName, {
      folderId: folderId || null,
      tags: existing?.tags || [],
    });
    await reload();
  };

  const onEditTags = async (sourceRecordName) => {
    const existing = refs.find((ref) => ref.sourceRecordName === sourceRecordName);
    const input = await modal.prompt('Tags (comma-separated):', (existing?.tags || []).join(', '), { title: 'Edit tags' });
    if (input === null) return;
    const tags = input.split(',').map((tag) => tag.trim()).filter(Boolean);
    await setFamilySearchSourceReferenceTags(sourceRecordName, {
      folderId: existing?.folderId || null,
      tags,
    });
    await reload();
  };

  const refByRecord = new Map(refs.map((ref) => [ref.sourceRecordName, ref]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-lg">
        <header className="px-5 py-3 border-b border-border flex items-center gap-3">
          <h2 className="text-base font-semibold">FamilySearch Source Folders</h2>
          <button onClick={onClose} className="ms-auto text-sm text-muted-foreground hover:text-foreground">Close</button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-0 flex-1">
          <aside className="min-h-0 border-b md:border-b-0 md:border-r border-border p-3 space-y-2 overflow-auto">
            <div className="flex gap-2">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name"
                className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-xs"
              />
              <button disabled={busy} onClick={onAddFolder} className="text-xs border border-border bg-secondary rounded-md px-2">+ Add</button>
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Folders</div>
            {folders.length === 0 && <div className="text-xs text-muted-foreground">No folders yet.</div>}
            {folders.map((folder) => {
              const count = refs.filter((ref) => ref.folderId === folder.id).length;
              return (
                <div key={folder.id} className="rounded-md border border-border bg-secondary px-2 py-1.5">
                  <div className="flex items-baseline justify-between">
                    <div className="text-sm font-medium truncate">{folder.name}</div>
                    <div className="text-xs text-muted-foreground">{count}</div>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => onRenameFolder(folder)} className="text-[11px] text-primary">Rename</button>
                    <button onClick={() => onDeleteFolder(folder)} className="text-[11px] text-destructive">Delete</button>
                  </div>
                </div>
              );
            })}
          </aside>
          <main className="min-h-0 overflow-auto p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Sources</div>
            {sources.length === 0 && <div className="text-sm text-muted-foreground">No sources in this tree.</div>}
            <ul className="space-y-1">
              {sources.map((source) => {
                const ref = refByRecord.get(source.recordName);
                return (
                  <li key={source.recordName} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-secondary">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{source.label}</div>
                      {ref?.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ref.tags.map((tag) => (
                            <span key={tag} className="text-[10px] bg-background border border-border rounded-full px-2 py-0.5">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <select
                      value={ref?.folderId || ''}
                      onChange={(e) => onMoveRef(source.recordName, e.target.value)}
                      className="text-xs bg-background border border-border rounded-md px-1 py-0.5"
                    >
                      <option value="">— No folder —</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>{folder.name}</option>
                      ))}
                    </select>
                    <button onClick={() => onEditTags(source.recordName)} className="text-xs border border-border bg-background rounded-md px-2 py-1">Tags…</button>
                  </li>
                );
              })}
            </ul>
          </main>
        </div>
      </div>
    </div>
  );
}

export default FamilySearchSourceFoldersSheet;
