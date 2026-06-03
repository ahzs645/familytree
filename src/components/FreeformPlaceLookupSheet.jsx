import React, { useState } from 'react';
import { Sheet } from './ui/Sheet.jsx';

/**
 * FreeformPlaceLookupSheet — add a place manually without geocoding.
 *
 * Mac reference: PlaceLookupAddPlaceControllerFreeformControlsSheet.nib.
 * Lets the user type structured fields (name, locality, admin regions,
 * country) plus optional lat/lon, then calls onApply with a normalized
 * place record shape.
 */
export function FreeformPlaceLookupSheet({ initial = {}, onApply, onCancel, title = 'Add place (freeform)' }) {
  const [draft, setDraft] = useState(() => ({
    name: initial.name || '',
    locality: initial.locality || '',
    adminLevel3: initial.adminLevel3 || '',
    adminLevel2: initial.adminLevel2 || '',
    adminLevel1: initial.adminLevel1 || '',
    country: initial.country || '',
    countryCode: initial.countryCode || '',
    postalCode: initial.postalCode || '',
    latitude: initial.latitude ?? '',
    longitude: initial.longitude ?? '',
    notes: initial.notes || '',
  }));

  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const apply = () => {
    const parts = [draft.name, draft.locality, draft.adminLevel3, draft.adminLevel2, draft.adminLevel1, draft.country]
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    const displayName = parts.join(', ');
    onApply({
      name: draft.name || displayName,
      displayName,
      locality: draft.locality,
      adminLevel3: draft.adminLevel3,
      adminLevel2: draft.adminLevel2,
      adminLevel1: draft.adminLevel1,
      country: draft.country,
      countryCode: draft.countryCode.toUpperCase(),
      postalCode: draft.postalCode,
      latitude: draft.latitude === '' ? null : Number(draft.latitude),
      longitude: draft.longitude === '' ? null : Number(draft.longitude),
      notes: draft.notes,
      source: 'freeform',
    });
  };

  const field = (name, label, props = {}) => (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        {...props}
        value={draft[name]}
        onChange={(event) => set(name, event.target.value)}
        className="w-full h-9 mt-1 rounded-md border border-border bg-secondary px-2 text-xs"
      />
    </label>
  );

  return (
    <Sheet
      title={title}
      subtitle="Fill in place details manually. No geocoder call will be made."
      footer={(
        <>
          <button type="button" onClick={onCancel} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
          <button type="button" onClick={apply} disabled={!draft.name && !draft.locality && !draft.country} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50">Save place</button>
        </>
      )}
    >
      {field('name', 'Place name (display)')}
      <div className="grid grid-cols-2 gap-2">
        {field('locality', 'Locality (city / town)')}
        {field('postalCode', 'Postal code')}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {field('adminLevel3', 'County / district')}
        {field('adminLevel2', 'State / province')}
        {field('adminLevel1', 'Region')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field('country', 'Country')}
        {field('countryCode', 'ISO code (US, GB…)', { maxLength: 3, style: { textTransform: 'uppercase' } })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field('latitude', 'Latitude', { type: 'number', step: 'any' })}
        {field('longitude', 'Longitude', { type: 'number', step: 'any' })}
      </div>
      <label className="block">
        <span className="text-xs text-muted-foreground">Notes</span>
        <textarea
          rows={2}
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="w-full mt-1 rounded-md border border-border bg-secondary px-2 py-1.5 text-xs"
        />
      </label>
    </Sheet>
  );
}

export default FreeformPlaceLookupSheet;
