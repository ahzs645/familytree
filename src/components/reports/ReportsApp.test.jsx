import { describe, expect, it } from 'vitest';
import {
  REPORT_BUILDERS,
  applyReportContentOptions,
  createSavedReportPayload,
  defaultOptionsForBuilder,
  getReportBuilderCategories,
  stateFromSavedReport,
} from './ReportsApp.jsx';

describe('ReportsApp report configuration', () => {
  it('registers the parity report builders with subject metadata', () => {
    const byId = new Map(REPORT_BUILDERS.map((builder) => [builder.id, builder]));

    expect(byId.get('person-events')).toMatchObject({
      label: 'Person Events Report',
      needsSubject: true,
      subjectType: 'Person',
      subjectLabel: 'Person',
    });
    expect(byId.get('story-report')).toMatchObject({
      label: 'Story Report',
      needsSubject: true,
      subjectType: 'Story',
      subjectLabel: 'Story',
    });
    expect(byId.get('kinship-report')).toMatchObject({
      label: 'Kinship Report',
      needsSubject: true,
      needsSecondSubject: true,
      secondSubjectType: 'Person',
    });
    expect(byId.get('gia-pha-lineage')).toMatchObject({
      label: 'Gia phả / Family Lineage Report',
      needsSubject: true,
      subjectType: 'Person',
      usesGenerations: true,
      defaultOptions: { generations: 5 },
    });
  });

  it('creates saved report payloads with second subject and full options', () => {
    const payload = createSavedReportPayload({
      name: 'Kinship check',
      builderId: 'kinship-report',
      targetId: 'person-a',
      secondTargetId: 'person-b',
      options: { includeHeader: false },
      pageStyle: { paginate: true, background: 'sepia', pageSize: 'a4', orientation: 'landscape', margin: 72 },
      themeId: 'sepia',
    });

    expect(payload).toMatchObject({
      name: 'Kinship check',
      builderId: 'kinship-report',
      targetRecordName: 'person-a',
      targetRecordType: 'Person',
      secondTargetRecordName: 'person-b',
      secondTargetRecordType: 'Person',
      options: { includeHeader: false },
      pageStyle: { paginate: true, background: 'sepia', pageSize: 'a4', orientation: 'landscape', margin: 72 },
      themeId: 'sepia',
    });
  });

  it('restores saved report state with defaults for missing options', () => {
    const state = stateFromSavedReport({
      builderId: 'ancestor-narrative',
      targetRecordName: 'person-a',
      secondTargetRecordName: 'person-b',
      options: { includeHeader: false },
      pageStyle: { margin: 60 },
      themeId: 'soft',
    });

    expect(state).toMatchObject({
      builderId: 'ancestor-narrative',
      targetId: 'person-a',
      secondTargetId: 'person-b',
      options: { includeHeader: false, generations: 5 },
      pageStyle: { paginate: false, background: 'none', pageSize: 'letter', orientation: 'portrait', margin: 60 },
      themeId: 'soft',
    });
    expect(defaultOptionsForBuilder('register')).toMatchObject({ includeHeader: true, generations: 4 });
  });

  it('can suppress the generated report header', () => {
    const report = {
      title: 'Test Report',
      blocks: [
        { kind: 'title', level: 1, text: 'Test Report' },
        { kind: 'paragraph', text: 'Body' },
      ],
    };

    expect(applyReportContentOptions(report, { includeHeader: false }).blocks).toEqual([{ kind: 'paragraph', text: 'Body' }]);
    expect(applyReportContentOptions(report, { includeHeader: true }).blocks).toHaveLength(2);
  });

  it('groups report builders for the report library', () => {
    const groups = getReportBuilderCategories(REPORT_BUILDERS);
    const names = groups.map((group) => group.name);

    expect(names).toContain('Person Reports');
    expect(names).toContain('Lineage Reports');
    expect(groups.find((group) => group.name === 'Analysis')?.builders.map((builder) => builder.id)).toContain('status-report');
  });
});
