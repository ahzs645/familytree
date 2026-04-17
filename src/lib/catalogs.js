/**
 * Static catalogs for editor dropdowns. The values match the conclusion-type
 * naming scheme used by the legacy CTW data ("UniqueID_<Kind>_<Name>") so
 * records remain interoperable with existing trees.
 *
 * "Common" entries are highlighted at the top of the dropdown via the
 * optional `common: true` flag.
 */

export const ADDITIONAL_NAME_TYPES = [
  { id: 'AdoptiveName', label: 'Adoptive Name' },
  { id: 'ArtistsName', label: 'Stage / Pen Name' },
  { id: 'DoubleBarrelledName', label: 'Double-barrelled Name' },
  { id: 'FormalName', label: 'Formal Name' },
  { id: 'FamilyName', label: 'Family Name' },
  { id: 'Other', label: 'Other Name' },
  { id: 'MaidenName', label: 'Name at Birth' },
  { id: 'MarriedName', label: 'Married Name' },
  { id: 'NameVariation', label: 'Name Variation' },
  { id: 'Nickname', label: 'Nickname' },
  { id: 'ProfessionalName', label: 'Professional Name' },
  { id: 'ReligiousName', label: 'Religious Name' },
  { id: 'Title', label: 'Title' },
];

export const PERSON_EVENT_TYPES = [
  { id: 'Birth', label: 'Birth', common: true },
  { id: 'Burial', label: 'Burial', common: true },
  { id: 'Death', label: 'Death', common: true },
  { id: 'Nationality', label: 'Nationality', common: true },
  { id: 'Occupation', label: 'Occupation', common: true },
  { id: 'Residence', label: 'Place of Residence', common: true },
  { id: 'Religion', label: 'Religion', common: true },
  { id: 'Adoption', label: 'Adoption' },
  { id: 'AdultChristening', label: 'Adult Baptism' },
  { id: 'Apprenticeship', label: 'Apprenticeship' },
  { id: 'BarMitzvah', label: 'Bar Mitzvah' },
  { id: 'BasMitzvah', label: 'Bas Mitzvah' },
  { id: 'Blessing', label: 'Blessing' },
  { id: 'Census', label: 'Census' },
  { id: 'Baptism', label: 'Child Baptism' },
  { id: 'Christening', label: 'Christening' },
  { id: 'Circumcision', label: 'Circumcision' },
  { id: 'Confirmation', label: 'Confirmation' },
  { id: 'Cremation', label: 'Cremation' },
  { id: 'Deed', label: 'Document / Deed' },
  { id: 'Emigration', label: 'Emigration' },
  { id: 'Excommunication', label: 'Excommunication' },
  { id: 'FirstCommunion', label: 'First Communion' },
  { id: 'Education', label: 'Formal Education' },
  { id: 'Funeral', label: 'Funeral' },
  { id: 'Graduation', label: 'Graduation' },
  { id: 'Illness', label: 'Illness' },
  { id: 'Immigration', label: 'Immigration' },
  { id: 'LandTransaction', label: 'Land Transaction' },
  { id: 'MilitaryAward', label: 'Military Award' },
  { id: 'MilitaryDischarge', label: 'Military Discharge' },
  { id: 'MilitaryInduction', label: 'Military Induction' },
  { id: 'MilitaryService', label: 'Military Service' },
  { id: 'Miscarriage', label: 'Miscarriage' },
  { id: 'Mission', label: 'Mission' },
  { id: 'Naturalization', label: 'Naturalization' },
  { id: 'NickName', label: 'Nickname' },
  { id: 'NobilityTypeTitle', label: 'Nobility Title' },
  { id: 'Ordination', label: 'Ordination' },
  { id: 'GenericEvent', label: 'Other Event' },
  { id: 'Probate', label: 'Probate' },
  { id: 'Retirement', label: 'Retirement' },
  { id: 'Will', label: 'Will' },
];

export const FAMILY_EVENT_TYPES = [
  { id: 'Marriage', label: 'Marriage', common: true },
  { id: 'Annuled', label: 'Annulment' },
  { id: 'Bann', label: 'Banns' },
  { id: 'Census', label: 'Census' },
  { id: 'MarriageCivil', label: 'Civil Marriage' },
  { id: 'Partnership', label: 'Civil Partnership' },
  { id: 'Divorced', label: 'Divorce' },
  { id: 'Divorce_Filing', label: 'Divorce Filing' },
  { id: 'Engagement', label: 'Engagement' },
  { id: 'Contract', label: 'Marriage Contract' },
  { id: 'License', label: 'Marriage License' },
  { id: 'OtherEvent', label: 'Other Event' },
  { id: 'Settlement', label: 'Prenuptial Agreement' },
  { id: 'MarriageReligion', label: 'Religious Marriage' },
  { id: 'Separation', label: 'Separation' },
];

export const PERSON_FACT_TYPES = [
  { id: 'Clan', label: 'Clan', common: true },
  { id: 'Email', label: 'Email', common: true },
  { id: 'EyeColor', label: 'Eye Color', common: true },
  { id: 'HairColor', label: 'Hair Color', common: true },
  { id: 'Height', label: 'Height', common: true },
  { id: 'Phone', label: 'Phone Number', common: true },
  { id: 'SkinColor', label: 'Skin Color', common: true },
  { id: 'BloodType', label: 'Blood Type' },
  { id: 'CasteName', label: 'Caste' },
  { id: 'Race', label: 'Ethnic Origin' },
  { id: 'Hobby', label: 'Hobby' },
  { id: 'Honors', label: 'Honors' },
  { id: 'NationalID', label: 'National ID Number' },
  { id: 'NationalOrTribalOrigin', label: 'National or Tribal Origin' },
  { id: 'PhysicalDescription', label: 'Physical Description' },
  { id: 'Possession', label: 'Possession' },
  { id: 'SocialSecurityNumber', label: 'Social Security Number' },
  { id: 'TribeName', label: 'Tribe' },
  { id: 'Weight', label: 'Weight' },
];

export const INFLUENTIAL_PERSON_TYPES_PERSON = [
  { id: 'BestFriend', label: 'Best Friend' },
  { id: 'Boss', label: 'Boss' },
  { id: 'CoWorker', label: 'Co-Worker' },
  { id: 'Friend', label: 'Friend' },
  { id: 'Godparent', label: 'Godparent' },
  { id: 'Neighbor', label: 'Neighbor' },
  { id: 'Servant', label: 'Servant' },
  { id: 'Teacher', label: 'Teacher' },
  { id: 'WitnessOfBirth', label: 'Witness of Birth' },
  { id: 'WitnessOfDeath', label: 'Witness of Death' },
];

export const INFLUENTIAL_PERSON_TYPES_FAMILY = [
  { id: 'WitnessOfCivilMarriage', label: 'Witness of Civil Marriage' },
  { id: 'WitnessOfMarriage', label: 'Witness of Marriage' },
  { id: 'WitnessOfReligiousMarriage', label: 'Witness of Religious Marriage' },
];

export const LABELS = [
  { id: 'Incomplete', label: 'Incomplete', color: 'rgb(220 38 38)' },
  { id: 'Important', label: 'Important', color: 'rgb(37 99 235)' },
  { id: 'Noteworthy', label: 'Noteworthy', color: 'rgb(22 163 74)' },
];

export const PLACE_TEMPLATE_FIELDS = {
  Generic: ['Place'],
  'Generic_OneComponent': ['Place'],
  'Generic_TwoComponents': ['Place', 'Region'],
  'Generic_ThreeComponents': ['Place', 'Region', 'Country'],
  'United States of America': ['Place', 'County', 'State', 'Country'],
  'United Kingdom': ['Place', 'County', 'Region', 'Country'],
  'England (Borough)': ['Place', 'Borough', 'County', 'Country'],
  'England (Parish)': ['Place', 'Parish', 'County', 'Country'],
  'Canada (Province)': ['Place', 'County', 'Province', 'Country'],
  'Canada (Territory)': ['Place', 'County', 'Territory', 'Country'],
  Australia: ['Place', 'Region', 'State', 'Country'],
  Germany: ['Place', 'District', 'State', 'Country'],
  France: ['Place', 'Department', 'Region', 'Country'],
  Italy: ['Place', 'Province', 'Region', 'Country'],
  Spain: ['Place', 'Province', 'Region', 'Country'],
  Brazil: ['Place', 'Municipality', 'State', 'Country'],
  Mexico: ['Place', 'Municipality', 'State', 'Country'],
  China: ['Place', 'Prefecture', 'Province', 'Country'],
  Russia: ['Place', 'District', 'Region', 'Country'],
};
// Templates without an explicit field list fall back to a 4-tier generic.
export const DEFAULT_PLACE_FIELDS = ['Place', 'Region', 'State', 'Country'];

// All template choices (subset most common; complete set is dozens).
export const PLACE_TEMPLATES = Object.keys({
  ...PLACE_TEMPLATE_FIELDS,
  Austria: 1, Belgium: 1, 'Bosnia and Herzegovina': 1, Bulgaria: 1, Croatia: 1,
  Czechia: 1, Denmark: 1, Finland: 1, Greece: 1, Hungary: 1, Ireland: 1,
  Netherlands: 1, Norway: 1, Poland: 1, Portugal: 1, Romania: 1, Serbia: 1,
  Slovakia: 1, Slovenia: 1, Sweden: 1, Switzerland: 1,
}).sort();

export const SOURCE_TEMPLATES = [
  'Generic', 'Address Book', 'Book', 'Business Organisational Record',
  'CD-ROM', 'Cemetery Record (Digital)', 'Cemetery Record (Microfilm)',
  'Cemetery Record (Physical Copy)',
  'Census (Digital)', 'Census (Microfilm)', 'Census (Physical Copy)',
  'Church Record (Books)', 'Church Record (Digital)', 'Church Record (Microfilm)',
  'Corporate Record (Digital)', 'Corporate Record (Microfilm)', 'Corporate Record (Physical Copy)',
  'Court Documents', 'Deed', 'Diary / Journal', 'Draft Registration',
  'E-Mail Message',
  'Emigration Record (Digital)', 'Emigration Record (Microfilm)', 'Emigration Record (Physical Copy)',
  'Family Bible', 'Family Chart', 'Funeral Home Record', 'Grave Markers',
  'Historical Letter (Digital)', 'Historical Letter (Microfilm)', 'Historical Letter (Physical Copy)',
  'Historical Research',
  'Immigration Record (Digital)', 'Immigration Record (Microfilm)', 'Immigration Record (Physical Copy)',
  'Interview (Digital)', 'Interview (Microfilm)', 'Interview (Physical Copy)',
  'Land Grant Register', 'Land Record (Digital)', 'Land Record (Microfilm)', 'Land Record (Physical Copy)',
  'Legal Document (Digital)', 'Legal Document (Microfilm)', 'Legal Document (Physical Copy)',
  'Legal Genetic Testing', 'Letter',
  'Local and State Record (Digital)', 'Local and State Record (Microfilm)', 'Local and State Record (Physical Copy)',
  'Manuscript Record', 'Map', 'Medical Record', 'Military Record',
  'National Government Record (Digital)', 'National Government Record (Microfilm)', 'National Government Record (Physical Copy)',
  'Native American Tribal Census', 'Naturalization Record', 'Newspaper',
  'Non-Legal / Private Genetic Testing',
  'Passenger List', 'Pension File', 'Periodical', 'Personal Bible', 'Personal Correspondence',
  'Portrait', 'Preservation Film',
  'Research Report (Digital)', 'Research Report (Microfilm)', 'Research Report (Physical Copy)',
  'School Record (Digital)', 'School Record (Microfilm)', 'School Record (Physical Copy)',
  'Tax List',
  'US Congressional Record (Digital)', 'US Congressional Record (Microfilm)',
  'Unpublished Narrative', 'Vertical File', 'Video',
  'Vital Record',
  'Vital Record – Birth Certificate',
  'Vital Record – Death Certificate',
  'Vital Record – Divorce Certificate',
  'Vital Record – Marriage License',
  'Website', 'Will',
];

export const REFERENCE_NUMBER_FIELDS = [
  { id: 'ownReferenceNumber', label: 'Own Reference Number' },
  { id: 'gedcomID', label: 'Gedcom ID' },
  { id: 'ancestralFileNumber', label: 'Ancestral File Number' },
  { id: 'familySearchID', label: 'FamilySearch ID' },
];

export function groupedTypeOptions(types) {
  const common = types.filter((t) => t.common);
  const rest = types.filter((t) => !t.common);
  return { common, rest };
}

/** Format an ISO date for the "Last Edited" display. */
export function formatTimestamp(v) {
  if (!v) return '—';
  const d = typeof v === 'number' ? new Date(v) : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

/** Convert decimal degrees to D° M' S" N/S/E/W. */
export function dmsLat(v) {
  return _dms(v, 'N', 'S');
}
export function dmsLon(v) {
  return _dms(v, 'E', 'W');
}
function _dms(value, pos, neg) {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return '';
  const sign = n >= 0 ? pos : neg;
  const abs = Math.abs(n);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${d}° ${m}' ${s}" ${sign}`;
}
