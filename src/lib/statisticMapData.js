/** MacFamilyTree-compatible statistic-map data source definitions. */
export const STATISTIC_MAP_SOURCES = Object.freeze([
  source('events-heat', 'eventsHeat', { mode: 'heat' }),
  source('events', 'events'),
  source('birth-heat', 'birthHeat', { mode: 'heat', eventKind: 'birth' }),
  source('birth', 'birth', { eventKind: 'birth' }),
  source('birth-living', 'birthLiving', { eventKind: 'birth', livingOnly: true }),
  source('burial-heat', 'burialHeat', { mode: 'heat', eventKind: 'burial' }),
  source('burial', 'burial', { eventKind: 'burial' }),
  source('death-heat', 'deathHeat', { mode: 'heat', eventKind: 'death' }),
  source('death', 'death', { eventKind: 'death' }),
  source('marriage-heat', 'marriageHeat', { mode: 'heat', eventKind: 'marriage' }),
  source('divorce-heat', 'divorceHeat', { mode: 'heat', eventKind: 'divorce' }),
  source('living-heat', 'livingHeat', { mode: 'heat', livingOnly: true }),
  source('name-distribution', 'nameDistribution', { colorBy: 'name', eventKind: 'birth' }),
  source('gender-distribution', 'genderDistribution', { colorBy: 'gender', eventKind: 'birth' }),
  source('average-age', 'averageAge', { aggregate: 'average-age', unit: 'years' }),
  source('average-age-at-death', 'averageAgeAtDeath', { aggregate: 'average-age-at-death', unit: 'years' }),
  source('father-first-child-age', 'fatherFirstChildAge', { aggregate: 'father-first-child-age', unit: 'years' }),
  source('mother-first-child-age', 'motherFirstChildAge', { aggregate: 'mother-first-child-age', unit: 'years' }),
  source('father-child-count', 'fatherChildCount', { aggregate: 'father-child-count', unit: 'children' }),
  source('mother-child-count', 'motherChildCount', { aggregate: 'mother-child-count', unit: 'children' }),
  source('man-marriage-age', 'manMarriageAge', { aggregate: 'man-marriage-age', unit: 'years' }),
  source('woman-marriage-age', 'womanMarriageAge', { aggregate: 'woman-marriage-age', unit: 'years' }),
]);

function source(id, labelKey, options = {}) {
  return { id, labelKey, ...options };
}

export function statisticEventMatches(event, sourceDefinition) {
  if (!event || !sourceDefinition) return false;
  if (sourceDefinition.livingOnly && Number.isFinite(event.subjectDeathYear)) return false;
  if (!sourceDefinition.eventKind) return true;
  return eventKind(event.conclusionType) === sourceDefinition.eventKind;
}

export function eventKind(value) {
  const text = String(value || '').toLowerCase();
  if (/birth|christen|bapti/.test(text)) return 'birth';
  if (/burial|buri|interment/.test(text)) return 'burial';
  if (/death|decease|crem/.test(text)) return 'death';
  if (/divorc|annul/.test(text)) return 'divorce';
  if (/marriage|married|wedding|matrimony/.test(text)) return 'marriage';
  return 'other';
}

/**
 * Convert a place-level Mac statistic into one averaged point per place.
 * Input events are the already-scoped, coordinate-bearing route view models.
 */
export function buildAggregateStatisticPoints(sourceId, {
  events = [],
  families = [],
  childRelations = [],
  nowYear = new Date().getFullYear(),
} = {}) {
  const sourceDefinition = STATISTIC_MAP_SOURCES.find((item) => item.id === sourceId);
  if (!sourceDefinition?.aggregate) return [];

  const familyById = new Map(families.map((family) => [family.recordName, family]));
  const birthByPerson = new Map();
  const deathByPerson = new Map();
  for (const event of events) {
    if (!event.subjectId || event.recordType !== 'PersonEvent') continue;
    const kind = eventKind(event.conclusionType);
    if (kind === 'birth' && !birthByPerson.has(event.subjectId)) birthByPerson.set(event.subjectId, event);
    if (kind === 'death' && !deathByPerson.has(event.subjectId)) deathByPerson.set(event.subjectId, event);
  }

  const childrenByFamily = new Map();
  for (const relation of childRelations) {
    const familyId = refName(relation?.fields?.family?.value);
    const childId = refName(relation?.fields?.child?.value);
    if (!familyId || !childId) continue;
    if (!childrenByFamily.has(familyId)) childrenByFamily.set(familyId, []);
    childrenByFamily.get(familyId).push(childId);
  }

  const measurements = [];
  const add = (placeEvent, value) => {
    if (!placeEvent || !Number.isFinite(value) || value < 0 || value > 130) return;
    measurements.push({ ...placeEvent, value });
  };

  if (sourceDefinition.aggregate === 'average-age') {
    for (const birth of birthByPerson.values()) {
      const death = deathByPerson.get(birth.subjectId);
      const end = finite(death?.year) ?? finite(birth.subjectDeathYear) ?? nowYear;
      const start = finite(birth.year) ?? finite(birth.subjectBirthYear);
      if (start != null) add(birth, end - start);
    }
  } else if (sourceDefinition.aggregate === 'average-age-at-death') {
    for (const death of deathByPerson.values()) {
      const birth = birthByPerson.get(death.subjectId);
      const start = finite(birth?.year) ?? finite(death.subjectBirthYear);
      if (start != null && finite(death.year) != null) add(death, death.year - start);
    }
  } else if (sourceDefinition.aggregate === 'man-marriage-age' || sourceDefinition.aggregate === 'woman-marriage-age') {
    const field = sourceDefinition.aggregate.startsWith('man-') ? 'man' : 'woman';
    for (const event of events) {
      if (eventKind(event.conclusionType) !== 'marriage' || event.recordType !== 'FamilyEvent') continue;
      const family = familyById.get(event.subjectId);
      const personId = refName(family?.fields?.[field]?.value);
      const birth = birthByPerson.get(personId);
      const start = finite(birth?.year);
      if (start != null && finite(event.year) != null) add(event, event.year - start);
    }
  } else {
    const role = sourceDefinition.aggregate.startsWith('father-') ? 'man' : 'woman';
    const isCount = sourceDefinition.aggregate.endsWith('child-count');
    for (const family of families) {
      const parentId = refName(family?.fields?.[role]?.value);
      const parentBirth = birthByPerson.get(parentId);
      const childIds = childrenByFamily.get(family.recordName) || [];
      if (!parentBirth || childIds.length === 0) continue;
      if (isCount) {
        add(parentBirth, childIds.length);
        continue;
      }
      const childYears = childIds.map((id) => finite(birthByPerson.get(id)?.year)).filter((year) => year != null);
      const firstChildYear = childYears.length ? Math.min(...childYears) : null;
      const parentYear = finite(parentBirth.year);
      if (firstChildYear != null && parentYear != null) add(parentBirth, firstChildYear - parentYear);
    }
  }

  return aggregateMeasurements(measurements, sourceDefinition.unit);
}

function aggregateMeasurements(measurements, unit) {
  const byPlace = new Map();
  for (const measurement of measurements) {
    const key = measurement.placeId;
    if (!key) continue;
    if (!byPlace.has(key)) byPlace.set(key, { ...measurement, values: [] });
    byPlace.get(key).values.push(measurement.value);
  }
  const raw = [...byPlace.values()].map((point) => ({
    id: `aggregate:${point.placeId}`,
    recordName: `aggregate:${point.placeId}`,
    recordType: 'PlaceAggregate',
    placeId: point.placeId,
    placeName: point.placeName,
    lat: point.lat,
    lng: point.lng,
    value: point.values.reduce((sum, value) => sum + value, 0) / point.values.length,
    sampleCount: point.values.length,
    unit,
  }));
  const values = raw.map((point) => point.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : min;
  return raw.map((point) => {
    const ratio = max === min ? 0.5 : (point.value - min) / (max - min);
    return {
      ...point,
      size: Math.round(18 + ratio * 28),
      color: valueColor(ratio),
    };
  }).sort((a, b) => b.value - a.value || a.placeName.localeCompare(b.placeName));
}

export function aggregateLegend(points) {
  if (!points?.length) return null;
  const values = points.map((point) => point.value);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    unit: points[0].unit,
  };
}

function valueColor(ratio) {
  if (ratio < 0.25) return '#2563eb';
  if (ratio < 0.5) return '#0f766e';
  if (ratio < 0.75) return '#d97706';
  return '#b91c1c';
}

function finite(value) {
  return Number.isFinite(value) ? value : null;
}

function refName(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.recordName || value.id || value.identifier || '';
}
