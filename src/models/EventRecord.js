/**
 * EventRecord — represents a life event (birth, death, marriage, etc.).
 * PersonEvent was `no`/`ro`, FamilyEvent was `oo`/`ao` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';
import { readConclusionType, readField, readRef } from '../lib/schema.js';

export class EventRecord extends BaseRecord {
  /** The event type name (e.g., 'Birth', 'Death', 'Marriage'). */
  eventType() {
    return readConclusionType(this.record);
  }

  /** The conclusion type name. */
  conclusionType() {
    return readConclusionType(this.record);
  }

  /** Date string for this event. */
  date() {
    return this.fieldValue('date') || this.fieldValue('cached_dateAsDate') || null;
  }

  /** Reference to the associated person's record name (for PersonEvents). */
  personRecordName() {
    return readRef(this.fieldValue('person'));
  }

  /** Reference to the associated family's record name (for FamilyEvents). */
  familyRecordName() {
    return readRef(this.fieldValue('family'));
  }

  /** Reference to the associated place's record name. */
  placeRecordName() {
    return readRef(this.fieldValue('place') || this.fieldValue('assignedPlace'));
  }

  /** User description/notes for this event. */
  description() {
    return readField(this.record, ['description', 'userDescription'], '');
  }
}

export class PersonEventRecord extends EventRecord {
  recordType() {
    return 'PersonEvent';
  }
}

export class FamilyEventRecord extends EventRecord {
  recordType() {
    return 'FamilyEvent';
  }
}

export default EventRecord;
