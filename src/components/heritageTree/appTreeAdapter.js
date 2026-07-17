import calcTree from 'relatives-tree';
import { getLocalDatabase } from '../../lib/LocalDatabase.js';
import { getAppPreferences } from '../../lib/appPreferences.js';
import { isPublicRecord } from '../../lib/privacy.js';
import { refToRecordName } from '../../lib/recordRef.js';
import { readField } from '../../lib/schema.js';
import { mediaAssetSrc } from '../../lib/mediaPresentation.js';
import { Gender, personSummary } from '../../models/index.js';

export const CW = 192;
const PX = 80;
const PY = 80;

export async function loadHeritageTreeData() {
  await getAppPreferences();
  const db = getLocalDatabase();
  const [{ records: personRecords }, { records: familyRecords }, { records: childRelations }, { records: placeRecords }] = await Promise.all([
    db.query('Person', { limit: 100000 }),
    db.query('Family', { limit: 100000 }),
    db.query('ChildRelation', { limit: 100000 }),
    db.query('Place', { limit: 100000 }),
  ]);

  const places = new Map(placeRecords.filter(isPublicRecord).map((record) => [record.recordName, placeLabel(record)]));
  const indis = {};
  const fams = {};

  await Promise.all(personRecords.filter(isPublicRecord).map(async (record) => {
    const summary = personSummary(record);
    const thumbnailId = summary?.thumbnail;
    let photoUrl = null;
    if (thumbnailId) {
      const asset = await db.getAsset(thumbnailId);
      photoUrl = mediaAssetSrc(asset) || (String(thumbnailId).startsWith('data:') ? thumbnailId : null);
    }
    const birthPlace = placeFromField(record, ['birthPlace', 'cached_birthPlace', 'cached_birthPlaceString'], places);
    const deathPlace = placeFromField(record, ['deathPlace', 'cached_deathPlace', 'cached_deathPlaceString'], places);
    indis[record.recordName] = {
      id: record.recordName,
      type: 'INDI',
      record,
      summary,
      name: summary?.fullName || 'No name recorded',
      given: summary?.firstName || '',
      surname: summary?.lastName || '',
      birth: summary?.birthDate || '',
      death: summary?.deathDate || '',
      place: birthPlace,
      deathPlace,
      sex: summary?.gender === Gender.Female ? 'F' : summary?.gender === Gender.Male ? 'M' : 'U',
      famc: [],
      fams: [],
      photoUrl,
    };
  }));

  for (const family of familyRecords.filter(isPublicRecord)) {
    const husb = refToRecordName(family.fields?.man?.value);
    const wife = refToRecordName(family.fields?.woman?.value);
    fams[family.recordName] = {
      id: family.recordName,
      type: 'FAM',
      husb: husb && indis[husb] ? husb : null,
      wife: wife && indis[wife] ? wife : null,
      chil: [],
    };
    if (fams[family.recordName].husb) indis[fams[family.recordName].husb].fams.push(family.recordName);
    if (fams[family.recordName].wife) indis[fams[family.recordName].wife].fams.push(family.recordName);
  }

  for (const relation of childRelations.filter(isPublicRecord)) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    const childId = refToRecordName(relation.fields?.child?.value);
    if (!familyId || !childId || !fams[familyId] || !indis[childId]) continue;
    if (!fams[familyId].chil.includes(childId)) fams[familyId].chil.push(childId);
    if (!indis[childId].famc.includes(familyId)) indis[childId].famc.push(familyId);
  }

  Object.values(indis).forEach((person) => {
    person.origin = originForPlace(person.place || person.deathPlace);
  });
  Object.keys(indis).forEach((id) => getHeritage(id, indis, fams));

  return { indis, fams };
}

export function layoutHeritageTree(data = {}, preferredRootId = null) {
  const { indis = {}, fams = {} } = data || {};
  if (Object.keys(indis).length === 0) return emptyResult(indis, fams);

  const individuals = Object.values(indis).filter((i) => !i.isDummy).map((i) => {
    let label = i.name || 'Unknown';
    const bYear = year(i.birth);
    const dYear = year(i.death);
    if (bYear || dYear) label += ` (${bYear} - ${dYear})`;
    const connCount = i.famc.length + i.fams.length;
    if (connCount === 0) label += ' [Disconnected]';
    return {
      id: i.id,
      name: label,
      sortName: i.summary?.fullNameForSorting || i.name || 'Unknown',
      searchText: [
        label,
        i.name,
        i.summary?.fullName,
        i.summary?.fullNameForSorting,
        i.given,
        i.surname,
      ].filter(Boolean).join(' '),
      connCount,
    };
  }).sort((a, b) => a.sortName.localeCompare(b.sortName) || b.connCount - a.connCount);

  const workingIndis = clonePeople(indis);
  const workingFams = cloneFamilies(fams);
  let dummyIndex = 1;
  Object.values(workingFams).forEach((fam) => {
    if ((fam.husb || fam.wife) && fam.chil.length === 0) {
      const dummyId = `DUMMY_${dummyIndex++}`;
      workingIndis[dummyId] = { id: dummyId, type: 'INDI', name: '', sex: 'U', famc: [fam.id], fams: [], isDummy: true };
      fam.chil.push(dummyId);
    }
  });

  const rtNodes = Object.values(workingIndis).map((i) => {
    const parents = [];
    const children = [];
    const spouses = [];
    const siblings = [];
    if (i.famc.length > 0) {
      const fam = workingFams[i.famc[0]];
      if (fam?.husb) parents.push({ id: fam.husb, type: 'blood' });
      if (fam?.wife) parents.push({ id: fam.wife, type: 'blood' });
      fam?.chil.forEach((cId) => {
        if (cId !== i.id) siblings.push({ id: cId, type: 'blood' });
      });
    }
    i.fams.forEach((fId) => {
      const fam = workingFams[fId];
      if (!fam || (fam.husb !== i.id && fam.wife !== i.id)) return;
      const spouseId = fam.husb === i.id ? fam.wife : fam.husb;
      if (spouseId) spouses.push({ id: spouseId, type: 'married' });
      fam.chil.forEach((cId) => children.push({ id: cId, type: 'blood' }));
    });
    return {
      id: i.id,
      gender: i.sex === 'F' ? 'female' : 'male',
      parents: dedup(parents),
      children: dedup(children),
      siblings: dedup(siblings),
      spouses: dedup(spouses),
    };
  });

  const defaultRoot = Object.values(indis)
    .filter((i) => !i.isDummy)
    .sort((a, b) => ((b.famc?.length || 0) + (b.fams?.length || 0)) - ((a.famc?.length || 0) + (a.fams?.length || 0)))[0];
  const validRootId = preferredRootId && indis[preferredRootId] && !indis[preferredRootId].isDummy ? preferredRootId : defaultRoot?.id;

  let tree;
  try {
    tree = calcTree(rtNodes, { rootId: validRootId });
  } catch {
    return { ...emptyResult(indis, fams), individuals, rootId: validRootId };
  }

  const realNodes = tree.nodes.filter((n) => workingIndis[n.id] && !workingIndis[n.id].isDummy);
  if (realNodes.length === 0) return { ...emptyResult(indis, fams), individuals, rootId: validRootId };

  const minTop = Math.min(...realNodes.map((n) => n.top));
  const minLeft = Math.min(...realNodes.map((n) => n.left));
  let rtMaxGen = 1;
  const X_UNIT = 130;
  const Y_UNIT = 160;
  const mapX = (val) => (val - minLeft) * X_UNIT + PX;
  const mapY = (val) => (val - minTop) * Y_UNIT + PY;
  const renderedIds = new Set(realNodes.map((n) => n.id));

  const nodes = realNodes.map((rtn) => {
    const i = indis[rtn.id];
    if (!i) return null;
    const gen = Math.floor((rtn.top - minTop) / 2) + 1;
    if (gen > rtMaxGen) rtMaxGen = gen;
    const centerX = mapX(rtn.left + 1);
    const centerY = mapY(rtn.top + 1);
    // Pedigree collapse (e.g. cousin marriages) makes relatives-tree place the
    // same person at several positions, so the person id alone is not unique.
    return { ...i, renderKey: `${rtn.id}@${rtn.left},${rtn.top}`, x: centerX - CW / 2, y: centerY - 45, h: 90, gen, hasHiddenRelations: hasHiddenRelations(i, fams, renderedIds, indis) };
  }).filter(Boolean);

  const dummyPoints = tree.nodes.filter((n) => workingIndis[n.id]?.isDummy).map((n) => ({ x: mapX(n.left + 1), y: mapY(n.top) }));
  const connectors = [];
  tree.connectors.forEach((c, idx) => {
    const rawPoints = Array.isArray(c) ? c : c.points;
    if (!rawPoints || rawPoints.some((val, i) => i % 2 !== 0 && val < minTop)) return;
    const pts = [];
    for (let i = 0; i < rawPoints.length; i += 2) pts.push({ x: mapX(rawPoints[i]), y: mapY(rawPoints[i + 1]) });
    let isMarriage = false;
    if (pts.length > 1 && pts.every((p) => p.y === pts[0].y)) {
      const lineY = pts[0].y;
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const leftNode = nodes.find((n) => Math.abs((n.x + CW / 2) - minX) < 10 && Math.abs((n.y + 45) - lineY) < 10);
      const rightNode = nodes.find((n) => Math.abs((n.x + CW / 2) - maxX) < 10 && Math.abs((n.y + 45) - lineY) < 10);
      if (leftNode && rightNode) isMarriage = leftNode.fams.some((fId) => rightNode.fams.includes(fId));
    }
    const isDummyLine = pts.some((p) => dummyPoints.some((dp) => Math.abs(p.x - dp.x) < 1 && Math.abs(p.y - dp.y) < 1));
    if (!isDummyLine) connectors.push({ id: idx, path: pts.map((p) => `${p.x},${p.y}`).join(' '), isMarriage });
  });

  const genBands = [];
  const genLabels = [];
  for (let i = 0; i < rtMaxGen; i++) {
    genLabels.push({ gen: i + 1, y: mapY(minTop + i * 2 + 1) - 45 });
    if (i < rtMaxGen - 1) genBands.push({ id: i, y: mapY(minTop + (i + 1) * 2) });
  }

  return { nodes, connectors, maxGen: rtMaxGen, individuals, rootId: validRootId, genBands, genLabels, indis, fams };
}

function placeFromField(record, aliases, places) {
  const value = readField(record, aliases, '');
  const ref = refToRecordName(value);
  if (ref && places.has(ref)) return places.get(ref);
  return typeof value === 'string' ? value : '';
}

function placeLabel(record) {
  return readField(record, ['cached_standardizedLocationString', 'cached_normalLocationString', 'cached_normallocationString', 'placeName', 'name'], '');
}

function originForPlace(placeValue = '') {
  const pl = String(placeValue).toLowerCase();
  if (!pl) return '';
  if (pl.includes('rusyn') || pl.includes('ruthenia') || pl.includes('carpatho')) return 'rusyn';
  if (pl.includes('poland')) return 'polish';
  if (pl.includes('czech')) return 'czech';
  if (pl.includes('slovakia')) return 'slovak';
  if (pl.includes('austria')) return 'austrian';
  if (pl.includes('lebanon')) return 'lebanese';
  if (pl.includes('germany') || pl.includes('deutschland')) return 'german';
  if (pl.includes('france')) return 'french';
  if (pl.includes('switzerland') || pl.includes('zurich')) return 'swiss';
  if (pl.includes('ireland')) return 'irish';
  if (pl.includes('united states') || pl.includes('usa') || pl.includes('america')) return 'american';
  if (pl.includes('england') || pl.includes('united kingdom') || pl.includes('britain')) return 'english';
  if (pl.includes('scotland')) return 'scottish';
  if (pl.includes('italy')) return 'italian';
  if (pl.includes('spain')) return 'spanish';
  if (pl.includes('canada')) return 'canadian';
  if (pl.includes('mexico')) return 'mexican';
  if (pl.includes('ukraine')) return 'ukrainian';
  if (pl.includes('russia')) return 'russian';
  if (pl.includes('china')) return 'chinese';
  if (pl.includes('syria')) return 'syrian';
  if (pl.includes('hungary')) return 'hungarian';
  if (pl.includes('turkey') || pl.includes('turkiye')) return 'turkish';
  return 'generic';
}

function getHeritage(id, indis, fams, depth = 0) {
  if (depth > 50) return { untraced: 100 };
  const person = indis[id];
  if (!person) return { untraced: 100 };
  if (person.heritage) return person.heritage;
  let org = person.origin || 'untraced';
  if (org === 'american' || org === 'canadian' || org === 'generic') org = 'untraced';
  if (person.famc.length === 0) {
    person.heritage = { [org]: 100 };
    return person.heritage;
  }
  const fam = fams[person.famc[0]];
  const dadH = fam?.husb ? getHeritage(fam.husb, indis, fams, depth + 1) : { untraced: 100 };
  const momH = fam?.wife ? getHeritage(fam.wife, indis, fams, depth + 1) : { untraced: 100 };
  const combined = {};
  for (const [o, pct] of Object.entries(dadH)) combined[o] = (combined[o] || 0) + pct / 2;
  for (const [o, pct] of Object.entries(momH)) combined[o] = (combined[o] || 0) + pct / 2;
  person.heritage = combined;
  return combined;
}

function hasHiddenRelations(person, fams, renderedIds, indis) {
  if (person.famc.length > 0) {
    const fam = fams[person.famc[0]];
    if (fam?.husb && indis[fam.husb] && !renderedIds.has(fam.husb)) return true;
    if (fam?.wife && indis[fam.wife] && !renderedIds.has(fam.wife)) return true;
  }
  return person.fams.some((fId) => {
    const fam = fams[fId];
    if (!fam) return false;
    const spouseId = fam.husb === person.id ? fam.wife : fam.husb;
    if (spouseId && indis[spouseId] && !renderedIds.has(spouseId)) return true;
    return fam.chil.some((cId) => indis[cId] && !renderedIds.has(cId));
  });
}

function clonePeople(indis) {
  return Object.fromEntries(Object.entries(indis).map(([id, person]) => [id, { ...person, famc: [...person.famc], fams: [...person.fams] }]));
}

function cloneFamilies(fams) {
  return Object.fromEntries(Object.entries(fams).map(([id, fam]) => [id, { ...fam, chil: [...fam.chil] }]));
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function year(value) {
  return String(value || '').match(/\d{4}/)?.[0] || '';
}

function emptyResult(indis = {}, fams = {}) {
  return { nodes: [], connectors: [], maxGen: 0, individuals: [], rootId: null, genBands: [], genLabels: [], indis, fams };
}
