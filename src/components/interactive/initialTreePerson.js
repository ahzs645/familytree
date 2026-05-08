export function resolveInitialTreePersonId({ persons = [], activeId = null, startPerson = null, largestRoot = null } = {}) {
  const personIds = new Set(persons.map((person) => person?.recordName).filter(Boolean));
  if (activeId && personIds.has(activeId)) return activeId;
  if (startPerson?.recordName && personIds.has(startPerson.recordName)) return startPerson.recordName;
  if (largestRoot?.recordName && personIds.has(largestRoot.recordName)) return largestRoot.recordName;
  return persons[0]?.recordName || null;
}
