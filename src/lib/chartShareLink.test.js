import { describe, expect, it } from 'vitest';
import { buildShareLinkUrl, decodeSharePayload, encodeSharePayload } from './chartShareLink.js';

describe('chart share links', () => {
  it('uses the SPA entry URL for project-page deployments', () => {
    const url = buildShareLinkUrl('abc123', {
      baseUrl: 'https://projects.example.com',
      basePath: '/familytree/',
    });
    const parsed = new URL(url);

    expect(`${parsed.origin}${parsed.pathname}`).toBe('https://projects.example.com/familytree/');
    expect(parsed.searchParams.get('p')).toBe('/view/abc123');
  });

  it('keeps the token encoded as one route segment', () => {
    const url = buildShareLinkUrl('abc/with+chars%', {
      baseUrl: 'https://projects.example.com',
      basePath: '/familytree',
    });
    const parsed = new URL(url);

    expect(parsed.searchParams.get('p')).toBe('/view/abc%2Fwith%2Bchars%25');
  });

  it('decodes lzstring tokens without a global Buffer object', async () => {
    const originalBuffer = globalThis.Buffer;
    const payload = {
      version: 1,
      chart: { name: 'Shared Chart', roots: {} },
      persons: {},
      families: {},
    };

    try {
      globalThis.Buffer = undefined;
      const token = await encodeSharePayload(payload);
      await expect(decodeSharePayload(token)).resolves.toEqual(payload);
    } finally {
      globalThis.Buffer = originalBuffer;
    }
  });
});
