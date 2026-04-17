/**
 * Places — list + editor. Place Template picker drives the dynamic
 * component inputs (Place / County / State / Country, etc.). DMS coordinate
 * display. Map widget for click-to-set coords. Place Details sub-list.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { getLocalDatabase } from '../lib/LocalDatabase.js';
import { saveWithChangeLog, logRecordCreated, logRecordDeleted } from '../lib/changeLog.js';
import { refToRecordName, refValue } from '../lib/recordRef.js';
import { placeSummary } from '../models/index.js';
import {
  PLACE_TEMPLATE_FIELDS,
  DEFAULT_PLACE_FIELDS,
  LABELS,
  REFERENCE_NUMBER_FIELDS,
  formatTimestamp,
  dmsLat,
  dmsLon,
} from '../lib/catalogs.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { Section } from '../components/editors/Section.jsx';
import { EditSwitch } from '../components/editors/EditSwitch.jsx';
import { Map as MapView } from '../components/ui/Map.jsx';

function uuid(p) {
  return `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const ACCENTS = {
  name: 'rgb(255 153 0)',
  details: 'rgb(51 102 230)',
  coord: 'rgb(128 64 191)',
  map: 'rgb(77 128 230)',
  media: 'rgb(77 128 230)',
  notes: 'rgb(217 217 0)',
  sources: 'rgb(51 0 255)',
  labels: 'rgb(255 0 128)',
  ref: 'rgb(128 217 77)',
  bookmarks: 'rgb(128 51 255)',
  private: 'rgb(255 0 0)',
  edited: 'rgb(191 128 64)',
};

const inputClass = 'w-full bg-background text-foreground border border-border rounded-md px-2.5 py-2 text-sm outline-none focus:border-primary';

function Field({ label, children }) {
  return (
    <div className="flex-1 min-w-0">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function templateFieldsFor(templateId, templates) {
  if (!templateId) return DEFAULT_PLACE_FIELDS;
  // Try the legacy slug form first, then the actual template name from the
  // record so real data ("placetemplate-12" → "United States of America")
  // resolves to the correct field set.
  const slug = templateId.replace(/^PlaceTemplate_/, '');
  if (PLACE_TEMPLATE_FIELDS[slug]) return PLACE_TEMPLATE_FIELDS[slug];
  const record = templates?.find((t) => t.recordName === templateId);
  if (record && PLACE_TEMPLATE_FIELDS[record.name]) return PLACE_TEMPLATE_FIELDS[record.name];
  return DEFAULT_PLACE_FIELDS;
}

export default function Places() {
  const [places, setPlaces] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [templateId, setTemplateId] = useState('');
  const [components, setComponents] = useState({});
  const [details, setDetails] = useState([]);
  const [labels, setLabels] = useState({});
  const [refNumbers, setRefNumbers] = useState({});
  const [bookmarked, setBookmarked] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  // Coordinate record lives separate from Place, linked by Place.coordinate or Coordinate.place.
  const [coordinate, setCoordinate] = useState(null);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const reload = useCallback(async () => {
    const db = getLocalDatabase();
    const { records } = await db.query('Place', { limit: 100000 });
    const sorted = records.sort((a, b) => {
      const an = (a.fields?.placeName?.value || a.fields?.cached_normallocationString?.value || '').toLowerCase();
      const bn = (b.fields?.placeName?.value || b.fields?.cached_normallocationString?.value || '').toLowerCase();
      return an.localeCompare(bn);
    });
    setPlaces(sorted);
    const tpls = await db.query('PlaceTemplate', { limit: 10000 });
    setTemplates(
      tpls.records
        .map((t) => ({
          recordName: t.recordName,
          name: t.fields?.name?.value || t.fields?.title?.value || t.recordName,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    if (!activeId && sorted.length > 0) setActiveId(sorted[0].recordName);
  }, [activeId]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!activeId) return;
    const record = places.find((p) => p.recordName === activeId);
    if (!record) return;

    // Real mftpkg uses `template`, my editor writes `placeTemplate` — accept either.
    const tplRef =
      refToRecordName(record.fields?.template?.value) ||
      refToRecordName(record.fields?.placeTemplate?.value) ||
      '';
    setTemplateId(tplRef);

    const fields = templateFieldsFor(tplRef, templates);
    const comps = {};
    // Real data stores component values directly as lowercase fields (place, county, state,
    // province, country…). Fall back to `placeComponent_<slot>` for records we created.
    for (const fname of fields) {
      const slot = fname.toLowerCase();
      comps[slot] = record.fields?.[slot]?.value || record.fields?.[`placeComponent_${slot}`]?.value || '';
    }
    if (!Object.values(comps).some((v) => v)) {
      const first = fields[0]?.toLowerCase();
      if (first) comps[first] = record.fields?.placeName?.value || '';
    }
    setComponents(comps);

    setBookmarked(!!record.fields?.isBookmarked?.value);
    setIsPrivate(!!record.fields?.isPrivate?.value);

    const refs = {};
    for (const fd of REFERENCE_NUMBER_FIELDS) refs[fd.id] = record.fields?.[fd.id]?.value ?? '';
    setRefNumbers(refs);

    (async () => {
      const db = getLocalDatabase();
      const pd = await db.query('PlaceDetail', { referenceField: 'place', referenceValue: activeId, limit: 500 });
      setDetails(pd.records.map((r) => ({
        recordName: r.recordName,
        name: r.fields?.name?.value || '',
      })));
      const lbl = await db.query('LabelRelation', { referenceField: 'targetPlace', referenceValue: activeId, limit: 500 });
      const map = new Map(lbl.records.map((r) => [refToRecordName(r.fields?.label?.value), r.recordName]));
      const s = {};
      for (const def of LABELS) s[def.id] = map.has(def.id);
      setLabels(s);

      // Load the Coordinate record: either the direct ref on Place, or a Coordinate
      // whose `place` ref points back here.
      const coordRef = refToRecordName(record.fields?.coordinate?.value);
      let coord = coordRef ? await db.getRecord(coordRef) : null;
      if (!coord) {
        const { records } = await db.query('Coordinate', {
          referenceField: 'place', referenceValue: activeId, limit: 5,
        });
        coord = records[0] || null;
      }
      setCoordinate(coord);
      setLatitude(coord?.fields?.latitude?.value?.toString() ?? '');
      setLongitude(coord?.fields?.longitude?.value?.toString() ?? '');
    })();
  }, [activeId, places, templates]);

  const templateFields = useMemo(() => templateFieldsFor(templateId, templates), [templateId, templates]);

  const onSave = useCallback(async () => {
    const record = places.find((p) => p.recordName === activeId);
    if (!record) return;
    setSaving(true);
    const db = getLocalDatabase();
    const nextFields = { ...record.fields };

    if (templateId) {
      nextFields.template = { value: refValue(templateId, 'PlaceTemplate'), type: 'REFERENCE' };
      delete nextFields.placeTemplate;
    } else {
      delete nextFields.template;
      delete nextFields.placeTemplate;
    }

    for (const fname of templateFields) {
      const slot = fname.toLowerCase();
      const v = components[slot];
      // Real data uses lowercase fields directly (place, county, state…); drop legacy
      // placeComponent_ keys.
      delete nextFields[`placeComponent_${slot}`];
      if (v == null || v === '') delete nextFields[slot];
      else nextFields[slot] = { value: v, type: 'STRING' };
    }
    const parts = templateFields.map((fname) => components[fname.toLowerCase()]).filter(Boolean);
    const display = parts.join(', ');
    if (parts[0]) nextFields.placeName = { value: display || parts[0], type: 'STRING' };
    if (display) {
      nextFields.cached_shortLocationString = { value: display, type: 'STRING' };
      nextFields.cached_standardizedLocationString = { value: parts.join(','), type: 'STRING' };
    }

    nextFields.isBookmarked = { value: !!bookmarked, type: 'BOOLEAN' };
    nextFields.isPrivate = { value: !!isPrivate, type: 'BOOLEAN' };
    for (const f of REFERENCE_NUMBER_FIELDS.filter((f) => f.id !== 'familySearchID')) {
      const v = refNumbers[f.id];
      if (v == null || v === '') delete nextFields[f.id];
      else nextFields[f.id] = { value: v, type: 'STRING' };
    }

    // Coordinate — write to separate Coordinate record. Create if missing,
    // delete if both inputs are blank.
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    const hasCoord = Number.isFinite(latNum) && Number.isFinite(lonNum);
    if (hasCoord) {
      let coord = coordinate;
      if (!coord) {
        coord = {
          recordName: uuid('coord'),
          recordType: 'Coordinate',
          fields: { place: { value: refValue(activeId, 'Place'), type: 'REFERENCE' } },
        };
        await db.saveRecord(coord);
        await logRecordCreated(coord);
        nextFields.coordinate = { value: refValue(coord.recordName, 'Coordinate'), type: 'REFERENCE' };
      }
      await saveWithChangeLog({
        ...coord,
        fields: {
          ...coord.fields,
          place: { value: refValue(activeId, 'Place'), type: 'REFERENCE' },
          latitude: { value: latNum, type: 'DOUBLE' },
          longitude: { value: lonNum, type: 'DOUBLE' },
        },
      });
    } else if (coordinate) {
      await db.deleteRecord(coordinate.recordName);
      await logRecordDeleted(coordinate.recordName, 'Coordinate');
      delete nextFields.coordinate;
      setCoordinate(null);
    }

    await saveWithChangeLog({ ...record, fields: nextFields });

    const existing = (await db.query('PlaceDetail', { referenceField: 'place', referenceValue: activeId, limit: 500 })).records;
    const keep = new Set();
    for (const d of details) {
      if (!d.name) continue;
      if (d.recordName) {
        keep.add(d.recordName);
        const prev = existing.find((r) => r.recordName === d.recordName);
        if (prev) {
          await saveWithChangeLog({ ...prev, fields: { ...prev.fields, name: { value: d.name, type: 'STRING' } } });
        }
      } else {
        const rec = {
          recordName: uuid('pd'),
          recordType: 'PlaceDetail',
          fields: {
            place: { value: refValue(activeId, 'Place'), type: 'REFERENCE' },
            name: { value: d.name, type: 'STRING' },
          },
        };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
        keep.add(rec.recordName);
      }
    }
    for (const prev of existing) {
      if (!keep.has(prev.recordName)) {
        await db.deleteRecord(prev.recordName);
        await logRecordDeleted(prev.recordName, 'PlaceDetail');
      }
    }

    const existingLbl = (await db.query('LabelRelation', { referenceField: 'targetPlace', referenceValue: activeId, limit: 500 })).records;
    const existingByLabel = new Map(existingLbl.map((r) => [refToRecordName(r.fields?.label?.value), r]));
    for (const def of LABELS) {
      const want = !!labels[def.id];
      const existing2 = existingByLabel.get(def.id);
      if (want && !existing2) {
        const rec = {
          recordName: uuid('lbr'),
          recordType: 'LabelRelation',
          fields: {
            label: { value: refValue(def.id, 'Label'), type: 'REFERENCE' },
            targetPlace: { value: refValue(activeId, 'Place'), type: 'REFERENCE' },
          },
        };
        await db.saveRecord(rec);
        await logRecordCreated(rec);
      } else if (!want && existing2) {
        await db.deleteRecord(existing2.recordName);
        await logRecordDeleted(existing2.recordName, 'LabelRelation');
      }
    }

    await reload();
    setSaving(false);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 1500);
  }, [activeId, places, templateId, templateFields, components, details, labels, refNumbers, bookmarked, isPrivate, latitude, longitude, coordinate, reload]);

  const active = places.find((p) => p.recordName === activeId);
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng);

  const renderRow = (r) => {
    const s = placeSummary(r);
    return (
      <div>
        <div className="text-sm text-foreground">{s?.displayName || s?.name || r.recordName}</div>
        {s?.geonameID && <div className="text-xs text-muted-foreground">GeoName #{s.geonameID}</div>}
      </div>
    );
  };

  const detail = active ? (
    <div className="p-5 max-w-4xl">
      <div className="flex items-center mb-4">
        <h2 className="text-base font-semibold truncate">
          {placeSummary(active)?.displayName || active.recordName}
        </h2>
        <div className="ml-auto flex items-center gap-3">
          {status && <span className="text-emerald-500 text-xs">{status}</span>}
          <button onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-60">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <Section title="Place Name" accent={ACCENTS.name}>
        <Field label="Place Template">
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputClass}>
            <option value="">— no template —</option>
            {templates.map((t) => <option key={t.recordName} value={t.recordName}>{t.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {templateFields.map((fname) => {
            const slot = fname.toLowerCase();
            return (
              <Field key={fname} label={fname}>
                <input
                  value={components[slot] || ''}
                  onChange={(e) => setComponents((s) => ({ ...s, [slot]: e.target.value }))}
                  className={inputClass}
                />
              </Field>
            );
          })}
        </div>
      </Section>

      <Section title={`Place Details · ${details.length}`} accent={ACCENTS.details}
        controls={<button onClick={() => setDetails((a) => [...a, { name: '' }])}
          className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Add Detail</button>}>
        {details.length === 0 ? (
          <Empty title="No place details" hint="Use the button above to add one." />
        ) : (
          <div className="space-y-2">
            {details.map((d, i) => (
              <div key={d.recordName || i} className="flex items-center gap-2">
                <input value={d.name} placeholder="Place detail name"
                  onChange={(e) => setDetails((a) => a.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  className={inputClass} />
                <button onClick={() => setDetails((a) => a.filter((_, j) => j !== i))}
                  className="text-destructive border border-border rounded-md w-8 h-8 text-sm hover:bg-destructive/10">×</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Coordinate" accent={ACCENTS.coord}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Latitude">
            <input value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} />
            {hasPoint && <div className="text-[11px] text-muted-foreground mt-1">{dmsLat(lat)}</div>}
          </Field>
          <Field label="Longitude">
            <input value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} />
            {hasPoint && <div className="text-[11px] text-muted-foreground mt-1">{dmsLon(lng)}</div>}
          </Field>
        </div>
      </Section>

      <Section title="Map" accent={ACCENTS.map}>
        <div className="h-80 rounded-md overflow-hidden border border-border">
          <MapView
            center={hasPoint ? [lng, lat] : [0, 20]}
            zoom={hasPoint ? 9 : 1.5}
            markers={hasPoint ? [{
              id: 'self', lat, lng, draggable: true,
              onDragEnd: ({ lng: nl, lat: nL }) => {
                setLatitude(nL.toFixed(6));
                setLongitude(nl.toFixed(6));
              },
            }] : []}
            onClick={({ lng: nl, lat: nL }) => {
              setLatitude(nL.toFixed(6));
              setLongitude(nl.toFixed(6));
            }}
          />
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">Click on the map to set coordinates, drag the marker to fine-tune.</div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div>
          <Section title="Media" accent={ACCENTS.media}>
            <Empty title="No media present" hint="Open the Media section to manage pictures." />
          </Section>
          <Section title="Notes" accent={ACCENTS.notes}>
            <Empty title="No notes present" hint="Add notes about this place." />
          </Section>
          <Section title="Source Citations" accent={ACCENTS.sources}>
            <Empty title="Source citations" hint="Link sources documenting this place." />
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
    <div className="p-10 text-muted-foreground">No place selected.</div>
  );

  if (places.length === 0) {
    return <div className="p-10 text-muted-foreground">No places in this tree yet.</div>;
  }

  return (
    <MasterDetailList
      items={places}
      activeId={activeId}
      onPick={setActiveId}
      renderRow={renderRow}
      placeholder="Search places…"
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
