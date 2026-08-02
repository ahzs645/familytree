import { describe, expect, it } from 'vitest';
import { buildResearchQuestions, normalizeResearchOptions } from './researchQuestions.js';

const field = (value) => ({ value, type: 'STRING' });
const ref = (id, type) => ({ value: `${id}---${type}`, type: 'REFERENCE' });
const person = (id, name, fields = {}) => ({ recordName: id, recordType: 'Person', fields: { cached_fullName: field(name), ...fields } });
const event = (id, owner, type, fields = {}, family = false) => ({
  recordName: id,
  recordType: family ? 'FamilyEvent' : 'PersonEvent',
  fields: {
    [family ? 'family' : 'person']: ref(owner, family ? 'Family' : 'Person'),
    eventType: field(type),
    ...fields,
  },
});

describe('research questions', () => {
  it('normalizes persisted category and scope options', () => {
    expect(normalizeResearchOptions({ categories: { birth: false }, scopeMode: 'bad' })).toMatchObject({
      categories: { birth: false, death: true, places: true },
      scopeMode: 'all',
    });
  });

  it('generates actionable date, place, source, and relative questions', () => {
    const p1 = person('p1', 'Ada Example', { cached_birthDate: field('1800') });
    const p2 = person('p2', 'Sam Example');
    const data = {
      persons: [p1, p2],
      families: [{ recordName: 'f1', recordType: 'Family', fields: { man: ref('p1', 'Person'), woman: ref('p2', 'Person') } }],
      childRelations: [],
      personEvents: [event('b1', 'p1', 'Birth', { date: field('1800') })],
      familyEvents: [event('m1', 'f1', 'Marriage', { date: field('1820') }, true)],
      sourceRelations: [],
      places: [],
    };
    const kinds = buildResearchQuestions(data).map((question) => question.kind);
    expect(kinds).toContain('birthPlace');
    expect(kinds).toContain('marriagePlace');
    expect(kinds).toContain('personSource');
    expect(kinds).toContain('parents');
    expect(kinds).toContain('deathDate');
  });

  it('honors category, scoped-set, and target-person filters', () => {
    const data = { persons: [person('p1', 'One'), person('p2', 'Two')] };
    const onlyBirth = normalizeResearchOptions({ categories: Object.fromEntries(['death', 'marriage', 'sources', 'parents', 'spouses', 'places'].map((key) => [key, false])) });
    expect(buildResearchQuestions(data, onlyBirth, new Set(['p2']))).toEqual([
      expect.objectContaining({ personId: 'p2', kind: 'birthDate' }),
    ]);
    expect(buildResearchQuestions(data, { ...onlyBirth, targetPersonId: 'p1' }, new Set(['p2']))).toEqual([
      expect.objectContaining({ personId: 'p1', kind: 'birthDate' }),
    ]);
  });

  it('does not duplicate marriage questions for both partners', () => {
    const data = {
      persons: [person('p1', 'One'), person('p2', 'Two')],
      families: [{ recordName: 'f1', recordType: 'Family', fields: { man: ref('p1', 'Person'), woman: ref('p2', 'Person') } }],
    };
    const questions = buildResearchQuestions(data).filter((question) => question.kind === 'marriageDate');
    expect(questions).toHaveLength(1);
  });
});
