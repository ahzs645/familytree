import { describe, expect, it } from 'vitest';
import {
  buildMediaSlideshowSearchParams,
  normalizeMediaSlideshowSettings,
  parseMediaSlideshowSearchParams,
} from './mediaPresentation.js';

describe('media presentation settings', () => {
  it('normalizes slideshow controls and bounds', () => {
    expect(normalizeMediaSlideshowSettings({
      interval: 200,
      filter: 'Bogus',
      fit: 'stretch',
      background: 'neon',
      showCaption: 0,
      showMetadata: 1,
    })).toMatchObject({
      interval: 60,
      filter: 'all',
      fit: 'contain',
      background: 'dark',
      showCaption: true,
      showMetadata: false,
    });
  });

  it('round-trips selected media ids and non-default settings through query params', () => {
    const params = buildMediaSlideshowSearchParams({
      mediaIds: ['media-1', 'media-2', 'media-1'],
      settings: { interval: 9, random: true, fit: 'cover', showMetadata: true },
    });
    expect(params.get('mediaIds')).toBe('media-1,media-2');
    expect(params.get('interval')).toBe('9');

    expect(parseMediaSlideshowSearchParams(params).selectedIds).toEqual(['media-1', 'media-2']);
    expect(parseMediaSlideshowSearchParams(params).settings).toMatchObject({
      interval: 9,
      random: true,
      fit: 'cover',
      showMetadata: true,
    });
  });
});
