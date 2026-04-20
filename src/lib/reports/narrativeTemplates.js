/**
 * Narrative report sentence templates.
 *
 * Mirrors a minimal slice of MacFamilyTree's
 * `CoreNarrativeReport.strings` — the flagship narrative output. Mac ships
 * ~600 `NarrativeReportGenerator_<Event>|<Gender>|<Slots>` strings; we port
 * the core five event types with Male / Female / Unknown gender and the
 * slot vocabulary `@Name@ @Date@ @Year@ @Place@ @Age@`.
 *
 * Each template is picked by:
 *   1. event type (Birth, Marriage, Death, Residence, Occupation)
 *   2. gender (male | female | unknown)
 *   3. slot signature (which of Date/Place/Age are available)
 *
 * Missing fields fall through progressively:
 *   DatePlace → Date → Place → bare
 *
 * Consumers should substitute the `@Name@` slot themselves when rendering
 * a paragraph that already opens with the person's name.
 */

import { Gender } from '../../models/constants.js';

export const EVENT = Object.freeze({
  BIRTH: 'Birth',
  MARRIAGE: 'Marriage',
  DEATH: 'Death',
  RESIDENCE: 'Residence',
  OCCUPATION: 'Occupation',
});

const MALE = 'male';
const FEMALE = 'female';
const UNKNOWN = 'unknown';

const TEMPLATES = {
  [EVENT.BIRTH]: {
    DatePlace: {
      male: '@Name@ was born on @Date@ in @Place@.',
      female: '@Name@ was born on @Date@ in @Place@.',
      unknown: '@Name@ was born on @Date@ in @Place@.',
    },
    Date: {
      male: '@Name@ was born on @Date@.',
      female: '@Name@ was born on @Date@.',
      unknown: '@Name@ was born on @Date@.',
    },
    Place: {
      male: '@Name@ was born in @Place@.',
      female: '@Name@ was born in @Place@.',
      unknown: '@Name@ was born in @Place@.',
    },
    bare: {
      male: '@Name@ was born.',
      female: '@Name@ was born.',
      unknown: '@Name@ was born.',
    },
  },
  [EVENT.MARRIAGE]: {
    DatePlace: {
      male: '@Name@ married @Partner@ on @Date@ in @Place@.',
      female: '@Name@ married @Partner@ on @Date@ in @Place@.',
      unknown: '@Name@ married @Partner@ on @Date@ in @Place@.',
    },
    Date: {
      male: '@Name@ married @Partner@ on @Date@.',
      female: '@Name@ married @Partner@ on @Date@.',
      unknown: '@Name@ married @Partner@ on @Date@.',
    },
    Place: {
      male: '@Name@ married @Partner@ in @Place@.',
      female: '@Name@ married @Partner@ in @Place@.',
      unknown: '@Name@ married @Partner@ in @Place@.',
    },
    bare: {
      male: '@Name@ married @Partner@.',
      female: '@Name@ married @Partner@.',
      unknown: '@Name@ married @Partner@.',
    },
  },
  [EVENT.DEATH]: {
    DatePlaceAge: {
      male: 'He died on @Date@ in @Place@ at the age of @Age@.',
      female: 'She died on @Date@ in @Place@ at the age of @Age@.',
      unknown: '@Name@ died on @Date@ in @Place@ at the age of @Age@.',
    },
    DatePlace: {
      male: 'He died on @Date@ in @Place@.',
      female: 'She died on @Date@ in @Place@.',
      unknown: '@Name@ died on @Date@ in @Place@.',
    },
    DateAge: {
      male: 'He died on @Date@ at the age of @Age@.',
      female: 'She died on @Date@ at the age of @Age@.',
      unknown: '@Name@ died on @Date@ at the age of @Age@.',
    },
    Date: {
      male: 'He died on @Date@.',
      female: 'She died on @Date@.',
      unknown: '@Name@ died on @Date@.',
    },
    Place: {
      male: 'He died in @Place@.',
      female: 'She died in @Place@.',
      unknown: '@Name@ died in @Place@.',
    },
    bare: {
      male: 'He died.',
      female: 'She died.',
      unknown: '@Name@ died.',
    },
  },
  [EVENT.RESIDENCE]: {
    DatePlace: {
      male: 'In @Year@ he lived in @Place@.',
      female: 'In @Year@ she lived in @Place@.',
      unknown: 'In @Year@ @Name@ lived in @Place@.',
    },
    Place: {
      male: 'He lived in @Place@.',
      female: 'She lived in @Place@.',
      unknown: '@Name@ lived in @Place@.',
    },
    Date: {
      male: 'In @Year@ his residence was recorded.',
      female: 'In @Year@ her residence was recorded.',
      unknown: 'In @Year@ @Name@\'s residence was recorded.',
    },
    bare: {
      male: 'A residence was recorded for him.',
      female: 'A residence was recorded for her.',
      unknown: 'A residence was recorded for @Name@.',
    },
  },
  [EVENT.OCCUPATION]: {
    DateDescription: {
      male: 'In @Year@ he worked as @Description@.',
      female: 'In @Year@ she worked as @Description@.',
      unknown: 'In @Year@ @Name@ worked as @Description@.',
    },
    Description: {
      male: 'He worked as @Description@.',
      female: 'She worked as @Description@.',
      unknown: '@Name@ worked as @Description@.',
    },
    Date: {
      male: 'In @Year@ his occupation was recorded.',
      female: 'In @Year@ her occupation was recorded.',
      unknown: 'In @Year@ @Name@\'s occupation was recorded.',
    },
    bare: {
      male: 'An occupation was recorded.',
      female: 'An occupation was recorded.',
      unknown: 'An occupation was recorded.',
    },
  },
};

function genderKey(gender) {
  if (gender === Gender.Male) return MALE;
  if (gender === Gender.Female) return FEMALE;
  return UNKNOWN;
}

function pickSlotKey(slots, preferredOrder) {
  const have = new Set(Object.entries(slots || {}).filter(([, v]) => v != null && v !== '').map(([k]) => k));
  for (const key of preferredOrder) {
    const required = key.match(/[A-Z][a-z]+/g) || [];
    if (required.every((name) => have.has(name))) return key;
  }
  return 'bare';
}

const SLOT_ORDER = {
  [EVENT.BIRTH]: ['DatePlace', 'Date', 'Place', 'bare'],
  [EVENT.MARRIAGE]: ['DatePlace', 'Date', 'Place', 'bare'],
  [EVENT.DEATH]: ['DatePlaceAge', 'DatePlace', 'DateAge', 'Date', 'Place', 'bare'],
  [EVENT.RESIDENCE]: ['DatePlace', 'Place', 'Date', 'bare'],
  [EVENT.OCCUPATION]: ['DateDescription', 'Description', 'Date', 'bare'],
};

export function narrativeSentenceFor(event, gender, slots) {
  const byEvent = TEMPLATES[event];
  if (!byEvent) return '';
  const slotKey = pickSlotKey(slots, SLOT_ORDER[event] || ['bare']);
  const byGender = byEvent[slotKey];
  if (!byGender) return '';
  const template = byGender[genderKey(gender)] || byGender.unknown;
  return renderTemplate(template, slots);
}

function renderTemplate(template, slots = {}) {
  return template.replace(/@(\w+)@/g, (match, key) => {
    const value = slots[key];
    return value == null || value === '' ? '' : String(value);
  }).replace(/\s{2,}/g, ' ').trim();
}

export function describeBirth(personSummary) {
  const year = yearOf(personSummary?.birthDate);
  return narrativeSentenceFor(EVENT.BIRTH, personSummary?.gender, {
    Name: personSummary?.fullName || '',
    Date: personSummary?.birthDate || '',
    Year: year || '',
    Place: personSummary?.birthPlace || '',
  });
}

export function describeDeath(personSummary) {
  const birth = yearOf(personSummary?.birthDate);
  const death = yearOf(personSummary?.deathDate);
  const age = (birth && death) ? String(Math.max(0, death - birth)) : '';
  return narrativeSentenceFor(EVENT.DEATH, personSummary?.gender, {
    Name: personSummary?.fullName || '',
    Date: personSummary?.deathDate || '',
    Year: death || '',
    Place: personSummary?.deathPlace || '',
    Age: age,
  });
}

export function describeMarriage(personSummary, partnerSummary, marriageDate, marriagePlace) {
  const year = yearOf(marriageDate);
  return narrativeSentenceFor(EVENT.MARRIAGE, personSummary?.gender, {
    Name: personSummary?.fullName || '',
    Partner: partnerSummary?.fullName || 'an unnamed partner',
    Date: marriageDate || '',
    Year: year || '',
    Place: marriagePlace || '',
  });
}

function yearOf(raw) {
  if (!raw) return '';
  const match = String(raw).match(/\b(\d{4})\b/);
  return match ? match[1] : '';
}
