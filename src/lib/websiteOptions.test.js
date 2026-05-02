import { describe, expect, it } from 'vitest';
import {
  addSiteTheme,
  moveSiteTheme,
  normalizeContentSections,
  normalizeSiteThemes,
  normalizeWebsiteOptions,
  resolveSiteTheme,
  setDefaultSiteTheme,
  updateSiteTheme,
} from './websiteOptions.js';
import {
  publishTargetActionLabel,
  publishTargetModeDescription,
} from './publishTargets.js';

describe('website options', () => {
  it('normalizes theme lists while preserving custom order', () => {
    const themes = normalizeSiteThemes([
      { id: 'custom', label: 'Custom', colors: { background: '#111111' } },
      { id: 'archive', label: 'Archive Custom', colors: { card: '#eeeeee' } },
    ]);

    expect(themes.map((theme) => theme.id).slice(0, 2)).toEqual(['custom', 'archive']);
    expect(themes.find((theme) => theme.id === 'custom')).toMatchObject({
      label: 'Custom',
      colors: { background: '#111111' },
    });
    expect(themes.find((theme) => theme.id === 'archive')).toMatchObject({
      label: 'Archive Custom',
      colors: { card: '#eeeeee' },
    });
  });

  it('falls back to the first available theme and normalizes content controls', () => {
    const options = normalizeWebsiteOptions({
      theme: 'missing',
      siteThemes: [{ id: 'family', label: 'Family', colors: { text: '#123456' } }],
      contentSections: { media: false, relatedSources: false },
      accentColor: 'not-a-color',
    });

    expect(options.theme).toBe('family');
    expect(options.accentColor).toBe('#2563eb');
    expect(options.contentSections.media).toBe(false);
    expect(options.contentSections.relatedSources).toBe(false);
    expect(options.contentSections.people).toBe(true);
    expect(resolveSiteTheme(options)).toMatchObject({ id: 'family' });
  });

  it('adds, edits, and reorders site themes', () => {
    const withCustom = addSiteTheme(undefined, { label: 'Family Album', colors: { background: '#101010' } });
    const custom = withCustom.find((theme) => theme.label === 'Family Album');
    expect(custom).toMatchObject({ id: 'family-album', colors: { background: '#101010' } });

    const edited = updateSiteTheme(withCustom, custom.id, { label: 'Album', colors: { text: '#fafafa' } });
    expect(edited.find((theme) => theme.id === custom.id)).toMatchObject({
      label: 'Album',
      colors: { background: '#101010', text: '#fafafa' },
    });

    const moved = moveSiteTheme(edited, custom.id, 'up');
    expect(moved.findIndex((theme) => theme.id === custom.id)).toBeLessThan(
      edited.findIndex((theme) => theme.id === custom.id),
    );

    const defaulted = setDefaultSiteTheme(edited, custom.id);
    expect(defaulted[0].id).toBe(custom.id);
  });

  it('fills missing content section switches from defaults', () => {
    expect(normalizeContentSections({ people: false })).toMatchObject({
      people: false,
      families: true,
      relatedMedia: true,
      author: true,
    });
  });
});

describe('publish target labels', () => {
  it('labels FTP/SFTP as package preparation rather than browser upload', () => {
    expect(publishTargetActionLabel('ftp')).toBe('Prepare FTP upload package');
    expect(publishTargetActionLabel('sftp')).toBe('Prepare SFTP upload package');
    expect(publishTargetModeDescription('ftp')).toContain('does not upload directly');
  });
});
