/**
 * SubtreeWizard — two-column picker mirroring MacFamilyTree's SliceSheet.
 * Left:  "Available Persons" (everyone not yet in the working set).
 * Right: "Persons to be Exported" (the working set).
 * Actions:
 *   - Add selected, Remove selected
 *   - Add Ancestors of Person, Add Descendants of Person
 *   - Export Subtree (downloads JSON)
 *   - Remove Subtree (deletes from the active database)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAllPersons } from '../lib/treeQuery.js';
import {
  exportSubtreeBackup,
  collectAncestorIds,
  collectDescendantIds,
  removeSubtree,
} from '../lib/subtree.js';
import { compareStrings, getCurrentLocalization } from '../lib/i18n.js';
import { useModal } from '../contexts/ModalContext.jsx';

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

export default function SubtreeWizard() {
  const navigate = useNavigate();
  const modal = useModal();
  const [allPersons, setAllPersons] = useState([]);
  const [working, setWorking] = useState(new Set());
  const [leftSelection, setLeftSelection] = useState(new Set());
  const [rightSelection, setRightSelection] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [depth, setDepth] = useState(5);
  const localization = getCurrentLocalization();

  useEffect(() => {
    (async () => {
      const list = await listAllPersons();
      setAllPersons(list);
    })();
  }, []);

  const sortedPersons = useMemo(() => (
    [...allPersons].sort((a, b) => compareStrings(a.fullName || '', b.fullName || '', localization))
  ), [allPersons, localization.locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const availablePersons = sortedPersons.filter((p) => !working.has(p.recordName));
  const workingPersons = sortedPersons.filter((p) => working.has(p.recordName));

  const addSelected = () => {
    const next = new Set(working);
    for (const id of leftSelection) next.add(id);
    setWorking(next);
    setLeftSelection(new Set());
  };

  const removeSelected = () => {
    const next = new Set(working);
    for (const id of rightSelection) next.delete(id);
    setWorking(next);
    setRightSelection(new Set());
  };

  const addAncestorsOf = async (personId) => {
    setBusy(true);
    try {
      const ids = await collectAncestorIds(personId, depth);
      const next = new Set(working);
      next.add(personId);
      for (const id of ids) next.add(id);
      setWorking(next);
      setStatus(`Added ${ids.length} ancestors.`);
    } finally {
      setBusy(false);
    }
  };

  const addDescendantsOf = async (personId) => {
    setBusy(true);
    try {
      const ids = await collectDescendantIds(personId, depth);
      const next = new Set(working);
      next.add(personId);
      for (const id of ids) next.add(id);
      setWorking(next);
      setStatus(`Added ${ids.length} descendants.`);
    } finally {
      setBusy(false);
    }
  };

  const exportWorkingSet = async () => {
    if (working.size === 0) { setStatus('Select at least one person to export.'); return; }
    setBusy(true);
    try {
      const roots = [...working];
      // Collect the union of every root's subtree closure (events, relations, assets).
      const backups = await Promise.all(roots.map((id) => exportSubtreeBackup(id)));
      const merged = mergeBackups(backups);
      downloadJson(`cloudtreeweb-subtree-${Date.now()}.json`, merged);
      setStatus(`Exported ${Object.keys(merged.records).length} records across ${roots.length} root(s).`);
    } finally {
      setBusy(false);
    }
  };

  const removeWorkingSet = async () => {
    if (working.size === 0) return;
    if (!(await modal.confirm(`Remove ${working.size} persons and their attached records from the database? This cannot be undone.`, { title: 'Remove subtree', okLabel: 'Remove', destructive: true }))) return;
    setBusy(true);
    try {
      let removed = 0;
      for (const id of working) {
        const n = await removeSubtree(id);
        removed += n;
      }
      setWorking(new Set());
      setStatus(`Removed ${removed} records.`);
    } finally {
      setBusy(false);
    }
  };

  const exportAndRemove = async () => {
    if (working.size === 0) { setStatus('Select at least one person.'); return; }
    if (!(await modal.confirm(
      `Export ${working.size} persons (and their subtree) to a JSON file, then remove them from the current database?\n\nThis mirrors the Mac "Slice" flow. The export happens first — if it succeeds, the remove runs. The operation cannot be undone from here.`,
      { title: 'Slice subtree (export then remove)', okLabel: 'Slice', destructive: true },
    ))) return;
    setBusy(true);
    try {
      const roots = [...working];
      const backups = await Promise.all(roots.map((id) => exportSubtreeBackup(id)));
      const merged = mergeBackups(backups);
      downloadJson(`cloudtreeweb-subtree-slice-${Date.now()}.json`, merged);
      let removed = 0;
      for (const id of working) removed += await removeSubtree(id);
      setWorking(new Set());
      setStatus(`Sliced: exported ${Object.keys(merged.records).length} records, then removed ${removed}.`);
    } catch (err) {
      setStatus(`Slice failed before remove: ${err.message}. Nothing was removed.`);
    } finally {
      setBusy(false);
    }
  };

  const firstRight = workingPersons[0]?.recordName;

  return (
    <div className="h-full overflow-auto p-6">
      <header className="flex items-center gap-3 mb-4">
        <div className="min-w-0 me-auto">
          <h1 className="text-base font-semibold leading-tight">Subtree wizard</h1>
          <p className="text-xs text-muted-foreground">Build a slice of the tree, then export or remove it.</p>
        </div>
        <button onClick={() => navigate('/export')} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Back to Export</button>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
        <label className="flex items-center gap-2">Generations depth
          <input
            type="number"
            min="1"
            max="15"
            value={depth}
            onChange={(e) => setDepth(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
            className="w-16 h-8 rounded-md border border-border bg-secondary px-2"
          />
        </label>
        <button onClick={exportWorkingSet} disabled={busy || working.size === 0} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-semibold disabled:opacity-50">
          Export subtree ({working.size})
        </button>
        <button onClick={removeWorkingSet} disabled={busy || working.size === 0} className="border border-destructive text-destructive rounded-md px-3 py-1.5 hover:bg-destructive/10 disabled:opacity-50">
          Remove subtree
        </button>
        <button onClick={exportAndRemove} disabled={busy || working.size === 0} className="border border-border rounded-md px-3 py-1.5 hover:bg-accent disabled:opacity-50" title="Mac 'Slice': export then remove">
          Slice (export then remove)
        </button>
        {status ? <span className="text-muted-foreground ms-2">{status}</span> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 h-[calc(100vh-220px)]">
        <Column
          title={`Available persons (${availablePersons.length})`}
          persons={availablePersons}
          selection={leftSelection}
          onToggle={(id) => toggle(leftSelection, setLeftSelection, id)}
        />
        <div className="flex md:flex-col items-center justify-center gap-2">
          <button onClick={addSelected} disabled={leftSelection.size === 0} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">Add →</button>
          <button onClick={removeSelected} disabled={rightSelection.size === 0} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">← Remove</button>
          <div className="border-t border-border w-full my-2" />
          <button onClick={() => firstRight && addAncestorsOf(firstRight)} disabled={!firstRight || busy} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">+ Ancestors</button>
          <button onClick={() => firstRight && addDescendantsOf(firstRight)} disabled={!firstRight || busy} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">+ Descendants</button>
        </div>
        <Column
          title={`Persons to be exported (${workingPersons.length})`}
          persons={workingPersons}
          selection={rightSelection}
          onToggle={(id) => toggle(rightSelection, setRightSelection, id)}
        />
      </div>
    </div>
  );
}

function toggle(set, setSet, id) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  setSet(next);
}

function Column({ title, persons, selection, onToggle }) {
  return (
    <div className="border border-border rounded-md flex flex-col min-h-0 overflow-hidden">
      <header className="px-3 py-2 bg-muted border-b border-border text-xs font-semibold">{title}</header>
      <ul className="flex-1 overflow-auto p-1">
        {persons.map((p) => (
          <li key={p.recordName}>
            <label className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent cursor-pointer ${selection.has(p.recordName) ? 'bg-primary/10' : ''}`}>
              <input type="checkbox" checked={selection.has(p.recordName)} onChange={() => onToggle(p.recordName)} />
              <span className="truncate">{p.fullName}</span>
            </label>
          </li>
        ))}
        {persons.length === 0 ? <li className="text-center text-xs text-muted-foreground py-6">Empty</li> : null}
      </ul>
    </div>
  );
}

function mergeBackups(list) {
  const merged = {
    format: 'cloudtreeweb-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    records: {},
    assets: [],
  };
  for (const b of list) {
    Object.assign(merged.records, b.records || {});
    if (Array.isArray(b.assets)) merged.assets.push(...b.assets);
  }
  // De-dupe assets by assetId.
  const seen = new Set();
  merged.assets = merged.assets.filter((a) => (seen.has(a.assetId) ? false : (seen.add(a.assetId), true)));
  return merged;
}
