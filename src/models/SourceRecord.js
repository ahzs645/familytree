/**
 * SourceRecord — represents a genealogical source/citation.
 * Was `Tt` / `Nt` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';

export class SourceRecord extends BaseRecord {
  title(includeFullText = false) {
    return this.fieldValue('cached_title') || this.fieldValue('title') || '';
  }

  date() {
    return this.fieldValue('cached_date') || null;
  }

  text() {
    return this.fieldValue('text') || '';
  }

  isBookmarked() {
    return !!this.fieldValue('isBookmarked');
  }
}

export default SourceRecord;
