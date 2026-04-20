import React, { useState } from 'react';

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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-[10vh]" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
        <header className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">Fill in place details manually. No geocoder call will be made.</p>
        </header>
        <div className="p-4 space-y-3">
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
        </div>
        <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="border border-border rounded-md px-3 py-1.5 text-xs hover:bg-accent">Cancel</button>
          <button type="button" onClick={apply} disabled={!draft.name && !draft.locality && !draft.country} className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50">Save place</button>
        </footer>
      </div>
    </div>
  );
}

export default FreeformPlaceLookupSheet;
