import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAppPreferences } from '../lib/appPreferences.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import {
  DEFAULT_FAMILYSEARCH_CONFIG,
  FAMILYSEARCH_ENVIRONMENTS,
  buildFamilySearchAuthorizationUrl,
  compareLocalToFamilySearchPerson,
  findFamilySearchMatchesByExample,
  getFamilySearchConfig,
  mergeFamilySearchPersons,
  readFamilySearchMergeAnalysis,
  readFamilySearchPerson,
  saveFamilySearchConfig,
} from '../lib/familySearchApi.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { readField } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import { FamilySearchSourceFoldersSheet } from '../components/FamilySearchSourceFoldersSheet.jsx';
import { FamilySearchBatchDownloadSheet } from '../components/FamilySearchBatchDownloadSheet.jsx';

const TASK_META_KEY = 'familySearchTasks';

const TASK_TYPES = [
  { id: 'match-review', label: 'Match Review' },
  { id: 'record-match-review', label: 'Record Match Review' },
  { id: 'picture-review', label: 'Picture Review' },
  { id: 'ordinance-review', label: 'Ordinance Review' },
  { id: 'sync-review', label: 'Sync Review' },
];

export default function FamilySearch() {
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('unmatched');
  const [taskType, setTaskType] = useState('match-review');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [apiStatus, setApiStatus] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingValue, setEditingValue] = useState('');
  const [apiConfig, setApiConfig] = useState(DEFAULT_FAMILYSEARCH_CONFIG);
  const [apiOutput, setApiOutput] = useState(null);
  const [compareRows, setCompareRows] = useState([]);
  const [mergeSurvivorId, setMergeSurvivorId] = useState('');
  const [mergeDuplicateId, setMergeDuplicateId] = useState('');
  const [mergeReason, setMergeReason] = useState('');
  const [resourcesToCopy, setResourcesToCopy] = useState('');
  const [resourcesToDelete, setResourcesToDelete] = useState('');
  const [sourceFoldersOpen, setSourceFoldersOpen] = useState(false);
  const [batchDownloadOpen, setBatchDownloadOpen] = useState(false);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const [{ records }, savedTasks, prefs] = await Promise.all([
      db.query('Person', { limit: 100000 }),
      db.getMeta(TASK_META_KEY),
      getAppPreferences(),
    ]);
    setPeople(records.map((record) => ({
      record,
      summary: personSummary(record),
      familySearchID: readField(record, ['familySearchID', 'familySearchId'], ''),
    })).filter((entry) => entry.summary));
    setTasks(Array.isArray(savedTasks) ? savedTasks : []);
    setTaskType(prefs.familySearch.defaultTaskType || 'match-review');
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    let cancel = false;
    (async () => {
      const config = await getFamilySearchConfig();
      if (!cancel) setApiConfig(config);
    })();
    return () => { cancel = true; };
  }, []);

  const stats = useMemo(() => {
    const matched = people.filter((entry) => entry.familySearchID).length;
    const openTasks = tasks.filter((task) => task.status !== 'done').length;
    return { total: people.length, matched, unmatched: people.length - matched, openTasks };
  }, [people, tasks]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((entry) => {
      if (filter === 'matched' && !entry.familySearchID) return false;
      if (filter === 'unmatched' && entry.familySearchID) return false;
      if (filter === 'tasks' && !tasks.some((task) => task.personId === entry.record.recordName && task.status !== 'done')) return false;
      if (!q) return true;
      return entry.summary.fullName.toLowerCase().includes(q) || String(entry.familySearchID).toLowerCase().includes(q);
    });
  }, [filter, people, query, tasks]);

  const saveTasks = useCallback(async (next) => {
    setTasks(next);
    await getLocalDatabase().setMeta(TASK_META_KEY, next);
  }, []);

  const addTask = useCallback(async (personId, type = taskType) => {
    const person = people.find((entry) => entry.record.recordName === personId);
    if (!person) return;
    const next = [
      {
        id: uuid('fst'),
        personId,
        personName: person.summary.fullName,
        type,
        status: 'open',
        createdAt: new Date().toISOString(),
        note: '',
      },
      ...tasks,
    ];
    await saveTasks(next);
    setStatus('Task added');
    setTimeout(() => setStatus(''), 1500);
  }, [people, saveTasks, taskType, tasks]);

  const updateTaskStatus = useCallback(async (taskId, nextStatus) => {
    await saveTasks(tasks.map((task) => task.id === taskId ? { ...task, status: nextStatus, updatedAt: new Date().toISOString() } : task));
  }, [saveTasks, tasks]);

  const startEditingId = useCallback((entry) => {
    setEditingId(entry.record.recordName);
    setEditingValue(entry.familySearchID || '');
  }, []);

  const saveFamilySearchId = useCallback(async () => {
    const entry = people.find((item) => item.record.recordName === editingId);
    if (!entry) return;
    const next = {
      ...entry.record,
      fields: {
        ...(entry.record.fields || {}),
      },
    };
    if (editingValue.trim()) {
      next.fields.familySearchID = { value: editingValue.trim(), type: 'STRING' };
    } else {
      delete next.fields.familySearchID;
      delete next.fields.familySearchId;
    }
    await saveWithChangeLog(next);
    setEditingId('');
    setEditingValue('');
    await reload();
    setStatus('FamilySearch ID saved');
    setTimeout(() => setStatus(''), 1500);
  }, [editingId, editingValue, people, reload]);

  const updateApiConfig = useCallback((key, value) => {
    setApiConfig((current) => ({ ...current, [key]: value }));
  }, []);

  const onSaveApiConfig = useCallback(async () => {
    try {
      const saved = await saveFamilySearchConfig(apiConfig);
      setApiConfig(saved);
      setApiStatus('FamilySearch API settings saved.');
    } catch (error) {
      setApiStatus(`Settings save failed: ${error.message}`);
    }
  }, [apiConfig]);

  const onOpenAuthorization = useCallback(() => {
    try {
      const url = buildFamilySearchAuthorizationUrl(apiConfig, `ctw-${Date.now().toString(36)}`);
      window.open(url, '_blank', 'noopener,noreferrer');
      setApiStatus('Authorization page opened. Paste the returned access token or exchange the code outside this browser build.');
    } catch (error) {
      setApiStatus(error.message);
    }
  }, [apiConfig]);

  const onFindMatches = useCallback(async (entry) => {
    setApiStatus('Calling FamilySearch matches…');
    try {
      const output = await findFamilySearchMatchesByExample(apiConfig, entry.record);
      setApiOutput({ title: `Matches for ${entry.summary.fullName}`, data: output });
      setCompareRows([]);
      setApiStatus('FamilySearch matches loaded.');
    } catch (error) {
      setApiStatus(`FamilySearch matches failed: ${error.message}`);
    }
  }, [apiConfig]);

  const onComparePerson = useCallback(async (entry) => {
    const personId = entry.familySearchID || prompt('FamilySearch person ID:');
    if (!personId) return;
    setApiStatus('Reading FamilySearch person…');
    try {
      const remote = await readFamilySearchPerson(apiConfig, personId);
      setApiOutput({ title: `FamilySearch ${personId}`, data: remote });
      setCompareRows(compareLocalToFamilySearchPerson(entry.record, remote));
      setMergeSurvivorId((current) => current || personId);
      setApiStatus('Comparison ready.');
    } catch (error) {
      setApiStatus(`Compare failed: ${error.message}`);
    }
  }, [apiConfig]);

  const onReadMergeAnalysis = useCallback(async () => {
    setApiStatus('Reading merge analysis…');
    try {
      const output = await readFamilySearchMergeAnalysis(apiConfig, mergeSurvivorId, mergeDuplicateId);
      setApiOutput({ title: `Merge ${mergeSurvivorId} <- ${mergeDuplicateId}`, data: output });
      setApiStatus('Merge analysis loaded.');
    } catch (error) {
      setApiStatus(`Merge analysis failed: ${error.message}`);
    }
  }, [apiConfig, mergeDuplicateId, mergeSurvivorId]);

  const onSubmitMerge = useCallback(async () => {
    if (!confirm('Submit this merge plan to FamilySearch? This changes FamilySearch Family Tree data.')) return;
    setApiStatus('Submitting FamilySearch merge…');
    try {
      await mergeFamilySearchPersons(apiConfig, {
        survivorId: mergeSurvivorId,
        duplicateId: mergeDuplicateId,
        reason: mergeReason,
        resourcesToCopy: lines(resourcesToCopy),
        resourcesToDelete: lines(resourcesToDelete),
      });
      setApiStatus('FamilySearch merge submitted.');
    } catch (error) {
      setApiStatus(`Merge failed: ${error.message}`);
    }
  }, [apiConfig, mergeDuplicateId, mergeReason, mergeSurvivorId, resourcesToCopy, resourcesToDelete]);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-5">
        <header className="flex items-center gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold">FamilySearch</h1>
            <p className="text-sm text-muted-foreground mt-1">Local FamilySearch ID review, search launch, and task tracking.</p>
          </div>
          {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
          <div className={`${status ? '' : 'ms-auto'} flex gap-2`}>
            <button onClick={() => setSourceFoldersOpen(true)} className="text-xs border border-border bg-secondary rounded-md px-2.5 py-1.5">
              Manage Sources…
            </button>
            <button onClick={() => setBatchDownloadOpen(true)} className="text-xs border border-border bg-secondary rounded-md px-2.5 py-1.5">
              Auto-Download Relatives…
            </button>
          </div>
        </header>
        <FamilySearchSourceFoldersSheet open={sourceFoldersOpen} onClose={() => setSourceFoldersOpen(false)} />
        <FamilySearchBatchDownloadSheet open={batchDownloadOpen} onClose={() => setBatchDownloadOpen(false)} />

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat label="People" value={stats.total} />
          <Stat label="Matched" value={stats.matched} />
          <Stat label="Unmatched" value={stats.unmatched} />
          <Stat label="Open Tasks" value={stats.openTasks} />
        </section>

        <section className="rounded-lg border border-border bg-card p-4 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Filter">
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className={inputClass}>
                <option value="all">All People</option>
                <option value="matched">Matched</option>
                <option value="unmatched">Unmatched</option>
                <option value="tasks">Open Tasks</option>
              </select>
            </Field>
            <Field label="Task Type">
              <select value={taskType} onChange={(event) => setTaskType(event.target.value)} className={inputClass}>
                {TASK_TYPES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
            </Field>
            <Field label="Find">
              <input value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} />
            </Field>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
          <main className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-semibold">{visible.length} people</div>
            <div className="divide-y divide-border">
              {visible.slice(0, 300).map((entry) => {
                const personTasks = tasks.filter((task) => task.personId === entry.record.recordName && task.status !== 'done');
                return (
                  <div key={entry.record.recordName} className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{entry.summary.fullName}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {entry.familySearchID ? `FamilySearch ID ${entry.familySearchID}` : 'No FamilySearch ID'}{personTasks.length ? ` · ${personTasks.length} open task${personTasks.length === 1 ? '' : 's'}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => navigate(`/web-search?provider=familysearch&personId=${encodeURIComponent(entry.record.recordName)}`)} className={secondaryButton}>Search</button>
                      <button onClick={() => onFindMatches(entry)} className={secondaryButton}>API matches</button>
                      <button onClick={() => onComparePerson(entry)} className={secondaryButton}>Compare</button>
                      <button onClick={() => startEditingId(entry)} className={secondaryButton}>ID</button>
                      <button onClick={() => addTask(entry.record.recordName)} className={secondaryButton}>Task</button>
                      <button onClick={() => navigate(`/person/${entry.record.recordName}`)} className={secondaryButton}>Open</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>

          <aside className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold mb-3">API connection</h2>
              <div className="space-y-3">
                <Field label="Environment">
                  <select value={apiConfig.environment} onChange={(event) => updateApiConfig('environment', event.target.value)} className={inputClass}>
                    {Object.entries(FAMILYSEARCH_ENVIRONMENTS).map(([id, env]) => <option key={id} value={id}>{env.label}</option>)}
                  </select>
                </Field>
                <Field label="Client ID">
                  <input value={apiConfig.clientId} onChange={(event) => updateApiConfig('clientId', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Redirect URI">
                  <input value={apiConfig.redirectUri} onChange={(event) => updateApiConfig('redirectUri', event.target.value)} className={inputClass} />
                </Field>
                <Field label="Access token">
                  <input value={apiConfig.accessToken} onChange={(event) => updateApiConfig('accessToken', event.target.value)} className={inputClass} type="password" />
                </Field>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={apiConfig.termsConfirmed}
                    onChange={(event) => updateApiConfig('termsConfirmed', event.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I have FamilySearch API access and will follow FamilySearch terms, privacy, and one-person-at-a-time contribution rules.</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={onSaveApiConfig} className={primaryButton}>Save</button>
                  <button onClick={onOpenAuthorization} className={secondaryButton}>Open auth</button>
                </div>
                {apiStatus && <div className="text-xs text-muted-foreground">{apiStatus}</div>}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold mb-3">Compare / merge</h2>
              {compareRows.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-md border border-border text-xs">
                  {compareRows.map((row) => (
                    <div key={row.field} className="grid grid-cols-[72px_1fr_1fr] gap-2 border-b border-border last:border-b-0 p-2">
                      <span className="font-medium">{row.field}</span>
                      <span className={row.status === 'same' ? 'text-emerald-500' : 'text-muted-foreground'}>{row.local || '—'}</span>
                      <span className={row.status === 'same' ? 'text-emerald-500' : row.status === 'different' ? 'text-amber-500' : 'text-muted-foreground'}>{row.remote || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3">
                <Field label="Survivor ID">
                  <input value={mergeSurvivorId} onChange={(event) => setMergeSurvivorId(event.target.value)} className={inputClass} />
                </Field>
                <Field label="Duplicate ID">
                  <input value={mergeDuplicateId} onChange={(event) => setMergeDuplicateId(event.target.value)} className={inputClass} />
                </Field>
                <Field label="Reason">
                  <input value={mergeReason} onChange={(event) => setMergeReason(event.target.value)} className={inputClass} />
                </Field>
                <Field label="Resources to copy">
                  <textarea value={resourcesToCopy} onChange={(event) => setResourcesToCopy(event.target.value)} className={inputClass} rows={3} />
                </Field>
                <Field label="Resources to delete">
                  <textarea value={resourcesToDelete} onChange={(event) => setResourcesToDelete(event.target.value)} className={inputClass} rows={3} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <button onClick={onReadMergeAnalysis} className={secondaryButton}>Read analysis</button>
                  <button onClick={onSubmitMerge} className={primaryButton}>Submit merge</button>
                </div>
              </div>
            </section>

            {apiOutput && (
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold mb-3">{apiOutput.title}</h2>
                <pre className="max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(apiOutput.data, null, 2)}
                </pre>
              </section>
            )}

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold mb-3">FamilySearch ID</h2>
              {editingId ? (
                <div className="space-y-3">
                  <input value={editingValue} onChange={(event) => setEditingValue(event.target.value)} className={inputClass} />
                  <div className="flex gap-2">
                    <button onClick={saveFamilySearchId} className={primaryButton}>Save ID</button>
                    <button onClick={() => setEditingId('')} className={secondaryButton}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Select ID on a person row.</div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold mb-3">Tasks</h2>
              {tasks.length === 0 ? (
                <div className="text-sm text-muted-foreground">No FamilySearch tasks.</div>
              ) : (
                <div className="space-y-2">
                  {tasks.slice(0, 12).map((task) => (
                    <div key={task.id} className="rounded-md border border-border bg-background p-3">
                      <div className="text-sm font-medium">{task.personName}</div>
                      <div className="text-xs text-muted-foreground mt-1">{taskLabel(task.type)} · {task.status}</div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => updateTaskStatus(task.id, task.status === 'done' ? 'open' : 'done')} className={secondaryButton}>
                          {task.status === 'done' ? 'Reopen' : 'Done'}
                        </button>
                        <button onClick={() => navigate(`/web-search?provider=familysearch&personId=${encodeURIComponent(task.personId)}`)} className={secondaryButton}>Search</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function taskLabel(type) {
  return TASK_TYPES.find((entry) => entry.id === type)?.label || type;
}

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function lines(value) {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary min-w-[180px]';
const primaryButton = 'rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold disabled:opacity-60';
const secondaryButton = 'rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60';
