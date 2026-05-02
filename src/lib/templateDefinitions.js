import {
  PlaceCitationBracketMode,
  PlaceCitationMode,
  PlaceCitationTrailingMode,
} from '../models/constants.js';
import { readRef } from './schema.js';
import { humanizeType } from '../utils/humanizeType.js';

export const TEMPLATE_TABS = [
  { id: 'SourceTemplate', label: 'Source Templates', uuidPrefix: 'srctpl' },
  { id: 'SourceTemplateKey', label: 'Source Template Keys', uuidPrefix: 'srctplkey' },
  { id: 'SourceTemplateKeyRelation', label: 'Source Template Key Relations', uuidPrefix: 'srctplrel' },
  { id: 'PlaceTemplate', label: 'Place Templates', uuidPrefix: 'plctpl' },
  { id: 'PlaceTemplateKey', label: 'Place Template Keys', uuidPrefix: 'plctplkey' },
  { id: 'PlaceTemplateKeyRelation', label: 'Place Template Key Relations', uuidPrefix: 'plctplrel' },
  { id: 'ConclusionPersonEventType', label: 'Person Event Types', uuidPrefix: 'cpet' },
  { id: 'ConclusionFamilyEventType', label: 'Family Event Types', uuidPrefix: 'cfet' },
  { id: 'ConclusionPersonFactType', label: 'Person Fact Types', uuidPrefix: 'cpft' },
  { id: 'ConclusionAdditionalNameType', label: 'Additional Name Types', uuidPrefix: 'cant' },
];

export const BASE_TEMPLATE_FIELDS = [
  { id: 'name', label: 'Name' },
  { id: 'typeName', label: 'Type name' },
  { id: 'title', label: 'Display title' },
  { id: 'order', label: 'Order', type: 'number' },
  { id: 'description', label: 'Description', kind: 'textarea', rows: 3 },
];

const SOURCE_RELATION_FIELDS = [
  {
    id: 'template',
    label: 'Source template record',
    referenceType: 'SourceTemplate',
    hint: 'Record id of the SourceTemplate this field belongs to.',
  },
  {
    id: 'templateKey',
    label: 'Source template key record',
    referenceType: 'SourceTemplateKey',
    hint: 'Record id of the SourceTemplateKey used for this ordered field.',
  },
  { id: 'order', label: 'Field order', type: 'number' },
  { id: 'isTitleComponent', label: 'Title component', kind: 'select', type: 'number', options: yesNoOptions() },
  { id: 'isDateForDisplayComponent', label: 'Date display component', kind: 'select', type: 'number', options: yesNoOptions() },
  { id: 'longCitationEnabled', label: 'Use in long citation', kind: 'select', type: 'number', options: yesNoOptions() },
  { id: 'longCitationOrder', label: 'Long citation order', type: 'number' },
  { id: 'shortCitationEnabled', label: 'Use in short citation', kind: 'select', type: 'number', options: yesNoOptions() },
  { id: 'shortCitationOrder', label: 'Short citation order', type: 'number' },
];

const PLACE_RELATION_FIELDS = [
  {
    id: 'template',
    label: 'Place template record',
    referenceType: 'PlaceTemplate',
    hint: 'Record id of the PlaceTemplate this field belongs to.',
  },
  {
    id: 'templateKey',
    label: 'Place template key record',
    referenceType: 'PlaceTemplateKey',
    hint: 'Record id of the PlaceTemplateKey used for this ordered field.',
  },
  { id: 'order', label: 'Field order', type: 'number' },
  { id: 'citationMode', label: 'Citation mode', kind: 'select', type: 'number', options: enumOptions(PlaceCitationMode) },
  {
    id: 'citationTrailingMode',
    label: 'Trailing separator',
    kind: 'select',
    type: 'number',
    options: enumOptions(PlaceCitationTrailingMode),
  },
  {
    id: 'citationBracketMode',
    label: 'Bracket style',
    kind: 'select',
    type: 'number',
    options: enumOptions(PlaceCitationBracketMode),
  },
];

export const TEMPLATE_FIELDS_BY_TYPE = {
  PlaceTemplate: [
    ...BASE_TEMPLATE_FIELDS,
    { id: 'countryIdentifier', label: 'Country (ISO)' },
    { id: 'localizeableNameKey', label: 'Localizable name key' },
    { id: 'citationFormat', label: 'Citation format', kind: 'textarea', rows: 2 },
  ],
  PlaceTemplateKey: [
    ...BASE_TEMPLATE_FIELDS,
    { id: 'internationalName', label: 'International name' },
    { id: 'localName', label: 'Local name' },
    { id: 'localizeableNameKey', label: 'Localizable name key' },
  ],
  PlaceTemplateKeyRelation: PLACE_RELATION_FIELDS,
  SourceTemplate: [
    ...BASE_TEMPLATE_FIELDS,
    { id: 'uniqueID', label: 'MacFamilyTree unique id' },
    { id: 'citationFormat', label: 'Citation format', kind: 'textarea', rows: 2 },
    { id: 'fullCitationFormat', label: 'Full citation format', kind: 'textarea', rows: 2 },
    { id: 'shortCitationFormat', label: 'Short citation format', kind: 'textarea', rows: 2 },
  ],
  SourceTemplateKey: [
    ...BASE_TEMPLATE_FIELDS,
    { id: 'internationalName', label: 'International name' },
    { id: 'placeholder', label: 'Placeholder' },
    { id: 'gedcomTag', label: 'GEDCOM tag' },
    { id: 'keyType', label: 'Key type', type: 'number' },
    { id: 'localizeableNameKey', label: 'Localizable name key' },
  ],
  SourceTemplateKeyRelation: SOURCE_RELATION_FIELDS,
};

export function templateFieldsForType(recordType) {
  return TEMPLATE_FIELDS_BY_TYPE[recordType] || BASE_TEMPLATE_FIELDS;
}

export function templateRecordLabel(record) {
  if (!record) return '';
  const fields = record.fields || {};
  return (
    fields.name?.value ||
    fields.title?.value ||
    fields.internationalName?.value ||
    fields.localName?.value ||
    relationLabel(record) ||
    humanizeType(fields.typeName?.value) ||
    humanizeType(record.recordName)
  );
}

function relationLabel(record) {
  if (!String(record.recordType || '').endsWith('TemplateKeyRelation')) return '';
  const templateId = readRef(record.fields?.template);
  const keyId = readRef(record.fields?.templateKey);
  return [templateId, keyId].filter(Boolean).join(' / ');
}

function yesNoOptions() {
  return [
    { value: '', label: '-' },
    { value: 0, label: 'No' },
    { value: 1, label: 'Yes' },
  ];
}

function enumOptions(definition) {
  return [
    { value: '', label: '-' },
    ...Object.entries(definition).map(([label, value]) => ({
      value,
      label: label.replace(/([a-z])([A-Z])/g, '$1 $2'),
    })),
  ];
}
