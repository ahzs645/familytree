/**
 * Navigation helpers for the interactive 3D tree.
 *
 * The Mac view exposes quick navigation around the focused person. Keep that
 * as pure data here so the overlay can change without touching Three.js.
 */

function personOption(person, relation, familyRecordName = null) {
  if (!person?.recordName) return null;
  return {
    id: person.recordName,
    familyRecordName,
    label: person.fullName || 'Unnamed person',
    relation,
  };
}

function pushUnique(target, seen, option) {
  if (!option || seen.has(option.id)) return;
  seen.add(option.id);
  target.push(option);
}

export function buildTreeNavigationOptions(context) {
  const sections = [
    { id: 'parents', label: 'Parents', options: [] },
    { id: 'partners', label: 'Partners', options: [] },
    { id: 'children', label: 'Children', options: [] },
  ];
  const seen = new Set([context?.selfSummary?.recordName].filter(Boolean));

  for (const family of context?.parents || []) {
    pushUnique(sections[0].options, seen, personOption(family.man, 'Father', family.family?.recordName));
    pushUnique(sections[0].options, seen, personOption(family.woman, 'Mother', family.family?.recordName));
  }
  for (const family of context?.families || []) {
    pushUnique(sections[1].options, seen, personOption(family.partner, 'Partner', family.family?.recordName));
    for (const child of family.children || []) {
      pushUnique(sections[2].options, seen, personOption(child, 'Child', family.family?.recordName));
    }
  }

  return sections.filter((section) => section.options.length > 0);
}

export function firstNavigationOption(context, sectionId) {
  return buildTreeNavigationOptions(context).find((section) => section.id === sectionId)?.options[0] || null;
}
