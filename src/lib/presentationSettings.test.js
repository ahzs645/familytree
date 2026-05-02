import { describe, expect, it } from 'vitest';
import { normalizePageStyle, normalizePresentationSettings, updatePageStyle } from './presentationSettings.js';

describe('presentation settings', () => {
  it('normalizes shared page style defaults and bounds', () => {
    expect(normalizePageStyle({ paginate: 1, background: 'bad', pageSize: 'poster', orientation: 'wide', margin: 8 })).toEqual({
      paginate: true,
      background: 'none',
      pageSize: 'letter',
      orientation: 'portrait',
      margin: 24,
    });
  });

  it('updates nested page style without dropping presentation settings', () => {
    expect(updatePageStyle({ pageStyle: { background: 'soft' }, exportSettings: { filenameBase: 'Book' } }, { margin: 72 })).toEqual({
      pageStyle: { paginate: false, background: 'soft', pageSize: 'letter', orientation: 'portrait', margin: 72 },
      themeId: 'plain',
      language: 'system',
      exportSettings: { filenameBase: 'Book', includeAuthorMetadata: true, includePdfBackground: true },
    });
  });

  it('normalizes empty presentation settings for saved documents', () => {
    expect(normalizePresentationSettings()).toMatchObject({
      pageStyle: { paginate: false, background: 'none', pageSize: 'letter', orientation: 'portrait', margin: 48 },
      themeId: 'plain',
      language: 'system',
      exportSettings: {
        filenameBase: '',
        includeAuthorMetadata: true,
        includePdfBackground: true,
      },
    });
  });

  it('bounds theme, language, and export settings', () => {
    expect(normalizePresentationSettings({
      themeId: 'missing',
      language: 'klingon',
      exportSettings: {
        filenameBase: 'Annual book',
        includeAuthorMetadata: false,
        includePdfBackground: false,
      },
    })).toMatchObject({
      themeId: 'plain',
      language: 'system',
      exportSettings: {
        filenameBase: 'Annual book',
        includeAuthorMetadata: false,
        includePdfBackground: false,
      },
    });
  });
});
