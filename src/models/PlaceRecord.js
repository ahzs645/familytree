/**
 * PlaceRecord — represents a geographic location.
 * Was `_t` / `kt` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';
import { FIELD_ALIASES, readField } from '../lib/schema.js';

export class PlaceRecord extends BaseRecord {
  placeName() {
    return readField(this.record, FIELD_ALIASES.placeName, '');
  }

  normalLocationString() {
    return readField(this.record, ['cached_normallocationString', 'cached_displayName', 'placeName'], this.placeName());
  }

  shortLocationString() {
    return readField(this.record, FIELD_ALIASES.placeShortName, this.placeName());
  }

  standardizedLocationString() {
    return this.fieldValue('cached_standardizedLocationString') || this.placeName();
  }

  geonameID() {
    return readField(this.record, FIELD_ALIASES.geonameID, null);
  }
}

export default PlaceRecord;
