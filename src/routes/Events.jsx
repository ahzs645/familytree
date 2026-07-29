/**
 * Events editor — list PersonEvent + FamilyEvent records; edit conclusion type,
 * date, place, and description. Create new events or delete existing ones.
 *
 * This screen mixes two record types behind one kind filter, so it keeps a
 * thin custom controller instead of useRecordEditor: useRecords supplies the
 * cached data, the recordWrite helpers do all change-logged writes, and the
 * dirty/lock/save-shortcut wiring mirrors the shared hook.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { refToRecordName } from '../lib/recordRef.js';
import { readConclusionType, readRef, writeRef } from '../lib/schema.js';
import { applyValuesToRecord, createRecordEnvelope, createWithChangeLog, deleteWithChangeLog, stringField } from '../lib/recordWrite.js';
import { useRecords } from '../lib/data/useRecords.js';
import { personSummary, placeSummary } from '../models/index.js';
import { buildPersonLineage, attachLineageToPersonSummaries } from '../lib/personLineage.js';
import { personDisplayName } from '../lib/personDisplayName.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { NotesEditor, SourceCitationsEditor } from '../components/editors/RelatedRecordEditors.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { formatEventDate } from '../utils/formatDate.js';
import { DatePicker } from '../components/ui/DatePicker.jsx';
import { useModal } from '../contexts/ModalContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { useDirtyBaseline } from '../lib/editorState.js';
import { useSaveShortcut } from '../lib/useSaveShortcut.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { useRecordLock } from '../lib/useRecordLock.js';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { BdiText, LtrText } from '../components/BdiText.jsx';
import { Button } from '../components/ui/Button.jsx';

export default function Events({
  initialKindFilter = 'all',
  showKindFilter = true,
  showPersonEventCreate = true,
  showFamilyEventCreate = true,
} = {}) {
  const navigate = useNavigate();
  const modal = useModal();
  const [searchParams] = useSearchParams();
  const queryEventId = searchParams.get('eventId');
  const { records: personEventRecords, loading: loadingPersonEvents, reload: reloadPersonEvents } = useRecords('PersonEvent');
  const { records: familyEventRecords, loading: loadingFamilyEvents, reload: reloadFamilyEvents } = useRecords('FamilyEvent');
  const { records: personRecords } = useRecords('Person');
  const { records: familyRecords } = useRecords('Family');
  const { records: childRelationRecords } = useRecords('ChildRelation');
  const { records: placeRecords } = useRecords('Place');
  const { records: personTypeRecords } = useRecords('ConclusionPersonEventType');
  const { records: familyTypeRecords } = useRecords('ConclusionFamilyEventType');
  const [events, setEvents] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [kindFilter, setKindFilter] = useState(initialKindFilter);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [queryMessage, setQueryMessage] = useState(null);
  const [loadSeq, setLoadSeq] = useState(0);

  // Attach Arabic-patrilineal lineage so events for name-less records show a
  // readable descriptor instead of "No name recorded" (see personDisplayName).
  const persons = useMemo(() => {
    const lineage = buildPersonLineage(personRecords, familyRecords, childRelationRecords);
    return attachLineageToPersonSummaries(personRecords.map(personSummary).filter(Boolean), lineage);
  }, [personRecords, familyRecords, childRelationRecords]);
  const families = familyRecords;
  const places = placeRecords;
  const types = useMemo(() => ({
    Person: personTypeRecords.map((r) => ({ id: r.recordName, label: readConclusionType(r) })).filter((r) => r.label),
    Family: familyTypeRecords.map((r) => ({ id: r.recordName, label: readConclusionType(r) })).filter((r) => r.label),
  }), [personTypeRecords, familyTypeRecords]);

  const loading = loadingPersonEvents || loadingFamilyEvents;
  useEffect(() => {
    if (loading) return;
    const merged = [...personEventRecords, ...familyEventRecords].sort((a, b) => {
      const ad = a.fields?.date?.value || '';
      const bd = b.fields?.date?.value || '';
      return String(bd).localeCompare(String(ad));
    });
    setEvents(merged);
    setActiveId((current) => {
      if (current && merged.some((event) => event.recordName === current)) return current;
      return merged.length > 0 ? merged[0].recordName : null;
    });
    setLoadSeq((n) => n + 1);
  }, [personEventRecords, familyEventRecords, loading]);

  const reload = useCallback(() => {
    reloadPersonEvents();
    reloadFamilyEvents();
  }, [reloadPersonEvents, reloadFamilyEvents]);

  useEffect(() => {
    if (!queryEventId) {
      setQueryMessage(null);
      return;
    }
    if (events.length === 0) return;
    const target = events.find((event) => event.recordName === queryEventId);
    if (target) {
      setActiveId(queryEventId);
      if (kindFilter !== 'all' && kindFilter !== target.recordType) setKindFilter(target.recordType);
      setQueryMessage(null);
    } else {
      setQueryMessage(`The linked event record "${queryEventId}" was not found in this tree.`);
    }
  }, [events, kindFilter, queryEventId]);

  useEffect(() => {
    const explicitKind = searchParams.get('kind');
    if (explicitKind === 'all' || explicitKind === 'PersonEvent' || explicitKind === 'FamilyEvent') {
      if (explicitKind !== kindFilter) setKindFilter(explicitKind);
      return;
    }
    if (initialKindFilter && initialKindFilter !== kindFilter) {
      setKindFilter(initialKindFilter);
    }
  }, [initialKindFilter, kindFilter, searchParams]);

  useEffect(() => {
    if (!activeId) return;
    const ev = events.find((e) => e.recordName === activeId);
    if (!ev) return;
    setValues({
      conclusionType: refToRecordName(ev.fields?.conclusionType?.value) || ev.fields?.conclusionType?.value || ev.fields?.eventType?.value || '',
      conclusionTypeLabel: readConclusionType(ev),
      date: ev.fields?.date?.value || '',
      description: ev.fields?.description?.value || ev.fields?.userDescription?.value || '',
      isPrivate: !!ev.fields?.isPrivate?.value,
      personRef: refToRecordName(ev.fields?.person?.value) || '',
      familyRef: refToRecordName(ev.fields?.family?.value) || '',
      placeRef:
        refToRecordName(ev.fields?.place?.value) ||
        refToRecordName(ev.fields?.assignedPlace?.value) ||
        '',
      placeDetail: ev.fields?.placeDetail?.value || ev.fields?.placeDescription?.value || '',
    });
  }, [activeId, events]);

  const onSave = useCallback(async () => {
    const ev = events.find((e) => e.recordName === activeId);
    if (!ev) return;
    if (isRecordLocked(ev)) {
      setStatus('Unlock this event before saving.');
      return;
    }
    setSaving(true);
    const refFields = { place: 'Place' };
    if (ev.recordType === 'PersonEvent' && values.personRef) refFields.person = 'Person';
    if (ev.recordType === 'FamilyEvent' && values.familyRef) refFields.family = 'Family';
    const next = applyValuesToRecord(ev, {
      date: values.date,
      description: values.description,
      placeDetail: values.placeDetail?.trim(),
      place: values.placeRef,
      person: values.personRef,
      family: values.familyRef,
    }, { fields: ['date', 'description', 'placeDetail'], refFields });
    const typeOptions = ev.recordType === 'FamilyEvent' ? types.Family : types.Person;
    const chosenType = typeOptions.find((t) => t.id === values.conclusionType || t.label === values.conclusionType);
    if (chosenType) {
      next.fields.conclusionType = writeRef(chosenType.id, ev.recordType === 'FamilyEvent' ? 'ConclusionFamilyEventType' : 'ConclusionPersonEventType');
      next.fields.eventType = stringField(chosenType.label);
    } else if (values.conclusionType) {
      delete next.fields.conclusionType;
      next.fields.eventType = stringField(values.conclusionType);
    } else {
      delete next.fields.conclusionType;
      delete next.fields.eventType;
    }
    if (values.isPrivate) next.fields.isPrivate = { value: true, type: 'BOOLEAN' };
    else delete next.fields.isPrivate;

    await saveWithChangeLog(next);
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, events, values, types]);

  const onCreate = useCallback(async (kind) => {
    const record = createRecordEnvelope(kind, kind === 'PersonEvent' ? 'pe' : 'fe');
    await createWithChangeLog(record);
    setActiveId(record.recordName);
  }, []);

  const onDelete = useCallback(async () => {
    const ev = events.find((e) => e.recordName === activeId);
    if (!ev) return;
    if (isRecordLocked(ev)) {
      setStatus('Unlock this event before deleting.');
      return;
    }
    if (!(await modal.confirm('Delete this event?', { title: 'Delete event', okLabel: 'Delete', destructive: true }))) return;
    // No setActiveId here: the events-sync effect drops the deleted id and
    // reselects the first remaining event once the cache refreshes.
    await deleteWithChangeLog(ev.recordName, ev.recordType);
  }, [activeId, events, modal]);

  const filtered = events.filter((e) => {
    if (kindFilter === 'all') return true;
    return e.recordType === kindFilter;
  });

  const personByName = React.useMemo(() => new Map(persons.map((p) => [p.recordName, p])), [persons]);
  const familyByName = React.useMemo(() => new Map(families.map((f) => [f.recordName, f])), [families]);

  const renderRow = (e) => {
    const t = readConclusionType(e) || 'Event';
    const d = formatEventDate(e.fields?.date?.value);
    const subjectRef =
      readRef(e.fields?.person) ||
      readRef(e.fields?.family) ||
      '';
    let subjectLabel = null;
    if (e.recordType === 'PersonEvent') {
      const p = personByName.get(subjectRef);
      subjectLabel = p ? <BdiText>{personDisplayName(p)}</BdiText> : <LtrText>{subjectRef}</LtrText>;
    } else {
      const f = familyByName.get(subjectRef);
      if (f) {
        const manRef = readRef(f.fields?.man);
        const womanRef = readRef(f.fields?.woman);
        const manName = manRef ? personDisplayName(personByName.get(manRef)) : null;
        const womanName = womanRef ? personDisplayName(personByName.get(womanRef)) : null;
        subjectLabel = manName || womanName ? (
          <>
            {manName && <BdiText>{manName}</BdiText>}
            {manName && womanName && <span> & </span>}
            {womanName && <BdiText>{womanName}</BdiText>}
          </>
        ) : <LtrText>{subjectRef}</LtrText>;
      } else {
        subjectLabel = <LtrText>{subjectRef}</LtrText>;
      }
    }
    return (
      <div>
        <div className="text-sm text-foreground">
          {t}{d && <span className="text-muted-foreground"> · <LtrText>{d}</LtrText></span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {e.recordType === 'PersonEvent' ? 'Person' : 'Family'} {subjectLabel && <>· {subjectLabel}</>}
        </div>
      </div>
    );
  };

  const active = events.find((e) => e.recordName === activeId);
  const editableSnapshot = useMemo(() => ({ activeFields: active?.fields || {}, values }), [active, values]);
  const dirty = useDirtyBaseline(editableSnapshot, {
    recordKey: active?.recordName,
    reloadKey: loadSeq,
    enabled: !!active && !saving,
  });
  useSaveShortcut(onSave, { enabled: !!active && !saving && !isRecordLocked(active) && dirty });
  const onToggleLock = useRecordLock({
    record: active,
    setRecord: (next) => setEvents((rows) => rows.map((row) => row.recordName === next.recordName ? next : row)),
    setSaving,
    setStatus,
    reload,
  });
  const availableTypes = active?.recordType === 'FamilyEvent' ? types.Family : types.Person;

  const detail = active ? (
    <div className="p-7 max-w-[860px]">
      <div className="flex items-center mb-4">
        <h2 className="text-base font-semibold text-foreground m-0">
          {active.recordType === 'PersonEvent' ? 'Person event' : 'Family event'}
        </h2>
        <div className="ms-auto flex items-center gap-2">
          <SaveStatus status={status} dirty={dirty} />
          <Button
            onClick={() => navigate(`/views/media-gallery?targetId=${encodeURIComponent(active.recordName)}&targetType=${active.recordType}`)}
          >
            Related media
          </Button>
          <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
          <Button variant="destructiveOutline" size="md" onClick={onDelete} disabled={isRecordLocked(active)}>Delete</Button>
          <Button variant="primary" size="md" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)">{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
      {queryMessage && (
        <div className={`${warningBoxClass} mb-3.5`}>
          {queryMessage}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 mb-3">
        <FieldRow label="Type" hint="Matches your ConclusionType library. Free-text is accepted.">
          <input
            list="event-types"
            value={values.conclusionTypeLabel || values.conclusionType || ''}
            onChange={(e) => setValues({ ...values, conclusionType: e.target.value, conclusionTypeLabel: '' })}
            className={formClasses.input}
          />
          <datalist id="event-types">
            {availableTypes.map((t) => <option key={t.id} value={t.label} />)}
          </datalist>
        </FieldRow>
        <FieldRow label="Date" hint="Supports ABT, BEF, AFT, BET…AND, FROM…TO, EST, CAL, INT, and BC era.">
          <DatePicker
            value={values.date ?? ''}
            onChange={(v) => setValues({ ...values, date: v })}
            placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"
          />
        </FieldRow>
        {active.recordType === 'PersonEvent' ? (
          <FieldRow label="Person">
            <select
              value={values.personRef ?? ''}
              onChange={(e) => setValues({ ...values, personRef: e.target.value })}
              className={formClasses.input}
              dir="auto"
            >
              <option value="">—</option>
              {persons.map((p) => (
                <option key={p.recordName} value={p.recordName}>{personDisplayName(p)}</option>
              ))}
            </select>
          </FieldRow>
        ) : (
          <FieldRow label="Family">
            <select
              value={values.familyRef ?? ''}
              onChange={(e) => setValues({ ...values, familyRef: e.target.value })}
              className={formClasses.input}
              dir="auto"
            >
              <option value="">—</option>
              {families.map((f) => (
                <option key={f.recordName} value={f.recordName}>
                  {f.fields?.cached_familyName?.value || f.recordName}
                </option>
              ))}
            </select>
          </FieldRow>
        )}
        <FieldRow label="Place">
          <select
            value={values.placeRef ?? ''}
            onChange={(e) => setValues({ ...values, placeRef: e.target.value })}
            className={formClasses.input}
          >
            <option value="">—</option>
            {places.map((p) => {
              const s = placeSummary(p);
              return <option key={p.recordName} value={p.recordName}>{s?.displayName || p.recordName}</option>;
            })}
          </select>
        </FieldRow>
        <FieldRow label="Place detail">
          <input
            value={values.placeDetail ?? ''}
            onChange={(e) => setValues({ ...values, placeDetail: e.target.value })}
            className={formClasses.input}
            placeholder="e.g. St Mary's Church, Plot 14"
          />
        </FieldRow>
      </div>
      <FieldRow label="Description">
        <textarea
          value={values.description ?? ''}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          className={formClasses.textarea}
          rows={4}
        />
      </FieldRow>
      <FieldRow label="Privacy">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={!!values.isPrivate} onChange={(e) => setValues({ ...values, isPrivate: e.target.checked })} />
          Mark this event as private (hidden from charts and reports)
        </label>
      </FieldRow>

      <div className="mt-6 grid gap-5">
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2.5">Source Citations</h3>
          <SourceCitationsEditor
            key={`sources-${active.recordName}`}
            ownerRecordName={active.recordName}
            ownerRecordType={active.recordType}
            ownerRole="target"
            onChanged={reload}
          />
        </section>
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-2.5">Notes</h3>
          <NotesEditor
            key={`notes-${active.recordName}`}
            ownerRecordName={active.recordName}
            ownerRecordType={active.recordType}
            onChanged={reload}
          />
        </section>
      </div>
    </div>
  ) : (
    <div className="text-muted-foreground p-10">No event selected. Create one from the toolbar.</div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-border bg-card">
      <h1 className="text-sm font-bold text-foreground me-1">Events</h1>
      {showKindFilter ? (
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="rounded-md border border-border bg-secondary text-secondary-foreground px-2.5 py-1.5 text-xs cursor-pointer">
          <option value="all">All events</option>
          <option value="PersonEvent">Person events</option>
          <option value="FamilyEvent">Family events</option>
        </select>
      ) : (
        <span className="text-muted-foreground text-xs">
          {kindFilter === 'FamilyEvent' ? 'Family events' : kindFilter === 'PersonEvent' ? 'Person events' : 'All events'}
        </span>
      )}
      <div className="ms-auto flex gap-1.5">
        {showPersonEventCreate ? <Button onClick={() => onCreate('PersonEvent')}>+ Person event</Button> : null}
        {showFamilyEventCreate ? <Button onClick={() => onCreate('FamilyEvent')}>+ Family event</Button> : null}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {toolbar}
      {queryMessage && !active && (
        <div className={`${warningBoxClass} m-3`}>
          {queryMessage}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <MasterDetailList
          items={filtered}
          activeId={activeId}
          onPick={setActiveId}
          renderRow={renderRow}
          placeholder="Search events…"
          detail={detail}
        />
      </div>
    </div>
  );
}

const warningBoxClass = 'border border-destructive/40 bg-destructive/10 text-destructive-text rounded-md px-2.5 py-2 text-xs';
