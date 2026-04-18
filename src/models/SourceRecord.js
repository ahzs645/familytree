/**
 * SourceRecord — represents a genealogical source/citation.
 * Was `Tt` / `Nt` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';
import { FIELD_ALIASES, readBoolean, readField } from '../lib/schema.js';

export class SourceRecord extends BaseRecord {
  title(includeFullText = false) {
    return readField(this.record, FIELD_ALIASES.sourceTitle, '');
  }

  date() {
    return readField(this.record, FIELD_ALIASES.sourceDate, null);
  }

  text() {
    return this.fieldValue('text') || '';
  }

  isBookmarked() {
    return readBoolean(this.record, FIELD_ALIASES.bookmark);
  }
}

export default SourceRecord;
