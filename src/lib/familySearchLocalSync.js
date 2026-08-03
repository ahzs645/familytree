import { refValue } from './schema.js';

/**
 * Apply a reconciled FamilySearch vital place to the PersonEvent shape used by
 * event editors, maps, and imports. The caller supplies a new record envelope
 * when the vital event does not exist yet.
 */
export function withFamilySearchVitalPlace(event, { personId, eventType, placeId = '', text = '' }) {
  const fields = {
    ...(event?.fields || {}),
    person: { value: refValue(personId, 'Person'), type: 'REFERENCE' },
    conclusionType: { value: refValue(eventType, 'ConclusionPersonEventType'), type: 'REFERENCE' },
  };
  delete fields.place;
  delete fields.assignedPlace;
  delete fields.placeName;
  delete fields.assignedPlaceName;
  if (placeId) fields.place = { value: refValue(placeId, 'Place'), type: 'REFERENCE' };
  else if (text) fields.placeName = { value: text, type: 'STRING' };
  return { ...event, fields };
}
