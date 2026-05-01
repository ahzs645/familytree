export const EVIDENCE_CONFIDENCE = Object.freeze({
  UNKNOWN: 'unknown',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
});

export const EVIDENCE_CONFIDENCE_LABELS = Object.freeze({
  [EVIDENCE_CONFIDENCE.UNKNOWN]: '—',
  [EVIDENCE_CONFIDENCE.LOW]: 'Low',
  [EVIDENCE_CONFIDENCE.MEDIUM]: 'Medium',
  [EVIDENCE_CONFIDENCE.HIGH]: 'High',
});

export function readCitationEvidence(rel) {
  const fields = rel?.fields || {};
  return {
    page: readString(fields, 'page'),
    citation: readString(fields, 'citation') || readString(fields, 'text'),
    transcription: readString(fields, 'transcription') || readString(fields, 'excerpt'),
    confidence: normalizeConfidence(readString(fields, 'confidence') || readString(fields, 'evidenceConfidence')),
    attribution: readString(fields, 'attribution') || readString(fields, 'contributor'),
  };
}

export function writeCitationEvidenceFields(fields, draft = {}) {
  const next = { ...(fields || {}) };
  writeString(next, 'page', draft.page);
  writeString(next, 'citation', draft.citation);
  writeString(next, 'text', draft.citation);
  writeString(next, 'transcription', draft.transcription);
  writeString(next, 'excerpt', draft.transcription);
  writeString(next, 'attribution', draft.attribution);
  writeString(next, 'contributor', draft.attribution);
  const confidence = normalizeConfidence(draft.confidence);
  if (confidence !== EVIDENCE_CONFIDENCE.UNKNOWN) {
    next.confidence = { value: confidence, type: 'STRING' };
    next.evidenceConfidence = { value: confidence, type: 'STRING' };
  } else {
    delete next.confidence;
    delete next.evidenceConfidence;
  }
  return next;
}

export function evidenceSummary(rel) {
  const evidence = readCitationEvidence(rel);
  return [
    evidence.page && `p. ${evidence.page}`,
    evidence.confidence !== EVIDENCE_CONFIDENCE.UNKNOWN && `${EVIDENCE_CONFIDENCE_LABELS[evidence.confidence]} confidence`,
    evidence.transcription && 'transcription',
    evidence.attribution && `by ${evidence.attribution}`,
  ].filter(Boolean).join(' · ');
}

function readString(fields, key) {
  const value = fields?.[key]?.value;
  return value == null ? '' : String(value);
}

function writeString(fields, key, value) {
  const text = String(value || '').trim();
  if (text) fields[key] = { value: text, type: 'STRING' };
  else delete fields[key];
}

function normalizeConfidence(value) {
  return Object.values(EVIDENCE_CONFIDENCE).includes(value) ? value : EVIDENCE_CONFIDENCE.UNKNOWN;
}
