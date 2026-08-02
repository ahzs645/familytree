import { describe, expect, it } from 'vitest';
import { mergeFamilySearchFurtherInformation, normalizeFurtherInformationQueue } from './familySearchSourceFolders.js';

describe('FamilySearch further-information queue', () => {
  it('retains seen state while counts are unchanged and resets it for new information', () => {
    const existing = [{ personId: 'P1', personName: 'Jane', notes: 1, memories: 0, discussions: 0, total: 1, signature: '1:0:0:1', seenAt: '2025-01-01' }];
    expect(mergeFamilySearchFurtherInformation(existing, [{ personId: 'P1', notes: 1, memories: 0, discussions: 0, total: 1, available: true }], { P1: 'Jane' })[0].seenAt)
      .toBe('2025-01-01');
    expect(mergeFamilySearchFurtherInformation(existing, [{ personId: 'P1', notes: 2, memories: 0, discussions: 0, total: 2, available: true }], { P1: 'Jane' })[0].seenAt)
      .toBeNull();
  });

  it('drops empty queue entries and normalizes numeric counts', () => {
    expect(normalizeFurtherInformationQueue([{ personId: 'P1', total: 0 }, { personId: 'P2', notes: '2', total: '2' }]))
      .toMatchObject([{ personId: 'P2', notes: 2, total: 2 }]);
  });
});
