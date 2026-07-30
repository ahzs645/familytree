/**
 * Places — list + editor. Place Template picker drives the dynamic
 * component inputs (Place / County / State / Country, etc.). DMS coordinate
 * display. Map widget for click-to-set coords. Place Details sub-list.
 */
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAppDataClient } from '../lib/data/AppDataClient.js';
import { generateId } from '../lib/ids.js';
import { formClasses } from '../components/ui/formClasses.js';
import { Button } from '../components/ui/Button.jsx';
import { saveWithChangeLog } from '../lib/changeLog.js';
import { createWithChangeLog, deleteWithChangeLog } from '../lib/recordWrite.js';
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
import { resolveLabelDefinitions } from '../lib/labels.js';
import { MasterDetailList } from '../components/editors/MasterDetailList.jsx';
import { Section } from '../components/editors/Section.jsx';
import { EditSwitch } from '../components/editors/EditSwitch.jsx';
import { MediaRelationsEditor, NotesEditor, SourceCitationsEditor } from '../components/editors/RelatedRecordEditors.jsx';
import { Map as MapView } from '../components/ui/Map.jsx';
import { BatchPlaceLookupSheet } from '../components/BatchPlaceLookupSheet.jsx';
import { FreeformPlaceLookupSheet } from '../components/FreeformPlaceLookupSheet.jsx';
import { PlaceConvertToDetailSheet } from '../components/PlaceConvertToDetailSheet.jsx';
import {
  MAP_PREFERENCES_EVENT,
  batchLookupMissingCoordinates,
  batchLookupMissingGeoNames,
  getMapPreferences,
  lookupGeoNameId,
  lookupPlaceCandidates,
  placeDetailsFromComponents,
  saveMapPreferences,
} from '../lib/placeGeocoding.js';
import { useModal } from '../contexts/ModalContext.jsx';
import { isRecordLocked } from '../lib/recordLock.js';
import { SaveStatus } from '../components/editors/SaveStatus.jsx';
import { EditorSectionNavProvider, EditorSectionNavBar } from '../components/editors/EditorSectionNav.jsx';
import { RecordLockButton } from '../components/editors/RecordLockButton.jsx';
import { useListSelection } from '../components/lists/useListSelection.js';
import { RecordBulkBar } from '../components/lists/RecordBulkBar.jsx';
import { useRecordEditor } from '../components/editors/useRecordEditor.js';
import { useRecords } from '../lib/data/useRecords.js';

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

const inputClass = formClasses.input;

const REF_NUMBER_FIELDS = REFERENCE_NUMBER_FIELDS.filter((f) => f.id !== 'familySearchID');

// The caption has to wrap the control, not sit beside it: a bare <label> with
// no `for` names nothing, so every field on these screens reached assistive
// tech unnamed even though the caption was right there on screen.
function Field({ label, children }) {
  return (
    <label className="flex-1 min-w-0 block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
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

function placeSortKey(record) {
  return (record.fields?.placeName?.value || record.fields?.cached_normallocationString?.value || '').toLowerCase();
}

function sortPlaces(a, b) {
  return placeSortKey(a).localeCompare(placeSortKey(b));
}

/**
 * Reconcile the side records owned by the editor — the Coordinate record
 * (created/updated/deleted per `coordPlan` planned in applyValues), the
 * PlaceDetail rows, and the LabelRelation rows. Runs alongside the
 * main-record save; every write goes through the change-logged helpers.
 */
async function reconcilePlaceSideRecords(placeId, vals, coordPlan, setCoordinate) {
  const data = getAppDataClient();

  if (coordPlan?.save) {
    const { existing, recordName, latitude, longitude } = coordPlan.save;
    const next = {
      ...(existing || { recordName, recordType: 'Coordinate' }),
      fields: {
        ...existing?.fields,
        place: { value: refValue(placeId, 'Place'), type: 'REFERENCE' },
        latitude: { value: latitude, type: 'DOUBLE' },
        longitude: { value: longitude, type: 'DOUBLE' },
      },
    };
    if (existing) await saveWithChangeLog(next);
    else await createWithChangeLog(next);
    setCoordinate(next);
  } else if (coordPlan?.remove) {
    await deleteWithChangeLog(coordPlan.remove, 'Coordinate');
    setCoordinate(null);
  }

  const existing = (await data.records.query('PlaceDetail', { referenceField: 'place', referenceValue: placeId, limit: 500 })).records;
  const keep = new Set();
  for (const d of vals.details) {
    if (!d.name) continue;
    if (d.recordName) {
      keep.add(d.recordName);
      const prev = existing.find((r) => r.recordName === d.recordName);
      if (prev) {
        await saveWithChangeLog({ ...prev, fields: { ...prev.fields, name: { value: d.name, type: 'STRING' } } });
      }
    } else {
      const rec = {
        recordName: generateId('pd'),
        recordType: 'PlaceDetail',
        fields: {
          place: { value: refValue(placeId, 'Place'), type: 'REFERENCE' },
          name: { value: d.name, type: 'STRING' },
        },
      };
      await createWithChangeLog(rec);
      keep.add(rec.recordName);
    }
  }
  for (const prev of existing) {
    if (!keep.has(prev.recordName)) await deleteWithChangeLog(prev.recordName, 'PlaceDetail');
  }

  const existingLbl = (await data.records.query('LabelRelation', { referenceField: 'targetPlace', referenceValue: placeId, limit: 500 })).records;
  const existingByLabel = new Map(existingLbl.map((r) => [refToRecordName(r.fields?.label?.value), r]));
  for (const def of LABELS) {
    const want = !!vals.labels[def.id];
    const existing2 = existingByLabel.get(def.id);
    if (want && !existing2) {
      await createWithChangeLog({
        recordName: generateId('lbr'),
        recordType: 'LabelRelation',
        fields: {
          label: { value: refValue(def.id, 'Label'), type: 'REFERENCE' },
          targetPlace: { value: refValue(placeId, 'Place'), type: 'REFERENCE' },
        },
      });
    } else if (!want && existing2) {
      await deleteWithChangeLog(existing2.recordName, 'LabelRelation');
    }
  }
}

export default function Places() {
  const navigate = useNavigate();
  const modal = useModal();
  const [searchParams] = useSearchParams();
  // Coordinate record lives separate from Place, linked by Place.coordinate or Coordinate.place.
  const [coordinate, setCoordinate] = useState(null);
  const [mapPrefs, setMapPrefs] = useState({ defaultZoom: 9, batchLimit: 10 });
  const [placeQueryMessage, setPlaceQueryMessage] = useState(null);
  const [showBatchSheet, setShowBatchSheet] = useState(false);
  const [showConvertSheet, setShowConvertSheet] = useState(false);
  const [showNewPlaceSheet, setShowNewPlaceSheet] = useState(false);
  const sideSave = useRef(Promise.resolve());
  const statusRef = useRef(null);

  const queryPlaceId = searchParams.get('placeId');
  const focus = searchParams.get('focus');

  const { records: templateRecords } = useRecords('PlaceTemplate');
  const templates = useMemo(
    () => templateRecords
      .map((t) => ({
        recordName: t.recordName,
        name: t.fields?.name?.value || t.fields?.title?.value || t.recordName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [templateRecords],
  );
  const { records: labelRecords } = useRecords('Label');
  const labelDefs = useMemo(() => resolveLabelDefinitions(labelRecords), [labelRecords]);

  const toValues = useCallback((record) => {
    // Real mftpkg uses `template`, my editor writes `placeTemplate` — accept either.
    const tplRef =
      refToRecordName(record.fields?.template?.value) ||
      refToRecordName(record.fields?.placeTemplate?.value) ||
      '';
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
    const refs = {};
    for (const fd of REFERENCE_NUMBER_FIELDS) refs[fd.id] = record.fields?.[fd.id]?.value ?? '';
    refs.geonameID = record.fields?.geonameID?.value || record.fields?.geoNameID?.value || '';
    refs.lookupProviderId = record.fields?.lookupProviderId?.value || '';
    return {
      templateId: tplRef,
      components: comps,
      bookmarked: !!record.fields?.isBookmarked?.value,
      isPrivate: !!record.fields?.isPrivate?.value,
      nameType: record.fields?.nameType?.value || record.fields?.placeNameType?.value || '',
      refNumbers: refs,
      // Hydrated asynchronously from PlaceDetail / LabelRelation / Coordinate rows.
      details: [],
      labels: {},
      latitude: '',
      longitude: '',
    };
  }, [templates]);

  const applyValues = useCallback((record, vals) => {
    const nextFields = { ...record.fields };

    if (vals.templateId) {
      nextFields.template = { value: refValue(vals.templateId, 'PlaceTemplate'), type: 'REFERENCE' };
      delete nextFields.placeTemplate;
    } else {
      delete nextFields.template;
      delete nextFields.placeTemplate;
    }

    const fields = templateFieldsFor(vals.templateId, templates);
    for (const fname of fields) {
      const slot = fname.toLowerCase();
      const v = vals.components[slot];
      // Real data uses lowercase fields directly (place, county, state…); drop legacy
      // placeComponent_ keys.
      delete nextFields[`placeComponent_${slot}`];
      if (v == null || v === '') delete nextFields[slot];
      else nextFields[slot] = { value: v, type: 'STRING' };
    }
    const parts = fields.map((fname) => vals.components[fname.toLowerCase()]).filter(Boolean);
    const display = parts.join(', ');
    if (parts[0]) nextFields.placeName = { value: display || parts[0], type: 'STRING' };
    if (display) {
      nextFields.cached_shortLocationString = { value: display, type: 'STRING' };
      nextFields.cached_standardizedLocationString = { value: parts.join(','), type: 'STRING' };
    }

    nextFields.isBookmarked = { value: !!vals.bookmarked, type: 'BOOLEAN' };
    nextFields.isPrivate = { value: !!vals.isPrivate, type: 'BOOLEAN' };
    if (vals.nameType) nextFields.nameType = { value: vals.nameType, type: 'STRING' };
    else delete nextFields.nameType;
    for (const f of REF_NUMBER_FIELDS) {
      const v = vals.refNumbers[f.id];
      if (v == null || v === '') delete nextFields[f.id];
      else nextFields[f.id] = { value: v, type: 'STRING' };
    }
    if (vals.refNumbers.geonameID) {
      nextFields.geonameID = { value: vals.refNumbers.geonameID, type: 'STRING' };
      nextFields.geoNameID = { value: vals.refNumbers.geonameID, type: 'STRING' };
    }
    if (vals.refNumbers.lookupProviderId) nextFields.lookupProviderId = { value: vals.refNumbers.lookupProviderId, type: 'STRING' };

    // Coordinate — separate Coordinate record. Plan the write here so a new
    // record's name can be referenced from the Place fields synchronously;
    // create if missing, delete if both inputs are blank.
    const latNum = parseFloat(vals.latitude);
    const lonNum = parseFloat(vals.longitude);
    const hasCoord = Number.isFinite(latNum) && Number.isFinite(lonNum);
    let coordPlan = null;
    if (hasCoord) {
      const recordName = coordinate?.recordName || generateId('coord');
      if (!coordinate) nextFields.coordinate = { value: refValue(recordName, 'Coordinate'), type: 'REFERENCE' };
      coordPlan = { save: { existing: coordinate, recordName, latitude: latNum, longitude: lonNum } };
    } else if (coordinate) {
      delete nextFields.coordinate;
      coordPlan = { remove: coordinate.recordName };
    }

    // Side records save on the same chain the hydration effect awaits, so a
    // reload never reads them mid-reconcile.
    sideSave.current = sideSave.current
      .then(() => reconcilePlaceSideRecords(record.recordName, vals, coordPlan, setCoordinate))
      .catch((error) => statusRef.current?.(error?.message || String(error)));
    return { ...record, fields: nextFields };
  }, [templates, coordinate]);

  const {
    rows: places, active, activeId, setActiveId, values, setValues,
    dirty, saving, status, setStatus, loadSeq, onSave, onToggleLock,
  } = useRecordEditor({
    recordType: 'Place',
    noun: 'place',
    idPrefix: 'place',
    sortRows: sortPlaces,
    toValues,
    applyValues,
  });
  statusRef.current = setStatus;

  const onCreatePlace = useCallback(async (payload) => {
    setShowNewPlaceSheet(false);
    const record = {
      recordName: generateId('place'),
      recordType: 'Place',
      fields: {
        placeName: { value: payload.name || payload.displayName || 'New Place', type: 'STRING' },
        cached_normallocationString: { value: payload.displayName || payload.name || 'New Place', type: 'STRING' },
      },
    };
    for (const [key, field] of [['locality', 'locality'], ['adminLevel1', 'adminLevel1'], ['country', 'country'], ['postalCode', 'postalCode'], ['notes', 'note']]) {
      if (payload[key]) record.fields[field] = { value: String(payload[key]), type: 'STRING' };
    }
    if (Number.isFinite(payload.latitude) && Number.isFinite(payload.longitude)) {
      const coord = {
        recordName: generateId('coord'),
        recordType: 'Coordinate',
        fields: {
          place: { value: refValue(record.recordName, 'Place'), type: 'REFERENCE' },
          latitude: { value: payload.latitude, type: 'DOUBLE' },
          longitude: { value: payload.longitude, type: 'DOUBLE' },
        },
      };
      await createWithChangeLog(coord);
      record.fields.coordinate = { value: refValue(coord.recordName, 'Coordinate'), type: 'REFERENCE' };
    }
    await createWithChangeLog(record);
    setActiveId(record.recordName);
  }, [setActiveId]);

  useEffect(() => {
    getMapPreferences().then(setMapPrefs);
  }, []);

  const placeIds = useMemo(() => places.map((record) => record.recordName), [places]);
  const selection = useListSelection(placeIds);

  useEffect(() => {
    const onPrefsChanged = (event) => setMapPrefs(event.detail || {});
    window.addEventListener(MAP_PREFERENCES_EVENT, onPrefsChanged);
    return () => window.removeEventListener(MAP_PREFERENCES_EVENT, onPrefsChanged);
  }, []);

  useEffect(() => {
    if (!queryPlaceId) {
      setPlaceQueryMessage(null);
      return;
    }
    if (places.length === 0) return;
    const target = places.find((place) => place.recordName === queryPlaceId);
    if (target) {
      setActiveId(queryPlaceId);
      setPlaceQueryMessage(null);
    } else {
      setPlaceQueryMessage(`The linked place record "${queryPlaceId}" was not found in the current Places list.`);
    }
  }, [places, queryPlaceId, setActiveId]);

  useEffect(() => {
    if (!focus) return;
    if (focus !== 'missing-coordinates') return;

    if (places.length === 0) {
      return;
    }

    requestAnimationFrame(() => {
      const section = document.getElementById(focus);
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowBatchSheet(true);
    });
  }, [focus, places.length]);

  // Hydrate the side-record values (place details, labels, coordinate) for
  // the active place. Re-runs on every list refresh (loadSeq), which the
  // write paths trigger automatically.
  useEffect(() => {
    if (!activeId) return undefined;
    let cancelled = false;
    (async () => {
      await sideSave.current;
      const data = getAppDataClient();
      const record = await data.records.get(activeId);
      if (!record || cancelled) return;

      const [pd, lbl] = await Promise.all([
        data.records.query('PlaceDetail', { referenceField: 'place', referenceValue: activeId, limit: 500 }),
        data.records.query('LabelRelation', { referenceField: 'targetPlace', referenceValue: activeId, limit: 500 }),
      ]);
      const details = pd.records.map((r) => ({
        recordName: r.recordName,
        name: r.fields?.name?.value || '',
      }));
      const labelled = new Set(lbl.records.map((r) => refToRecordName(r.fields?.label?.value)));
      const labels = {};
      for (const def of LABELS) labels[def.id] = labelled.has(def.id);

      // Load the Coordinate record: either the direct ref on Place, or a Coordinate
      // whose `place` ref points back here.
      const coordRef = refToRecordName(record.fields?.coordinate?.value);
      let coord = coordRef ? await data.records.get(coordRef) : null;
      if (!coord) {
        const { records } = await data.records.query('Coordinate', {
          referenceField: 'place', referenceValue: activeId, limit: 5,
        });
        coord = records[0] || null;
      }
      if (cancelled) return;
      setCoordinate(coord);
      const roundCoord = (v) => (typeof v === 'number' ? Number(v.toFixed(6)).toString() : '');
      setValues((current) => ({
        ...current,
        details,
        labels,
        latitude: roundCoord(coord?.fields?.latitude?.value),
        longitude: roundCoord(coord?.fields?.longitude?.value),
      }));
    })();
    return () => { cancelled = true; };
  }, [activeId, loadSeq, setValues]);

  const templateFields = useMemo(() => templateFieldsFor(values.templateId, templates), [values.templateId, templates]);

  const onLookupPlace = useCallback(async () => {
    if (!active) return;
    const query = Object.values(values.components || {}).filter(Boolean).join(', ') || placeSummary(active)?.displayName || placeSummary(active)?.name;
    if (!query) return;
    setStatus('Looking up place…');
    try {
      const candidates = await lookupPlaceCandidates(query, { limit: 1 });
      const match = candidates[0];
      if (!match) {
        setStatus('No lookup match');
        return;
      }
      setValues((v) => ({
        ...v,
        latitude: match.latitude.toFixed(6),
        longitude: match.longitude.toFixed(6),
        refNumbers: { ...v.refNumbers, lookupProviderId: match.providerId },
      }));
      setStatus(`Matched ${match.name}`);
    } catch (error) {
      setStatus(error.message);
    }
  }, [active, values.components, setValues, setStatus]);

  const onLookupGeoName = useCallback(async () => {
    const id = await modal.prompt('GeoName ID:', '', { title: 'Lookup GeoName', placeholder: 'e.g. 5128581' });
    if (!id) return;
    setStatus('Looking up GeoName…');
    try {
      const match = await lookupGeoNameId(id);
      setValues((v) => ({
        ...v,
        latitude: match.latitude.toFixed(6),
        longitude: match.longitude.toFixed(6),
        refNumbers: { ...v.refNumbers, geonameID: id, geoNameID: id },
      }));
      setStatus(`GeoName matched ${match.name}`);
    } catch (error) {
      setStatus(error.message);
    }
  }, [modal, setValues, setStatus]);

  const onBatchLookup = useCallback(async () => {
    const limit = Number(mapPrefs.batchLimit) || 10;
    if (!(await modal.confirm(`Lookup coordinates for up to ${limit} places missing coordinates?`, { title: 'Batch lookup', okLabel: 'Run lookup' }))) return;
    setStatus('Batch lookup running…');
    try {
      const changed = await batchLookupMissingCoordinates({ limit });
      setStatus(`Batch lookup updated ${changed.length} places.`);
    } catch (error) {
      setStatus(error.message);
    }
  }, [mapPrefs.batchLimit, modal, setStatus]);

  const onBatchGeoName = useCallback(async () => {
    const limit = Number(mapPrefs.batchLimit) || 10;
    if (!(await modal.confirm(`Find GeoName IDs for up to ${limit} places without one?`, { title: 'Match GeoName IDs', okLabel: 'Run match' }))) return;
    setStatus('Matching GeoName IDs…');
    try {
      const changed = await batchLookupMissingGeoNames({ limit });
      setStatus(`Matched GeoName IDs for ${changed.length} place${changed.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }, [mapPrefs.batchLimit, modal, setStatus]);

  const onConvertToDetails = useCallback(() => {
    const generated = placeDetailsFromComponents(values.components || {});
    if (!generated.length) return;
    setValues((v) => ({ ...v, details: [...(v.details || []), ...generated] }));
    setStatus(`Added ${generated.length} place detail rows.`);
  }, [values.components, setValues, setStatus]);

  const onPrefsChange = useCallback(async (next) => {
    const saved = await saveMapPreferences(next);
    setMapPrefs(saved);
  }, []);

  const details = values.details || [];
  const lat = parseFloat(values.latitude);
  const lng = parseFloat(values.longitude);
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

  const detailHeader = active ? (
    <div className="border-b border-border bg-card">
      <div className="flex items-center gap-3 px-5 py-3">
        <h2 className="text-base font-semibold truncate flex-1 min-w-0">
          {placeSummary(active)?.displayName || active.recordName}
        </h2>
        <SaveStatus status={status} dirty={dirty} />
        <RecordLockButton record={active} saving={saving} onToggle={onToggleLock} />
        <Button variant="primary" size="md" onClick={onSave} disabled={saving || isRecordLocked(active) || !dirty} title="Save (⌘/Ctrl+S)">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      <EditorSectionNavBar />
    </div>
  ) : null;

  const detail = active ? (
    <div className="p-5 max-w-4xl">
      {placeQueryMessage && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-text">
          {placeQueryMessage}
        </div>
      )}

      <Section title="Place Name" accent={ACCENTS.name}>
        <Field label="Place Template">
          <select value={values.templateId || ''} onChange={(e) => setValues((v) => ({ ...v, templateId: e.target.value }))} className={inputClass}>
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
                  value={values.components?.[slot] || ''}
                  onChange={(e) => setValues((v) => ({ ...v, components: { ...v.components, [slot]: e.target.value } }))}
                  className={inputClass}
                />
              </Field>
            );
          })}
        </div>
      </Section>

      <Section title={`Place Details · ${details.length}`} accent={ACCENTS.details}
        controls={<button onClick={() => setValues((v) => ({ ...v, details: [...(v.details || []), { name: '' }] }))}
          className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Add Detail</button>}>
        {details.length === 0 ? (
          <Empty title="No place details" hint="Use the button above to add one." />
        ) : (
          <div className="space-y-2">
            {details.map((d, i) => (
              <div key={d.recordName || i} className="flex items-center gap-2">
                <input value={d.name} placeholder="Place detail name"
                  onChange={(e) => setValues((v) => ({ ...v, details: (v.details || []).map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))}
                  className={inputClass} />
                <button onClick={() => setValues((v) => ({ ...v, details: (v.details || []).filter((_, j) => j !== i) }))}
                  aria-label="Remove place detail"
                  className="text-destructive-text border border-border rounded-md inline-flex items-center justify-center shrink-0 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8 text-sm hover:bg-destructive/10">×</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div id="missing-coordinates">
        <Section title="Coordinate" accent={ACCENTS.coord}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Latitude">
            <input value={values.latitude || ''} onChange={(e) => setValues((v) => ({ ...v, latitude: e.target.value }))} className={inputClass} />
            {hasPoint && <div className="text-2xs text-muted-foreground mt-1">{dmsLat(lat)}</div>}
          </Field>
          <Field label="Longitude">
            <input value={values.longitude || ''} onChange={(e) => setValues((v) => ({ ...v, longitude: e.target.value }))} className={inputClass} />
            {hasPoint && <div className="text-2xs text-muted-foreground mt-1">{dmsLon(lng)}</div>}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="primary" size="sm" onClick={() => setShowNewPlaceSheet(true)}>+ New Place</Button>
          <button onClick={onLookupPlace} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Lookup Place</button>
          <button onClick={onLookupGeoName} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">GeoName ID</button>
          <button onClick={onBatchLookup} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5" title={`Quick lookup for up to ${Number(mapPrefs.batchLimit) || 10} places missing coordinates`}>Batch Missing</button>
          <button onClick={onBatchGeoName} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5" title={`Find GeoName IDs for up to ${Number(mapPrefs.batchLimit) || 10} places without one`}>Match GeoName IDs</button>
          <button onClick={() => setShowBatchSheet(true)} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5" title="Review and lookup places missing coordinates one by one">Batch Sheet…</button>
          <button onClick={onConvertToDetails} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5" title="Generate PlaceDetail rows from the current place components">Place to Details</button>
          <button onClick={() => setShowConvertSheet(true)} disabled={!activeId} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5" title="Collapse this Place into a PlaceDetail of a parent place">Convert to Detail…</button>
        </div>
        </Section>
      </div>

      <Section title="Map" accent={ACCENTS.map}>
        <div className="h-80 rounded-md overflow-hidden border border-border">
          <MapView
            center={hasPoint ? [lng, lat] : [0, 20]}
            zoom={hasPoint ? Number(mapPrefs.defaultZoom || 9) : 1.5}
            markers={hasPoint ? [{
              id: 'self', lat, lng, draggable: true,
              onDragEnd: ({ lng: nl, lat: nL }) => {
                setValues((v) => ({ ...v, latitude: nL.toFixed(6), longitude: nl.toFixed(6) }));
              },
            }] : []}
            onClick={({ lng: nl, lat: nL }) => {
              setValues((v) => ({ ...v, latitude: nL.toFixed(6), longitude: nl.toFixed(6) }));
            }}
            showControls={false}
          />
        </div>
        <div className="text-2xs text-muted-foreground mt-2">Click on the map to set coordinates, drag the marker to fine-tune.</div>
      </Section>

      <MapPreferencesCard preferences={mapPrefs} onChange={onPrefsChange} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <div>
          <Section title="Media" accent={ACCENTS.media}
            controls={<button onClick={() => navigate(`/views/media-gallery?targetId=${encodeURIComponent(activeId)}&targetType=Place`)} className="text-xs bg-secondary border border-border rounded-md px-2.5 py-1.5">Open Gallery</button>}>
            <MediaRelationsEditor ownerRecordName={activeId} ownerRecordType="Place" />
          </Section>
          <Section title="Notes" accent={ACCENTS.notes}>
            <NotesEditor ownerRecordName={activeId} ownerRecordType="Place" />
          </Section>
          <Section title="Source Citations" accent={ACCENTS.sources}>
            <SourceCitationsEditor ownerRecordName={activeId} ownerRecordType="Place" ownerRole="target" />
          </Section>
        </div>
        <div>
          <Section title="Labels" accent={ACCENTS.labels}>
            <div className="space-y-1">
              {labelDefs.map((def) => (
                <EditSwitch key={def.id} label={def.label} color={def.color}
                  checked={!!values.labels?.[def.id]} onChange={(checked) => setValues((v) => ({ ...v, labels: { ...v.labels, [def.id]: checked } }))} />
              ))}
            </div>
          </Section>
          <Section title="Reference Numbers" accent={ACCENTS.ref}>
            <div className="grid grid-cols-1 gap-3">
              {REF_NUMBER_FIELDS.map((f) => (
                <Field key={f.id} label={f.label}>
                  <input value={values.refNumbers?.[f.id] ?? ''} onChange={(e) => setValues((v) => ({ ...v, refNumbers: { ...v.refNumbers, [f.id]: e.target.value } }))} className={inputClass} />
                </Field>
              ))}
              <Field label="GeoName ID">
                <input value={values.refNumbers?.geonameID ?? ''} onChange={(e) => setValues((v) => ({ ...v, refNumbers: { ...v.refNumbers, geonameID: e.target.value } }))} className={inputClass} />
              </Field>
              <Field label="Name type">
                <select value={values.nameType || ''} onChange={(e) => setValues((v) => ({ ...v, nameType: e.target.value }))} className={inputClass}>
                  <option value="">Standard</option>
                  <option value="official">Official</option>
                  <option value="historical">Historical</option>
                  <option value="native">Native / local</option>
                  <option value="abbreviation">Abbreviation</option>
                  <option value="alternate">Alternate</option>
                </select>
              </Field>
            </div>
          </Section>
          <Section title="Bookmarks" accent={ACCENTS.bookmarks}>
            <EditSwitch label="Bookmarked" checked={!!values.bookmarked} onChange={(checked) => setValues((v) => ({ ...v, bookmarked: checked }))} />
          </Section>
          <Section title="Private" accent={ACCENTS.private}>
            <EditSwitch label="Marked as Private" checked={!!values.isPrivate} onChange={(checked) => setValues((v) => ({ ...v, isPrivate: checked }))} />
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
    <EditorSectionNavProvider>
      <MasterDetailList
        items={places}
        activeId={activeId}
        onPick={setActiveId}
        renderRow={renderRow}
        placeholder="Search places…"
        detail={detail}
        detailHeader={detailHeader}
        selection={selection}
        bulkBar={(
          <RecordBulkBar
            selection={selection}
            recordType="Place"
            onDeleted={(ids) => {
              if (ids.includes(activeId)) setActiveId(null);
            }}
          />
        )}
      />
      {showBatchSheet && (
        <BatchPlaceLookupSheet
          onClose={() => setShowBatchSheet(false)}
        />
      )}
      {showConvertSheet && activeId && (
        <PlaceConvertToDetailSheet
          placeRecordName={activeId}
          onClose={() => setShowConvertSheet(false)}
          onConverted={() => {
            setShowConvertSheet(false);
            setActiveId(null);
          }}
        />
      )}
      {showNewPlaceSheet && (
        <FreeformPlaceLookupSheet
          title="New place"
          onApply={onCreatePlace}
          onCancel={() => setShowNewPlaceSheet(false)}
        />
      )}
    </EditorSectionNavProvider>
  );
}

function MapPreferencesCard({ preferences, onChange }) {
  return (
    <Section title="Map Preferences" accent={ACCENTS.map}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Basemap">
          <select
            value={preferences.basemap || 'auto'}
            onChange={(e) => onChange({ basemap: e.target.value })}
            className={inputClass}
          >
            <option value="auto">Auto theme</option>
            <option value="positron">Light</option>
            <option value="voyager">Voyager</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Field label="Default map zoom">
          <input
            type="number"
            min="1"
            max="18"
            value={preferences.defaultZoom || 9}
            onChange={(e) => onChange({ defaultZoom: +e.target.value || 9 })}
            className={inputClass}
          />
        </Field>
        <Field label="Batch lookup limit">
          <input
            type="number"
            min="1"
            max="50"
            value={preferences.batchLimit || 10}
            onChange={(e) => onChange({ batchLimit: +e.target.value || 10 })}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-col justify-end gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.showLabels !== false}
              onChange={(e) => onChange({ showLabels: e.target.checked })}
            />
            Show map labels
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.markerClustering !== false}
              onChange={(e) => onChange({ markerClustering: e.target.checked })}
            />
            Cluster dense markers
          </label>
        </div>
      </div>
    </Section>
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
      <div className="text-2xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
