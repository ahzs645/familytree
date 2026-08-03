import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { candidateDisplayName } from '../lib/placeGeocoding.js';
import { Button } from './ui/Button.jsx';
import { Map as MapView } from './ui/Map.jsx';
import { Sheet } from './ui/Sheet.jsx';

export function PlaceLookupCandidateSheet({ query, candidates = [], loading = false, error = '', onApply, onCancel }) {
  const { t, localization } = useTranslation();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [selectedId, setSelectedId] = useState(candidates[0]?.candidateId || '');
  const [nameIndex, setNameIndex] = useState(0);

  useEffect(() => {
    if (!candidates.some((candidate) => candidate.candidateId === selectedId)) {
      setSelectedId(candidates[0]?.candidateId || '');
      setNameIndex(0);
    }
  }, [candidates, selectedId]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const firstControl = dialogRef.current?.querySelector('button, input, select');
    firstControl?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onCancel]);

  const selected = candidates.find((candidate) => candidate.candidateId === selectedId) || candidates[0] || null;
  const nameForms = selected?.nameForms?.length ? selected.nameForms : selected ? [{ name: selected.name, language: '', kind: 'preferred' }] : [];
  const selectedName = nameForms[nameIndex]?.name || selected?.name || '';
  const population = useMemo(() => {
    if (!selected?.population) return '';
    return new Intl.NumberFormat(localization.locale).format(selected.population);
  }, [localization.locale, selected?.population]);

  const chooseCandidate = (candidate) => {
    setSelectedId(candidate.candidateId);
    setNameIndex(0);
  };

  return (
    <Sheet
      dialogRef={dialogRef}
      ariaLabel={t('placeLookup.candidates.ariaLabel')}
      title={t('placeLookup.candidates.title')}
      subtitle={t('placeLookup.candidates.subtitle', { query })}
      maxWidth="max-w-5xl"
      maxHeight="max-h-[90vh]"
      offset="pt-[4vh]"
      scroll="card"
      bodyClassName="grid min-h-0 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]"
      footer={(
        <>
          <button type="button" onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
            {t('placeLookup.candidates.cancel')}
          </button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selected || loading}
            onClick={() => onApply({ candidate: selected, chosenName: selectedName })}
          >
            {t('placeLookup.candidates.apply')}
          </Button>
        </>
      )}
    >
      <div className="min-h-0 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">{t('placeLookup.candidates.loading')}</p>
        ) : error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-text" role="alert">{error}</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('placeLookup.candidates.empty')}</p>
        ) : (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-muted-foreground">{t('placeLookup.candidates.results', { count: candidates.length })}</legend>
            <div className="space-y-2">
              {candidates.map((candidate) => {
                const checked = candidate.candidateId === selected?.candidateId;
                return (
                  <label key={candidate.candidateId} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${checked ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'}`}>
                    <input
                      type="radio"
                      name="place-lookup-candidate"
                      value={candidate.candidateId}
                      checked={checked}
                      onChange={() => chooseCandidate(candidate)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{candidate.name || candidate.displayName}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{candidate.displayName}</span>
                      <span className="mt-1 block text-2xs text-muted-foreground">
                        {featureLabel(candidate, t)} · {candidate.featureClass || '—'} / {candidate.featureCode || '—'} · {formatCoordinates(candidate)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>

      <div className="min-w-0 space-y-3 lg:overflow-y-auto">
        {selected && (
          <>
            <div className="h-52 overflow-hidden rounded-lg border border-border" aria-label={t('placeLookup.candidates.mapPreview')}>
              <MapView
                center={[selected.longitude, selected.latitude]}
                zoom={10}
                markers={[{ id: selected.candidateId, lng: selected.longitude, lat: selected.latitude }]}
                showControls={false}
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">{t('placeLookup.candidates.nameForm')}</span>
              <select
                value={String(Math.min(nameIndex, Math.max(0, nameForms.length - 1)))}
                onChange={(event) => setNameIndex(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-border bg-secondary px-3 text-sm"
              >
                {nameForms.map((form, index) => (
                  <option key={`${form.name}-${form.language}-${index}`} value={String(index)}>
                    {form.name} — {nameFormDescription(form, t)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-2xs text-muted-foreground">
                {t('placeLookup.candidates.appliedPreview', { name: candidateDisplayName(selected, selectedName) })}
              </span>
            </label>

            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg border border-border p-3 text-xs">
              <dt className="text-muted-foreground">{t('placeLookup.candidates.feature')}</dt>
              <dd>{featureLabel(selected, t)} ({selected.featureClass || '—'} / {selected.featureCode || '—'})</dd>
              <dt className="text-muted-foreground">{t('placeLookup.candidates.coordinates')}</dt>
              <dd className="font-mono">{formatCoordinates(selected)}</dd>
              <dt className="text-muted-foreground">{t('placeLookup.candidates.population')}</dt>
              <dd>{population || t('placeLookup.candidates.notAvailable')}</dd>
              <dt className="text-muted-foreground">{t('placeLookup.candidates.provider')}</dt>
              <dd>{selected.provider}{selected.packageId ? ` · ${selected.packageId}` : ''}</dd>
              {selected.geoNameID && (
                <>
                  <dt className="text-muted-foreground">{t('placeLookup.candidates.geoNameId')}</dt>
                  <dd>{selected.geoNameID}</dd>
                </>
              )}
            </dl>

            <section>
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{t('placeLookup.candidates.hierarchy')}</h3>
              {selected.hierarchy?.length ? (
                <ol className="space-y-1 rounded-lg border border-border p-3 text-xs">
                  {selected.hierarchy.map((item, index) => (
                    <li key={`${item.level}-${item.value}-${index}`} className="flex gap-2">
                      <span className="min-w-24 text-muted-foreground">{hierarchyLabel(item.level, t)}</span>
                      <span>{item.value}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-xs text-muted-foreground">{t('placeLookup.candidates.notAvailable')}</p>}
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
}

function formatCoordinates(candidate) {
  return `${Number(candidate.latitude).toFixed(5)}, ${Number(candidate.longitude).toFixed(5)}`;
}

function featureLabel(candidate, t) {
  const value = String(candidate.featureCode || candidate.featureClass || '').toLocaleLowerCase();
  if (/church|place_of_worship|(^|\.)ch$|chur/.test(value)) return t('placeLookup.features.church');
  if (/cemetery|grave|cem|cmty/.test(value)) return t('placeLookup.features.cemetery');
  if (/city|town|village|hamlet|ppl|municipality/.test(value)) return t('placeLookup.features.city');
  if (/country|state|county|administrative|adm/.test(value)) return t('placeLookup.features.administrative');
  if (/building|amenity|tourism|historic|poi|spot/.test(value)) return t('placeLookup.features.poi');
  return t('placeLookup.features.place');
}

function nameFormDescription(form, t) {
  const kind = t(`placeLookup.nameKinds.${form.kind || 'alternate'}`);
  return form.language ? t('placeLookup.candidates.nameKindLanguage', { kind, language: form.language }) : kind;
}

function hierarchyLabel(level, t) {
  const known = ['neighbourhood', 'suburb', 'cityDistrict', 'locality', 'county', 'state', 'country', 'admin1', 'admin2', 'admin3', 'admin4'];
  return known.includes(level) ? t(`placeLookup.hierarchy.${level}`) : level;
}

export default PlaceLookupCandidateSheet;
