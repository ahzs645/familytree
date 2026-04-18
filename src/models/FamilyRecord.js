/**
 * FamilyRecord — represents a family unit (couple + children).
 * Was `ht` / `pt` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';
import { readRef } from '../lib/schema.js';

export class FamilyRecord extends BaseRecord {
  /** Reference to the male partner's record name. */
  manRecordName() {
    return readRef(this.fieldValue('man'));
  }

  /** Reference to the female partner's record name. */
  womanRecordName() {
    return readRef(this.fieldValue('woman'));
  }

  /** Cached marriage date string. */
  marriageDate() {
    return this.fieldValue('cached_marriageDate') || null;
  }

  /** Display name for this family (usually "Partner1 & Partner2"). */
  familyName() {
    // This is typically computed by the app from the partner names
    return this.fieldValue('cached_familyName') || 'Family';
  }

  familyRecordName() {
    return this.recordName();
  }
}

export default FamilyRecord;
