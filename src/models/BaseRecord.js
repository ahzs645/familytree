/**
 * BaseRecord — base class for all CloudKit record wrappers.
 * Was `st` / `lt` in the minified code.
 *
 * Every record in the family tree (Person, Family, Event, Place, etc.)
 * extends this class. It wraps a raw CloudKit record and provides
 * common methods for field access, modification tracking, and persistence.
 */
export class BaseRecord {
  constructor(record) {
    this.record = record;
    this.onIsModifiedChanged = null;
    this.isReplacementObjectForChangeLog = false;
  }

  /** Unique identifier for this record. */
  recordName() {
    return this.record?.recordName;
  }

  /** Record type string (e.g., 'Person', 'Family'). */
  recordType() {
    return this.record?.recordType;
  }

  /** Alias for recordName. */
  key() {
    return this.recordName();
  }

  /** Read a field value from the underlying CloudKit record. */
  fieldValue(fieldName) {
    const field = this.record?.fields?.[fieldName];
    return field ? field.value : undefined;
  }

  /** Set a field value on the underlying CloudKit record. */
  setFieldValue(value, type, fieldName) {
    if (!this.record) return;
    if (!this.record.fields) this.record.fields = {};
    this.record.fields[fieldName] = { value, type: type || 'STRING' };
    if (this.onIsModifiedChanged) {
      this.onIsModifiedChanged(true, this);
    }
  }

  /** Whether this record has unsaved modifications. */
  isModified() {
    return this.record?._dirty || false;
  }

  /** Get the unique ID field (used for CloudKit sync). */
  uniqueID() {
    return this.fieldValue('uniqueID');
  }

  /** Get the CloudKit change tag. */
  changeTag() {
    return this.record?.recordChangeTag;
  }
}

export default BaseRecord;
