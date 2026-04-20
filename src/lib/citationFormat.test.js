import { describe, it, expect } from 'vitest';
import {
  formatCitation,
  formatBibliography,
  CITATION_MODE,
  BRACKET_MODE,
  FONT_MODE,
  TRAILING_MODE,
  DEFAULT_LONG_CITATION,
  DEFAULT_NORMAL_CITATION,
} from './citationFormat.js';

function source(fields) {
  const out = { fields: {} };
  for (const [k, v] of Object.entries(fields)) out.fields[k] = { value: v };
  return out;
}

describe('citationFormat', () => {
  const s = source({
    title: '1900 US Census',
    author: 'US Gov',
    date: '1900',
    page: '23',
    publisher: 'NARA',
    repositoryName: 'FamilySearch',
    sourceReferenceNumber: 'T623',
    url: 'https://example.com/s/1',
  });

  it('renders normal-form citation with italic title and parens', () => {
    expect(formatCitation(s, CITATION_MODE.NORMAL)).toBe('(US Gov, *1900 US Census*, 1900, 23).');
  });

  it('renders long-form citation with period separator', () => {
    expect(formatCitation(s, CITATION_MODE.LONG)).toBe(
      'US Gov. *1900 US Census*. NARA. 1900. FamilySearch. T623. https://example.com/s/1.'
    );
  });

  it('honors bracketMode=none', () => {
    const cfg = { ...DEFAULT_NORMAL_CITATION, bracketMode: BRACKET_MODE.NONE };
    expect(formatCitation(s, CITATION_MODE.NORMAL, cfg)).toBe('US Gov, *1900 US Census*, 1900, 23.');
  });

  it('honors semicolon trailing', () => {
    const cfg = { ...DEFAULT_NORMAL_CITATION, trailingMode: TRAILING_MODE.SEMICOLON };
    expect(formatCitation(s, CITATION_MODE.NORMAL, cfg).endsWith(';')).toBe(true);
  });

  it('honors small-caps font on titles', () => {
    const cfg = { ...DEFAULT_LONG_CITATION, fontMode: FONT_MODE.SMALL_CAPS };
    expect(formatCitation(s, CITATION_MODE.LONG, cfg)).toContain('1900 US CENSUS');
  });

  it('returns empty string when disabled', () => {
    expect(formatCitation(s, CITATION_MODE.LONG, { ...DEFAULT_LONG_CITATION, enabled: false })).toBe('');
  });

  it('skips missing fields', () => {
    const sparse = source({ title: 'Record A' });
    expect(formatCitation(sparse, CITATION_MODE.LONG)).toBe('*Record A*.');
  });

  it('formatBibliography filters empty entries', () => {
    const entries = formatBibliography([s, source({})]);
    expect(entries).toHaveLength(1);
  });
});
