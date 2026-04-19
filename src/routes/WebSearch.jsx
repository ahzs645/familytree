import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PersonPicker } from '../components/charts/PersonPicker.jsx';
import { getAppPreferences, saveAppPreferences } from '../lib/appPreferences.js';
import { logRecordCreated, saveWithChangeLog } from '../lib/changeLog.js';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { refValue } from '../lib/recordRef.js';
import { readField, readRef } from '../lib/schema.js';
import { listAllPersons } from '../lib/treeQuery.js';

const PROVIDERS = [
  { id: 'familysearch', label: 'FamilySearch' },
  { id: 'ancestry', label: 'Ancestry' },
  { id: 'findagrave', label: 'Find a Grave' },
  { id: 'google', label: 'Google' },
  { id: 'custom', label: 'Custom' },
];

const INSERT_ACTIONS = [
  { id: 'firstName', label: 'First Name' },
  { id: 'nameMiddle', label: 'Middle Name' },
  { id: 'lastName', label: 'Surname' },
  { id: 'birthDate', label: 'Date Of Birth' },
  { id: 'birthPlace', label: 'Place Of Birth' },
  { id: 'deathDate', label: 'Date Of Death' },
  { id: 'deathPlace', label: 'Place Of Death' },
  { id: 'note', label: 'Note' },
];

export default function WebSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [persons, setPersons] = useState([]);
  const [personId, setPersonId] = useState(searchParams.get('personId') || '');
  const [provider, setProvider] = useState(searchParams.get('provider') || 'familysearch');
  const [customUrl, setCustomUrl] = useState('');
  const [insertAction, setInsertAction] = useState('note');
  const [insertValue, setInsertValue] = useState('');
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState([]);
  const [personFields, setPersonFields] = useState(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getLocalDatabase();
      const [list, prefs, rawPeople] = await Promise.all([
        listAllPersons(),
        getAppPreferences(),
        db.query('Person', { limit: 100000 }),
      ]);
      if (cancelled) return;
      setPersons(list);
      setProvider(searchParams.get('provider') || prefs.webSearch.provider || 'familysearch');
      setCustomUrl(prefs.webSearch.customUrl || '');
      setHistory((await db.getMeta('webSearchHistory')) || []);
      setPersonFields(new Map(rawPeople.records.map((record) => [record.recordName, record.fields || {}])));
      setPersonId((current) => current || searchParams.get('personId') || list[0]?.recordName || '');
    })();
    return () => { cancelled = true; };
    // Initial load only; route query params seed the first state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = persons.find((person) => person.recordName === personId);
  const searchUrl = useMemo(() => buildSearchUrl(provider, customUrl, selected), [customUrl, provider, selected]);

  const openSearch = useCallback(async () => {
    if (!searchUrl || !selected) return;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
    const db = getLocalDatabase();
    const nextHistory = [
      { at: new Date().toISOString(), provider, personId, label: selected.fullName, url: searchUrl },
      ...history,
    ].slice(0, 25);
    await db.setMeta('webSearchHistory', nextHistory);
    setHistory(nextHistory);
  }, [history, personId, provider, searchUrl, selected]);

  const saveProvider = useCallback(async () => {
    const prefs = await getAppPreferences();
    await saveAppPreferences({
      ...prefs,
      webSearch: {
        ...prefs.webSearch,
        provider,
        customUrl,
      },
    });
    setStatus('Saved provider');
    setTimeout(() => setStatus(''), 1500);
  }, [customUrl, provider]);

  const insertIntoPerson = useCallback(async () => {
    if (!selected || !insertValue.trim()) return;
    await applyInsert(personId, insertAction, insertValue.trim());
    setStatus('Inserted');
    setInsertValue('');
    setTimeout(() => setStatus(''), 1500);
  }, [insertAction, insertValue, personId, selected]);

  if (persons.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No person data. Import a family tree first.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto p-5">
        <header className="flex items-center gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold">Web Search</h1>
            <p className="text-sm text-muted-foreground mt-1">Person-aware search links and quick inserts back into the local tree.</p>
          </div>
          {status && <span className="ms-auto text-xs text-emerald-500">{status}</span>}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          <main className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-base font-semibold mb-4">Search Parameters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Person">
                  <PersonPicker persons={persons} value={personId} onChange={setPersonId} />
                </Field>
                <Field label="Provider">
                  <select value={provider} onChange={(event) => setProvider(event.target.value)} className={inputClass}>
                    {PROVIDERS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                  </select>
                </Field>
                <Field label="Custom URL">
                  <input value={customUrl} onChange={(event) => setCustomUrl(event.target.value)} className={inputClass} />
                </Field>
                <Field label="Generated URL">
                  <input value={searchUrl || ''} readOnly className={inputClass} />
                </Field>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={openSearch} disabled={!searchUrl} className={primaryButton}>Open Search</button>
                <button onClick={saveProvider} className={secondaryButton}>Save Provider</button>
                <button onClick={() => selected && navigate(`/person/${selected.recordName}`)} className={secondaryButton}>Open Person</button>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-base font-semibold mb-4">Insert Result</h2>
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
                <Field label="Target">
                  <select value={insertAction} onChange={(event) => setInsertAction(event.target.value)} className={inputClass}>
                    {INSERT_ACTIONS.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                  </select>
                </Field>
                <Field label="Value">
                  <input value={insertValue} onChange={(event) => setInsertValue(event.target.value)} className={inputClass} />
                </Field>
              </div>
              <button onClick={insertIntoPerson} disabled={!insertValue.trim()} className={`${primaryButton} mt-4`}>Insert</button>
            </section>
          </main>

          <aside className="rounded-lg border border-border bg-card p-5 h-fit">
            <h2 className="text-base font-semibold mb-3">{selected?.fullName || 'Selected Person'}</h2>
            <Info label="Birth" value={selected?.birthDate || 'Unknown'} />
            <Info label="Death" value={selected?.deathDate || 'Unknown'} />
            <Info label="FamilySearch ID" value={selected ? selectedRecordField(selected.recordName, personFields, 'familySearchID') : ''} />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-5 mb-2">Recent Searches</h3>
            {history.length === 0 ? (
              <div className="text-sm text-muted-foreground">No searches yet.</div>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 8).map((entry) => (
                  <a key={`${entry.at}-${entry.url}`} href={entry.url} target="_blank" rel="noreferrer" className="block rounded-md border border-border bg-background p-2 hover:bg-secondary">
                    <div className="text-sm truncate">{entry.label}</div>
                    <div className="text-[11px] text-muted-foreground">{providerLabel(entry.provider)} · {new Date(entry.at).toLocaleDateString()}</div>
                  </a>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

async function applyInsert(personId, action, value) {
  const db = getLocalDatabase();
  const person = await db.getRecord(personId);
  if (!person) throw new Error('Person not found.');
  if (['firstName', 'nameMiddle', 'lastName'].includes(action)) {
    const next = {
      ...person,
      fields: {
        ...(person.fields || {}),
        [action]: { value, type: 'STRING' },
      },
    };
    await saveWithChangeLog(next);
    return;
  }
  if (action === 'note') {
    const record = {
      recordName: uuid('note'),
      recordType: 'Note',
      fields: {
        person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
        target: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
        targetType: { value: 'Person', type: 'STRING' },
        title: { value: 'Web Search', type: 'STRING' },
        text: { value, type: 'STRING' },
        note: { value, type: 'STRING' },
      },
    };
    await db.saveRecord(record);
    await logRecordCreated(record);
    return;
  }
  if (action === 'birthDate') return upsertPersonEvent(personId, 'Birth', { date: value });
  if (action === 'deathDate') return upsertPersonEvent(personId, 'Death', { date: value });
  if (action === 'birthPlace') return upsertPersonEvent(personId, 'Birth', { placeName: value });
  if (action === 'deathPlace') return upsertPersonEvent(personId, 'Death', { placeName: value });
}

async function upsertPersonEvent(personId, typeId, patch) {
  const db = getLocalDatabase();
  const { records } = await db.query('PersonEvent', { referenceField: 'person', referenceValue: personId, limit: 100000 });
  let event = records.find((record) => (
    readRef(record.fields?.conclusionType) === typeId ||
    readField(record, ['eventType', 'type', 'conclusionType']) === typeId
  ));
  const creating = !event;
  if (!event) {
    event = {
      recordName: uuid('pe'),
      recordType: 'PersonEvent',
      fields: {
        person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
        conclusionType: { value: refValue(typeId, 'ConclusionPersonEventType'), type: 'REFERENCE' },
      },
    };
  }
  const fields = { ...(event.fields || {}) };
  if (patch.date) fields.date = { value: patch.date, type: 'STRING' };
  if (patch.placeName) {
    const place = await findOrCreatePlace(patch.placeName);
    fields.place = { value: refValue(place.recordName, 'Place'), type: 'REFERENCE' };
  }
  const next = { ...event, fields };
  if (creating) {
    await db.saveRecord(next);
    await logRecordCreated(next);
  } else {
    await saveWithChangeLog(next);
  }
}

async function findOrCreatePlace(name) {
  const db = getLocalDatabase();
  const { records } = await db.query('Place', { limit: 100000 });
  const found = records.find((record) => {
    const label = readField(record, ['placeName', 'cached_standardizedLocationString', 'cached_displayName', 'name'], '');
    return label.toLowerCase() === name.toLowerCase();
  });
  if (found) return found;
  const record = {
    recordName: uuid('place'),
    recordType: 'Place',
    fields: {
      placeName: { value: name, type: 'STRING' },
      cached_standardizedLocationString: { value: name, type: 'STRING' },
    },
  };
  await db.saveRecord(record);
  await logRecordCreated(record);
  return record;
}

function buildSearchUrl(provider, customUrl, person) {
  if (!person) return '';
  const data = {
    firstName: person.firstName || '',
    lastName: person.lastName || '',
    fullName: person.fullName || '',
    birthYear: year(person.birthDate),
    deathYear: year(person.deathDate),
  };
  if (provider === 'custom') return template(customUrl, data);
  if (provider === 'familysearch') {
    return `https://www.familysearch.org/search/record/results?q.givenName=${enc(data.firstName)}&q.surname=${enc(data.lastName)}${data.birthYear ? `&q.birthLikeDate.from=${data.birthYear}&q.birthLikeDate.to=${data.birthYear}` : ''}`;
  }
  if (provider === 'ancestry') {
    return `https://www.ancestry.com/search/?name=${enc(`${data.firstName} ${data.lastName}`)}`;
  }
  if (provider === 'findagrave') {
    return `https://www.findagrave.com/memorial/search?firstname=${enc(data.firstName)}&lastname=${enc(data.lastName)}`;
  }
  return `https://www.google.com/search?q=${enc(`${data.fullName} genealogy ${data.birthYear || ''}`)}`;
}

function template(raw, data) {
  return String(raw || '').replace(/\{(\w+)\}/g, (_match, key) => enc(data[key] || ''));
}

function enc(value) {
  return encodeURIComponent(String(value || '').trim());
}

function year(value) {
  const match = String(value || '').match(/\d{4}/);
  return match ? match[0] : '';
}

function providerLabel(id) {
  return PROVIDERS.find((entry) => entry.id === id)?.label || id;
}

function selectedRecordField(recordName, personFields, field) {
  const fields = personFields.get(recordName) || {};
  return fields[field]?.value || fields.familySearchId?.value || '';
}

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || 'Unknown'}</span>
    </div>
  );
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';
const primaryButton = 'rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60';
const secondaryButton = 'rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60';
