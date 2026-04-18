/**
 * Convert MacFamilyTree internal type identifiers (conclusionType, templateID,
 * record classes) into human-readable labels.
 *
 * Examples:
 *   "UniqueID_PersonEvent_Birth---ConclusionPersonEventType" → "Birth"
 *   "SourceTemplate_AddressBook"                             → "Address Book"
 *   "PlaceTemplateKeyRelation"                               → "Place Template Key Relation"
 *   "ChangeLogSubEntry"                                      → "Change Log Sub Entry"
 */

const RECORD_LABELS = {
  Person: 'Persons',
  Family: 'Families',
  Place: 'Places',
  Source: 'Sources',
  PersonEvent: 'Person events',
  FamilyEvent: 'Family events',
  Media: 'Media items',
  SourceRepository: 'Source repositories',
  ChangeLogEntry: 'Change-log entries',
  ChangeLogSubEntry: 'Change-log sub-entries',
  PlaceTemplate: 'Place templates',
  PlaceTemplateKey: 'Place template keys',
  PlaceTemplateKeyRelation: 'Place template key relations',
  SourceTemplate: 'Source templates',
  SourceTemplateKey: 'Source template keys',
  SourceTemplateKeyRelation: 'Source template key relations',
  PersonFactType: 'Person fact types',
  PersonEventType: 'Person event types',
  FamilyEventType: 'Family event types',
  AdditionalNameType: 'Additional name types',
  Label: 'Labels',
  ToDo: 'ToDos',
  Story: 'Stories',
  Bookmark: 'Bookmarks',
};

function splitCamel(s) {
  return String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function humanizeType(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // Strip the trailing "---ConclusionXxxType" suffix used on event references.
  const head = s.replace(/---.*$/, '');

  // UniqueID_PersonEvent_Birth → Birth
  const eventMatch = head.match(
    /^UniqueID_(?:Person|Family)Event_(.+)$/
  ) || head.match(/^UniqueID_(?:Person|Family)Fact_(.+)$/);
  if (eventMatch) return splitCamel(eventMatch[1]);

  // "SourceTemplate_AddressBook" → "Address Book"
  const tplMatch = head.match(
    /^(?:Source|Place)Template(?:Key)?_(.+)$/
  );
  if (tplMatch) return splitCamel(tplMatch[1].replace(/_/g, ' '));

  // Known record-type class names
  if (RECORD_LABELS[head]) return RECORD_LABELS[head];

  // Fallback: strip UniqueID_ and split camel case
  return splitCamel(head.replace(/^UniqueID_/, '').replace(/_/g, ' '));
}

export default humanizeType;
