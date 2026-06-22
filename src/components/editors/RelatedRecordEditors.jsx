import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { logRecordCreated, logRecordDeleted, saveWithChangeLog } from '../../lib/changeLog.js';
import { readRef, writeRef } from '../../lib/schema.js';
import { personSummary, familySummary, placeSummary, sourceSummary } from '../../models/index.js';
import { affiliationLevelLabel, affiliationName } from '../../lib/tribalAffiliations.js';
import {
  CERTAINTY,
  CERTAINTY_LABELS,
  CERTAINTY_AXES,
  certaintySortKey,
  readCertainty,
} from '../../lib/sourceCertainty.js';
import {
  applySourceRelationLineageFields,
  createLineageBatch,
  getCitationLineage,
  recordLineageEvent,
} from '../../lib/sourceLineage.js';
import {
  EVIDENCE_CONFIDENCE,
  EVIDENCE_CONFIDENCE_LABELS,
  evidenceSummary,
  readCitationEvidence,
  writeCitationEvidenceFields,
} from '../../lib/citationEvidence.js';
import { BdiText } from '../BdiText.jsx';
import { generateId } from '../../lib/ids.js';
import { formClasses } from '../ui/formClasses.js';

const MEDIA_TYPES = ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo'];
const CITABLE_TARGET_TYPES = ['Person', 'Family', 'Place', 'PersonEvent', 'FamilyEvent', 'PersonFact', 'TribalAffiliation', 'TribalAffiliationRelation', ...MEDIA_TYPES];

const inputClass = formClasses.inputCompact;
const buttonClass = formClasses.buttonSecondary;
const primaryButtonClass = formClasses.buttonPrimary;

function uuid(prefix) {
  return generateId(prefix);
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
  if (record.recordType === 'TribalAffiliation') {
    return `${affiliationName(record)} (${affiliationLevelLabel(record.fields?.level?.value || 'clan')})`;
  }
  if (record.recordType === 'TribalAffiliationRelation') {
    return fieldText(record, ['cached_personName', 'role', 'notes']) || record.recordName;
  }
  if (record.recordType?.startsWith('Media')) return fieldText(record, ['caption', 'title', 'filename', 'fileName', 'url']) || record.recordName;
  if (record.recordType === 'PersonFact') {
    return [fieldText(record, ['description', 'value', 'text']), fieldText(record, ['date'])]
      .filter(Boolean)
      .join(' - ') || record.recordName;
  }
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

function RelationRow({ rel, target, label, typeLabel, children, onRemove, onLineage }) {
  return (
    <div className="rounded-md bg-secondary/30 border border-border/60 p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground min-w-20">{typeLabel || target?.recordType || 'Record'}</span>
        <span className="text-sm flex-1 min-w-0 truncate"><BdiText>{label || recordDisplayLabel(target) || readRef(rel.fields?.target) || rel.recordName}</BdiText></span>
        {onLineage && <button onClick={onLineage} className="text-xs text-muted-foreground hover:underline">View lineage</button>}
        <button onClick={onRemove} className="text-xs text-destructive hover:underline" title="Detach this citation. The source record will not be deleted.">Detach</button>
      </div>
      {children}
    </div>
  );
}

function mediaPictureIdentifier(record) {
  return record?.fields?.pictureFileIdentifier?.value
    || record?.fields?.thumbnailFileIdentifier?.value
    || record?.recordName
    || '';
}

// Owner record types that carry a primary "entry image" (thumbnailFileIdentifier).
const ENTRY_IMAGE_OWNERS = ['Person', 'Family', 'Place'];

export function MediaRelationsEditor({ ownerRecordName, ownerRecordType, onChanged, emptyHint = 'Attach media records to this entry.' }) {
  const [relations, setRelations] = useState([]);
  const [media, setMedia] = useState([]);
  const [mediaType, setMediaType] = useState(MEDIA_TYPES[0]);
  const [mediaId, setMediaId] = useState('');
  const [ownerThumb, setOwnerThumb] = useState('');

  const supportsEntryImage = ENTRY_IMAGE_OWNERS.includes(ownerRecordType);

  const reload = useCallback(async () => {
    if (!ownerRecordName) return;
    const db = getLocalDatabase();
    const [relRows, pool, owner] = await Promise.all([
      db.query('MediaRelation', { referenceField: 'target', referenceValue: ownerRecordName, limit: 100000 }),
      loadRecordPool(MEDIA_TYPES),
      db.getRecord(ownerRecordName),
    ]);
    const byId = new Map(pool.map((record) => [record.recordName, record]));
    setMedia(pool);
    setOwnerThumb(owner?.fields?.thumbnailFileIdentifier?.value || '');
    setRelations(relRows.records.map((rel) => ({
      rel,
      target: byId.get(readRef(rel.fields?.media)),
    })));
  }, [ownerRecordName]);

  useEffect(() => { reload(); }, [reload]);

  const setEntryImage = useCallback(async (mediaRecord, makePrimary) => {
    if (!ownerRecordName) return;
    const db = getLocalDatabase();
    const owner = await db.getRecord(ownerRecordName);
    if (!owner) return;
    const fields = { ...owner.fields };
    if (makePrimary) fields.thumbnailFileIdentifier = { value: mediaPictureIdentifier(mediaRecord), type: 'STRING' };
    else delete fields.thumbnailFileIdentifier;
    await saveWithChangeLog({ ...owner, fields });
    await reload();
    onChanged?.();
  }, [onChanged, ownerRecordName, reload]);

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
          {relations.map(({ rel, target }) => {
            const isPicture = target?.recordType === 'MediaPicture';
            const isEntry = supportsEntryImage && isPicture && !!ownerThumb && ownerThumb === mediaPictureIdentifier(target);
            return (
              <RelationRow
                key={rel.recordName}
                rel={rel}
                target={target}
                typeLabel={target?.recordType?.replace('Media', '') || 'Media'}
                onRemove={() => removeRelation(rel)}
              >
                {supportsEntryImage && isPicture && (
                  <div className="mt-1.5">
                    {isEntry ? (
                      <button onClick={() => setEntryImage(target, false)} className="text-xs text-primary hover:underline" title="Stop using this picture as the entry image.">★ Entry image — remove</button>
                    ) : (
                      <button onClick={() => setEntryImage(target, true)} className="text-xs text-muted-foreground hover:underline" title="Use this picture as the profile/entry image.">Use as entry image</button>
                    )}
                  </div>
                )}
              </RelationRow>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[130px_1fr_auto]">
        <select value={mediaType} onChange={(e) => { setMediaType(e.target.value); setMediaId(''); }} className={inputClass} aria-label="Media type">
          {MEDIA_TYPES.map((type) => <option key={type} value={type}>{type.replace('Media', '')}</option>)}
        </select>
        <select value={mediaId} onChange={(e) => setMediaId(e.target.value)} className={inputClass} aria-label="Media record" dir="auto">
          <option value="">Select media...</option>
          {filteredMedia.map((record) => (
            <option key={record.recordName} value={record.recordName} disabled={attachedIds.has(record.recordName)}>
              {recordDisplayLabel(record)}
            </option>
          ))}
        </select>
        <button onClick={addRelation} disabled={!mediaId || attachedIds.has(mediaId)} className={primaryButtonClass}>Attach now</button>
      </div>
    </div>
  );
}

export function SourceCitationsEditor({ ownerRecordName, ownerRecordType, ownerRole = 'target', onChanged }) {
  const [relations, setRelations] = useState([]);
  const [pool, setPool] = useState([]);
  const [selectedType, setSelectedType] = useState(ownerRole === 'source' ? 'Person' : 'Source');
  const [selectedId, setSelectedId] = useState('');
  const [sortMode, setSortMode] = useState('title');
  const [drafts, setDrafts] = useState({});
  const [lineage, setLineage] = useState(null);

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
        ...readCitationEvidence(rel),
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
    const batch = await createLineageBatch({ kind: 'manualEdit', sourceName: 'Source citation edit', summary: 'Manual source citation attach' });
    const created = await recordLineageEvent({
      eventType: 'created',
      operation: 'manualEdit',
      sourceRelation: rec,
      source: sourceId,
      target: targetId,
      targetType,
      lineageBatch: batch.recordName,
      details: 'Source citation attached manually.',
    });
    const next = applySourceRelationLineageFields(rec, {
      lineageBatch: batch.recordName,
      operation: 'manualEdit',
      sourceRecord: sourceId,
      targetRecord: targetId,
      createdByEvent: created.recordName,
    });
    await db.saveRecord(next);
    await logRecordCreated(next, { lineage: { lineageBatch: batch.recordName, operation: 'manualEdit', lineageEvent: created.recordName } });
    setSelectedId('');
    await reload();
    onChanged?.();
  }, [attachedIds, onChanged, ownerRecordName, ownerRecordType, ownerRole, reload, selectedId, selectedType]);

  const saveRelation = useCallback(async (rel) => {
    const draft = drafts[rel.recordName] || {};
    const fields = writeCitationEvidenceFields(rel.fields, draft);
    for (const { key } of CERTAINTY_AXES) {
      const v = draft[key];
      if (v && v !== CERTAINTY.DONT_KNOW) fields[key] = { value: v, type: 'STRING' };
      else delete fields[key];
    }
    const batchId = readRef(rel.fields?.lineageBatch) || (await createLineageBatch({ kind: 'manualEdit', sourceName: 'Source citation edit', summary: 'Manual source citation edit' })).recordName;
    const event = await recordLineageEvent({
      eventType: 'edited',
      operation: 'manualEdit',
      sourceRelation: rel,
      lineageBatch: batchId,
      details: 'Citation evidence edited manually.',
    });
    const next = applySourceRelationLineageFields({ ...rel, fields }, {
      lineageBatch: batchId,
      operation: 'manualEdit',
      updatedByEvent: event.recordName,
    });
    await saveWithChangeLog(next, { lineage: { lineageBatch: batchId, operation: 'manualEdit', lineageEvent: event.recordName } });
    await reload();
    onChanged?.();
  }, [drafts, onChanged, reload]);

  const removeRelation = useCallback(async (rel) => {
    const db = getLocalDatabase();
    const batchId = readRef(rel.fields?.lineageBatch) || (await createLineageBatch({ kind: 'manualEdit', sourceName: 'Source citation detach', summary: 'Manual source citation detach' })).recordName;
    const event = await recordLineageEvent({
      eventType: 'detached',
      operation: 'manualEdit',
      sourceRelation: rel,
      lineageBatch: batchId,
      details: 'Source citation detached. Source record was not deleted.',
    });
    await db.deleteRecord(rel.recordName);
    await logRecordDeleted(rel.recordName, 'SourceRelation', { lineage: { lineageBatch: batchId, operation: 'manualEdit', lineageEvent: event.recordName } });
    await reload();
    onChanged?.();
  }, [onChanged, reload]);

  const orderedRelations = useMemo(() => {
    const rows = [...relations];
    if (sortMode === 'certainty') return rows.sort((a, b) => certaintySortKey(b.rel) - certaintySortKey(a.rel));
    if (sortMode === 'date') return rows.sort((a, b) => String(b.target?.fields?.cached_date?.value || b.target?.fields?.date?.value || '').localeCompare(String(a.target?.fields?.cached_date?.value || a.target?.fields?.date?.value || '')));
    if (sortMode === 'page') return rows.sort((a, b) => String(a.rel.fields?.page?.value || '').localeCompare(String(b.rel.fields?.page?.value || ''), undefined, { numeric: true }));
    return rows.sort((a, b) => recordDisplayLabel(a.target).localeCompare(recordDisplayLabel(b.target)));
  }, [relations, sortMode]);

  const showLineage = useCallback(async (rel) => {
    setLineage({ loading: true, relation: rel });
    setLineage(await getCitationLineage(rel.recordName));
  }, []);

  return (
    <div>
      {relations.length === 0 ? (
        <Empty title={ownerRole === 'source' ? 'No referenced entries present' : 'No source citations'} hint={ownerRole === 'source' ? 'Add entries assigned to this source.' : 'Attach sources that document this entry.'} />
      ) : (
        <>
          {relations.length > 1 ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              Sort
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className={inputClass}>
                <option value="title">{ownerRole === 'source' ? 'By Type/Title' : 'By Source Title'}</option>
                <option value="certainty">By Certainty</option>
                <option value="date">By Source Date</option>
                <option value="page">By Page Number</option>
              </select>
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
                  onLineage={() => showLineage(rel)}
                >
                  {evidenceSummary(rel) && (
                    <div className="mt-1 text-[11px] text-muted-foreground">{evidenceSummary(rel)}</div>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_auto] mt-2">
                    <input
                      value={draft.page || ''}
                      onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, page: e.target.value } }))}
                      className={inputClass}
                      placeholder="Page"
                      aria-label="Citation page"
                    />
                    <input
                      value={draft.citation || ''}
                      onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, citation: e.target.value } }))}
                      className={inputClass}
                      placeholder="Citation text"
                      aria-label="Citation text"
                    />
                    <button onClick={() => saveRelation(rel)} className={buttonClass}>Save citation now</button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px] mt-2">
                    <textarea
                      value={draft.transcription || ''}
                      onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, transcription: e.target.value } }))}
                      className={`${inputClass} min-h-16 resize-y`}
                      placeholder="Transcription / excerpt"
                      aria-label="Citation transcription"
                    />
                    <div className="space-y-2">
                      <select
                        value={draft.confidence || EVIDENCE_CONFIDENCE.UNKNOWN}
                        onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, confidence: e.target.value } }))}
                        className={inputClass}
                        aria-label="Evidence confidence"
                      >
                        {Object.entries(EVIDENCE_CONFIDENCE_LABELS).map(([value, text]) => (
                          <option key={value} value={value}>{text} confidence</option>
                        ))}
                      </select>
                      <input
                        value={draft.attribution || ''}
                        onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, attribution: e.target.value } }))}
                        className={inputClass}
                        placeholder="Attribution"
                        aria-label="Citation attribution"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mt-2" role="group" aria-label="Citation certainty">
                    {CERTAINTY_AXES.map(({ key, label, values }) => (
                      <label key={key} className="text-[11px] text-muted-foreground">
                        <span className="block mb-0.5">{label} quality</span>
                        <select
                          value={draft[key] || CERTAINTY.DONT_KNOW}
                          onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, [key]: e.target.value } }))}
                          className={inputClass}
                        >
                          {values.map((value) => (
                            <option key={value} value={value}>{CERTAINTY_LABELS[value]}</option>
                          ))}
                          {!values.includes(draft[key]) && draft[key] ? (
                            <option value={draft[key]}>{CERTAINTY_LABELS[draft[key]] || draft[key]}</option>
                          ) : null}
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[130px_1fr_auto]">
        <select value={selectedType} onChange={(e) => { setSelectedType(e.target.value); setSelectedId(''); }} className={inputClass} aria-label={ownerRole === 'source' ? 'Citation target type' : 'Citation source type'}>
          {poolTypes.map((type) => <option key={type} value={type}>{type.replace('Media', '')}</option>)}
        </select>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass} aria-label={ownerRole === 'source' ? 'Citation target record' : 'Citation source record'} dir="auto">
          <option value="">Select {ownerRole === 'source' ? 'target' : 'source'}...</option>
          {filteredPool.map((record) => (
            <option key={record.recordName} value={record.recordName} disabled={attachedIds.has(record.recordName)}>
              {recordDisplayLabel(record)}
            </option>
          ))}
        </select>
        <button onClick={addRelation} disabled={!selectedId || attachedIds.has(selectedId)} className={primaryButtonClass}>Attach now</button>
      </div>
      {lineage && (
        <LineageDrawer lineage={lineage} onClose={() => setLineage(null)} />
      )}
    </div>
  );
}

function LineageDrawer({ lineage, onClose }) {
  const relation = lineage?.relation;
  const events = lineage?.events || [];
  const batch = lineage?.batch;
  const citation = relation ? readCitationEvidence(relation) : {};
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-lg overflow-auto border-l border-border bg-background p-5 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-base font-semibold flex-1">Citation lineage</h3>
          <button onClick={onClose} className={buttonClass}>Close</button>
        </div>
        {lineage.loading ? (
          <div className="text-sm text-muted-foreground">Loading lineage…</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Citation</div>
              <div className="text-sm">Source: <BdiText>{recordDisplayLabel(lineage.source) || readRef(relation?.fields?.source) || 'Unknown'}</BdiText></div>
              <div className="text-sm">Target: <BdiText>{recordDisplayLabel(lineage.target) || readRef(relation?.fields?.target) || 'Unknown'}</BdiText></div>
              {citation.page && <div className="text-sm">Page: {citation.page}</div>}
              {citation.citation && <div className="text-sm">Citation: {citation.citation}</div>}
              {citation.transcription && <div className="text-sm">Transcription present</div>}
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground mb-1">Batch</div>
              <div className="text-sm">{batch?.fields?.summary?.value || batch?.fields?.kind?.value || relation?.fields?.lineageOperation?.value || 'Legacy / unknown origin'}</div>
              {batch?.fields?.sourceName?.value && <div className="text-xs text-muted-foreground mt-1">{batch.fields.sourceName.value}</div>}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Timeline</div>
              {events.length === 0 ? (
                <div className="text-sm text-muted-foreground">Legacy / unknown origin</div>
              ) : events.map((event) => (
                <div key={event.recordName} className="rounded-md border border-border bg-card p-3 mb-2">
                  <div className="text-sm font-medium">{event.fields?.eventType?.value || 'event'} · {event.fields?.operation?.value || 'unknown'}</div>
                  <div className="text-xs text-muted-foreground">{event.fields?.timestamp?.value || ''}</div>
                  {event.fields?.details?.value && <div className="text-sm mt-1">{event.fields.details.value}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AssociateRelationsEditor({ ownerRecordName, ownerRecordType, relationTypes, onChanged }) {
  const [relations, setRelations] = useState([]);
  const [persons, setPersons] = useState([]);
  const [typeId, setTypeId] = useState(relationTypes?.[0]?.id || '');
  const [personId, setPersonId] = useState('');
  const [newDate, setNewDate] = useState('');
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
        date: rel.fields?.date?.value || '',
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
        ...(newDate ? { date: { value: newDate, type: 'STRING' } } : {}),
      },
    };
    await db.saveRecord(rec);
    await logRecordCreated(rec);
    setPersonId('');
    setNewDate('');
    await reload();
    onChanged?.();
  }, [newDate, onChanged, ownerField, ownerRecordName, ownerRecordType, personId, persons, reload, typeId]);

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
    if (draft.date) fields.date = { value: draft.date, type: 'STRING' };
    else delete fields.date;
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr_130px_auto] mt-2">
                  <select
                    value={draft.type || ''}
                    onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, type: e.target.value } }))}
                    className={inputClass}
                    aria-label="Associate relation type"
                  >
                    <option value="">Relation type...</option>
                    {relationTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                  </select>
                  <select
                    value={draft.targetPerson || ''}
                    onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, targetPerson: e.target.value } }))}
                    className={inputClass}
                    aria-label="Associate person"
                    dir="auto"
                  >
                    <option value="">Select person...</option>
                    {persons.map((person) => <option key={person.recordName} value={person.recordName}>{recordDisplayLabel(person)}</option>)}
                  </select>
                  <input
                    value={draft.date || ''}
                    onChange={(e) => setDrafts((state) => ({ ...state, [rel.recordName]: { ...draft, date: e.target.value } }))}
                    className={inputClass}
                    placeholder="Date"
                    aria-label="Associate relation date"
                  />
                  <button onClick={() => saveRelation(rel)} disabled={!draft.type || !draft.targetPerson} className={buttonClass}>Save relation now</button>
                </div>
              </RelationRow>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[150px_1fr_130px_auto]">
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass} aria-label="New associate relation type">
          {relationTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
        </select>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={inputClass} aria-label="New associate person" dir="auto">
          <option value="">Select person...</option>
          {persons.map((person) => <option key={person.recordName} value={person.recordName}>{recordDisplayLabel(person)}</option>)}
        </select>
        <input value={newDate} onChange={(e) => setNewDate(e.target.value)} className={inputClass} placeholder="Date (optional)" aria-label="New associate relation date" />
        <button onClick={addRelation} disabled={!personId || !typeId} className={primaryButtonClass}>Attach now</button>
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
                aria-label="Note title"
              />
              <textarea
                value={note.text}
                onChange={(e) => setNotes((items) => items.map((item, i) => i === index ? { ...item, text: e.target.value } : item))}
                className={`${inputClass} mt-2 resize-y`}
                rows={3}
                placeholder="Note text"
                aria-label="Note text"
              />
              <div className="text-end mt-2">
                <button onClick={() => setNotes((items) => items.filter((_, i) => i !== index))} className="text-xs text-destructive hover:underline">Stage removal</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setNotes((items) => [...items, { title: '', text: '' }])} className={primaryButtonClass}>Stage note</button>
        <button onClick={saveNotes} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
          {saving ? 'Saving...' : 'Save notes'}
        </button>
      </div>
    </div>
  );
}
