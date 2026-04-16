/**
 * EventRecord — represents a life event (birth, death, marriage, etc.).
 * PersonEvent was `no`/`ro`, FamilyEvent was `oo`/`ao` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';

export class EventRecord extends BaseRecord {
  /** The event type name (e.g., 'Birth', 'Death', 'Marriage'). */
  eventType() {
    return this.fieldValue('eventType') || this.fieldValue('conclusionType') || '';
  }

  /** The conclusion type name. */
  conclusionType() {
    return this.fieldValue('conclusionType') || this.eventType();
  }

  /** Date string for this event. */
  date() {
    return this.fieldValue('date') || this.fieldValue('cached_dateAsDate') || null;
  }

  /** Reference to the associated person's record name (for PersonEvents). */
  personRecordName() {
    const ref = this.fieldValue('person');
    return ref ? ref.recordName : null;
  }

  /** Reference to the associated family's record name (for FamilyEvents). */
  familyRecordName() {
    const ref = this.fieldValue('family');
    return ref ? ref.recordName : null;
  }

  /** Reference to the associated place's record name. */
  placeRecordName() {
    const ref = this.fieldValue('place') || this.fieldValue('assignedPlace');
    return ref ? ref.recordName : null;
  }

  /** User description/notes for this event. */
  description() {
    return this.fieldValue('description') || this.fieldValue('userDescription') || '';
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
