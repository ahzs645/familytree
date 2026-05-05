import { readRef } from './schema.js';

export const MILK_KINSHIP_RECORD_TYPE = 'MilkKinship';

export function milkKinshipSummary(record, personById = new Map()) {
  if (!record) return null;
  const nursingMotherId = readRef(record.fields?.nursingMother);
  const milkFatherId = readRef(record.fields?.milkFather);
  const childId = readRef(record.fields?.child);
  return {
    recordName: record.recordName,
    nursingMotherId,
    milkFatherId,
    childId,
    nursingMotherName: personById.get(nursingMotherId)?.fullName || nursingMotherId || '',
    milkFatherName: personById.get(milkFatherId)?.fullName || milkFatherId || '',
    childName: personById.get(childId)?.fullName || childId || '',
    startDate: record.fields?.startDate?.value || '',
    endDate: record.fields?.endDate?.value || '',
    notes: record.fields?.notes?.value || '',
    isActive: record.fields?.isActive?.value !== false,
  };
}

export function roleForMilkKinship(summary, personId) {
  if (!summary || !personId) return 'child';
  if (summary.childId === personId) return 'child';
  if (summary.nursingMotherId === personId) return 'nursingMother';
  if (summary.milkFatherId === personId) return 'milkFather';
  return 'child';
}
