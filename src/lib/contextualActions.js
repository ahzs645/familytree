// @ts-check

const CHART_ACTIONS = [
  ['treeChart', 'tree'],
  ['hourglassChart', 'hourglass'],
  ['ancestorChart', 'ancestor'],
  ['descendantChart', 'descendant'],
  ['fanChart', 'fan'],
  ['relationshipChart', 'relationship'],
  ['genogramChart', 'genogram'],
  ['virtualTree', 'virtual'],
];

/** @param {string} path @param {Record<string, string | number | null | undefined>} params */
function query(path, params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') search.set(key, String(value));
  }
  return `${path}?${search.toString()}`;
}

/**
 * @param {{ personId?: string, familyId?: string, recordType?: string, recordId?: string }} [options]
 */
export function contextualActions({ personId = '', familyId = '', recordType = '', recordId = '' } = {}) {
  const subjectPerson = personId || '';
  const scopedType = recordType || (familyId ? 'Family' : 'Person');
  const scopedId = recordId || familyId || personId;
  const groups = [];

  if (subjectPerson) {
    groups.push({
      id: 'views',
      actions: [
        { id: 'interactiveTree', href: query('/tree', { person: subjectPerson }) },
        { id: 'timeline', href: query('/charts', { person: subjectPerson, type: 'timeline' }) },
        { id: 'map', href: query('/map', familyId ? { family: familyId } : { person: subjectPerson }) },
      ],
    });
    groups.push({
      id: 'charts',
      actions: CHART_ACTIONS.map(([id, type]) => ({ id, href: query('/charts', { person: subjectPerson, type }) })),
    });
    groups.push({
      id: 'reports',
      actions: [
        { id: 'personReport', href: query('/reports', { person: subjectPerson, type: 'person-summary' }) },
        { id: 'familyReport', href: query('/reports', { person: subjectPerson, type: 'family-group-sheet', family: familyId }) },
      ],
    });
  }

  const checks = [];
  if (scopedId && ['Person', 'Family'].includes(scopedType)) {
    checks.push({ id: 'plausibility', href: query('/plausibility', { kind: scopedType, recordId: scopedId }) });
  }
  if (scopedId && ['Person', 'Family', 'Source', 'Place'].includes(scopedType)) {
    checks.push({ id: 'duplicates', href: query('/duplicates', { kind: scopedType, recordId: scopedId, auto: 1 }) });
  }
  if (subjectPerson) checks.push({ id: 'webSearch', href: query('/web-search', { personId: subjectPerson }) });
  if (checks.length) groups.push({ id: 'checks', actions: checks });
  return groups;
}
