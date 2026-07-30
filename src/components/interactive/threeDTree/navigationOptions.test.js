import { describe, expect, it } from 'vitest';
import { buildTreeNavigationOptions, firstNavigationOption } from './navigationOptions.js';
import { clampMenuToViewport } from './overlays.jsx';

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

describe('clampMenuToViewport', () => {
  const view = { width: 390, height: 844 };
  const W = 230;
  const H = 420;

  it('leaves a menu that already fits where it is', () => {
    expect(clampMenuToViewport(20, 30, W, H, view)).toEqual({ left: 20, top: 30 });
  });

  it('flips a menu that would run off the right edge', () => {
    // A tap near the right edge of a 390px phone used to clip the labels.
    expect(clampMenuToViewport(300, 30, W, H, view).left).toBe(70);
  });

  it('flips a menu that would run off the bottom edge', () => {
    expect(clampMenuToViewport(20, 700, W, H, view).top).toBe(280);
  });

  it('clamps into the gutter when neither side has room', () => {
    const narrow = { width: 200, height: 300 };
    const { left, top } = clampMenuToViewport(190, 290, W, H, narrow);
    expect(left).toBe(8);
    expect(top).toBe(8);
  });
});
