import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { readRef, writeRef } from '../lib/schema.js';
import { personSummary } from '../models/index.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { FieldRow } from '../components/editors/FieldRow.jsx';
import { formClasses } from '../components/ui/formClasses.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';
import { createRecordEnvelope, createWithChangeLog, deleteWithChangeLog } from '../lib/recordWrite.js';
import { PageTitle } from '../components/ui/PageTitle.jsx';
import { RelativesSelectionSheet } from '../components/editors/RelativesSelectionSheet.jsx';
import { useTranslation } from '../contexts/LocalizationContext.jsx';

const GROUP_FIELDS = ['name', 'description', 'color'];

function groupName(record) {
  return record?.fields?.name?.value || record?.fields?.title?.value || record?.recordName || 'Group';
}

function groupToValues(record) {
  return {
    name: record.fields?.name?.value || '',
    description: record.fields?.description?.value || record.fields?.userDescription?.value || '',
    color: record.fields?.color?.value || '',
  };
}

function membershipRecord(groupId, personRecordName) {
  const record = createRecordEnvelope('PersonGroupRelation', 'pgr');
  record.fields.personGroup = writeRef(groupId, 'PersonGroup');
  record.fields.person = writeRef(personRecordName, 'Person');
  return record;
}

export default function PersonGroups() {
  const { t } = useTranslation();
  const modal = useModal();
  const [searchParams] = useSearchParams();
  const queryGroupId = searchParams.get('groupId');
  const {
    rows: groups, active, activeId, setActiveId, values, setValues,
    dirty, saving, status, setStatus, onCreate, onSave, onToggleLock,
  } = useRecordEditor({
    recordType: 'PersonGroup',
    noun: 'group',
    idPrefix: 'grp',
    fields: GROUP_FIELDS,
    labelOf: groupName,
    createValues: () => ({ name: 'New Group' }),
    toValues: groupToValues,
  });
  const { records: relations } = useRecords('PersonGroupRelation');
  const { records: personRecords } = useRecords('Person');
  const persons = useMemo(
    () => personRecords
      .map((rec) => ({ rec, summary: personSummary(rec) }))
      .filter((x) => x.summary)
      .sort((a, b) => a.summary.fullName.localeCompare(b.summary.fullName)),
    [personRecords],
  );
  const [personId, setPersonId] = useState('');
  const [relativeSheetOpen, setRelativeSheetOpen] = useState(false);

  useEffect(() => {
    if (!queryGroupId || groups.length === 0) return;
    if (groups.some((group) => group.recordName === queryGroupId)) setActiveId(queryGroupId);
  }, [queryGroupId, groups, setActiveId]);

  const memberRelations = useMemo(() => relations.filter((r) => readRef(r.fields?.personGroup) === activeId), [relations, activeId]);
  const members = memberRelations.map((rel) => {
    const id = readRef(rel.fields?.person);
    return { rel, person: persons.find((p) => p.rec.recordName === id) };
  });

  const onDelete = useCallback(async () => {
    if (!active) return;
    if (isRecordLocked(active)) {
      setStatus('Unlock this group before deleting.');
      return;
    }
    if (!(await modal.confirm('Delete this group? Members keep their records — only the group and its memberships are removed.', { title: 'Delete group', okLabel: 'Delete', destructive: true }))) return;
    for (const rel of memberRelations) {
      await deleteWithChangeLog(rel.recordName, 'PersonGroupRelation');
    }
    await deleteWithChangeLog(active.recordName, 'PersonGroup');
  }, [active, memberRelations, modal, setStatus]);

  const addRelativeSet = async (ids) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this group before editing members.');
      return;
    }
    if (!activeId) return;
    try {
      const existing = new Set(memberRelations.map((r) => readRef(r.fields?.person)).filter(Boolean));
      let added = 0;
      for (const id of ids) {
        if (existing.has(id)) continue;
        existing.add(id);
        await createWithChangeLog(membershipRecord(activeId, id));
        added += 1;
      }
      setStatus(t('relativeSelection.addedToGroup', { count: added }));
    } catch (error) {
      setStatus(error.message);
    }
  };

  const addMember = async () => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this group before editing members.');
      return;
    }
    if (!activeId || !personId || memberRelations.some((r) => readRef(r.fields?.person) === personId)) return;
    await createWithChangeLog(membershipRecord(activeId, personId));
    setPersonId('');
  };

  const removeMember = async (rel) => {
    if (isRecordLocked(active)) {
      setStatus('Unlock this group before editing members.');
      return;
    }
    await deleteWithChangeLog(rel.recordName, 'PersonGroupRelation');
  };

  const detail = active ? (
    <div className="p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-base font-semibold truncate">{groupName(active)}</h2>
        <span className="ms-auto"><SaveStatus status={status} dirty={dirty} /></span>
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <button onClick={onDelete} disabled={isRecordLocked(active)} className="text-destructive-text border border-border rounded-md px-3 py-1.5 text-xs hover:bg-destructive/10 disabled:opacity-50">Delete</button>
        <Button variant="primary" size="md" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)">
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
      <FieldRow label="Group name"><input value={values.name || ''} onChange={(e) => setValues({ ...values, name: e.target.value })} className={formClasses.input} /></FieldRow>
      <FieldRow label="Color"><input value={values.color || ''} onChange={(e) => setValues({ ...values, color: e.target.value })} className={formClasses.input} /></FieldRow>
      <FieldRow label="Description"><textarea rows={4} value={values.description || ''} onChange={(e) => setValues({ ...values, description: e.target.value })} className={formClasses.textarea} /></FieldRow>

      <section className="mt-6 border border-border rounded-md p-3 bg-card">
        <h3 className="text-sm font-semibold mb-3">Members · {members.length}</h3>
        <div className="space-y-2 mb-3">
          {members.length === 0 ? <div className="text-sm text-muted-foreground">No members.</div> : members.map(({ rel, person }) => (
            <div key={rel.recordName} className="flex items-center gap-2 bg-secondary/40 rounded-md p-2">
              <span className="text-sm flex-1">{person?.summary.fullName || readRef(rel.fields?.person)}</span>
              <button onClick={() => removeMember(rel)} className="text-xs text-destructive-text">Remove now</button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} className="bg-background border border-border rounded-md px-2 py-1.5 text-sm" aria-label="Group member person">
            <option value="">Select person...</option>
            {persons.map(({ rec, summary }) => <option key={rec.recordName} value={rec.recordName}>{summary.fullName}</option>)}
          </select>
          <button onClick={addMember} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">Add now</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => setRelativeSheetOpen(true)} className="bg-secondary border border-border rounded-md px-3 py-1.5 text-xs">{t('relativeSelection.addSetToGroup')}</button>
        </div>
      </section>
    </div>
  ) : <div className="p-10 text-muted-foreground">No group selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-border bg-card">
        <PageTitle className="text-base font-semibold">Person Groups</PageTitle>
        <span className="text-xs text-muted-foreground">{groups.length}</span>
        <Button variant="primary" size="sm" onClick={onCreate} className="ms-auto">+ New</Button>
      </header>
      <div className="flex-1 min-h-0">
        <MasterDetailList items={groups} activeId={activeId} onPick={setActiveId} renderRow={(g) => <div className="text-sm">{groupName(g)}</div>} placeholder="Search groups..." detail={detail} emptyTitle="No groups yet" emptyHint="Tap + New to create a group." />
      </div>
      <RelativesSelectionSheet
        open={relativeSheetOpen}
        onClose={() => setRelativeSheetOpen(false)}
        persons={persons.map(({ summary }) => summary)}
        initialPersonId={personId}
        onApply={addRelativeSet}
      />
    </div>
  );
}
