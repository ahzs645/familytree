/**
 * Sources — list + editor. Source Template picker, full info fields,
 * Source Text, Referenced Entries (computed from PersonEvent.source refs),
 * Labels, Reference Numbers, Bookmarks, Private, Last Edited.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { sourceSummary, personSummary } from '../models/index.js';
import {
  LABELS,
  REFERENCE_NUMBER_FIELDS,
  formatTimestamp,
} from '../lib/catalogs.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { Section } from '../components/editors/Section.jsx';
import { EditSwitch } from '../components/editors/EditSwitch.jsx';

function uuid(p) {
  return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function humanizeTemplateName(recordName) {
  // "SourceTemplate_ChurchRecord_Books" → "Church Record - Books"
  return (recordName || '')
    .replace(/^SourceTemplate_/, '')
    .replace(/_/g, ' · ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

const ACCENTS = {
  info: 'rgb(255 128 0)',
  text: 'rgb(0 204 128)',
  refs: 'rgb(102 217 0)',
  media: 'rgb(77 128 230)',
  notes: 'rgb(217 217 0)',
  labels: 'rgb(255 0 128)',
  ref: 'rgb(128 217 77)',
  bookmarks: 'rgb(128 51 255)',
  private: 'rgb(255 0 0)',
  edited: 'rgb(191 128 64)',
};

const inputClass = 'w-full bg-background text-foreground border border-border rounded-md px-2.5 py-2 text-sm outline-none focus:border-primary';
const textareaClass = inputClass + ' resize-y';

const INFO_FIELDS = [
  { id: 'title', label: 'Title' },
  { id: 'author', label: 'Author' },
  { id: 'publication', label: 'Publication' },
  { id: 'abbreviation', label: 'Abbreviation' },
  { id: 'cached_date', label: 'Date' },
  { id: 'place', label: 'Place' },
  { id: 'agency', label: 'Agency' },
  { id: 'sourceReferenceNumber', label: 'Reference Number' },
  { id: 'sourceReferenceType', label: 'Reference Type' },
];

function Field({ label, children }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

export default function Sources() {
  const [sources, setSources] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [info, setInfo] = useState({});
  const [text, setText] = useState('');
  const [labels, setLabels] = useState({});
  const [refNumbers, setRefNumbers] = useState({});
  const [bookmarked, setBookmarked] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [referenced, setReferenced] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const { records } = await db.query('Source', { limit: 100000 });
    const sorted = records.sort((a, b) => {
      const an = (a.fields?.cached_title?.value || a.fields?.title?.value || '').toLowerCase();
      const bn = (b.fields?.cached_title?.value || b.fields?.title?.value || '').toLowerCase();
      return an.localeCompare(bn);
    });
    setSources(sorted);
    const tpls = await db.query('SourceTemplate', { limit: 10000 });
    setTemplates(
      tpls.records
        .map((t) => ({
          recordName: t.recordName,
          name: t.fields?.name?.value || t.fields?.title?.value || humanizeTemplateName(t.recordName),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    if (!activeId && sorted.length > 0) setActiveId(sorted[0].recordName);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!activeId) return;
    const r = sources.find((s) => s.recordName === activeId);
    if (!r) return;
    // Real .mftpkg uses `template`; saveWithChangeLog writes `sourceTemplate`.
    setTemplateId(refToRecordName(r.fields?.template?.value) || refToRecordName(r.fields?.sourceTemplate?.value) || '');
    const v = {};
    for (const f of INFO_FIELDS) v[f.id] = r.fields?.[f.id]?.value ?? '';
    setInfo(v);
    setText(r.fields?.text?.value || '');
    setBookmarked(!!r.fields?.isBookmarked?.value);
    setIsPrivate(!!r.fields?.isPrivate?.value);

    const refs = {};
    for (const fd of REFERENCE_NUMBER_FIELDS.filter((f) => f.id !== 'familySearchID')) {
      refs[fd.id] = r.fields?.[fd.id]?.value ?? '';
    }
    setRefNumbers(refs);

    (async () => {
      const db = getLocalDatabase();
      // Find SourceRelation rows pointing at this source, plus events that reference it directly.
      const [srcRels, lbl] = await Promise.all([
        db.query('SourceRelation', { referenceField: 'source', referenceValue: activeId, limit: 500 }),
        db.query('LabelRelation', { referenceField: 'targetSource', referenceValue: activeId, limit: 500 }),
      ]);
      const refList = [];
      for (const rel of srcRels.records) {
        const targetType = rel.fields?.targetType?.value || '';
        const targetRef = refToRecordName(rel.fields?.target?.value);
        if (!targetRef) continue;
        const target = await db.getRecord(targetRef);
        if (!target) continue;
        refList.push({
          recordName: target.recordName,
          recordType: target.recordType || targetType,
          label:
            target.recordType === 'Person'
              ? personSummary(target)?.fullName
              : target.fields?.cached_familyName?.value || target.recordName,
        });
      }
      setReferenced(refList);

      const map = new Map(lbl.records.map((rec) => [refToRecordName(rec.fields?.label?.value), rec.recordName]));
      const s = {};
      for (const def of LABELS) s[def.id] = map.has(def.id);
      setLabels(s);
    })();
  }, [activeId, sources]);

  const onSave = useCallback(async () => {
    const r = sources.find((s) => s.recordName === activeId);
    if (!r) return;
    setSaving(true);
    const db = getLocalDatabase();
    const next = { ...r, fields: { ...r.fields } };

    if (templateId) {
      next.fields.template = { value: refValue(templateId, 'SourceTemplate'), type: 'REFERENCE' };
      delete next.fields.sourceTemplate;
    } else {
      delete next.fields.template;
      delete next.fields.sourceTemplate;
    }

    for (const f of INFO_FIELDS) {
      const v = info[f.id];
      if (v == null || v === '') delete next.fields[f.id];
      else next.fields[f.id] = { value: v, type: 'STRING' };
    }
    if (info.title) next.fields.cached_title = { value: info.title, type: 'STRING' };
    if (text) next.fields.text = { value: text, type: 'STRING' };
    else delete next.fields.text;

    next.fields.isBookmarked = { value: !!bookmarked, type: 'BOOLEAN' };
    next.fields.isPrivate = { value: !!isPrivate, type: 'BOOLEAN' };
    for (const f of REFERENCE_NUMBER_FIELDS.filter((f) => f.id !== 'familySearchID')) {
      const v = refNumbers[f.id];
      if (v == null || v === '') delete next.fields[f.id];
      else next.fields[f.id] = { value: v, type: 'STRING' };
    }

    await saveWithChangeLog(next);

    // Labels reconcile
    const existingLbl = (await db.query('LabelRelation', { referenceField: 'targetSource', referenceValue: activeId, limit: 500 })).records;
    const existingByLabel = new Map(existingLbl.map((rec) => [refToRecordName(rec.fields?.label?.value), rec]));
    for (const def of LABELS) {
      const want = !!labels[def.id];
      const existing = existingByLabel.get(def.id);
      if (want && !existing) {
        const rec = {
          recordName: uuid('lbr'),
          recordType: 'LabelRelation',
          fields: {
            label: { value: refValue(def.id, 'Label'), type: 'REFERENCE' },
            targetSource: { value: refValue(activeId, 'Source'), type: 'REFERENCE' },
          },
        };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
      } else if (!want && existing) {
        await db.deleteRecord(existing.recordName);
        await logRecordDeleted(existing.recordName, 'LabelRelation');
      }
    }

    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, sources, templateId, info, text, refNumbers, bookmarked, isPrivate, labels, reload]);

  const renderRow = (r) => {
    const s = sourceSummary(r);
    return (
      <div>
        <div className="text-sm text-foreground truncate">
          {s?.bookmarked ? '★ ' : ''}{s?.title || r.recordName}
        </div>
        {s?.date && <div className="text-xs text-muted-foreground">{s.date}</div>}
      </div>
    );
  };

  const active = sources.find((s) => s.recordName === activeId);
  const detail = active ? (
    <div className="p-5 max-w-4xl">
      <div className="flex items-center mb-4">
        <h2 className="text-base font-semibold truncate">
          {sourceSummary(active)?.title || active.recordName}
        </h2>
        <div className="ml-auto flex items-center gap-3">
          {status && <span className="text-emerald-500 text-xs">{status}</span>}
          <button onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <Section title="Source Information" accent={ACCENTS.info}>
        <Field label="Source Template">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputClass}>
            <option value="">— no template —</option>
            {templates.map((t) => <option key={t.recordName} value={t.recordName}>{t.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {INFO_FIELDS.map((f) => (
            <Field key={f.id} label={f.label}>
              <input value={info[f.id] ?? ''} onChange={(e) => setInfo((s) => ({ ...s, [f.id]: e.target.value }))} className={inputClass} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Source Text" accent={ACCENTS.text}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={textareaClass}
          placeholder="Type or paste the full source text here…" />
      </Section>

      <Section title={`Referenced Entries · ${referenced.length}`} accent={ACCENTS.refs}>
        {referenced.length === 0 ? (
          <Empty title="Not yet referenced" hint="Person and family records that cite this source will show up here." />
        ) : (
          <div className="space-y-2">
            {referenced.map((r) => (
              <div key={r.recordName} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md">
                <span className="text-sm">
                  <span className="text-xs text-muted-foreground mr-2">{r.recordType}</span>
                  {r.label}
                </span>
                <a
                  href={r.recordType === 'Person' ? `/person/${r.recordName}` : r.recordType === 'Family' ? `/family/${r.recordName}` : '#'}
                  className="text-xs text-primary hover:underline"
                >
                  open
                </a>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div>
          <Section title="Media" accent={ACCENTS.media}>
            <Empty title="No media present" hint="Manage media in the Media section." />
          </Section>
          <Section title="Notes" accent={ACCENTS.notes}>
            <Empty title="No notes present" hint="Add a note about this source." />
          </Section>
        </div>
        <div>
          <Section title="Labels" accent={ACCENTS.labels}>
            <div className="space-y-1">
              {LABELS.map((def) => (
                <EditSwitch key={def.id} label={def.label} color={def.color}
                  checked={!!labels[def.id]} onChange={(v) => setLabels((s) => ({ ...s, [def.id]: v }))} />
              ))}
            </div>
          </Section>
          <Section title="Reference Numbers" accent={ACCENTS.ref}>
            <div className="grid grid-cols-1 gap-3">
              {REFERENCE_NUMBER_FIELDS.filter((f) => f.id !== 'familySearchID').map((f) => (
                <Field key={f.id} label={f.label}>
                  <input value={refNumbers[f.id] ?? ''} onChange={(e) => setRefNumbers((s) => ({ ...s, [f.id]: e.target.value }))} className={inputClass} />
                </Field>
              ))}
            </div>
          </Section>
          <Section title="Bookmarks" accent={ACCENTS.bookmarks}>
            <EditSwitch label="Bookmarked" checked={bookmarked} onChange={setBookmarked} />
          </Section>
          <Section title="Private" accent={ACCENTS.private}>
            <EditSwitch label="Marked as Private" checked={isPrivate} onChange={setIsPrivate} />
          </Section>
          <Section title="Last Edited" accent={ACCENTS.edited}>
            <ReadOnly label="Change Date" value={formatTimestamp(active.fields?.mft_changeDate?.value || active.modified?.timestamp)} />
            <ReadOnly label="Creation Date" value={formatTimestamp(active.fields?.mft_creationDate?.value || active.created?.timestamp)} />
          </Section>
        </div>
      </div>
    </div>
  ) : (
    <div className="p-10 text-muted-foreground">No source selected.</div>
  );

  if (sources.length === 0) {
    return <div className="p-10 text-muted-foreground">No sources in this tree yet.</div>;
  }

  return (
    <MasterDetailList
      items={sources}
      activeId={activeId}
      onPick={setActiveId}
      renderRow={renderRow}
      placeholder="Search sources…"
      detail={detail}
    />
  );
}

function Empty({ title, hint }) {
  return (
    <div className="text-center py-6">
      <div className="text-sm text-foreground">{title}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
