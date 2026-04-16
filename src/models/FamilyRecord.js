/**
 * FamilyRecord — represents a family unit (couple + children).
 * Was `ht` / `pt` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';

export class FamilyRecord extends BaseRecord {
  /** Reference to the male partner's record name. */
  manRecordName() {
    const ref = this.fieldValue('man');
    return ref ? ref.recordName : null;
  }

  /** Reference to the female partner's record name. */
  womanRecordName() {
    const ref = this.fieldValue('woman');
    return ref ? ref.recordName : null;
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
