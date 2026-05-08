import { describe, expect, it } from 'vitest';
import { buildTreeNavigationOptions, firstNavigationOption } from './navigationOptions.js';

describe('buildTreeNavigationOptions', () => {
  it('groups unique parents, partners, and children', () => {
    const context = {
      selfSummary: { recordName: 'self' },
      parents: [{
        family: { recordName: 'fam-parent' },
        man: { recordName: 'father', fullName: 'Father' },
        woman: { recordName: 'mother', fullName: 'Mother' },
      }],
      families: [{
        family: { recordName: 'fam-own' },
        partner: { recordName: 'partner', fullName: 'Partner' },
        children: [
          { recordName: 'child-a', fullName: 'Child A' },
          { recordName: 'child-a', fullName: 'Child A duplicate' },
          { recordName: 'self', fullName: 'Self' },
        ],
      }],
    };

    const sections = buildTreeNavigationOptions(context);

    expect(sections.map((section) => section.id)).toEqual(['parents', 'partners', 'children']);
    expect(sections[0].options.map((option) => option.id)).toEqual(['father', 'mother']);
    expect(sections[2].options.map((option) => option.id)).toEqual(['child-a']);
    expect(firstNavigationOption(context, 'partners')).toMatchObject({ id: 'partner' });
  });
});
