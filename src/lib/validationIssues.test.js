import { describe, expect, it } from 'vitest';
import {
  compareIssues,
  hasBlockingIssues,
  issueSeverityRank,
  makeValidationIssue,
  normalizeIssue,
} from './validationIssues.js';

describe('validationIssues', () => {
  it('creates a stable shared issue shape', () => {
    expect(makeValidationIssue({
      scope: 'gedcom-import',
      code: 'unresolved-xref',
      severity: 'warning',
      line: 12,
      message: 'Missing @I1@',
      refs: ['@I1@'],
    })).toMatchObject({
      id: 'gedcom-import:unresolved-xref:12',
      scope: 'gedcom-import',
      code: 'unresolved-xref',
      rule: 'unresolved-xref',
      severity: 'warning',
      line: 12,
      refs: ['@I1@'],
      blocking: false,
    });
  });

  it('normalizes legacy rule-based warnings', () => {
    expect(normalizeIssue({
      rule: 'death-before-birth',
      severity: 'high',
      recordName: 'p1',
      recordType: 'Person',
      message: 'bad date order',
    }, { scope: 'plausibility' })).toMatchObject({
      scope: 'plausibility',
      code: 'death-before-birth',
      rule: 'death-before-birth',
      severity: 'high',
      recordName: 'p1',
      recordType: 'Person',
    });
  });

  it('sorts blocking and high severity issues first', () => {
    const low = makeValidationIssue({ severity: 'low', message: 'low' });
    const high = makeValidationIssue({ severity: 'high', message: 'high' });
    const error = makeValidationIssue({ severity: 'error', message: 'error' });
    expect([low, error, high].sort(compareIssues).map((issue) => issue.severity)).toEqual(['error', 'high', 'low']);
    expect(issueSeverityRank('warning')).toBe(issueSeverityRank('medium'));
  });

  it('detects blocking issues', () => {
    expect(hasBlockingIssues([makeValidationIssue({ severity: 'warning' })])).toBe(false);
    expect(hasBlockingIssues([makeValidationIssue({ severity: 'error' })])).toBe(true);
  });
});

