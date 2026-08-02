import { describe, expect, it } from 'vitest';
import { EventRecord } from './EventRecord.js';

describe('EventRecord extended fields', () => {
  it('reads canonical fields and the authority compatibility alias', () => {
    const event = new EventRecord({
      recordName: 'event-1',
      recordType: 'PersonEvent',
      fields: {
        time: { value: '14:35' },
        address: { value: '12 Registry Road' },
        authority: { value: 'County Registrar' },
        cause: { value: 'Pneumonia' },
      },
    });

    expect(event.time()).toBe('14:35');
    expect(event.address()).toBe('12 Registry Road');
    expect(event.agency()).toBe('County Registrar');
    expect(event.cause()).toBe('Pneumonia');
  });
});
