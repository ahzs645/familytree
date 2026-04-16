/**
 * PlaceRecord — represents a geographic location.
 * Was `_t` / `kt` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';

export class PlaceRecord extends BaseRecord {
  placeName() {
    return this.fieldValue('placeName') || this.fieldValue('cached_normallocationString') || '';
  }

  normalLocationString() {
    return this.fieldValue('cached_normallocationString') || this.placeName();
  }

  shortLocationString() {
    return this.fieldValue('cached_shortLocationString') || this.placeName();
  }

  standardizedLocationString() {
    return this.fieldValue('cached_standardizedLocationString') || this.placeName();
  }

  geonameID() {
    return this.fieldValue('geonameID') || null;
  }
}

export default PlaceRecord;
