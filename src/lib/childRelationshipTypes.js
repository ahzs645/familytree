const SECONDARY_RELATION_RE = /adopt|step|foster|guardian|ward|sealing|other|unknown/i;
const PRIMARY_RELATION_RE = /birth|biolog|natural|blood/i;

export function childRelationMarker(record) {
  const fields = record?.fields || {};
  return [
    fields.childRelationType?.value,
    fields.relationType?.value,
    fields.relationshipType?.value,
    fields.fatherRelationType?.value,
    fields.motherRelationType?.value,
  ].filter(Boolean).join(' ');
}

export function childRelationKind(record) {
  const marker = childRelationMarker(record);
  if (!marker) return 'primary';
  if (SECONDARY_RELATION_RE.test(marker)) return 'secondary';
  if (PRIMARY_RELATION_RE.test(marker)) return 'primary';
  return 'primary';
}

export function isPrimaryChildRelation(record) {
  return childRelationKind(record) === 'primary';
}

export function childRelationLabel(record) {
  const marker = childRelationMarker(record);
  return marker || 'Biological/natural';
}
