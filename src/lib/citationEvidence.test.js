import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_CONFIDENCE,
  evidenceSummary,
  readCitationEvidence,
  writeCitationEvidenceFields,
} from './citationEvidence.js';

describe('citationEvidence', () => {
  it('normalizes citation evidence fields from a source relation', () => {
    const rel = {
      fields: {
        page: { value: '42' },
        text: { value: 'Short citation' },
        excerpt: { value: 'Transcript' },
        evidenceConfidence: { value: 'high' },
        contributor: { value: 'A. Researcher' },
      },
    };

    expect(readCitationEvidence(rel)).toEqual({
      page: '42',
      citation: 'Short citation',
      transcription: 'Transcript',
      confidence: EVIDENCE_CONFIDENCE.HIGH,
      attribution: 'A. Researcher',
    });
  });

  it('writes compatibility aliases used by existing source relation renderers', () => {
    const fields = writeCitationEvidenceFields({}, {
      page: '12',
      citation: 'Civil record',
      transcription: 'Full text',
      confidence: 'medium',
      attribution: 'AJ',
    });

    expect(fields.page.value).toBe('12');
    expect(fields.citation.value).toBe('Civil record');
    expect(fields.text.value).toBe('Civil record');
    expect(fields.transcription.value).toBe('Full text');
    expect(fields.excerpt.value).toBe('Full text');
    expect(fields.confidence.value).toBe('medium');
    expect(fields.evidenceConfidence.value).toBe('medium');
    expect(fields.attribution.value).toBe('AJ');
    expect(fields.contributor.value).toBe('AJ');
  });

  it('summarizes evidence metadata for compact UI display', () => {
    expect(evidenceSummary({
      fields: {
        page: { value: '12' },
        transcription: { value: 'Full text' },
        confidence: { value: 'medium' },
        attribution: { value: 'AJ' },
      },
    })).toBe('p. 12 · Medium confidence · transcription · by AJ');
  });
});
