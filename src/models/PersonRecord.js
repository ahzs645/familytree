/**
 * PersonRecord — represents a person in the family tree.
 * Was `ft` / `dt` in the minified code.
 */
import { BaseRecord } from './BaseRecord.js';
import { Gender } from './constants.js';

export class PersonRecord extends BaseRecord {
  firstName() {
    return this.fieldValue('firstName') || '';
  }

  lastName() {
    return this.fieldValue('lastName') || '';
  }

  namePrefix() {
    return this.fieldValue('namePrefix') || '';
  }

  nameMiddle() {
    return this.fieldValue('nameMiddle') || '';
  }

  nameSuffix() {
    return this.fieldValue('nameSuffix') || '';
  }

  fullName() {
    return this.fieldValue('cached_fullName') || `${this.firstName()} ${this.lastName()}`.trim();
  }

  fullNameForSorting() {
    return this.fieldValue('cached_fullNameForSorting') || this.fullName();
  }

  get gender() {
    const val = this.fieldValue('gender');
    return val !== undefined ? val : Gender.UnknownGender;
  }

  birthDate() {
    return this.fieldValue('cached_birthDate') || null;
  }

  deathDate() {
    return this.fieldValue('cached_deathDate') || null;
  }

  isStartPerson() {
    return !!this.fieldValue('isStartPerson');
  }

  getThumbnailImageSource() {
    return this.fieldValue('thumbnailFileIdentifier') || null;
  }
}

export default PersonRecord;
