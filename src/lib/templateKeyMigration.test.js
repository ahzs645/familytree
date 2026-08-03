import { describe, expect, it } from 'vitest';
import { mergeTemplateValues, summarizeTemplateKeyUsage, templateKeyMigrationConfig } from './templateKeyMigration.js';

describe('template key migration logic', () => {
  it('counts distinct owning records and templates', () => {
    const values = [
      { fields: { source: { value: { recordName: 'source-1' } } } },
      { fields: { source: { value: { recordName: 'source-1' } } } },
      { fields: { source: { value: { recordName: 'source-2' } } } },
    ];
    const relations = [
      { fields: { template: { value: { recordName: 'template-1' } } } },
      { fields: { template: { value: { recordName: 'template-2' } } } },
    ];
    expect(summarizeTemplateKeyUsage(values, relations, 'source')).toEqual({
      valueCount: 3,
      recordCount: 2,
      relationCount: 2,
      templateCount: 2,
      total: 5,
    });
  });

  it('preserves distinct colliding values without duplicating identical ones', () => {
    expect(mergeTemplateValues('Archive 12', 'Page 4')).toBe('Archive 12\nPage 4');
    expect(mergeTemplateValues('Archive 12', 'Archive 12')).toBe('Archive 12');
    expect(mergeTemplateValues('', 'Page 4')).toBe('Page 4');
  });

  it('maps source and place key record types to their side-record shapes', () => {
    expect(templateKeyMigrationConfig('SourceTemplateKey')).toMatchObject({ valueType: 'SourceKeyValue', ownerField: 'source' });
    expect(templateKeyMigrationConfig('PlaceTemplateKey')).toMatchObject({ valueType: 'PlaceKeyValue', ownerField: 'place' });
  });
});
