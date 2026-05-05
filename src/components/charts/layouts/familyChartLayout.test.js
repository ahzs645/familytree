import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { layoutFamilyChart } from './familyChartLayout.js';
import { DEFAULT_THEME } from '../theme.js';

const atharaFixture = JSON.parse(readFileSync(new URL('../../../../fixtures/athara-tree-safeguards/family-chart.json', import.meta.url), 'utf8'));

const root = person('p-root', 'Root Person', 0);
const spouse = person('p-spouse', 'Spouse Person', 1);
const child = person('p-child', 'Child Person', 0);
const father = person('p-father', 'Father Person', 0);
const mother = person('p-mother', 'Mother Person', 1);

describe('layoutFamilyChart', () => {
  it('lays out ancestors, descendants, spouse placeholders, and kinships', () => {
    const layout = layoutFamilyChart({
      ancestorTree: {
        person: root,
        father: { person: father, father: null, mother: null },
        mother: { person: mother, father: null, mother: null },
      },
      descendantTree: {
        person: root,
        unions: [
          { familyRecordName: 'fam-1', partner: spouse, children: [{ person: child, unions: [] }] },
          { familyRecordName: 'fam-2', partner: null, children: [{ person: person('p-single', 'Single Parent Child', 1), unions: [] }] },
        ],
      },
      rootId: root.recordName,
      theme: DEFAULT_THEME,
      showKinships: true,
    });

    expect(layout.nodes.some((node) => node.person?.recordName === father.recordName && node.kinship === 'Father')).toBe(true);
    expect(layout.nodes.some((node) => node.person?.recordName === child.recordName && node.kinship === 'Son')).toBe(true);
    expect(layout.nodes.some((node) => node.role === 'placeholder-spouse')).toBe(true);
    expect(layout.links.some((link) => link.kind === 'marriage')).toBe(true);
  });

  it('collapses repeated descendant couple branches', () => {
    const repeatedChild = { person: person('p-repeat-child', 'Repeated Child', 0), unions: [] };
    const tree = {
      person: root,
      unions: [
        { familyRecordName: 'fam-a', partner: spouse, children: [repeatedChild] },
        { familyRecordName: 'fam-b', partner: spouse, children: [repeatedChild] },
      ],
    };

    const layout = layoutFamilyChart({
      descendantTree: tree,
      rootId: root.recordName,
      theme: DEFAULT_THEME,
      collapseDuplicates: true,
    });

    expect(layout.duplicateCount).toBe(1);
    expect(layout.nodes.some((node) => node.collapsedDuplicate)).toBe(true);
    expect(layout.links.some((link) => link.kind === 'duplicate-stub')).toBe(true);
  });

  it('keeps Athara-inspired couple layout regression cases covered by fixture', () => {
    const layout = layoutFamilyChart({
      descendantTree: atharaFixture.descendantTree,
      rootId: atharaFixture.rootId,
      theme: DEFAULT_THEME,
      collapseDuplicates: true,
    });
    const personIds = new Set(layout.nodes.map((node) => node.person?.recordName).filter(Boolean));

    expect(atharaFixture.metadata.cases).toEqual(expect.arrayContaining([
      'multi-generation child couple',
      'in-law spouse with parents',
      'single-parent child',
      'relationship cycle',
    ]));
    expect([...personIds]).toEqual(expect.arrayContaining(['root', 'partner', 'child', 'inlaw', 'grandchild', 'single-child']));
    expect(layout.nodes.some((node) => node.role === 'placeholder-spouse')).toBe(true);
    expect(layout.duplicateCount).toBe(1);
  });
});

function person(recordName, fullName, gender) {
  return { recordName, fullName, gender, birthDate: '', deathDate: '' };
}
