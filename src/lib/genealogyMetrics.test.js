import { describe, expect, it } from 'vitest';
import { buildGenealogyIndexes, computeAncestorCompleteness, computeRichStatistics } from './genealogyMetrics.js';

const ref = (recordName) => ({ recordName });
const field = (value) => ({ value });

function person(recordName, firstName, lastName, birth, death = '') {
  return {
    recordName,
    recordType: 'Person',
    fields: {
      firstName: field(firstName),
      lastName: field(lastName),
      cached_birthDate: field(birth),
      ...(death ? { cached_deathDate: field(death) } : {}),
    },
  };
}

function family(recordName, man, woman, marriageDate = '') {
  return {
    recordName,
    recordType: 'Family',
    fields: {
      man: field(ref(man)),
      woman: field(ref(woman)),
      cached_marriageDate: field(marriageDate),
    },
  };
}

function childRelation(recordName, familyId, childId) {
  return {
    recordName,
    recordType: 'ChildRelation',
    fields: {
      family: field(ref(familyId)),
      child: field(ref(childId)),
    },
  };
}

describe('genealogy metrics', () => {
  it('computes rich statistics from modular record sets', () => {
    const records = {
      persons: [
        person('p1', 'Root', 'Smith', '1980'),
        person('p2', 'Father', 'Smith', '1950'),
        person('p3', 'Mother', 'Jones', '1952'),
      ],
      families: [family('f1', 'p2', 'p3', '1978')],
      childRelations: [childRelation('cr1', 'f1', 'p1')],
      places: [],
      personEvents: [],
      familyEvents: [],
      facts: [],
    };
    const stats = computeRichStatistics({ ...records, ...buildGenealogyIndexes(records) });
    expect(stats.totals.persons).toBe(3);
    expect(stats.childrenPerFamily).toEqual([{ children: '1', count: 1 }]);
    expect(stats.ageAtMarriage).toEqual([{ name: '25-29', count: 2 }]);
    expect(stats.completeness.parentFamily).toBe(33.3);
  });

  it('computes ancestor completeness and repeated ancestors', () => {
    const records = {
      persons: [
        person('p1', 'Root', 'Smith', '1980'),
        person('p2', 'Father', 'Smith', '1950'),
        person('p3', 'Mother', 'Jones', '1952'),
        person('p4', 'Shared', 'Ancestor', '1920'),
      ],
      families: [
        family('f1', 'p2', 'p3'),
        family('f2', 'p4', 'p4'),
      ],
      childRelations: [
        childRelation('cr1', 'f1', 'p1'),
        childRelation('cr2', 'f2', 'p2'),
        childRelation('cr3', 'f2', 'p3'),
      ],
      places: [],
    };
    const metrics = computeAncestorCompleteness('p1', { ...records, ...buildGenealogyIndexes(records) }, { maxGenerations: 3 });
    expect(metrics.generations[0].coverage).toBe(100);
    expect(metrics.generations[1].unique).toBe(2);
    expect(metrics.generations[2].unique).toBe(1);
    expect(metrics.repeatedAncestors[0].personId).toBe('p4');
  });
});
