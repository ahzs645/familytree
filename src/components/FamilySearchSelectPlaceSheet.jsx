import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../contexts/LocalizationContext.jsx';
import { readField } from '../lib/schema.js';
import { Button } from './ui/Button.jsx';
import { Sheet } from './ui/Sheet.jsx';
import { formClasses } from './ui/formClasses.js';

function placeLabel(place) {
  return String(readField(place, ['cached_standardizedLocationString', 'cached_normallocationString', 'cached_displayName', 'placeName', 'name'], place?.recordName || ''));
}

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

export function initialPlaceResolutions(incomingPlaces, places) {
  return (incomingPlaces || []).map((incoming) => {
    const exact = (places || []).find((place) => normalized(placeLabel(place)) === normalized(incoming));
    return {
      incoming,
      mode: exact ? 'existing' : 'new',
      placeId: exact?.recordName || '',
      corrected: incoming,
    };
  });
}

export function FamilySearchSelectPlaceSheet({ incomingPlaces, places, onApply, onCancel }) {
  const { t } = useTranslation();
  const firstControlRef = useRef(null);
  const initial = useMemo(() => initialPlaceResolutions(incomingPlaces, places), [incomingPlaces, places]);
  const [resolutions, setResolutions] = useState(initial);

  useEffect(() => setResolutions(initial), [initial]);
  useEffect(() => {
    firstControlRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const update = (index, patch) => setResolutions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const valid = resolutions.every((item) => item.mode === 'text' || (item.mode === 'existing' ? item.placeId : item.corrected.trim()));

  return (
    <Sheet
      title={t('familySearch.places.title')}
      subtitle={t('familySearch.places.subtitle')}
      ariaLabel={t('familySearch.places.title')}
      maxWidth="max-w-3xl"
      scroll="card"
      footer={(
        <>
          <Button variant="outline" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="primary" size="sm" disabled={!valid} onClick={() => onApply(resolutions)}>{t('common.import')}</Button>
        </>
      )}
    >
      <div className="space-y-3">
        {resolutions.map((item, index) => (
          <fieldset key={item.incoming} className="rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium"><bdi>{item.incoming}</bdi></legend>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
              <label className="text-xs">
                <span className="block mb-1 text-muted-foreground">{t('familySearch.places.action')}</span>
                <select
                  ref={index === 0 ? firstControlRef : undefined}
                  value={item.mode}
                  onChange={(event) => update(index, { mode: event.target.value })}
                  className={formClasses.input}
                >
                  <option value="existing">{t('familySearch.places.useExisting')}</option>
                  <option value="new">{t('familySearch.places.createCorrected')}</option>
                  <option value="text">{t('familySearch.places.keepText')}</option>
                </select>
              </label>
              {item.mode === 'existing' && (
                <label className="text-xs">
                  <span className="block mb-1 text-muted-foreground">{t('familySearch.places.existingPlace')}</span>
                  <select value={item.placeId} onChange={(event) => update(index, { placeId: event.target.value })} className={formClasses.input}>
                    <option value="">{t('familySearch.places.choosePlace')}</option>
                    {(places || []).map((place) => <option key={place.recordName} value={place.recordName}>{placeLabel(place)}</option>)}
                  </select>
                </label>
              )}
              {item.mode === 'new' && (
                <label className="text-xs">
                  <span className="block mb-1 text-muted-foreground">{t('familySearch.places.correctedName')}</span>
                  <input value={item.corrected} onChange={(event) => update(index, { corrected: event.target.value })} className={formClasses.input} />
                </label>
              )}
              {item.mode === 'text' && <p className="self-end text-xs text-muted-foreground">{t('familySearch.places.keepTextHint')}</p>}
            </div>
          </fieldset>
        ))}
      </div>
    </Sheet>
  );
}

export default FamilySearchSelectPlaceSheet;
