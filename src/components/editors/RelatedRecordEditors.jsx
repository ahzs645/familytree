import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { logRecordCreated, logRecordDeleted, saveWithChangeLog } from '../../lib/changeLog.js';
import { readRef, writeRef } from '../../lib/schema.js';
import { personSummary, familySummary, placeSummary, sourceSummary } from '../../models/index.js';
import {
  CERTAINTY,
  CERTAINTY_LABELS,
  CERTAINTY_AXES,
  certaintySortKey,
  readCertainty,
} from '../../lib/sourceCertainty.js';

const MEDIA_TYPES = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];
const CITABLE_TARGET_TYPES = ['Person', 'Family', 'Place', 'PersonEvent', 'FamilyEvent', ...MEDIA_TYPES];

const inputClass = 'w-full bg-background text-foreground border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-primary';
const buttonClass = 'border border-border rounded-md px-2.5 py-1.5 text-xs hover:bg-accent disabled:opacity-50';
const primaryButtonClass = 'bg-secondary border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50';

function uuid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function fieldText(record, names) {
  for (const name of names) {
    const value = record?.fields?.[name]?.value;
    if (value) return value;
  }
  return '';
}

function stripConclusionId(value) {
  return String(value || '')
    .replace(/---.*$/, '')
    .replace(/^UniqueID_ConclusionAssociateRelationType_/, '')
    .replace(/^ConclusionAssociateRelationType_/, '')
    .replace(/^UniqueID_/, '');
}

export function recordDisplayLabel(record) {
  if (!record) return '';
  if (record.recordType === 'Person') return personSummary(record)?.fullName || record.recordName;
  if (record.recordType === 'Family') return familySummary(record)?.familyName || fieldText(record, ['cached_familyName']) || record.recordName;
  if (record.recordType === 'Place') return placeSummary(record)?.displayName || placeSummary(record)?.name || record.recordName;
  if (record.recordType === 'Source') return sourceSummary(record)?.title || record.recordName;
  if (record.recordType?.startsWith('Media')) return fieldText(record, ['caption', 'title', 'filename', 'fileName', 'url']) || record.recordName;
  if (record.recordType === 'PersonEvent' || record.recordType === 'FamilyEvent') {
    return [fieldText(record, ['eventType', 'type', 'description']), fieldText(record, ['date'])]
      .filter(Boolean)
      .join(' - ') || record.recordName;
  }
  return fieldText(record, ['title', 'name', 'text', 'description']) || record.recordName;
}

async function loadRecordPool(types) {
  const db = getLocalDatabase();
  const rows = await Promise.all(types.map((type) => db.query(type, { limit: 100000 })));
  const records = rows.flatMap((row) => row.records);
  records.sort((a, b) => recordDisplayLabel(a).localeCompare(recordDisplayLabel(b)));
  return records;
}

function Empty({ title, hint }) {
  return (
    <div className="text-center py-6">
      <div className="text-sm text-foreground">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function RelationRow({ rel, target, label, typeLabel, children, onRemove }) {
  return (
    <div className="rounded-md bg-secondary/30 border border-border/60 p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground min-w-20">{typeLabel || target?.recordType || 'Record'}</span>
        <span className="text-sm flex-1 min-w-0 truncate">{label || recordDisplayLabel(target) || readRef(rel.fields?.target) || rel.recordName}</span>
        <button onClick={onRemove} className="text-xs text-destructive hover:underline">Remove</button>
      </div>
      {children}
    </div>
  );
}

export function MediaRelationsEditor({ ownerRecordName, ownerRecordType, onChanged, emptyHint = 'Attach media records to this entry.' }) {
  const [relations, setRelations] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaType, setMediaType] = useState(MEDIA_TYPES[0]);
  const [mediaId, setMediaId] = useState('');

  const reload = useCallback(async () => {
    if (!ownerRecordName) return;
    const db = getLocalDatabase();
    const [relRows, pool] = await Promise.all([
      db.query('MediaRelation', { referenceField: 'target', referenceValue: ownerRecordName, limit: 100000 }),
      loadRecordPool(MEDIA_TYPES),
    ]);
    const byId = new Map(pool.map((record) => [record.recordName, record]));
    setMedia(pool);
    setRelations(relRows.records.map((rel) => ({
      rel,
      target: byId.get(readRef(rel.fields?.media)),
    })));
  }, [ownerRecordName]);

  useEffect(() => { reload(); }, [reload]);

  const filteredMedia = useMemo(() => media.filter((record) => record.recordType === mediaType), [media, mediaType]);
  const attachedIds = useMemo(() => new Set(relations.map(({ rel }) => readRef(rel.fields?.media)).filter(Boolean)), [relations]);

  const addRelation = useCallback(async () => {
    if (!ownerRecordName || !mediaId || attachedIds.has(mediaId)) return;
    const db = getLocalDatabase();
    const rec = {
      recordName: uuid('mr'),
      recordType: 'MediaRelation',
      fields: {
        media: writeRef(mediaId, mediaType),
        target: writeRef(ownerRecordName, ownerRecordType),
        targetType: { value: ownerRecordType, type: 'STRING' },
        order: { value: relations.length, type: 'DOUBLE' },
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    setMediaId('');
    await reload();
    onChanged?.();
  }, [attachedIds, mediaId, mediaType, onChanged, ownerRecordName, ownerRecordType, relations.length, reload]);

  const removeRelation = useCallback(async (rel) => {
    const db = getLocalDatabase();
    await db.deleteRecord(rel.recordName);
    await logRecordDeleted(rel.recordName, 'MediaRelation');
    await reload();
    onChanged?.();
  }, [onChanged, reload]);

  return (
    <div>
      {relations.length === 0 ? (
        <Empty title="No media attached" hint={emptyHint} />
      ) : (
        <div className="space-y-2 mb-3">
          {relations.map(({ rel, target }) => (
            <RelationRow
              key={rel.recordName}
              rel={rel}
              target={target}
              typeLabel={target?.recordType?.replace('Media', '') || 'Media'}
              onRemove={() => removeRelation(rel)}
            />
          ))}
        </div>
      )}
      <div className="grid grid-cols-[130px_1fr_auto] gap-2">
        <select value={mediaType} onChange={(e) => { setMediaType(e.target.value); setMediaId(''); }} className={inputClass}>
          {MEDIA_TYPES.map((type) => <option key={type} value={type}>{type.replace('Media', '')}</option>)}
        </select>
        <select value={mediaId} onChange={(e) => setMediaId(e.target.value)} className={inputClass}>
          <option value="">Select media...</option>
          {filteredMedia.map((record) => (
            <option key={record.recordName} value={record.recordName} disabled={attachedIds.has(record.recordName)}>
              {recordDisplayLabel(record)}
            </option>
          ))}
        </select>
        <button onClick={addRelation} disabled={!mediaId || attachedIds.has(mediaId)} className={primaryButtonClass}>Attach</button>
      </div>
    </div>
  );
}

export function SourceCitationsEditor({ ownerRecordName, ownerRecordType, ownerRole = 'target', onChanged }) {
  const [relations, setRelations] = useState([]);
  const [pool, setPool] = useState([]);
  const [selectedType, setSelectedType] = useState(ownerRole === 'source' ? 'Person' : 'Source');
  const [selectedId, setSelectedId] = useState('');
  const [sortByCertainty, setSortByCertainty] = useState(false);
  const [drafts, setDrafts] = useState({});

  const poolTypes = useMemo(() => ownerRole === 'source' ? CITABLE_TARGET_TYPES : ['Source'], [ownerRole]);
  const queryField = ownerRole === 'source' ? 'source' : 'target';
  const relatedField = ownerRole === 'source' ? 'target' : 'source';

  const reload = useCallback(async () => {
    if (!ownerRecordName) return;
    const db = getLocalDatabase();
    const [relRows, poolRecords] = await Promise.all([
      db.query('SourceRelation', { referenceField: queryField, referenceValue: ownerRecordName, limit: 100000 }),
      loadRecordPool(poolTypes),
    ]);
    const byId = new Map(poolRecords.map((record) => [record.recordName, record]));
    setPool(poolRecords);
    setRelations(relRows.records.map((rel) => ({
      rel,
      target: byId.get(readRef(rel.fields?.[relatedField])),
    })));
    setDrafts(Object.fromEntries(relRows.records.map((rel) => [
      rel.recordName,
      {
        page: rel.fields?.page?.value || '',
        citation: rel.fields?.citation?.value || rel.fields?.text?.value || '',
        sourceQuality: readCertainty(rel, 'sourceQuality'),
        informationQuality: readCertainty(rel, 'informationQuality'),
        evidenceQuality: readCertainty(rel, 'evidenceQuality'),
      },
    ])));
  }, [ownerRecordName, poolTypes, queryField, relatedField]);

  useEffect(() => { reload(); }, [reload]);

  const filteredPool = useMemo(() => pool.filter((record) => record.recordType === selectedType), [pool, selectedType]);
  const attachedIds = useMemo(() => new Set(relations.map(({ rel }) => readRef(rel.fields?.[relatedField])).filter(Boolean)), [relations, relatedField]);

  const addRelation = useCallback(async () => {
    if (!ownerRecordName || !selectedId || attachedIds.has(selectedId)) return;
    const db = getLocalDatabase();
    const sourceId = ownerRole === 'source' ? ownerRecordName : selectedId;
    const sourceType = 'Source';
    const targetId = ownerRole === 'source' ? selectedId : ownerRecordName;
    const targetType = ownerRole === 'source' ? selectedType : ownerRecordType;
    const rec = {
      recordName: uuid('sr'),
      recordType: 'SourceRelation',
      fields: {
        source: writeRef(sourceId, sourceType),
        target: writeRef(targetId, targetType),
        targetType: { value: targetType, type: 'STRING' },
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    setSelectedId('');
    await reload();
    onChanged?.();
  }, [attachedIds, onChanged, ownerRecordName, ownerRecordType, ownerRole, reload, selectedId, selectedType]);

  const saveRelation = useCallback(async (rel) => {
    const draft = drafts[rel.recordName] || {};
    const fields = { ...rel.fields };
    if (draft.page) fields.page = { value: draft.page, type: 'STRING' };
    else delete fields.page;
    if (draft.citation) {
      fields.citation = { value: draft.citation, type: 'STRING' };
      fields.text = { value: draft.citation, type: 'STRING' };
    } else {
      delete fields.citation;
      delete fields.text;
    }
    for (const { key } of CERTAINTY_AXES) {
      const v = draft[key];
      if (v && v !== CERTAINTY.DONT_KNOW) fields[key] = { value: v, type: 'STRING' };
      else delete fields[key];
    }
    await saveWithChangeLog({ ...rel, fields });
    await reload();
    onChanged?.();
  }, [drafts, onChanged, reload]);

  const removeRelation = useCallback(async (rel) => {
    const db = getLocalDatabase();
    await db.deleteRecord(rel.recordName);
    await logRecordDeleted(rel.recordName, 'SourceRelation');
    await reload();
    onChanged?.();
  }, [onChanged, reload]);

  const orderedRelations = useMemo(() => {
    if (!sortByCertainty) return relations;
    return [...relations].sort((a, b) => certaintySortKey(b.rel) - certaintySortKey(a.rel));
  }, [relations, sortByCertainty]);

  return (
    <div>
      {relations.length === 0 ? (
        <Empty title="No source citations" hint={ownerRole === 'source' ? 'Attach this source to people, families, places, events, or media.' : 'Attach sources that document this entry.'} />
      ) : (
        <>
          {relations.length > 1 ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <input
                type="checkbox"
                checked={sortByCertainty}
                onChange={(e) => setSortByCertainty(e.target.checked)}
              />
              Sort by certainty
            </label>
          ) : null}
          <div className="space-y-2 mb-3">
            {orderedRelations.map(({ rel, target }) => {
              const draft = drafts[rel.recordName] || {};
              return (
                <RelationRow
                  key={rel.recordName}
                  rel={rel}
                  target={target}
                  typeLabel={target?.recordType || rel.fields?.targetType?.value || 'Record'}
                  label={recordDisplayLabel(target) || readRef(rel.fields?.[relatedField])}
                  onRemove={() => removeRelation(rel)}
                >
                  <div className="grid grid-cols-[120px_1fr_auto] gap-2 mt-2">
                    <input
                      value={draft.page || ''}
                      onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, page: e.target.value } }))}
                      className={inputClass}
                      placeholder="Page"
                    />
                    <input
                      value={draft.citation || ''}
                      onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, citation: e.target.value } }))}
                      className={inputClass}
                      placeholder="Citation text"
                    />
                    <button onClick={() => saveRelation(rel)} className={buttonClass}>Save</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2" role="group" aria-label="Citation certainty">
                    {CERTAINTY_AXES.map(({ key, label }) => (
                      <label key={key} className="text-[11px] text-muted-foreground">
                        <span className="block mb-0.5">{label} quality</span>
                        <select
                          value={draft[key] || CERTAINTY.DONT_KNOW}
                          onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, [key]: e.target.value } }))}
                          className={inputClass}
                        >
                          {Object.entries(CERTAINTY_LABELS).map(([value, text]) => (
                            <option key={value} value={value}>{text}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </RelationRow>
              );
            })}
          </div>
        </>
      )}
      <div className="grid grid-cols-[130px_1fr_auto] gap-2">
        <select value={selectedType} onChange={(e) => { setSelectedType(e.target.value); setSelectedId(''); }} className={inputClass}>
          {poolTypes.map((type) => <option key={type} value={type}>{type.replace('Media', '')}</option>)}
        </select>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}>
          <option value="">Select {ownerRole === 'source' ? 'target' : 'source'}...</option>
          {filteredPool.map((record) => (
            <option key={record.recordName} value={record.recordName} disabled={attachedIds.has(record.recordName)}>
              {recordDisplayLabel(record)}
            </option>
          ))}
        </select>
        <button onClick={addRelation} disabled={!selectedId || attachedIds.has(selectedId)} className={primaryButtonClass}>Attach</button>
      </div>
    </div>
  );
}

export function AssociateRelationsEditor({ ownerRecordName, ownerRecordType, relationTypes, onChanged }) {
  const [relations, setRelations] = useState([]);
  const [persons, setPersons] = useState([]);
  const [typeId, setTypeId] = useState(relationTypes?.[0]?.id || '');
  const [personId, setPersonId] = useState('');
  const [drafts, setDrafts] = useState({});

  const ownerField = ownerRecordType === 'Family' ? 'sourceFamily' : 'sourcePerson';

  const reload = useCallback(async () => {
    if (!ownerRecordName) return;
    const db = getLocalDatabase();
    const [relRows, personRows] = await Promise.all([
      db.query('AssociateRelation', { referenceField: ownerField, referenceValue: ownerRecordName, limit: 100000 }),
      db.query('Person', { limit: 100000 }),
    ]);
    const sortedPersons = personRows.records.sort((a, b) => recordDisplayLabel(a).localeCompare(recordDisplayLabel(b)));
    const personsById = new Map(sortedPersons.map((person) => [person.recordName, person]));
    setPersons(sortedPersons);
    setRelations(relRows.records.map((rel) => ({
      rel,
      target: personsById.get(readRef(rel.fields?.targetPerson)),
    })));
    setDrafts(Object.fromEntries(relRows.records.map((rel) => [
      rel.recordName,
      {
        type: stripConclusionId(readRef(rel.fields?.relationType) || rel.fields?.type?.value || ''),
        targetPerson: readRef(rel.fields?.targetPerson) || '',
      },
    ])));
  }, [ownerField, ownerRecordName]);

  useEffect(() => { reload(); }, [reload]);

  const relationLabel = useCallback((id) => relationTypes.find((type) => type.id === id)?.label || id || 'Associate', [relationTypes]);

  const addRelation = useCallback(async () => {
    if (!ownerRecordName || !typeId || !personId) return;
    const targetPerson = persons.find((person) => person.recordName === personId);
    const db = getLocalDatabase();
    const rec = {
      recordName: uuid('ar'),
      recordType: 'AssociateRelation',
      fields: {
        [ownerField]: writeRef(ownerRecordName, ownerRecordType),
        targetPerson: writeRef(personId, 'Person'),
        relationType: writeRef(typeId, 'ConclusionAssociateRelationType'),
        type: { value: typeId, type: 'STRING' },
        cached_targetName: { value: recordDisplayLabel(targetPerson), type: 'STRING' },
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    setPersonId('');
    await reload();
    onChanged?.();
  }, [onChanged, ownerField, ownerRecordName, ownerRecordType, personId, persons, reload, typeId]);

  const saveRelation = useCallback(async (rel) => {
    const draft = drafts[rel.recordName] || {};
    const targetPerson = persons.find((person) => person.recordName === draft.targetPerson);
    const fields = {
      ...rel.fields,
      [ownerField]: writeRef(ownerRecordName, ownerRecordType),
      targetPerson: writeRef(draft.targetPerson, 'Person'),
      relationType: writeRef(draft.type, 'ConclusionAssociateRelationType'),
      type: { value: draft.type, type: 'STRING' },
      cached_targetName: { value: recordDisplayLabel(targetPerson), type: 'STRING' },
    };
    await saveWithChangeLog({ ...rel, fields });
    await reload();
    onChanged?.();
  }, [drafts, onChanged, ownerField, ownerRecordName, ownerRecordType, persons, reload]);

  const removeRelation = useCallback(async (rel) => {
    const db = getLocalDatabase();
    await db.deleteRecord(rel.recordName);
    await logRecordDeleted(rel.recordName, 'AssociateRelation');
    await reload();
    onChanged?.();
  }, [onChanged, reload]);

  return (
    <div>
      {relations.length === 0 ? (
        <Empty title="No influential persons" hint="Attach witnesses, friends, neighbors, or other associated people." />
      ) : (
        <div className="space-y-2 mb-3">
          {relations.map(({ rel, target }) => {
            const draft = drafts[rel.recordName] || {};
            return (
              <RelationRow
                key={rel.recordName}
                rel={rel}
                target={target}
                typeLabel={relationLabel(draft.type)}
                onRemove={() => removeRelation(rel)}
              >
                <div className="grid grid-cols-[150px_1fr_auto] gap-2 mt-2">
                  <select
                    value={draft.type || ''}
                    onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, type: e.target.value } }))}
                    className={inputClass}
                  >
                    <option value="">Relation type...</option>
                    {relationTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                  </select>
                  <select
                    value={draft.targetPerson || ''}
                    onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, targetPerson: e.target.value } }))}
                    className={inputClass}
                  >
                    <option value="">Select person...</option>
                    {persons.map((person) => <option key={person.recordName} value={person.recordName}>{recordDisplayLabel(person)}</option>)}
                  </select>
                  <button onClick={() => saveRelation(rel)} disabled={!draft.type || !draft.targetPerson} className={buttonClass}>Save</button>
                </div>
              </RelationRow>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-[150px_1fr_auto] gap-2">
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass}>
          {relationTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
        </select>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={inputClass}>
          <option value="">Select person...</option>
          {persons.map((person) => <option key={person.recordName} value={person.recordName}>{recordDisplayLabel(person)}</option>)}
        </select>
        <button onClick={addRelation} disabled={!personId || !typeId} className={primaryButtonClass}>Attach</button>
      </div>
    </div>
  );
}

export function NotesEditor({ ownerRecordName, ownerRecordType, onChanged }) {
  const [notes, setNotes] = useState([]);
  const [saving, setSaving] = useState(false);
  const ownerField = ownerRecordType.toLowerCase();

  const reload = useCallback(async () => {
    if (!ownerRecordName) return;
    const db = getLocalDatabase();
    const { records } = await db.query('Note', { referenceField: ownerField, referenceValue: ownerRecordName, limit: 100000 });
    setNotes(records.map((record) => ({
      recordName: record.recordName,
      title: record.fields?.title?.value || '',
      text: record.fields?.text?.value || record.fields?.note?.value || '',
    })));
  }, [ownerField, ownerRecordName]);

  useEffect(() => { reload(); }, [reload]);

  const saveNotes = useCallback(async () => {
    if (!ownerRecordName) return;
    setSaving(true);
    const db = getLocalDatabase();
    const existing = (await db.query('Note', { referenceField: ownerField, referenceValue: ownerRecordName, limit: 100000 })).records;
    const keep = new Set();
    for (const note of notes) {
      if (!note.title && !note.text) continue;
      const fields = {
        [ownerField]: writeRef(ownerRecordName, ownerRecordType),
        target: writeRef(ownerRecordName, ownerRecordType),
        targetType: { value: ownerRecordType, type: 'STRING' },
      };
      if (note.title) fields.title = { value: note.title, type: 'STRING' };
      if (note.text) {
        fields.text = { value: note.text, type: 'STRING' };
        fields.note = { value: note.text, type: 'STRING' };
      }
      if (note.recordName) {
        const previous = existing.find((record) => record.recordName === note.recordName);
        if (previous) {
          keep.add(note.recordName);
          await saveWithChangeLog({ ...previous, fields: { ...previous.fields, ...fields } });
        }
      } else {
        const record = { recordName: uuid('note'), recordType: 'Note', fields };
        await db.saveRecord(record);
        await logRecordCreated(record);
        keep.add(record.recordName);
      }
    }
    for (const previous of existing) {
      if (!keep.has(previous.recordName)) {
        await db.deleteRecord(previous.recordName);
        await logRecordDeleted(previous.recordName, 'Note');
      }
    }
    await reload();
    setSaving(false);
    onChanged?.();
  }, [notes, onChanged, ownerField, ownerRecordName, ownerRecordType, reload]);

  return (
    <div>
      {notes.length === 0 ? (
        <Empty title="No notes present" hint="Add notes directly from this editor." />
      ) : (
        <div className="space-y-2 mb-3">
          {notes.map((note, index) => (
            <div key={note.recordName || index} className="rounded-md bg-secondary/30 border border-border/60 p-2.5">
              <input
                value={note.title}
                onChange={(e) => setNotes((items) => items.map((item, i) => i === index ? { ...item, title: e.target.value } : item))}
                className={inputClass}
                placeholder="Title"
              />
              <textarea
                value={note.text}
                onChange={(e) => setNotes((items) => items.map((item, i) => i === index ? { ...item, text: e.target.value } : item))}
                className={`${inputClass} mt-2 resize-y`}
                rows={3}
                placeholder="Note text"
              />
              <div className="text-right mt-2">
                <button onClick={() => setNotes((items) => items.filter((_, i) => i !== index))} className="text-xs text-destructive hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setNotes((items) => [...items, { title: '', text: '' }])} className={primaryButtonClass}>Add Note</button>
        <button onClick={saveNotes} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>
    </div>
  );
}
