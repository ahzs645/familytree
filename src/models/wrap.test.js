import { describe, expect, it } from 'vitest';
import { lifeSpanLabel } from './wrap.js';
import { setActiveVitalDisplay } from '../lib/vitalFormat.js';

describe('lifeSpanLabel', () => {
  it('uses the parsed year for MacFamilyTree day-month-year dates', () => {
    expect(lifeSpanLabel({ birthDate: '10 04 2000' })).toBe('2000 –');
    expect(lifeSpanLabel({ birthDate: '20 10 1966', deathDate: '07 01 2020' })).toBe('1966 – 2020');
  });

  it('keeps death-only lifespan labels readable', () => {
    expect(lifeSpanLabel({ deathDate: '1989' })).toBe('? – 1989');
  });

  it('supports Islamic-friendly vital marker styles', () => {
    setActiveVitalDisplay({ markerStyle: 'symbols' });
    expect(lifeSpanLabel({ birthDate: '1901', deathDate: '1989' })).toBe('* 1901  ◆ 1989');

    setActiveVitalDisplay({ markerStyle: 'arabic-labels' });
    expect(lifeSpanLabel({ birthDate: '1901', deathDate: '1989' })).toBe('ميلاد 1901  وفاة 1989');

    setActiveVitalDisplay({ markerStyle: 'range' });
  });
});
