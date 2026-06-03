import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeGedcomBytes, extractGedcomCharTag, isGeneWebFileName } from './genealogyFileFormats.js';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../fixtures/geneweb/ged2gwb-cram');
const fixtureBytes = (name) => new Uint8Array(readFileSync(resolve(fixturesDir, name)));

describe('extractGedcomCharTag', () => {
  it('detects CHAR tags in CR-only GEDCOM headers', () => {
    const bytes = new TextEncoder().encode(['0 HEAD', '1 SOUR Legacy', '1 CHAR ANSEL', '0 TRLR'].join('\r'));

    expect(extractGedcomCharTag(bytes)).toBe('ANSEL');
  });

  it('detects CHAR tags in copied GeneWeb GEDCOM fixtures', () => {
    expect(extractGedcomCharTag(fixtureBytes('SIMPLE.GED'))).toBe('ASCII');
    expect(extractGedcomCharTag(fixtureBytes('ANSEL.GED'))).toBe('ANSEL');
  });
});

describe('isGeneWebFileName', () => {
  it('recognizes .gw files without treating GEDCOM names as GeneWeb', () => {
    expect(isGeneWebFileName('tree.gw')).toBe(true);
    expect(isGeneWebFileName('tree.GW')).toBe(true);
    expect(isGeneWebFileName('tree.ged')).toBe(false);
  });
});

describe('decodeGedcomBytes', () => {
  it('decodes GeneWeb UTF-16 little- and big-endian BOM fixtures', () => {
    const littleEndian = decodeGedcomBytes(fixtureBytes('ULHBOMCL.GED'), 'ULHBOMCL.GED');
    const bigEndian = decodeGedcomBytes(fixtureBytes('UHLBOMCL.GED'), 'UHLBOMCL.GED');

    expect(littleEndian).toContain('1 CHAR UNICODE');
    expect(littleEndian).toContain('Each UNICODE character is stored in Lo-Hi order');
    expect(bigEndian).toContain('1 CHAR UNICODE');
    expect(bigEndian).toContain('Each UNICODE character is stored in Hi-Lo order');
  });

  it('can decode the GeneWeb UTF-16LE fixture without a BOM when explicitly requested', () => {
    const decoded = decodeGedcomBytes(fixtureBytes('ULHCL.GED'), 'ULHCL.GED', { encoding: 'utf-16le' });

    expect(decoded).toContain('0 HEAD');
    expect(decoded).toContain('1 CHAR UNICODE');
    expect(decoded).toContain('Each UNICODE character is stored in Lo-Hi order');
  });

  it('uses the GeneWeb ANSEL CHAR tag for legacy GEDCOM text', () => {
    const decoded = decodeGedcomBytes(fixtureBytes('ANSEL.GED'), 'ANSEL.GED');

    expect(decoded).toContain('1 CHAR ANSEL');
    expect(decoded).toContain('british pound');
    expect(decoded).toContain('£');
  });
});
