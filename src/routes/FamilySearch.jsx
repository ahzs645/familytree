import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buttonClasses } from '../components/ui/Button.jsx';
import { getAppPreferences } from '../lib/appPreferences.js';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { generateId } from '../lib/ids.js';
import { formClasses } from '../components/ui/formClasses.js';
import {
  DEFAULT_FAMILYSEARCH_CONFIG,
  FAMILYSEARCH_ENVIRONMENTS,
  addFamilySearchDiscussionComment,
  applyFamilySearchSyncAction,
  beginFamilySearchPkceAuthorization,
  buildFamilySearchSyncRows,
  collectFamilySearchPlaceStrings,
  compareLocalToFamilySearchPerson,
  createFamilySearchDiscussion,
  exchangeFamilySearchAuthorizationCode,
  familySearchPersonWebUrl,
  findFamilySearchMatchesByExample,
  getFamilySearchConfig,
  listFamilySearchDiscussions,
  listFamilySearchRecordMatches,
  markFamilySearchRecordMatchesSeen,
  mergeFamilySearchPersons,
  normalizeChangeHistoryFeed,
  normalizeFamilySearchPerson,
  normalizeRecordMatchFeed,
  readFamilySearchChangeHistory,
  readFamilySearchMergeAnalysis,
  readFamilySearchFurtherInformation,
  readFamilySearchPerson,
  saveFamilySearchConfig,
  setFamilySearchRecordMatchStatus,
  uploadFamilySearchMemory,
  uploadFamilySearchPerson,
} from '../lib/familySearchApi.js';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { useRecords } from '../lib/data/useRecords.js';
import { matchesSearchText } from '../lib/i18n.js';
import { readField } from '../lib/schema.js';
import { refValue } from '../lib/schema.js';
import { Gender, personSummary } from '../models/index.js';
import { FamilySearchSourceFoldersSheet } from '../components/FamilySearchSourceFoldersSheet.jsx';
import { FamilySearchBatchDownloadSheet } from '../components/FamilySearchBatchDownloadSheet.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { BdiText, LtrText } from '../components/BdiText.jsx';
import { PageTitle } from '../components/ui/PageTitle.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { createRecordEnvelope, createWithChangeLog } from '../lib/recordWrite.js';
import { linkExistingRelative } from '../lib/relativeLinks.js';
import {
  acceptFamilySearchPolicy,
  getFamilySearchPolicyAcceptances,
  listFamilySearchFurtherInformation,
  markFamilySearchFurtherInformationSeen,
  mergeFamilySearchFurtherInformation,
  saveFamilySearchFurtherInformation,
} from '../lib/familySearchSourceFolders.js';
import { FamilySearchPolicySheet } from '../components/FamilySearchPolicySheet.jsx';
import { FamilySearchSelectPlaceSheet } from '../components/FamilySearchSelectPlaceSheet.jsx';
import { FamilySearchApproveAllSheet } from '../components/FamilySearchApproveAllSheet.jsx';
import { FamilySearchRemoteTreeSheet } from '../components/FamilySearchRemoteTreeSheet.jsx';

const TASK_META_KEY = 'familySearchTasks';

const TASK_TYPES = [
  { id: 'match-review', label: 'Match Review' },
  { id: 'record-match-review', label: 'Record Match Review' },
  { id: 'picture-review', label: 'Picture Review' },
  { id: 'ordinance-review', label: 'Ordinance Review' },
  { id: 'sync-review', label: 'Sync Review' },
];

const TASKS_BY_PANE = {
  overview: null,
  matches: null,
  'auto-matches': 'match-review',
  'record-matches': 'record-match-review',
  ordinances: 'ordinance-review',
  memories: 'picture-review',
  discussions: 'record-match-review',
  'change-history': 'sync-review',
  records: 'record-match-review',
  'further-information': null,
  statistics: null,
};

const FAMILYSEARCH_PANES = [
  { id: 'overview', label: 'Overview', description: 'Local IDs, API connection, and full workflow controls.' },
  { id: 'matches', label: 'Matches', description: 'Matched versus unmatched people and quick actions.' },
  { id: 'auto-matches', label: 'Auto-Matches', description: 'Open tasks flagged for API auto-match review.' },
  { id: 'record-matches', label: 'Record Matches', description: 'Review and resolve record-match workflow tasks.' },
  { id: 'ordinances', label: 'Ordinances', description: 'Track ordinance review queue (local-first for now).' },
  { id: 'memories', label: 'Memories', description: 'Quickly route memory-related FamilySearch work.' },
  { id: 'discussions', label: 'Discussions', description: 'Review discussion-style FamilySearch review tasks.' },
  { id: 'change-history', label: 'Change History', description: 'Review queued sync/change-history actions.' },
  { id: 'records', label: 'Records', description: 'Open records linked to FamilySearch match tasks.' },
  { id: 'further-information', labelKey: 'familySearch.panes.furtherInformation.label', descriptionKey: 'familySearch.panes.furtherInformation.description' },
  { id: 'statistics', label: 'Statistics', description: 'Summary totals and task depth for parity-style reporting.' },
];

const DEFAULT_PANE = 'overview';

export default function FamilySearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const modal = useModal();
  const paneFromQuery = searchParams.get('pane');
  const activePane = FAMILYSEARCH_PANES.find((entry) => entry.id === paneFromQuery)?.id || DEFAULT_PANE;
  const activePaneMeta = FAMILYSEARCH_PANES.find((entry) => entry.id === activePane) || FAMILYSEARCH_PANES[0];

  const { records: personRecords } = useRecords('Person');
  const { records: placeRecords } = useRecords('Place');
  const placesById = useMemo(() => new Map(placeRecords.map((place) => [place.recordName, place])), [placeRecords]);
  const people = useMemo(
    () => personRecords.map((record) => ({
      record,
      summary: personSummary(record),
      familySearchID: readField(record, ['familySearchID', 'familySearchId'], ''),
    })).filter((entry) => entry.summary),
    [personRecords],
  );
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('unmatched');
  const defaultFilterApplied = useRef(false);
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
  const [syncPersonId, setSyncPersonId] = useState('');
  const [syncRows, setSyncRows] = useState([]);
  const [recordMatchRows, setRecordMatchRows] = useState([]);
  const [recordMatchPersonId, setRecordMatchPersonId] = useState('');
  const [discussionRows, setDiscussionRows] = useState([]);
  const [discussionPersonId, setDiscussionPersonId] = useState('');
  const [changeHistoryRows, setChangeHistoryRows] = useState([]);
  const [comparePersonRecord, setComparePersonRecord] = useState(null);
  const [policyAcceptances, setPolicyAcceptances] = useState({ memories: null, ordinances: null });
  const [policiesLoaded, setPoliciesLoaded] = useState(false);
  const [pendingPolicy, setPendingPolicy] = useState('');
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [furtherInformation, setFurtherInformation] = useState([]);
  const [furtherScanBusy, setFurtherScanBusy] = useState(false);
  const [furtherScanProgress, setFurtherScanProgress] = useState('');
  const [remoteTreeRootId, setRemoteTreeRootId] = useState('');
  const [pendingImportPayloads, setPendingImportPayloads] = useState([]);
  const [incomingPlaces, setIncomingPlaces] = useState([]);
  const [pendingSyncPlace, setPendingSyncPlace] = useState(null);

  const setPane = useCallback((nextPane) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.set('pane', nextPane);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const requestPane = useCallback((nextPane) => {
    if (!policiesLoaded) {
      setPane(nextPane);
      return;
    }
    if ((nextPane === 'memories' || nextPane === 'ordinances') && !policyAcceptances[nextPane]) {
      setPendingPolicy(nextPane);
      return;
    }
    setPane(nextPane);
  }, [policiesLoaded, policyAcceptances, setPane]);

  const reload = useCallback(async () => {
    const [savedTasks, prefs, policies, furtherItems] = await Promise.all([
      getAppDataClient().meta.get(TASK_META_KEY),
      getAppPreferences(),
      getFamilySearchPolicyAcceptances(),
      listFamilySearchFurtherInformation(),
    ]);
    setTasks(Array.isArray(savedTasks) ? savedTasks : []);
    setTaskType(prefs.familySearch?.defaultTaskType || 'match-review');
    setPolicyAcceptances(policies);
    setPoliciesLoaded(true);
    setFurtherInformation(furtherItems);
    if (!defaultFilterApplied.current) {
      defaultFilterApplied.current = true;
      const showMatched = prefs.familySearch?.showMatched !== false;
      const showUnmatched = prefs.familySearch?.showUnmatched !== false;
      if (showMatched && !showUnmatched) setFilter('matched');
      else if (!showMatched && showUnmatched) setFilter('unmatched');
      else setFilter('all');
    }
  }, []);

  useEffect(() => {
    if (policiesLoaded && (activePane === 'memories' || activePane === 'ordinances') && !policyAcceptances[activePane]) {
      setPendingPolicy(activePane);
    }
  }, [activePane, policiesLoaded, policyAcceptances]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const config = await getFamilySearchConfig();
      if (!cancel) setApiConfig(config);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // PKCE redirect handler: when FamilySearch redirects back with ?code=, exchange it
  // for an access token. Falls back to the manual token-paste flow if the exchange
  // fails (the most common case in this backend-less build is a CORS error — a backend
  // proxy is required for the token endpoint).
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) return;
    const returnedState = searchParams.get('state') || '';
    let cancel = false;
    (async () => {
      setApiStatus('Exchanging FamilySearch authorization code…');
      try {
        const config = await getFamilySearchConfig();
        const { accessToken } = await exchangeFamilySearchAuthorizationCode(config, code, { state: returnedState });
        const saved = await saveFamilySearchConfig({ ...config, accessToken });
        if (cancel) return;
        setApiConfig(saved);
        setApiStatus('FamilySearch access token obtained via PKCE.');
      } catch (error) {
        if (cancel) return;
        setApiStatus(`Code exchange failed (${error.message}). Paste the access token manually instead.`);
      } finally {
        // Strip the code/state from the URL so a reload does not re-trigger exchange.
        setSearchParams((params) => {
          const next = new URLSearchParams(params);
          next.delete('code');
          next.delete('state');
          return next;
        }, { replace: true });
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const matched = people.filter((entry) => entry.familySearchID).length;
    const openTasks = tasks.filter((task) => task.status !== 'done').length;
    const doneTasks = tasks.filter((task) => task.status === 'done').length;
    const taskCounts = TASK_TYPES.reduce((acc, current) => {
      acc[current.id] = tasks.filter((task) => task.type === current.id).length;
      return acc;
    }, {});
    return {
      total: people.length,
      matched,
      unmatched: people.length - matched,
      openTasks,
      doneTasks,
      taskCounts,
    };
  }, [people, tasks]);

  const filteredBySearch = useMemo(() => {
    const q = query.trim();
    return people.filter((entry) => {
      if (filter === 'matched' && !entry.familySearchID) return false;
      if (filter === 'unmatched' && entry.familySearchID) return false;
      if (filter === 'tasks' && !tasks.some((task) => task.personId === entry.record.recordName && task.status !== 'done')) return false;
      if (!q) return true;
      return matchesSearchText(entry.summary.fullName, q) || matchesSearchText(entry.familySearchID, q);
    });
  }, [filter, people, query, tasks]);

  const peopleByPane = useMemo(() => {
    if (activePane === 'overview') return filteredBySearch;
    if (activePane === 'matches') return filteredBySearch.filter((entry) => !entry.familySearchID);

    const taskTypeForPane = TASKS_BY_PANE[activePane];
    if (!taskTypeForPane) {
      return activePane === 'statistics' ? [] : filteredBySearch;
    }

    return filteredBySearch.filter((entry) => tasks.some((task) =>
      task.personId === entry.record.recordName
      && task.type === taskTypeForPane
      && task.status !== 'done',
    ));
  }, [activePane, filteredBySearch, tasks]);

  const tasksByPane = useMemo(() => {
    const taskTypeForPane = TASKS_BY_PANE[activePane];
    return taskTypeForPane ? tasks.filter((task) => task.type === taskTypeForPane) : tasks;
  }, [activePane, tasks]);

  const saveTasks = useCallback(async (next) => {
    setTasks(next);
    await getAppDataClient().meta.set(TASK_META_KEY, next);
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

  const onOpenAuthorization = useCallback(async () => {
    try {
      // Persist the latest config (clientId/redirectUri) so the redirect handler can
      // complete the exchange after FamilySearch sends us back.
      await saveFamilySearchConfig(apiConfig);
      const { url } = await beginFamilySearchPkceAuthorization(apiConfig);
      // Same-tab navigation so the ?code= redirect lands back on this route and the
      // PKCE verifier stored in sessionStorage is still available.
      window.location.href = url;
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
    const personId = entry.familySearchID || await modal.prompt('FamilySearch person ID:', '', { title: 'Compare FamilySearch person' });
    if (!personId) return;
    setApiStatus('Reading FamilySearch person…');
    try {
      const remote = await readFamilySearchPerson(apiConfig, personId);
      setApiOutput({ title: `FamilySearch ${personId}`, data: remote });
      setCompareRows(compareLocalToFamilySearchPerson(entry.record, remote, { placesById }));
      setSyncRows(buildFamilySearchSyncRows(entry.record, remote, { placesById }));
      setSyncPersonId(personId);
      setComparePersonRecord(entry.record);
      setMergeSurvivorId((current) => current || personId);
      setApiStatus('Comparison ready.');
    } catch (error) {
      setApiStatus(`Compare failed: ${error.message}`);
    }
  }, [apiConfig, modal, placesById]);

  const onSyncAction = useCallback(async (row, direction) => {
    if (!syncPersonId || !comparePersonRecord) return;
    const actionLabel = t(`familySearch.sync.actions.${direction}`);
    const fieldLabel = familySearchFieldLabel(row.field, t);
    const reason = await modal.prompt(
      t('familySearch.sync.reasonPrompt', { action: actionLabel, field: fieldLabel }),
      '',
      { title: t('familySearch.sync.actionTitle', { action: actionLabel, field: fieldLabel }) },
    );
    if (!reason) return;
    setApiStatus(t('familySearch.sync.actionProgress', { action: actionLabel, field: fieldLabel }));
    try {
      if (direction === 'download') {
        if (row.conclusion === 'birthPlace' || row.conclusion === 'deathPlace') {
          setPendingSyncPlace({ row, record: comparePersonRecord });
          setIncomingPlaces([row.remote]);
          return;
        }
        // Pull the remote value into the local record.
        const next = {
          ...comparePersonRecord,
          fields: { ...(comparePersonRecord.fields || {}) },
        };
        if (row.conclusion === 'birth') next.fields.birthDate = { value: row.remote, type: 'STRING' };
        else if (row.conclusion === 'death') next.fields.deathDate = { value: row.remote, type: 'STRING' };
        else if (row.conclusion === 'gender') next.fields.gender = { value: row.remote === 'Female' ? Gender.Female : Gender.Male, type: 'INT64' };
        else if (row.conclusion === 'name') next.fields.cached_fullName = { value: row.remote, type: 'STRING' };
        await saveWithChangeLog(next);
        await reload();
        setApiStatus(t('familySearch.sync.downloaded', { field: fieldLabel }));
        return;
      }
      await applyFamilySearchSyncAction(apiConfig, {
        personId: syncPersonId,
        row,
        direction,
        localPerson: comparePersonRecord,
        reason,
      });
      setApiStatus(t('familySearch.sync.sent', { action: actionLabel, field: fieldLabel }));
    } catch (error) {
      setApiStatus(t('familySearch.sync.failed', { action: actionLabel, message: error.message }));
    }
  }, [apiConfig, comparePersonRecord, modal, reload, syncPersonId, t]);

  const onUploadPerson = useCallback(async (entry) => {
    if (!(await modal.confirm(
      `Upload "${entry.summary.fullName}" as a NEW FamilySearch person? Search for existing duplicates first to avoid creating a duplicate in the shared tree.`,
      { title: 'Upload to FamilySearch', okLabel: 'Upload' },
    ))) return;
    const reason = await modal.prompt('Reason for adding this person to FamilySearch:', '', { title: 'Upload reason' });
    if (reason === null) return;
    setApiStatus('Uploading person to FamilySearch…');
    try {
      const { personId } = await uploadFamilySearchPerson(apiConfig, entry.record, { reason });
      if (personId) {
        const next = { ...entry.record, fields: { ...(entry.record.fields || {}) } };
        next.fields.familySearchID = { value: personId, type: 'STRING' };
        await saveWithChangeLog(next);
        await reload();
        setApiStatus(`Uploaded. New FamilySearch ID ${personId} saved locally.`);
      } else {
        setApiStatus('Upload succeeded but no FamilySearch ID was returned.');
      }
    } catch (error) {
      setApiStatus(`Upload failed: ${error.message}`);
    }
  }, [apiConfig, modal, reload]);

  const onLoadRecordMatches = useCallback(async (entry) => {
    const personId = entry.familySearchID || await modal.prompt('FamilySearch person ID for record matches:', '', { title: 'Record matches' });
    if (!personId) return;
    setApiStatus('Loading record matches…');
    try {
      const feed = await listFamilySearchRecordMatches(apiConfig, personId);
      setRecordMatchRows(normalizeRecordMatchFeed(feed));
      setRecordMatchPersonId(personId);
      setApiOutput({ title: `Record matches ${personId}`, data: feed });
      setApiStatus('Record matches loaded.');
    } catch (error) {
      setApiStatus(`Record matches failed: ${error.message}`);
    }
  }, [apiConfig, modal]);

  const onResolveRecordMatch = useCallback(async (match, statusValue) => {
    const reason = statusValue === 'pending' ? '' : await modal.prompt(`Reason to ${statusValue === 'accepted' ? 'accept' : 'reject'} this record match:`, '', { title: 'Record match' });
    if (statusValue !== 'pending' && reason === null) return;
    setApiStatus(`Marking record match ${statusValue}…`);
    try {
      await setFamilySearchRecordMatchStatus(apiConfig, {
        personId: recordMatchPersonId,
        matchId: match.id,
        status: statusValue,
        reason,
      });
      setRecordMatchRows((rows) => rows.map((row) => row.id === match.id ? { ...row, status: statusValue } : row));
      setApiStatus(`Record match marked ${statusValue}.`);
    } catch (error) {
      setApiStatus(`Record match update failed: ${error.message}`);
    }
  }, [apiConfig, modal, recordMatchPersonId]);

  const onMarkAllRecordMatchesSeen = useCallback(async () => {
    if (!recordMatchPersonId) return;
    setApiStatus('Marking all record matches seen…');
    try {
      await markFamilySearchRecordMatchesSeen(apiConfig, recordMatchPersonId);
      setApiStatus('All record matches marked seen.');
    } catch (error) {
      setApiStatus(`Mark all seen failed: ${error.message}`);
    }
  }, [apiConfig, recordMatchPersonId]);

  const onAttachRecordMatchAsSource = useCallback(async (match) => {
    setApiStatus('Attaching record match as local source…');
    try {
      const sourceRecord = {
        recordName: generateId('src'),
        recordType: 'Source',
        fields: {
          title: { value: match.title || 'FamilySearch record match', type: 'STRING' },
          ...(match.url ? { url: { value: match.url, type: 'STRING' } } : {}),
          ...(match.collection ? { citation: { value: match.collection, type: 'STRING' } } : {}),
          note: { value: 'Imported from a FamilySearch record match.', type: 'STRING' },
        },
      };
      await saveWithChangeLog(sourceRecord);
      setApiStatus('Record match saved as a local source.');
    } catch (error) {
      setApiStatus(`Attach as source failed: ${error.message}`);
    }
  }, []);

  const onUploadMemory = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const title = await modal.prompt('Memory title:', file.name, { title: 'Upload memory' });
      if (title === null) return;
      setApiStatus('Uploading memory to FamilySearch…');
      try {
        const { memoryId } = await uploadFamilySearchMemory(apiConfig, { file, title });
        setApiStatus(memoryId ? `Memory uploaded (id ${memoryId}).` : 'Memory uploaded.');
      } catch (error) {
        setApiStatus(`Memory upload failed: ${error.message}`);
      }
    };
    input.click();
  }, [apiConfig, modal]);

  const onLoadDiscussions = useCallback(async (entry) => {
    const personId = entry.familySearchID || await modal.prompt('FamilySearch person ID for discussions:', '', { title: 'Discussions' });
    if (!personId) return;
    setApiStatus('Loading discussions…');
    try {
      const feed = await listFamilySearchDiscussions(apiConfig, personId);
      const refs = feed?.persons?.[0]?.['discussion-references'] || feed?.discussions || [];
      setDiscussionRows(Array.isArray(refs) ? refs : []);
      setDiscussionPersonId(personId);
      setApiOutput({ title: `Discussions ${personId}`, data: feed });
      setApiStatus('Discussions loaded.');
    } catch (error) {
      setApiStatus(`Discussions failed: ${error.message}`);
    }
  }, [apiConfig, modal]);

  const onCreateDiscussion = useCallback(async () => {
    const title = await modal.prompt('Discussion title:', '', { title: 'New discussion' });
    if (!title) return;
    const details = await modal.prompt('Discussion details:', '', { title: 'New discussion' });
    if (details === null) return;
    setApiStatus('Creating discussion…');
    try {
      await createFamilySearchDiscussion(apiConfig, { title, details });
      setApiStatus('Discussion created.');
    } catch (error) {
      setApiStatus(`Create discussion failed: ${error.message}`);
    }
  }, [apiConfig, modal]);

  const onAddDiscussionComment = useCallback(async (discussionId) => {
    const text = await modal.prompt('Comment:', '', { title: 'Add comment' });
    if (!text) return;
    setApiStatus('Adding comment…');
    try {
      await addFamilySearchDiscussionComment(apiConfig, discussionId, text);
      setApiStatus('Comment added.');
    } catch (error) {
      setApiStatus(`Add comment failed: ${error.message}`);
    }
  }, [apiConfig, modal]);

  const onLoadChangeHistory = useCallback(async (entry) => {
    const personId = entry.familySearchID || await modal.prompt('FamilySearch person ID for change history:', '', { title: 'Change history' });
    if (!personId) return;
    setApiStatus('Loading change history…');
    try {
      const feed = await readFamilySearchChangeHistory(apiConfig, personId);
      setChangeHistoryRows(normalizeChangeHistoryFeed(feed));
      setApiOutput({ title: `Change history ${personId}`, data: feed });
      setApiStatus('Change history loaded.');
    } catch (error) {
      setApiStatus(`Change history failed: ${error.message}`);
    }
  }, [apiConfig, modal]);

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
    if (!(await modal.confirm('Submit this merge plan to FamilySearch? This changes FamilySearch Family Tree data.', { title: 'Submit merge', okLabel: 'Submit' }))) return;
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
  }, [apiConfig, mergeDuplicateId, mergeReason, mergeSurvivorId, resourcesToCopy, resourcesToDelete, modal]);

  const onAcceptPolicy = useCallback(async () => {
    if (!pendingPolicy) return;
    const next = await acceptFamilySearchPolicy(pendingPolicy);
    const acceptedPane = pendingPolicy;
    setPolicyAcceptances(next);
    setPendingPolicy('');
    setPane(acceptedPane);
  }, [pendingPolicy, setPane]);

  const autoMatchTasks = useMemo(() => tasks.filter((task) => task.type === 'match-review' && task.status !== 'done'), [tasks]);

  const approveAutoMatch = useCallback(async (task) => {
    const stored = await getAppDataClient().meta.get(TASK_META_KEY);
    const current = Array.isArray(stored) ? stored : [];
    const next = current.map((item) => item.id === task.id ? { ...item, status: 'done', approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : item);
    await getAppDataClient().meta.set(TASK_META_KEY, next);
    setTasks(next);
  }, []);

  const scanFurtherInformation = useCallback(async () => {
    const matched = people.filter((entry) => entry.familySearchID);
    if (!apiConfig.accessToken && !apiConfig.mockData && !apiConfig.mockFamilySearch) {
      setFurtherScanProgress(t('familySearch.authRequired'));
      return;
    }
    setFurtherScanBusy(true);
    const scanned = [];
    try {
      for (let index = 0; index < matched.length; index += 1) {
        const entry = matched[index];
        setFurtherScanProgress(t('familySearch.furtherInformation.progress', { complete: index, count: matched.length }));
        try {
          scanned.push(await readFamilySearchFurtherInformation(apiConfig, entry.familySearchID));
        } catch (error) {
          const retained = furtherInformation.find((item) => item.personId === entry.familySearchID);
          if (retained) scanned.push(retained);
          setApiStatus(t('familySearch.furtherInformation.personFailed', { name: entry.summary.fullName, message: error?.message || String(error) }));
        }
      }
      const names = Object.fromEntries(matched.map((entry) => [entry.familySearchID, entry.summary.fullName]));
      const merged = mergeFamilySearchFurtherInformation(furtherInformation, scanned, names);
      const saved = await saveFamilySearchFurtherInformation(merged);
      setFurtherInformation(saved);
      setFurtherScanProgress(t('familySearch.furtherInformation.complete', { count: saved.filter((item) => !item.seenAt).length }));
    } finally {
      setFurtherScanBusy(false);
    }
  }, [apiConfig, furtherInformation, people, t]);

  const markFurtherSeen = useCallback(async (personId) => {
    setFurtherInformation(await markFamilySearchFurtherInformationSeen(personId));
  }, []);

  const stageRemoteImport = useCallback((payloads) => {
    const list = (payloads || []).filter(Boolean);
    setRemoteTreeRootId('');
    setBatchDownloadOpen(false);
    const strings = collectFamilySearchPlaceStrings(list);
    const unmatched = strings.filter((incoming) => !placeRecords.some((place) => normalizePlaceName(placeLabelForImport(place)) === normalizePlaceName(incoming)));
    setPendingImportPayloads(list);
    if (unmatched.length > 0) {
      setIncomingPlaces(unmatched);
      return;
    }
    importFamilySearchPayloads(list, [], placeRecords).then((result) => {
      setStatus(t('familySearch.import.complete', { count: result.created }));
      setPendingImportPayloads([]);
      reload();
    }).catch((error) => setApiStatus(t('familySearch.import.failed', { message: error?.message || String(error) })));
  }, [placeRecords, reload, t]);

  const applyPlaceResolutions = useCallback(async (resolutions) => {
    try {
      if (pendingSyncPlace) {
        const resolution = resolutions[0];
        const target = await materializePlaceResolution(resolution, placeRecords);
        const fieldName = pendingSyncPlace.row.conclusion;
        const next = { ...pendingSyncPlace.record, fields: { ...(pendingSyncPlace.record.fields || {}) } };
        if (target.placeId) {
          next.fields[fieldName] = { value: refValue(target.placeId, 'Place'), type: 'REFERENCE' };
          delete next.fields[`${fieldName}Text`];
        } else {
          delete next.fields[fieldName];
          next.fields[`${fieldName}Text`] = { value: target.text, type: 'STRING' };
        }
        await saveWithChangeLog(next);
        setComparePersonRecord(next);
        setPendingSyncPlace(null);
        setIncomingPlaces([]);
        await reload();
        setApiStatus(t('familySearch.places.reconciled'));
        return;
      }
      const result = await importFamilySearchPayloads(pendingImportPayloads, resolutions, placeRecords);
      setPendingImportPayloads([]);
      setIncomingPlaces([]);
      setRemoteTreeRootId('');
      setBatchDownloadOpen(false);
      setStatus(t('familySearch.import.complete', { count: result.created }));
      await reload();
    } catch (error) {
      setApiStatus(t('familySearch.import.failed', { message: error?.message || String(error) }));
    }
  }, [pendingImportPayloads, pendingSyncPlace, placeRecords, reload, t]);

  const cancelPlaceResolution = useCallback(() => {
    setIncomingPlaces([]);
    setPendingImportPayloads([]);
    setPendingSyncPlace(null);
  }, []);

  const hasPanePersonRows = activePane !== 'statistics' && activePane !== 'further-information';

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-6xl mx-auto p-5">
        <header className="flex flex-wrap items-center gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <PageTitle className="text-xl font-bold">FamilySearch</PageTitle>
            <p className="text-sm text-muted-foreground mt-1">{activePaneMeta.descriptionKey ? t(activePaneMeta.descriptionKey) : activePaneMeta.description}</p>
          </div>
          {status && <span className="text-xs text-success-text">{status}</span>}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ms-auto">
            <button onClick={() => setSourceFoldersOpen(true)} className="text-xs inline-flex h-8 items-center border border-border bg-secondary rounded-md px-2.5">
              Manage Sources…
            </button>
            <button onClick={() => setBatchDownloadOpen(true)} className="text-xs inline-flex h-8 items-center border border-border bg-secondary rounded-md px-2.5">
              Auto-Download Relatives…
            </button>
          </div>
        </header>

        <section className="flex flex-wrap gap-2 mb-4">
          {FAMILYSEARCH_PANES.map((pane) => (
            <button
              key={pane.id}
              onClick={() => requestPane(pane.id)}
              className={`rounded-md border px-2.5 py-1.5 text-xs ${
                pane.id === activePane
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border bg-secondary hover:bg-accent'
              }`}
            >
              {pane.labelKey ? t(pane.labelKey) : pane.label}
            </button>
          ))}
        </section>

        <FamilySearchSourceFoldersSheet open={sourceFoldersOpen} onClose={() => setSourceFoldersOpen(false)} />
        <FamilySearchBatchDownloadSheet open={batchDownloadOpen} onClose={() => setBatchDownloadOpen(false)} onImportPayloads={stageRemoteImport} />
        {remoteTreeRootId && (
          <FamilySearchRemoteTreeSheet rootId={remoteTreeRootId} config={apiConfig} onImportPayloads={stageRemoteImport} onClose={() => setRemoteTreeRootId('')} />
        )}
        {approveAllOpen && <FamilySearchApproveAllSheet tasks={autoMatchTasks} onApprove={approveAutoMatch} onClose={() => setApproveAllOpen(false)} />}
        {pendingPolicy && <FamilySearchPolicySheet policy={pendingPolicy} onAccept={onAcceptPolicy} onDecline={() => { setPendingPolicy(''); if (activePane === pendingPolicy) setPane(DEFAULT_PANE); }} />}
        {incomingPlaces.length > 0 && (
          <FamilySearchSelectPlaceSheet incomingPlaces={incomingPlaces} places={placeRecords} onApply={applyPlaceResolutions} onCancel={cancelPlaceResolution} />
        )}

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
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border text-sm font-semibold">
              <span className="min-w-0 flex-1">
                {hasPanePersonRows ? (
                  <>
                    {activePaneMeta.labelKey ? t(activePaneMeta.labelKey) : activePaneMeta.label} · {peopleByPane.length} people
                  </>
                ) : activePane === 'further-information' ? t('familySearch.furtherInformation.title') : 'Statistics'}
              </span>
              {activePane === 'auto-matches' && autoMatchTasks.length > 0 && (
                <button type="button" onClick={() => setApproveAllOpen(true)} className={primaryButton}>{t('familySearch.autoMatches.approveAll')}</button>
              )}
            </div>

            {hasPanePersonRows ? (
              <div className="divide-y divide-border">
                {peopleByPane.length === 0 ? (
                  <div className="p-8 text-sm text-muted-foreground">No people for this pane yet.</div>
                ) : (
                  peopleByPane.slice(0, 300).map((entry) => {
                    const personTasks = tasks.filter((task) => task.personId === entry.record.recordName && task.status !== 'done');
                    return (
                      <div key={entry.record.recordName} className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate"><BdiText>{entry.summary.fullName}</BdiText></div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {entry.familySearchID ? <>FamilySearch ID <LtrText>{entry.familySearchID}</LtrText></> : 'No FamilySearch ID'}{personTasks.length ? ` · ${personTasks.length} open task${personTasks.length === 1 ? '' : 's'}` : ''}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => navigate(`/web-search?provider=familysearch&personId=${encodeURIComponent(entry.record.recordName)}`)} className={secondaryButton}>Search</button>
                          <button onClick={() => onFindMatches(entry)} className={secondaryButton}>API matches</button>
                          <button onClick={() => onComparePerson(entry)} className={secondaryButton}>Compare / Sync</button>
                          {!entry.familySearchID && (
                            <button onClick={() => onUploadPerson(entry)} className={secondaryButton}>Upload</button>
                          )}
                          {activePane === 'record-matches' && (
                            <button onClick={() => onLoadRecordMatches(entry)} className={secondaryButton}>Record matches</button>
                          )}
                          {activePane === 'discussions' && (
                            <button onClick={() => onLoadDiscussions(entry)} className={secondaryButton}>Discussions</button>
                          )}
                          {activePane === 'change-history' && (
                            <button onClick={() => onLoadChangeHistory(entry)} className={secondaryButton}>History</button>
                          )}
                          {entry.familySearchID && (
                            <button onClick={() => setRemoteTreeRootId(entry.familySearchID)} className={secondaryButton}>{t('familySearch.remoteTree.expand')}</button>
                          )}
                          {entry.familySearchID && (
                            <a
                              href={familySearchPersonWebUrl(apiConfig, entry.familySearchID)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={secondaryButton}
                            >
                              Open on FamilySearch.org
                            </a>
                          )}
                          <button onClick={() => startEditingId(entry)} className={secondaryButton}>ID</button>
                          <button onClick={() => addTask(entry.record.recordName)} className={secondaryButton}>Task</button>
                          <button onClick={() => navigate(`/person/${entry.record.recordName}`)} className={secondaryButton}>Open</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : activePane === 'further-information' ? (
              <div className="p-4">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold">{t('familySearch.furtherInformation.title')}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{t('familySearch.furtherInformation.description')}</p>
                  </div>
                  <button type="button" disabled={furtherScanBusy} onClick={scanFurtherInformation} className={primaryButton}>
                    {furtherScanBusy ? t('familySearch.furtherInformation.scanning') : t('familySearch.furtherInformation.scan')}
                  </button>
                </div>
                {furtherScanProgress && <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">{furtherScanProgress}</p>}
                {furtherInformation.filter((item) => !item.seenAt).length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{t('familySearch.furtherInformation.empty')}</div>
                ) : (
                  <ul className="space-y-2">
                    {furtherInformation.filter((item) => !item.seenAt).map((item) => (
                      <li key={item.personId} className="rounded-md border border-border bg-background p-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium"><BdiText>{item.personName}</BdiText></div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {t('familySearch.furtherInformation.counts', { notes: item.notes, memories: item.memories, discussions: item.discussions })}
                            </div>
                          </div>
                          <a href={familySearchPersonWebUrl(apiConfig, item.personId)} target="_blank" rel="noopener noreferrer" className={secondaryButton}>{t('familySearch.furtherInformation.show')}</a>
                          <button type="button" onClick={() => markFurtherSeen(item.personId)} className={secondaryButton}>{t('familySearch.furtherInformation.markSeen')}</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Done tasks</div>
                  <div className="text-2xl font-bold mt-1">{stats.doneTasks.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">People with ID</div>
                  <div className="text-2xl font-bold mt-1">{stats.matched.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">People without ID</div>
                  <div className="text-2xl font-bold mt-1">{stats.unmatched.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-xs text-muted-foreground">Pending tasks</div>
                  <div className="text-2xl font-bold mt-1">{stats.openTasks.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Task by type</div>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                    {TASK_TYPES.map((entry) => (
                      <div key={entry.id} className="flex justify-between">
                        <span className="text-muted-foreground">{entry.label}</span>
                        <span className="font-semibold">{Number(stats.taskCounts[entry.id] || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

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
                <Field label="Token endpoint (optional proxy)">
                  <input
                    value={apiConfig.tokenEndpoint}
                    onChange={(event) => updateApiConfig('tokenEndpoint', event.target.value)}
                    placeholder="Leave blank to use the environment default"
                    className={inputClass}
                  />
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

            {syncRows.length > 0 && (
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold mb-1">Sync conclusions</h2>
                <p className="text-xs text-muted-foreground mb-3">
                  Per-field download / upload / replace / delete{syncPersonId ? ` for ${syncPersonId}` : ''}. Each FamilySearch write requires a reason.
                </p>
                <div className="overflow-hidden rounded-md border border-border text-xs">
                  <div className="grid grid-cols-[64px_1fr_1fr] gap-2 border-b border-border p-2 font-semibold text-2xs uppercase tracking-wide text-muted-foreground">
                    <span>Field</span><span>Local</span><span>FamilySearch</span>
                  </div>
                  {syncRows.map((row) => (
                    <div key={row.field} className="border-b border-border last:border-b-0 p-2">
                      <div className="grid grid-cols-[64px_1fr_1fr] gap-2">
                        <span className="font-medium">{familySearchFieldLabel(row.field, t)}</span>
                        <span className={row.status === 'same' ? 'text-success-text' : 'text-muted-foreground'}>{row.local || '—'}</span>
                        <span className={row.status === 'same' ? 'text-success-text' : row.status === 'different' ? 'text-warning-text' : 'text-muted-foreground'}>{row.remote || '—'}</span>
                      </div>
                      {row.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {row.actions.map((action) => (
                            <button
                              key={action}
                              onClick={() => onSyncAction(row, action)}
                              className="rounded border border-border bg-background px-2 py-0.5 text-2xs capitalize hover:bg-accent"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-semibold mb-3">Compare / merge</h2>
              {compareRows.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-md border border-border text-xs">
                  {compareRows.map((row) => (
                    <div key={row.field} className="grid grid-cols-[72px_1fr_1fr] gap-2 border-b border-border last:border-b-0 p-2">
                      <span className="font-medium">{familySearchFieldLabel(row.field, t)}</span>
                      <span className={row.status === 'same' ? 'text-success-text' : 'text-muted-foreground'}>{row.local || '—'}</span>
                      <span className={row.status === 'same' ? 'text-success-text' : row.status === 'different' ? 'text-warning-text' : 'text-muted-foreground'}>{row.remote || '—'}</span>
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

            {activePane === 'record-matches' && (
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">Record matches</h2>
                  {recordMatchPersonId && (
                    <button onClick={onMarkAllRecordMatchesSeen} className={secondaryButton}>Mark all seen</button>
                  )}
                </div>
                {recordMatchRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Use “Record matches” on a person row to load FamilySearch record hints.</div>
                ) : (
                  <div className="space-y-2">
                    {recordMatchRows.map((match) => (
                      <div key={match.id} className="rounded-md border border-border bg-background p-3">
                        <div className="text-sm font-medium"><BdiText>{match.title}</BdiText></div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {match.collection || 'Record'}{match.score != null ? ` · score ${match.score}` : ''}{match.status ? ` · ${match.status}` : ''}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button onClick={() => onResolveRecordMatch(match, 'accepted')} className={secondaryButton}>Accept</button>
                          <button onClick={() => onResolveRecordMatch(match, 'rejected')} className={secondaryButton}>Reject</button>
                          <button onClick={() => onResolveRecordMatch(match, 'pending')} className={secondaryButton}>Pending</button>
                          <button onClick={() => onAttachRecordMatchAsSource(match)} className={secondaryButton}>Attach as source</button>
                          {match.url && (
                            <a href={match.url} target="_blank" rel="noopener noreferrer" className={secondaryButton}>Open</a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activePane === 'discussions' && (
              <section className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">Discussions</h2>
                  <button onClick={onCreateDiscussion} className={secondaryButton}>New…</button>
                </div>
                {discussionRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Use “Discussions” on a person row to load FamilySearch discussion references.</div>
                ) : (
                  <div className="space-y-2">
                    {discussionRows.map((ref, index) => {
                      const discussionId = ref.resourceId || ref.id || ref.resource?.split('/').pop() || '';
                      return (
                        <div key={ref.resourceId || ref.id || index} className="rounded-md border border-border bg-background p-3">
                          <div className="text-sm font-medium"><BdiText>{ref.title || discussionId || 'Discussion'}</BdiText></div>
                          {discussionId && (
                            <button onClick={() => onAddDiscussionComment(discussionId)} className={`${secondaryButton} mt-2`}>Add comment</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {activePane === 'change-history' && (
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold mb-3">Change history</h2>
                {changeHistoryRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Use “History” on a person row to load the FamilySearch change feed.</div>
                ) : (
                  <div className="space-y-2">
                    {changeHistoryRows.slice(0, 30).map((change) => (
                      <div key={change.id} className="rounded-md border border-border bg-background p-2 text-xs">
                        <div className="font-medium"><BdiText>{change.title || 'Change'}</BdiText></div>
                        <div className="text-muted-foreground mt-0.5">{[change.contributor, change.updated].filter(Boolean).join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activePane === 'memories' && (
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold mb-1">Memories</h2>
                <p className="text-xs text-muted-foreground mb-3">Upload a photo, document, or story to FamilySearch Memories.</p>
                <button onClick={onUploadMemory} className={primaryButton}>Upload memory…</button>
              </section>
            )}

            {apiOutput && (
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-base font-semibold mb-3">{apiOutput.title}</h2>
                <pre className="max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-2xs leading-relaxed">
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
              {tasksByPane.length === 0 ? (
                <div className="text-sm text-muted-foreground">No FamilySearch tasks in this pane.</div>
              ) : (
                <div className="space-y-2">
                  {tasksByPane.slice(0, 12).map((task) => (
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

function familySearchFieldLabel(field, t) {
  const key = {
    Name: 'name',
    Gender: 'gender',
    Birth: 'birth',
    Death: 'death',
    'Birth place': 'birthPlace',
    'Death place': 'deathPlace',
  }[field];
  return key ? t(`familySearch.sync.fields.${key}`) : field;
}

function uuid(prefix) {
  return generateId(prefix);
}

function lines(value) {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function placeLabelForImport(place) {
  return String(readField(place, ['cached_standardizedLocationString', 'cached_normallocationString', 'cached_displayName', 'placeName', 'name'], ''));
}

function normalizePlaceName(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

async function materializePlaceResolution(resolution, existingPlaces, createdByName = new Map()) {
  if (!resolution || resolution.mode === 'text') return { placeId: '', text: resolution?.incoming || '' };
  if (resolution.mode === 'existing') return { placeId: resolution.placeId, text: '' };
  const name = String(resolution.corrected || resolution.incoming || '').trim();
  const key = normalizePlaceName(name);
  const prior = createdByName.get(key) || existingPlaces.find((place) => normalizePlaceName(placeLabelForImport(place)) === key);
  if (prior) return { placeId: prior.recordName, text: '' };
  const record = createRecordEnvelope('Place', 'place', {
    placeName: name,
    cached_standardizedLocationString: name,
    cached_normallocationString: name,
  });
  await createWithChangeLog(record);
  createdByName.set(key, record);
  return { placeId: record.recordName, text: '' };
}

async function importFamilySearchPayloads(payloads, resolutions, existingPlaces) {
  const client = getAppDataClient();
  const { records: existingPeople } = await client.records.query('Person', { limit: 100000 });
  const localByRemoteId = new Map(existingPeople.map((person) => [String(readField(person, ['familySearchID', 'familySearchId'], '')), person.recordName]).filter(([id]) => id));
  const remotePeople = new Map();
  const relationships = new Map();
  for (const payload of payloads || []) {
    const peopleInPayload = payload?.persons || (payload?.person ? [payload.person] : payload?.id ? [payload] : []);
    for (const person of peopleInPayload) {
      const normalized = normalizeFamilySearchPerson(person);
      if (normalized.id) remotePeople.set(normalized.id, { raw: person, normalized });
    }
    for (const relationship of payload?.relationships || []) {
      const parentId = relationship?.person1?.resourceId || String(relationship?.person1?.resource || '').split('/').pop();
      const childId = relationship?.person2?.resourceId || String(relationship?.person2?.resource || '').split('/').pop();
      if (parentId && childId && String(relationship.type || '').match(/ParentChild|BiologicalParent/)) {
        relationships.set(`${parentId}:${childId}`, { parentId, childId });
      }
    }
  }

  const resolutionByIncoming = new Map((resolutions || []).map((item) => [item.incoming, item]));
  const createdPlaces = new Map();
  let created = 0;
  for (const [remoteId, value] of remotePeople) {
    if (localByRemoteId.has(remoteId)) continue;
    const summary = value.normalized;
    const parts = String(summary.name || '').trim().split(/\s+/);
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] || '';
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    const person = createRecordEnvelope('Person', 'person-fs', {
      firstName,
      lastName,
      cached_fullName: summary.name || remoteId,
      cached_fullNameForSorting: summary.name || remoteId,
      familySearchID: remoteId,
      ...(summary.birth ? { cached_birthDate: summary.birth } : {}),
      ...(summary.death ? { cached_deathDate: summary.death } : {}),
    });
    if (summary.gender) person.fields.gender = { value: summary.gender === 'Female' ? Gender.Female : Gender.Male, type: 'INT64' };
    await createWithChangeLog(person);
    localByRemoteId.set(remoteId, person.recordName);
    created += 1;

    for (const fact of value.raw?.facts || []) {
      const tag = String(fact.type || '').split('/').pop();
      if (tag !== 'Birth' && tag !== 'Death') continue;
      const event = createRecordEnvelope('PersonEvent', 'event-fs');
      event.fields.person = { value: refValue(person.recordName, 'Person'), type: 'REFERENCE' };
      event.fields.conclusionType = { value: refValue(tag, 'ConclusionPersonEventType'), type: 'REFERENCE' };
      if (fact.date?.original) event.fields.date = { value: fact.date.original, type: 'STRING' };
      const incoming = String(fact.place?.original || fact.place?.normalized?.[0]?.value || '').trim();
      if (incoming) {
        let resolution = resolutionByIncoming.get(incoming);
        if (!resolution) {
          const exact = existingPlaces.find((place) => normalizePlaceName(placeLabelForImport(place)) === normalizePlaceName(incoming));
          resolution = exact ? { incoming, mode: 'existing', placeId: exact.recordName } : { incoming, mode: 'text' };
        }
        const target = await materializePlaceResolution(resolution, existingPlaces, createdPlaces);
        if (target.placeId) event.fields.place = { value: refValue(target.placeId, 'Place'), type: 'REFERENCE' };
        else event.fields.placeName = { value: target.text, type: 'STRING' };
      }
      await createWithChangeLog(event);
    }
  }

  for (const { parentId, childId } of relationships.values()) {
    const localParent = localByRemoteId.get(parentId);
    const localChild = localByRemoteId.get(childId);
    if (!localParent || !localChild || localParent === localChild) continue;
    await linkExistingRelative(localChild, localParent, 'parent');
  }
  return { created, total: remotePeople.size };
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
      <span className="block text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputClass = `${formClasses.input} min-w-[180px]`;
const primaryButton = buttonClasses({ variant: 'primary', size: 'sm' });
const secondaryButton = 'rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60';
