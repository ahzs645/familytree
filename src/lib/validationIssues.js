const SEVERITY_RANK = Object.freeze({
  error: 50,
  high: 40,
  warning: 30,
  medium: 30,
  low: 20,
  info: 10,
});

const BLOCKING_SEVERITIES = new Set(['error']);

export function makeValidationIssue({
  scope = 'general',
  code = 'issue',
  severity = 'warning',
  message,
  line = 0,
  recordName = null,
  recordType = null,
  refs = [],
  repair = null,
  details = null,
} = {}) {
  const normalizedSeverity = normalizeSeverity(severity);
  return {
    id: [scope, code, recordType, recordName, line].filter(Boolean).join(':') || `${scope}:${code}`,
    scope,
    code,
    rule: code,
    severity: normalizedSeverity,
    line: Number(line) || 0,
    recordName,
    recordType,
    refs: Array.isArray(refs) ? refs.filter(Boolean) : [],
    message: message || code,
    blocking: BLOCKING_SEVERITIES.has(normalizedSeverity),
    ...(repair ? { repair } : {}),
    ...(details ? { details } : {}),
  };
}

export function normalizeIssue(issue, defaults = {}) {
  if (!issue || typeof issue !== 'object') {
    return makeValidationIssue({ ...defaults, message: String(issue || 'Unknown issue') });
  }
  return makeValidationIssue({
    ...defaults,
    ...issue,
    code: issue.code || issue.rule || defaults.code,
    message: issue.message || defaults.message,
  });
}

export function issueSeverityRank(severity) {
  return SEVERITY_RANK[normalizeSeverity(severity)] || 0;
}

export function compareIssues(a, b) {
  const severityDelta = issueSeverityRank(b?.severity) - issueSeverityRank(a?.severity);
  if (severityDelta) return severityDelta;
  const lineDelta = (a?.line || 0) - (b?.line || 0);
  if (lineDelta) return lineDelta;
  return String(a?.message || '').localeCompare(String(b?.message || ''));
}

export function hasBlockingIssues(issues) {
  return (issues || []).some((issue) => issue?.blocking || BLOCKING_SEVERITIES.has(normalizeSeverity(issue?.severity)));
}

function normalizeSeverity(severity) {
  const value = String(severity || 'warning').toLowerCase();
  if (SEVERITY_RANK[value]) return value;
  return 'warning';
}

