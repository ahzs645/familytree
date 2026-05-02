import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_TABS,
  templateFieldsForType,
  templateRecordLabel,
} from './templateDefinitions.js';

describe('templateDefinitions', () => {
  it('exposes source and place relation editors with reference fields', () => {
    expect(TEMPLATE_TABS.map((tab) => tab.id)).toContain('SourceTemplateKeyRelation');
    expect(TEMPLATE_TABS.map((tab) => tab.id)).toContain('PlaceTemplateKeyRelation');

    expect(templateFieldsForType('SourceTemplateKeyRelation')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'template', referenceType: 'SourceTemplate' }),
        expect.objectContaining({ id: 'templateKey', referenceType: 'SourceTemplateKey' }),
        expect.objectContaining({ id: 'longCitationEnabled' }),
        expect.objectContaining({ id: 'shortCitationOrder' }),
      ]),
    );

    expect(templateFieldsForType('PlaceTemplateKeyRelation')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'template', referenceType: 'PlaceTemplate' }),
        expect.objectContaining({ id: 'templateKey', referenceType: 'PlaceTemplateKey' }),
        expect.objectContaining({ id: 'citationMode' }),
        expect.objectContaining({ id: 'citationBracketMode' }),
      ]),
    );
  });

  it('labels template-key relations by template and key references', () => {
    expect(templateRecordLabel({
      recordName: 'rel-1',
      recordType: 'SourceTemplateKeyRelation',
      fields: {
        template: { value: 'source-template-1---SourceTemplate', type: 'REFERENCE' },
        templateKey: { value: 'source-key-1---SourceTemplateKey', type: 'REFERENCE' },
      },
    })).toBe('source-template-1 / source-key-1');
  });
});
