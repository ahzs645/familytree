/**
 * GEDCOM tag → record-shape mappings used by the normalize stage and
 * the analysis stage. The Sets named *_HANDLED_TAGS list every tag we
 * map to a structured field; anything else gets preserved as a custom
 * extension via preserveExtensions().
 */

export const EVENT_TAG_TO_NAME = {
  BIRT: 'Birth', DEAT: 'Death', BURI: 'Burial', BAPM: 'Baptism', CHR: 'Christening',
  MARR: 'Marriage', DIV: 'Divorced', ENGA: 'Engagement', ANUL: 'Annuled',
  NATU: 'Naturalization', EMIG: 'Emigration', IMMI: 'Immigration', CENS: 'Census',
  GRAD: 'Graduation', OCCU: 'Occupation', RESI: 'Residence', RELI: 'Religion',
  WILL: 'Will', PROB: 'Probate', ADOP: 'Adoption', EVEN: 'GenericEvent',
  EDUC: 'Education', PROP: 'Possession', TITL: 'NobilityTypeTitle', BARM: 'BarMitzvah',
  BASM: 'BasMitzvah', BLES: 'Blessing', CONF: 'Confirmation', CREM: 'Cremation',
  FCOM: 'FirstCommunion', ORDN: 'Ordination', RETI: 'Retirement', CAST: 'CasteName',
};

export const CUSTOM_EVENT_TAG_TO_NAME = {
  _SEPR: 'Separation',
  _MILT: 'MilitaryService',
  _DEG: 'Degree',
  _MDCL: 'MedicalInformation',
  _ELEC: 'Elected',
  _CIRC: 'Circumcision',
};

export const ATTRIBUTE_TAG_TO_FACT = {
  CAST: 'CasteName',
  DSCR: 'PhysicalDescription',
  FACT: 'Other',
  IDNO: 'NationalID',
  NATI: 'NationalOrTribalOrigin',
  NCHI: 'ChildrenCount',
  NMR: 'MarriageCount',
  SSN: 'SocialSecurityNumber',
};

export const CONTACT_TAG_TO_FACT = {
  PHON: 'Phone',
  EMAIL: 'Email',
  EMAI: 'Email',
  WWW: 'Website',
  URL: 'Website',
};

export const TOP_LEVEL_TAGS = new Set(['HEAD', 'TRLR', 'INDI', 'FAM', 'SOUR', 'NOTE', 'OBJE', 'SUBM', 'REPO']);
export const PERSON_HANDLED_TAGS = new Set(['NAME', 'SEX', 'OBJE', 'NOTE', 'SOUR', 'ALIA', 'ASSO', 'ADDR', 'ADR1', 'ADR2', 'CITY', 'STAE', 'POST', 'CTRY', ...Object.keys(CONTACT_TAG_TO_FACT), ...Object.keys(ATTRIBUTE_TAG_TO_FACT), ...Object.keys(EVENT_TAG_TO_NAME)]);
export const FAMILY_HANDLED_TAGS = new Set(['HUSB', 'WIFE', 'CHIL', 'MARR', 'OBJE', 'ADDR', ...Object.keys(CONTACT_TAG_TO_FACT), ...Object.keys(EVENT_TAG_TO_NAME)]);
export const SOURCE_HANDLED_TAGS = new Set(['TITL', 'AUTH', 'TEXT', 'OBJE', 'REPO', 'PUBL', 'ABBR', 'NOTE']);
export const EVENT_HANDLED_TAGS = new Set(['DATE', 'PLAC', 'NOTE', 'OBJE', 'TYPE', 'SOUR', 'ADDR', ...Object.keys(CONTACT_TAG_TO_FACT)]);
export const REPOSITORY_HANDLED_TAGS = new Set(['NAME', 'ADDR', 'ADR1', 'ADR2', 'CITY', 'STAE', 'POST', 'CTRY', 'NOTE', ...Object.keys(CONTACT_TAG_TO_FACT)]);
