import { normalizeColor } from './schema.js';

const RECORD_TYPE_MAP = {
  additionalname: 'AdditionalName',
  associaterelation: 'AssociateRelation',
  changelogentry: 'ChangeLogEntry',
  changelogsubentry: 'ChangeLogSubEntry',
  childrelation: 'ChildRelation',
  coordinate: 'Coordinate',
  dnatestresult: 'DNATestResult',
  family: 'Family',
  familyevent: 'FamilyEvent',
  label: 'Label',
  labelrelation: 'LabelRelation',
  mediaaudio: 'MediaAudio',
  mediapdf: 'MediaPDF',
  mediapicture: 'MediaPicture',
  mediarelation: 'MediaRelation',
  mediaurl: 'MediaURL',
  mediavideo: 'MediaVideo',
  note: 'Note',
  person: 'Person',
  personevent: 'PersonEvent',
  personfact: 'PersonFact',
  persongroup: 'PersonGroup',
  persongrouprelation: 'PersonGroupRelation',
  place: 'Place',
  placedetail: 'PlaceDetail',
  placekeyvalue: 'PlaceKeyValue',
  placetemplate: 'PlaceTemplate',
  placetemplatekey: 'PlaceTemplateKey',
  placetemplatekeyrelation: 'PlaceTemplateKeyRelation',
  researchassistantquestioninfo: 'ResearchAssistantQuestionInfo',
  savedbook: 'SavedBook',
  savedchart: 'SavedChart',
  savedreport: 'SavedReport',
  savedview: 'SavedView',
  savedwebsite: 'SavedWebsite',
  scope: 'Scope',
  source: 'Source',
  sourcekeyvalue: 'SourceKeyValue',
  sourcerepository: 'SourceRepository',
  sourcerelation: 'SourceRelation',
  sourcetemplate: 'SourceTemplate',
  sourcetemplatekey: 'SourceTemplateKey',
  sourcetemplatekeyrelation: 'SourceTemplateKeyRelation',
  story: 'Story',
  storyrelation: 'StoryRelation',
  storysection: 'StorySection',
  storysectionrelation: 'StorySectionRelation',
  todo: 'ToDo',
  todorelation: 'ToDoRelation',
  treeinfo: 'FamilyTreeInformation',
};

const MEDIA_IDENTIFIER_FIELDS = [
  'audioFileIdentifier',
  'pdfFileIdentifier',
  'originalPictureFileIdentifier',
  'pictureFileIdentifier',
  'thumbnailFileIdentifier',
  'videoFileIdentifier',
];

function safeRows(query, sql, warnings) {
  try {
    return query(sql) || [];
  } catch (error) {
    warnings.push(`Skipped query: ${String(error?.message || error).slice(0, 180)}`);
    return [];
  }
}

function makeId(type, pk) {
  return `${String(type).toLowerCase()}-${pk}`;
}

function recordTypeFor(type) {
  return RECORD_TYPE_MAP[String(type).toLowerCase()] || type;
}

function field(value, type = 'STRING') {
  if (value === null || value === undefined) return undefined;
  return { value, type };
}

function cdTs(value) {
  if (value === null || value === undefined || value === '') return null;
  return Math.round(value * 1000 + 978307200000);
}

function hexToBase64(hex) {
  if (!hex) return null;
  const bytes = hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) || [];
  return bytesToBase64(new Uint8Array(bytes));
}

function bytesToBase64(bytes) {
  if (!bytes) return null;
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function mimeFromName(name = '') {
  const lower = name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'application/octet-stream';
}

function addUnmapped(fields, row, mappedColumns) {
  const unmapped = {};
  for (const [key, value] of Object.entries(row)) {
    if (mappedColumns.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    unmapped[key] = value;
  }
  if (Object.keys(unmapped).length) fields.mft_unmapped = field(JSON.stringify(unmapped));
}

function decodeArchivedPayload(base64, label, warnings) {
  if (!base64) return null;
  warnings.push(`${label} contains an archived Mac payload; original bytes were preserved for fixture-backed decoding.`);
  return {
    format: 'NSKeyedArchiver',
    status: 'preserved',
    decoded: null,
  };
}

function buildResourceIndex(resourceFiles = []) {
  const out = new Map();
  for (const resource of resourceFiles) {
    const path = resource.path || resource.name || '';
    const base = path.split('/').pop();
    if (base) out.set(base, resource);
    if (resource.sourceIdentifier) out.set(resource.sourceIdentifier, resource);
  }
  return out;
}

export function extractMFTPKGDataset({ query, sourceName = 'browser-import', resourceFiles = [] }) {
  const warnings = [];
  const records = {};
  const counts = {};
  const assets = [];
  const resourceIndex = buildResourceIndex(resourceFiles);

  const entityMap = { _names: {} };
  for (const row of safeRows(query, 'SELECT Z_ENT, Z_NAME FROM Z_PRIMARYKEY', warnings)) {
    entityMap[row.Z_NAME] = row.Z_ENT;
    entityMap._names[row.Z_ENT] = row.Z_NAME;
  }

  const baseObjectEntities = {};
  for (const row of safeRows(query, 'SELECT Z_PK, Z_ENT FROM ZBASEOBJECT', warnings)) {
    baseObjectEntities[row.Z_PK] = row.Z_ENT;
  }

  function ref(targetType, pk) {
    if (!pk) return undefined;
    const type = recordTypeFor(targetType);
    return field(`${makeId(type, pk)}---${type}`, 'REFERENCE');
  }

  function refByEntity(pk, ent) {
    if (!pk) return undefined;
    const entityName = entityMap._names?.[ent || baseObjectEntities[pk]];
    if (!entityName) return undefined;
    return ref(entityName, pk);
  }

  function addRecord(id, type, fields, created, modified) {
    records[id] = {
      recordType: type,
      recordName: id,
      fields,
      created: { timestamp: created || Date.now() },
      modified: { timestamp: modified || Date.now() },
    };
    counts[type] = (counts[type] || 0) + 1;
    return records[id];
  }

  function attachResourceAssets(mediaRecord, identifiers) {
    for (const identifier of identifiers.filter(Boolean)) {
      const resource =
        resourceIndex.get(identifier) ||
        [...resourceIndex.values()].find((r) => String(r.path || r.name || '').includes(identifier));
      if (!resource?.bytes) continue;
      const filename = (resource.path || resource.name || identifier).split('/').pop();
      const asset = {
        assetId: `asset-${mediaRecord.recordName}-${identifier}`,
        ownerRecordName: mediaRecord.recordName,
        sourceIdentifier: identifier,
        filename,
        mimeType: mimeFromName(filename),
        size: resource.bytes.byteLength ?? resource.bytes.length ?? 0,
        dataBase64: bytesToBase64(resource.bytes),
      };
      assets.push(asset);
      mediaRecord.fields.assetIds = field([...(mediaRecord.fields.assetIds?.value || []), asset.assetId], 'LIST');
    }
  }

  // Persons
  if (entityMap.Person) {
    for (const r of safeRows(query, `
      SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZGENDER, ZNAMEPREFIX, ZNAMESUFFIX, ZNAMEMIDDLE,
             ZCACHED_BIRTHDATE, ZCACHED_DEATHDATE, ZCACHED_FULLNAME, ZCACHED_FULLNAMEFORSORTING,
             ZUNIQUEID, ZISSTARTPERSON, ZISBOOKMARKED2, ZISPRIVATE,
             ZGEDCOMID, ZREFERENCENUMBERID, ZANCESTRALFILENUMBERID, ZFAMILYSEARCHID,
             ZTHUMBNAILFILEIDENTIFIER, ZCHANGEDATE, ZCREATIONDATE
      FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Person}
    `, warnings)) {
      const f = {};
      const mapped = new Set(Object.keys(r));
      if (r.ZFIRSTNAME) f.firstName = field(r.ZFIRSTNAME);
      if (r.ZLASTNAME) f.lastName = field(r.ZLASTNAME);
      if (r.ZGENDER !== null) f.gender = field(r.ZGENDER, 'INT64');
      if (r.ZNAMEPREFIX) f.namePrefix = field(r.ZNAMEPREFIX);
      if (r.ZNAMESUFFIX) f.nameSuffix = field(r.ZNAMESUFFIX);
      if (r.ZNAMEMIDDLE) f.nameMiddle = field(r.ZNAMEMIDDLE);
      if (r.ZCACHED_FULLNAME) f.cached_fullName = field(r.ZCACHED_FULLNAME);
      if (r.ZCACHED_FULLNAMEFORSORTING) f.cached_fullNameForSorting = field(r.ZCACHED_FULLNAMEFORSORTING);
      if (r.ZCACHED_BIRTHDATE) f.cached_birthDate = field(r.ZCACHED_BIRTHDATE);
      if (r.ZCACHED_DEATHDATE) f.cached_deathDate = field(r.ZCACHED_DEATHDATE);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZISSTARTPERSON) f.isStartPerson = field(r.ZISSTARTPERSON, 'INT64');
      if (r.ZISBOOKMARKED2) f.isBookmarked = field(r.ZISBOOKMARKED2, 'INT64');
      if (r.ZISPRIVATE) f.isPrivate = field(r.ZISPRIVATE, 'INT64');
      if (r.ZGEDCOMID) f.gedcomID = field(r.ZGEDCOMID);
      if (r.ZREFERENCENUMBERID) f.referenceNumberID = field(r.ZREFERENCENUMBERID);
      if (r.ZANCESTRALFILENUMBERID) f.ancestralFileNumberID = field(r.ZANCESTRALFILENUMBERID);
      if (r.ZFAMILYSEARCHID) f.familySearchID = field(r.ZFAMILYSEARCHID);
      if (r.ZTHUMBNAILFILEIDENTIFIER) f.thumbnailFileIdentifier = field(r.ZTHUMBNAILFILEIDENTIFIER);
      if (r.ZCHANGEDATE) f.mft_changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
      if (r.ZCREATIONDATE) f.mft_creationDate = field(cdTs(r.ZCREATIONDATE), 'TIMESTAMP');
      addUnmapped(f, r, mapped);
      addRecord(makeId('Person', r.Z_PK), 'Person', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }

  // Families
  if (entityMap.Family) {
    for (const r of safeRows(query, `
      SELECT Z_PK, ZMAN, ZWOMAN, ZCACHED_MARRIAGEDATE, ZUNIQUEID,
             ZCHANGEDATE, ZCREATIONDATE, ZGEDCOMID, ZISBOOKMARKED1, ZISPRIVATE
      FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Family}
    `, warnings)) {
      const f = {};
      if (r.ZMAN) f.man = ref('Person', r.ZMAN);
      if (r.ZWOMAN) f.woman = ref('Person', r.ZWOMAN);
      if (r.ZCACHED_MARRIAGEDATE) f.cached_marriageDate = field(r.ZCACHED_MARRIAGEDATE);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZGEDCOMID) f.gedcomID = field(r.ZGEDCOMID);
      if (r.ZISBOOKMARKED1) f.isBookmarked = field(r.ZISBOOKMARKED1, 'INT64');
      if (r.ZISPRIVATE) f.isPrivate = field(r.ZISPRIVATE, 'INT64');
      if (r.ZCHANGEDATE) f.mft_changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
      if (r.ZCREATIONDATE) f.mft_creationDate = field(cdTs(r.ZCREATIONDATE), 'TIMESTAMP');
      addRecord(makeId('Family', r.Z_PK), 'Family', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }

  for (const r of safeRows(query, 'SELECT Z_PK, ZFAMILY, ZCHILD FROM ZCHILDRELATION', warnings)) {
    const f = {};
    if (r.ZFAMILY) f.family = ref('Family', r.ZFAMILY);
    if (r.ZCHILD) f.child = ref('Person', r.ZCHILD);
    addRecord(makeId('ChildRelation', r.Z_PK), 'ChildRelation', f);
  }

  // Events/facts
  const conclusionJoin = 'LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.';
  if (entityMap.PersonEvent) {
    for (const r of safeRows(query, `
      SELECT e.Z_PK, e.ZPERSON1 as ZPERSON, e.ZDATE2 as ZDATE, e.ZASSIGNEDPLACE, e.ZUSERDESCRIPTION1,
             e.ZCAUSE, e.ZVALUE, e.ZUNIQUEID, e.ZCHANGEDATE, e.ZCREATIONDATE,
             c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
      FROM ZBASEOBJECT e ${conclusionJoin}ZCONCLUSIONTYPE2
      WHERE e.Z_ENT = ${entityMap.PersonEvent}
    `, warnings)) {
      const f = {};
      if (r.ZPERSON) f.person = ref('Person', r.ZPERSON);
      if (r.CTYPE_UID) f.conclusionType = field(`${r.CTYPE_UID}---${entityMap._names?.[r.CTYPE_ENT] || 'ConclusionPersonEventType'}`, 'REFERENCE');
      if (r.CONCLUSION_NAME) f.eventType = field(r.CONCLUSION_NAME);
      if (r.ZDATE) f.date = field(r.ZDATE);
      if (r.ZASSIGNEDPLACE) f.assignedPlace = ref('Place', r.ZASSIGNEDPLACE);
      if (r.ZUSERDESCRIPTION1) f.userDescription = field(r.ZUSERDESCRIPTION1);
      if (r.ZCAUSE) f.cause = field(r.ZCAUSE);
      if (r.ZVALUE) f.value = field(r.ZVALUE);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('PersonEvent', r.Z_PK), 'PersonEvent', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }
  if (entityMap.FamilyEvent) {
    for (const r of safeRows(query, `
      SELECT e.Z_PK, e.ZFAMILY, e.ZDATE1 as ZDATE, e.ZASSIGNEDPLACE, e.ZUNIQUEID,
             e.ZCHANGEDATE, e.ZCREATIONDATE,
             c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
      FROM ZBASEOBJECT e ${conclusionJoin}ZCONCLUSIONTYPE1
      WHERE e.Z_ENT = ${entityMap.FamilyEvent}
    `, warnings)) {
      const f = {};
      if (r.ZFAMILY) f.family = ref('Family', r.ZFAMILY);
      if (r.CTYPE_UID) f.conclusionType = field(`${r.CTYPE_UID}---${entityMap._names?.[r.CTYPE_ENT] || 'ConclusionFamilyEventType'}`, 'REFERENCE');
      if (r.CONCLUSION_NAME) f.eventType = field(r.CONCLUSION_NAME);
      if (r.ZDATE) f.date = field(r.ZDATE);
      if (r.ZASSIGNEDPLACE) f.assignedPlace = ref('Place', r.ZASSIGNEDPLACE);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('FamilyEvent', r.Z_PK), 'FamilyEvent', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }
  if (entityMap.PersonFact) {
    for (const r of safeRows(query, `
      SELECT e.Z_PK, e.ZPERSON2 as ZPERSON, e.ZVALUE, e.ZUSERDESCRIPTION2, e.ZUNIQUEID,
             e.ZCHANGEDATE, e.ZCREATIONDATE,
             c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
      FROM ZBASEOBJECT e ${conclusionJoin}ZCONCLUSIONTYPE3
      WHERE e.Z_ENT = ${entityMap.PersonFact}
    `, warnings)) {
      const f = {};
      if (r.ZPERSON) f.person = ref('Person', r.ZPERSON);
      if (r.CTYPE_UID) f.conclusionType = field(`${r.CTYPE_UID}---${entityMap._names?.[r.CTYPE_ENT] || 'ConclusionPersonFactType'}`, 'REFERENCE');
      if (r.CONCLUSION_NAME) f.factType = field(r.CONCLUSION_NAME);
      if (r.ZVALUE) f.value = field(r.ZVALUE);
      if (r.ZUSERDESCRIPTION2) f.description = field(r.ZUSERDESCRIPTION2);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('PersonFact', r.Z_PK), 'PersonFact', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }

  // Additional names
  for (const r of safeRows(query, `
    SELECT a.Z_PK, a.ZPERSON, a.ZFIRSTNAME, a.ZLASTNAME, a.ZNAMEMIDDLE, a.ZNAMEPREFIX,
           a.ZNAMESUFFIX, a.ZUNIQUEID, a.ZCREATIONDATE,
           c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
    FROM ZADDITIONALNAME a
    LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = a.ZCONCLUSIONTYPE
  `, warnings)) {
    const f = {};
    if (r.ZPERSON) f.person = ref('Person', r.ZPERSON);
    if (r.CTYPE_UID) f.conclusionType = field(`${r.CTYPE_UID}---${entityMap._names?.[r.CTYPE_ENT] || 'ConclusionAdditionalNameType'}`, 'REFERENCE');
    if (r.CONCLUSION_NAME) f.type = field(r.CONCLUSION_NAME);
    if (r.ZNAMEPREFIX) f.namePrefix = field(r.ZNAMEPREFIX);
    if (r.ZFIRSTNAME) f.firstName = field(r.ZFIRSTNAME);
    if (r.ZNAMEMIDDLE) f.nameMiddle = field(r.ZNAMEMIDDLE);
    if (r.ZLASTNAME) f.lastName = field(r.ZLASTNAME);
    if (r.ZNAMESUFFIX) f.nameSuffix = field(r.ZNAMESUFFIX);
    const display = [r.ZNAMEPREFIX, r.ZFIRSTNAME, r.ZNAMEMIDDLE, r.ZLASTNAME, r.ZNAMESUFFIX].filter(Boolean).join(' ');
    if (display) {
      f.name = field(display);
      f.value = field(display);
    }
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('AdditionalName', r.Z_PK), 'AdditionalName', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCREATIONDATE));
  }

  // Conclusion types
  for (const r of safeRows(query, `
    SELECT Z_PK, Z_ENT, ZTYPENAME, ZTYPENAMELOCALIZATIONKEY, ZUNIQUEID, ZISENABLED,
           ZISUSERCREATED, ZORDER, ZGEDCOMTAG, ZIDENTIFIER,
           ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME, ZINVERTEDTYPENAME, HEX(ZICONPNGDATA) as ICON_HEX
    FROM ZCONCLUSIONTYPE
  `, warnings)) {
    const entName = entityMap._names?.[r.Z_ENT] || 'ConclusionType';
    const id = r.ZUNIQUEID || makeId('ConclusionType', r.Z_PK);
    const f = {};
    if (r.ZTYPENAME) {
      f.typeName = field(r.ZTYPENAME);
      f.name = field(r.ZTYPENAME);
    }
    if (r.ZTYPENAMELOCALIZATIONKEY) f.typeNameLocalizationKey = field(r.ZTYPENAMELOCALIZATIONKEY);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    if (r.ZIDENTIFIER) f.identifier = field(r.ZIDENTIFIER);
    if (r.ZISENABLED !== null) f.isEnabled = field(r.ZISENABLED, 'INT64');
    if (r.ZISUSERCREATED !== null) f.isUserCreated = field(r.ZISUSERCREATED, 'INT64');
    if (r.ZORDER !== null) f.order = field(r.ZORDER, 'DOUBLE');
    if (r.ZGEDCOMTAG) f.gedcomTag = field(r.ZGEDCOMTAG);
    if (r.ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME) f.compatibleAssociatedContainerClassName = field(r.ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME);
    if (r.ZINVERTEDTYPENAME) f.invertedTypeName = field(r.ZINVERTEDTYPENAME);
    if (r.ICON_HEX) f.iconPNGData = field(hexToBase64(r.ICON_HEX));
    addRecord(id, entName, f);
  }

  // Labels and relations
  for (const r of safeRows(query, 'SELECT Z_PK, ZTITLE, ZCOLORCOMPONENTSSTRING, ZUNIQUEID FROM ZLABEL', warnings)) {
    const f = {};
    if (r.ZTITLE) {
      f.title = field(r.ZTITLE);
      f.name = field(r.ZTITLE);
    }
    if (r.ZCOLORCOMPONENTSSTRING) {
      f.colorComponentsString = field(r.ZCOLORCOMPONENTSSTRING);
      f.color = field(normalizeColor(r.ZCOLORCOMPONENTSSTRING));
    }
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('Label', r.Z_PK), 'Label', f);
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZLABEL, ZBASEOBJECT, ZUNIQUEID FROM ZLABELRELATION', warnings)) {
    const f = {};
    if (r.ZLABEL) f.label = ref('Label', r.ZLABEL);
    const target = refByEntity(r.ZBASEOBJECT);
    if (target) {
      const type = entityMap._names?.[baseObjectEntities[r.ZBASEOBJECT]];
      f.baseObject = target;
      f.target = target;
      if (type) {
        f.targetType = field(type);
        f[`target${type}`] = target;
      }
    }
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('LabelRelation', r.Z_PK), 'LabelRelation', f);
  }

  // Sources, source templates, key-values, repositories, source relations
  if (entityMap.Source) {
    for (const r of safeRows(query, `
      SELECT Z_PK, ZCACHED_TITLE, ZCACHED_DATE, ZTEXT, ZUNIQUEID, ZGEDCOMID, ZTEMPLATE,
             ZSOURCEREPOSITORY, ZCHANGEDATE, ZCREATIONDATE, ZISBOOKMARKED,
             ZAUTHORNAME, ZAGENCY, ZURLTOVENDOR
      FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Source}
    `, warnings)) {
      const f = {};
      if (r.ZCACHED_TITLE) { f.cached_title = field(r.ZCACHED_TITLE); f.title = field(r.ZCACHED_TITLE); }
      if (r.ZCACHED_DATE) f.cached_date = field(r.ZCACHED_DATE);
      if (r.ZTEXT) f.text = field(r.ZTEXT);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZGEDCOMID) f.gedcomID = field(r.ZGEDCOMID);
      if (r.ZTEMPLATE) f.template = ref('SourceTemplate', r.ZTEMPLATE);
      if (r.ZSOURCEREPOSITORY) f.sourceRepository = ref('SourceRepository', r.ZSOURCEREPOSITORY);
      if (r.ZISBOOKMARKED) f.isBookmarked = field(r.ZISBOOKMARKED, 'INT64');
      if (r.ZAUTHORNAME) f.author = field(r.ZAUTHORNAME);
      if (r.ZAGENCY) f.agency = field(r.ZAGENCY);
      if (r.ZURLTOVENDOR) f.urlToVendor = field(r.ZURLTOVENDOR);
      if (r.ZCHANGEDATE) f.mft_changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
      if (r.ZCREATIONDATE) f.mft_creationDate = field(cdTs(r.ZCREATIONDATE), 'TIMESTAMP');
      addRecord(makeId('Source', r.Z_PK), 'Source', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZNAME, ZUNIQUEID FROM ZSOURCETEMPLATE', warnings)) {
    const id = makeId('SourceTemplate', r.Z_PK);
    const f = {};
    if (r.ZNAME) f.name = field(r.ZNAME);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(id, 'SourceTemplate', f);
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZTYPE, ZGEDCOMTAG, ZLOCALIZEABLENAMEKEY, ZNAME, ZUNIQUEID FROM ZSOURCETEMPLATEKEY', warnings)) {
    const f = {};
    if (r.ZNAME) f.name = field(r.ZNAME);
    if (r.ZTYPE !== null) f.keyType = field(r.ZTYPE, 'INT64');
    if (r.ZGEDCOMTAG) f.gedcomTag = field(r.ZGEDCOMTAG);
    if (r.ZLOCALIZEABLENAMEKEY) f.localizeableNameKey = field(r.ZLOCALIZEABLENAMEKEY);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('SourceTemplateKey', r.Z_PK), 'SourceTemplateKey', f);
  }
  for (const r of safeRows(query, `
    SELECT Z_PK, ZTEMPLATE, ZTEMPLATEKEY, ZORDER, ZISDATEFORDISPLAYCOMPONENT, ZISTITLECOMPONENT,
           ZLONGCITATIONENABLED, ZLONGCITATIONORDER, ZSHORTCITATIONENABLED, ZSHORTCITATIONORDER, ZUNIQUEID
    FROM ZSOURCETEMPLATEKEYRELATION
  `, warnings)) {
    const f = {};
    if (r.ZTEMPLATE) f.template = ref('SourceTemplate', r.ZTEMPLATE);
    if (r.ZTEMPLATEKEY) f.templateKey = ref('SourceTemplateKey', r.ZTEMPLATEKEY);
    if (r.ZORDER !== null) f.order = field(r.ZORDER, 'DOUBLE');
    if (r.ZISDATEFORDISPLAYCOMPONENT !== null) f.isDateForDisplayComponent = field(r.ZISDATEFORDISPLAYCOMPONENT, 'INT64');
    if (r.ZISTITLECOMPONENT !== null) f.isTitleComponent = field(r.ZISTITLECOMPONENT, 'INT64');
    if (r.ZLONGCITATIONENABLED !== null) f.longCitationEnabled = field(r.ZLONGCITATIONENABLED, 'INT64');
    if (r.ZLONGCITATIONORDER !== null) f.longCitationOrder = field(r.ZLONGCITATIONORDER, 'DOUBLE');
    if (r.ZSHORTCITATIONENABLED !== null) f.shortCitationEnabled = field(r.ZSHORTCITATIONENABLED, 'INT64');
    if (r.ZSHORTCITATIONORDER !== null) f.shortCitationOrder = field(r.ZSHORTCITATIONORDER, 'DOUBLE');
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('SourceTemplateKeyRelation', r.Z_PK), 'SourceTemplateKeyRelation', f);
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZSOURCE, ZTEMPLATEKEY, ZVALUE, ZUNIQUEID FROM ZSOURCEKEYVALUE', warnings)) {
    const f = {};
    if (r.ZSOURCE) f.source = ref('Source', r.ZSOURCE);
    if (r.ZTEMPLATEKEY) f.templateKey = ref('SourceTemplateKey', r.ZTEMPLATEKEY);
    if (r.ZVALUE) f.value = field(r.ZVALUE);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('SourceKeyValue', r.Z_PK), 'SourceKeyValue', f);
  }
  if (entityMap.SourceRepository) {
    for (const r of safeRows(query, `
      SELECT Z_PK, ZNAME2, ZADDRESS, ZADDRESSLINE1, ZADDRESSLINE2, ZADDRESSLINE3, ZCITY, ZSTATE,
             ZCOUNTRY, ZPOSTALCODE, ZPHONE, ZEMAIL, ZFAX, ZWWW, ZTEXT3, ZUNIQUEID
      FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.SourceRepository}
    `, warnings)) {
      const f = {};
      if (r.ZNAME2) f.name = field(r.ZNAME2);
      if (r.ZADDRESS) f.address = field(r.ZADDRESS);
      if (r.ZADDRESSLINE1) f.addressLine1 = field(r.ZADDRESSLINE1);
      if (r.ZADDRESSLINE2) f.addressLine2 = field(r.ZADDRESSLINE2);
      if (r.ZADDRESSLINE3) f.addressLine3 = field(r.ZADDRESSLINE3);
      if (r.ZCITY) f.city = field(r.ZCITY);
      if (r.ZSTATE) f.state = field(r.ZSTATE);
      if (r.ZCOUNTRY) f.country = field(r.ZCOUNTRY);
      if (r.ZPOSTALCODE) f.postalCode = field(r.ZPOSTALCODE);
      if (r.ZPHONE) f.phone = field(r.ZPHONE);
      if (r.ZEMAIL) f.email = field(r.ZEMAIL);
      if (r.ZFAX) f.fax = field(r.ZFAX);
      if (r.ZWWW) { f.website = field(r.ZWWW); f.www = field(r.ZWWW); }
      if (r.ZTEXT3) f.note = field(r.ZTEXT3);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('SourceRepository', r.Z_PK), 'SourceRepository', f);
    }
  }
  if (entityMap.SourceRelation) {
    for (const r of safeRows(query, `
      SELECT Z_PK, ZSOURCE, ZSOURCECONTAINER, Z11_SOURCECONTAINER, ZUNIQUEID, ZPAGE, ZTEXT2, ZTEXT3,
             ZCHANGEDATE, ZCREATIONDATE
      FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.SourceRelation}
    `, warnings)) {
      const f = {};
      if (r.ZSOURCE) f.source = ref('Source', r.ZSOURCE);
      const target = refByEntity(r.ZSOURCECONTAINER, r.Z11_SOURCECONTAINER);
      if (target) f.target = target;
      const targetType = entityMap._names?.[r.Z11_SOURCECONTAINER];
      if (targetType) f.targetType = field(targetType);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZPAGE) f.page = field(r.ZPAGE);
      if (r.ZTEXT2) f.text = field(r.ZTEXT2);
      if (r.ZTEXT3) f.citation = field(r.ZTEXT3);
      addRecord(makeId('SourceRelation', r.Z_PK), 'SourceRelation', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }

  // Places and templates
  const placeKVs = {};
  for (const r of safeRows(query, 'SELECT ZPLACE, ZTEMPLATEKEY, ZVALUE FROM ZPLACEKEYVALUE', warnings)) {
    if (!placeKVs[r.ZPLACE]) placeKVs[r.ZPLACE] = {};
    placeKVs[r.ZPLACE][r.ZTEMPLATEKEY] = r.ZVALUE;
  }
  const tmplKeyRels = {};
  for (const r of safeRows(query, 'SELECT ZTEMPLATE, ZTEMPLATEKEY, ZORDER FROM ZPLACETEMPLATEKEYRELATION ORDER BY ZORDER', warnings)) {
    if (!tmplKeyRels[r.ZTEMPLATE]) tmplKeyRels[r.ZTEMPLATE] = [];
    tmplKeyRels[r.ZTEMPLATE].push({ keyPK: r.ZTEMPLATEKEY });
  }
  const keyNames = {};
  for (const r of safeRows(query, 'SELECT Z_PK, ZINTERNATIONALNAME, ZLOCALNAME, ZLOCALIZABLEINTERNATIONALNAMEKEY FROM ZPLACETEMPLATEKEY', warnings)) {
    keyNames[r.Z_PK] = r.ZINTERNATIONALNAME || r.ZLOCALNAME || r.ZLOCALIZABLEINTERNATIONALNAMEKEY || '';
  }
  if (entityMap.Place) {
    for (const r of safeRows(query, `
      SELECT Z_PK, ZCACHED_NORMALLOCATIONSTRING, ZCACHED_SHORTLOCATIONSTRING, ZCACHED_STANDARDIZEDLOCATIONSTRING,
             ZUNIQUEID, ZTEMPLATE1, ZCHANGEDATE, ZCREATIONDATE, ZGEONAMEID, ZALTERNATEPLACENAMES,
             ZGEDCOMID, ZREFERENCENUMBERID
      FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Place}
    `, warnings)) {
      const f = {};
      if (r.ZTEMPLATE1 && tmplKeyRels[r.ZTEMPLATE1] && placeKVs[r.Z_PK]) {
        for (const rel of tmplKeyRels[r.ZTEMPLATE1]) {
          const name = keyNames[rel.keyPK];
          const value = placeKVs[r.Z_PK][rel.keyPK];
          if (!name || !value) continue;
          const mapped = { Place: 'place', City: 'place', County: 'county', State: 'state', Country: 'country' }[name] || String(name).toLowerCase();
          if (!f[mapped]) f[mapped] = field(value);
        }
      }
      if (!f.place && r.ZCACHED_NORMALLOCATIONSTRING) f.place = field(r.ZCACHED_NORMALLOCATIONSTRING);
      if (r.ZCACHED_NORMALLOCATIONSTRING) {
        f.placeName = field(r.ZCACHED_NORMALLOCATIONSTRING);
        f.cached_normallocationString = field(r.ZCACHED_NORMALLOCATIONSTRING);
        f.cached_displayName = field(r.ZCACHED_NORMALLOCATIONSTRING);
      }
      if (r.ZCACHED_SHORTLOCATIONSTRING) f.cached_shortLocationString = field(r.ZCACHED_SHORTLOCATIONSTRING);
      if (r.ZCACHED_STANDARDIZEDLOCATIONSTRING) f.cached_standardizedLocationString = field(r.ZCACHED_STANDARDIZEDLOCATIONSTRING);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZTEMPLATE1) f.template = ref('PlaceTemplate', r.ZTEMPLATE1);
      if (r.ZGEONAMEID) {
        f.geonameID = field(r.ZGEONAMEID);
        f.geoNameID = field(r.ZGEONAMEID);
      }
      if (r.ZALTERNATEPLACENAMES) f.alternateNames = field(r.ZALTERNATEPLACENAMES);
      if (r.ZGEDCOMID) f.gedcomID = field(r.ZGEDCOMID);
      if (r.ZREFERENCENUMBERID) f.referenceNumberID = field(r.ZREFERENCENUMBERID);
      addRecord(makeId('Place', r.Z_PK), 'Place', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZPLACE, ZTEMPLATEKEY, ZVALUE, ZUNIQUEID FROM ZPLACEKEYVALUE', warnings)) {
    const f = {};
    if (r.ZPLACE) f.place = ref('Place', r.ZPLACE);
    if (r.ZTEMPLATEKEY) f.templateKey = ref('PlaceTemplateKey', r.ZTEMPLATEKEY);
    if (r.ZVALUE) f.value = field(r.ZVALUE);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('PlaceKeyValue', r.Z_PK), 'PlaceKeyValue', f);
  }
  for (const r of safeRows(query, `
    SELECT Z_PK, ZPLACE, ZPLACEDETAIL, ZLATITUDEDEGREES, ZLATITUDEMINUTES, ZLATITUDESECONDS, ZLATITUDEISSOUTH,
           ZLONGITUDEDEGREES, ZLONGITUDEMINUTES, ZLONGITUDESECONDS, ZLONGITUDEISWEST, ZUNIQUEID
    FROM ZCOORDINATE
  `, warnings)) {
    const f = {};
    for (const [src, dest] of [
      ['ZLATITUDEDEGREES', 'latitudeDegrees'], ['ZLATITUDEMINUTES', 'latitudeMinutes'], ['ZLATITUDESECONDS', 'latitudeSeconds'],
      ['ZLATITUDEISSOUTH', 'latitudeIsSouth'], ['ZLONGITUDEDEGREES', 'longitudeDegrees'], ['ZLONGITUDEMINUTES', 'longitudeMinutes'],
      ['ZLONGITUDESECONDS', 'longitudeSeconds'], ['ZLONGITUDEISWEST', 'longitudeIsWest'],
    ]) if (r[src] !== null && r[src] !== undefined) f[dest] = field(r[src], src.includes('IS') ? 'INT64' : 'DOUBLE');
    if (r.ZPLACE) f.place = ref('Place', r.ZPLACE);
    if (r.ZPLACEDETAIL) f.placeDetail = ref('PlaceDetail', r.ZPLACEDETAIL);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    const lat = (parseFloat(r.ZLATITUDEDEGREES || 0) + parseFloat(r.ZLATITUDEMINUTES || 0) / 60 + parseFloat(r.ZLATITUDESECONDS || 0) / 3600) * (r.ZLATITUDEISSOUTH ? -1 : 1);
    const lon = (parseFloat(r.ZLONGITUDEDEGREES || 0) + parseFloat(r.ZLONGITUDEMINUTES || 0) / 60 + parseFloat(r.ZLONGITUDESECONDS || 0) / 3600) * (r.ZLONGITUDEISWEST ? -1 : 1);
    f.latitude = field(lat, 'DOUBLE');
    f.longitude = field(lon, 'DOUBLE');
    const rec = addRecord(makeId('Coordinate', r.Z_PK), 'Coordinate', f);
    const placeId = r.ZPLACE ? makeId('Place', r.ZPLACE) : null;
    if (placeId && records[placeId]) records[placeId].fields.coordinate = ref('Coordinate', r.Z_PK);
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZCOORDINATE, ZPLACE, ZGEONAMEID, ZNAME, ZUNIQUEID FROM ZPLACEDETAIL', warnings)) {
    const f = {};
    if (r.ZCOORDINATE) f.coordinate = ref('Coordinate', r.ZCOORDINATE);
    if (r.ZPLACE) f.place = ref('Place', r.ZPLACE);
    if (r.ZGEONAMEID) {
      f.geonameID = field(r.ZGEONAMEID);
      f.geoNameID = field(r.ZGEONAMEID);
    }
    if (r.ZNAME) {
      f.name = field(r.ZNAME);
      f.placeName = field(r.ZNAME);
    }
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('PlaceDetail', r.Z_PK), 'PlaceDetail', f);
  }
  for (const table of [
    { table: 'ZPLACETEMPLATE', type: 'PlaceTemplate', cols: 'Z_PK, ZNAME, ZCOUNTRYIDENTIFIER, ZUNIQUEID, ZLOCALIZEABLENAMEKEY' },
    { table: 'ZPLACETEMPLATEKEY', type: 'PlaceTemplateKey', cols: 'Z_PK, ZINTERNATIONALNAME, ZLOCALNAME, ZUNIQUEID' },
    { table: 'ZPLACETEMPLATEKEYRELATION', type: 'PlaceTemplateKeyRelation', cols: 'Z_PK, ZTEMPLATE, ZTEMPLATEKEY, ZUNIQUEID, ZORDER' },
  ]) {
    for (const r of safeRows(query, `SELECT ${table.cols} FROM ${table.table}`, warnings)) {
      const f = {};
      if (r.ZNAME) f.name = field(r.ZNAME);
      if (r.ZCOUNTRYIDENTIFIER) f.countryIdentifier = field(r.ZCOUNTRYIDENTIFIER);
      if (r.ZINTERNATIONALNAME) f.internationalName = field(r.ZINTERNATIONALNAME);
      if (r.ZLOCALNAME) f.localName = field(r.ZLOCALNAME);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZLOCALIZEABLENAMEKEY) f.localizeableNameKey = field(r.ZLOCALIZEABLENAMEKEY);
      if (r.ZTEMPLATE) f.template = ref('PlaceTemplate', r.ZTEMPLATE);
      if (r.ZTEMPLATEKEY) f.templateKey = ref('PlaceTemplateKey', r.ZTEMPLATEKEY);
      if (r.ZORDER !== undefined && r.ZORDER !== null) f.order = field(r.ZORDER, 'DOUBLE');
      if (!f.name && r.ZUNIQUEID && table.type === 'PlaceTemplate') f.name = field(r.ZUNIQUEID.replace('PlaceTemplate_', '').replace(/_/g, ' '));
      addRecord(makeId(table.type, r.Z_PK), table.type, f);
    }
  }

  // Notes, todos, research, saved views, scopes
  if (entityMap.Note) {
    for (const r of safeRows(query, `
      SELECT Z_PK, ZOBJECT, Z6_OBJECT, ZTEXT, ZTEXT1, ZTITLE, ZUNIQUEID, ZCHANGEDATE, ZCREATIONDATE
      FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Note}
    `, warnings)) {
      const f = {};
      const target = refByEntity(r.ZOBJECT, r.Z6_OBJECT);
      if (target) {
        const type = entityMap._names?.[r.Z6_OBJECT || baseObjectEntities[r.ZOBJECT]];
        f.target = target;
        if (type) {
          f.targetType = field(type);
          f[String(type).toLowerCase()] = target;
          if (type === 'Person') f.person = target;
          if (type === 'Family') f.family = target;
        }
      }
      if (r.ZTEXT) f.text = field(r.ZTEXT);
      if (r.ZTEXT1) f.note = field(r.ZTEXT1);
      if (r.ZTITLE) f.title = field(r.ZTITLE);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('Note', r.Z_PK), 'Note', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
    }
  }
  if (entityMap.ToDo) {
    for (const r of safeRows(query, `
      SELECT t.Z_PK, t.ZTITLE2, t.ZTEXT3, t.ZDUEDATE, t.ZCACHED_DUEDATEASDATE, t.ZUNIQUEID,
             t.ZPRIORITYCONCLUSIONTYPE, t.ZSTATUSCONCLUSIONTYPE, t.ZTYPECONCLUSIONTYPE,
             p.ZTYPENAME as PRIORITY_NAME, s.ZTYPENAME as STATUS_NAME, y.ZTYPENAME as TYPE_NAME
      FROM ZBASEOBJECT t
      LEFT JOIN ZCONCLUSIONTYPE p ON p.Z_PK = t.ZPRIORITYCONCLUSIONTYPE
      LEFT JOIN ZCONCLUSIONTYPE s ON s.Z_PK = t.ZSTATUSCONCLUSIONTYPE
      LEFT JOIN ZCONCLUSIONTYPE y ON y.Z_PK = t.ZTYPECONCLUSIONTYPE
      WHERE t.Z_ENT = ${entityMap.ToDo}
    `, warnings)) {
      const f = {};
      if (r.ZTITLE2) f.title = field(r.ZTITLE2);
      if (r.ZTEXT3) { f.description = field(r.ZTEXT3); f.text = field(r.ZTEXT3); }
      if (r.ZDUEDATE) f.dueDate = field(r.ZDUEDATE);
      if (r.ZCACHED_DUEDATEASDATE) f.cached_dueDateAsDate = field(cdTs(r.ZCACHED_DUEDATEASDATE), 'TIMESTAMP');
      if (r.PRIORITY_NAME) f.priority = field(r.PRIORITY_NAME);
      if (r.STATUS_NAME) f.status = field(r.STATUS_NAME);
      if (r.TYPE_NAME) f.type = field(r.TYPE_NAME);
      if (r.ZPRIORITYCONCLUSIONTYPE) f.priorityConclusionType = ref('ConclusionType', r.ZPRIORITYCONCLUSIONTYPE);
      if (r.ZSTATUSCONCLUSIONTYPE) f.statusConclusionType = ref('ConclusionType', r.ZSTATUSCONCLUSIONTYPE);
      if (r.ZTYPECONCLUSIONTYPE) f.typeConclusionType = ref('ConclusionType', r.ZTYPECONCLUSIONTYPE);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('ToDo', r.Z_PK), 'ToDo', f);
    }
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZBASEOBJECT, Z4_BASEOBJECT, ZTODO, ZUNIQUEID FROM ZTODORELATION', warnings)) {
    const f = {};
    if (r.ZTODO) f.todo = ref('ToDo', r.ZTODO);
    const target = refByEntity(r.ZBASEOBJECT, r.Z4_BASEOBJECT);
    if (target) {
      f.target = target;
      const type = entityMap._names?.[r.Z4_BASEOBJECT || baseObjectEntities[r.ZBASEOBJECT]];
      if (type) f.targetType = field(type);
    }
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('ToDoRelation', r.Z_PK), 'ToDoRelation', f);
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZTYPE, ZOBJECT, Z4_OBJECT, ZANSWERDATE, ZINFOKEY, ZINFOVALUE, ZUNIQUEID FROM ZRESEARCHASSISTANTQUESTIONINFO', warnings)) {
    const f = {};
    if (r.ZTYPE !== null) f.questionType = field(r.ZTYPE, 'INT64');
    const target = refByEntity(r.ZOBJECT, r.Z4_OBJECT);
    if (target) {
      f.target = target;
      const type = entityMap._names?.[r.Z4_OBJECT || baseObjectEntities[r.ZOBJECT]];
      if (type) f.targetType = field(type);
    }
    if (r.ZANSWERDATE) f.answerDate = field(cdTs(r.ZANSWERDATE), 'TIMESTAMP');
    if (r.ZINFOKEY) f.infoKey = field(r.ZINFOKEY);
    if (r.ZINFOVALUE) f.infoValue = field(r.ZINFOVALUE);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('ResearchAssistantQuestionInfo', r.Z_PK), 'ResearchAssistantQuestionInfo', f);
  }
  for (const r of safeRows(query, `
    SELECT Z_PK, Z_ENT, ZDATE, ZCHANGEDATE, ZTITLE, ZUNIQUEID, ZAUTHOR, ZSUBTITLE, ZFILEIDENTIFIER,
           HEX(ZBOOKDATA) as BOOK_HEX, HEX(ZTHUMBNAILDATA) as THUMB_HEX,
           HEX(ZCHARTOBJECTSCONTAINERDATA) as CHART_HEX, HEX(ZTHUMBNAILDATA1) as CHART_THUMB_HEX,
           HEX(ZREPORTNODESCONTAINERDATA) as REPORT_HEX, HEX(ZTHUMBNAILDATA2) as REPORT_THUMB_HEX,
           HEX(ZTHUMBNAILDATA3) as WEBSITE_THUMB_HEX
    FROM ZSAVEDVIEW
  `, warnings)) {
    const type = entityMap._names?.[r.Z_ENT] || 'SavedView';
    const f = {};
    if (r.ZTITLE) { f.title = field(r.ZTITLE); f.name = field(r.ZTITLE); }
    if (r.ZAUTHOR) f.author = field(r.ZAUTHOR);
    if (r.ZSUBTITLE) f.subtitle = field(r.ZSUBTITLE);
    if (r.ZDATE) f.date = field(cdTs(r.ZDATE), 'TIMESTAMP');
    if (r.ZCHANGEDATE) f.changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
    if (r.ZFILEIDENTIFIER) f.fileIdentifier = field(r.ZFILEIDENTIFIER);
    for (const [key, label] of [['BOOK_HEX', 'bookData'], ['CHART_HEX', 'chartObjectsContainerData'], ['REPORT_HEX', 'reportNodesContainerData']]) {
      const b64 = hexToBase64(r[key]);
      if (b64) {
        f[label] = field(b64);
        f[`${label}Decoded`] = field(JSON.stringify(decodeArchivedPayload(b64, `${type}:${r.ZTITLE || r.Z_PK}:${label}`, warnings)));
      }
    }
    for (const [key, label] of [['THUMB_HEX', 'thumbnailData'], ['CHART_THUMB_HEX', 'chartThumbnailData'], ['REPORT_THUMB_HEX', 'reportThumbnailData'], ['WEBSITE_THUMB_HEX', 'websiteThumbnailData']]) {
      const b64 = hexToBase64(r[key]);
      if (b64) f[label] = field(b64);
    }
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId(type, r.Z_PK), type, f, cdTs(r.ZDATE), cdTs(r.ZCHANGEDATE));
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZSCOPEENTITY, ZSCOPENAME, ZUNIQUEID, HEX(ZARCHIVEDFILTERSCONTAINERDATA) as FILTER_HEX FROM ZSCOPE', warnings)) {
    const f = {};
    if (r.ZSCOPEENTITY) f.scopeEntity = field(r.ZSCOPEENTITY);
    if (r.ZSCOPENAME) { f.scopeName = field(r.ZSCOPENAME); f.name = field(r.ZSCOPENAME); }
    const b64 = hexToBase64(r.FILTER_HEX);
    if (b64) {
      f.archivedFiltersContainerData = field(b64);
      f.archivedFiltersDecoded = field(JSON.stringify(decodeArchivedPayload(b64, `Scope:${r.ZSCOPENAME || r.Z_PK}`, warnings)));
    }
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('Scope', r.Z_PK), 'Scope', f);
  }

  // Media and relation families.
  for (const type of ['MediaPicture', 'MediaPDF', 'MediaURL', 'MediaAudio', 'MediaVideo']) {
    if (!entityMap[type]) continue;
    for (const r of safeRows(query, `
      SELECT Z_PK, ZTITLE, ZUSERDESCRIPTION, ZDATE, ZURL, ZUNIQUEID,
             ZAUDIOFILEIDENTIFIER, ZPDFFILEIDENTIFIER, ZORIGINALPICTUREFILEIDENTIFIER, ZPICTUREFILEIDENTIFIER,
             ZTHUMBNAILFILEIDENTIFIER, ZTHUMBNAILFILEIDENTIFIER1, ZTHUMBNAILFILEIDENTIFIER2, ZVIDEOFILEIDENTIFIER
      FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap[type]}
    `, warnings)) {
      const f = {};
      if (r.ZTITLE) { f.title = field(r.ZTITLE); f.caption = field(r.ZTITLE); }
      if (r.ZUSERDESCRIPTION) f.description = field(r.ZUSERDESCRIPTION);
      if (r.ZDATE) f.date = field(r.ZDATE);
      if (r.ZURL) f.url = field(r.ZURL);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      const identifiers = [];
      for (const [src, dest] of [
        ['ZAUDIOFILEIDENTIFIER', 'audioFileIdentifier'], ['ZPDFFILEIDENTIFIER', 'pdfFileIdentifier'],
        ['ZORIGINALPICTUREFILEIDENTIFIER', 'originalPictureFileIdentifier'], ['ZPICTUREFILEIDENTIFIER', 'pictureFileIdentifier'],
        ['ZTHUMBNAILFILEIDENTIFIER', 'thumbnailFileIdentifier'], ['ZTHUMBNAILFILEIDENTIFIER1', 'thumbnailFileIdentifier1'],
        ['ZTHUMBNAILFILEIDENTIFIER2', 'thumbnailFileIdentifier2'], ['ZVIDEOFILEIDENTIFIER', 'videoFileIdentifier'],
      ]) {
        if (r[src]) {
          f[dest] = field(r[src]);
          identifiers.push(r[src]);
        }
      }
      const rec = addRecord(makeId(type, r.Z_PK), type, f);
      attachResourceAssets(rec, identifiers);
    }
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZBASEMEDIA, Z16_BASEMEDIA, ZMEDIACONTAINER, Z7_MEDIACONTAINER, ZMEDIARELATIONASSIGNMENT, Z2_MEDIARELATIONASSIGNMENT, ZORDER, ZUNIQUEID FROM ZMEDIARELATION', warnings)) {
    const f = {};
    const media = refByEntity(r.ZBASEMEDIA, r.Z16_BASEMEDIA);
    const target = refByEntity(r.ZMEDIACONTAINER, r.Z7_MEDIACONTAINER);
    if (media) f.media = media;
    if (target) f.target = target;
    const targetType = entityMap._names?.[r.Z7_MEDIACONTAINER || baseObjectEntities[r.ZMEDIACONTAINER]];
    if (targetType) f.targetType = field(targetType);
    if (r.ZORDER !== null) f.order = field(r.ZORDER, 'DOUBLE');
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('MediaRelation', r.Z_PK), 'MediaRelation', f);
  }

  // Groups/stories.
  if (entityMap.PersonGroup) {
    for (const r of safeRows(query, `SELECT Z_PK, ZNAME, ZUSERDESCRIPTION, ZCOLORCOMPONENTSSTRING, ZUNIQUEID FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.PersonGroup}`, warnings)) {
      const f = {};
      if (r.ZNAME) f.name = field(r.ZNAME);
      if (r.ZUSERDESCRIPTION) f.description = field(r.ZUSERDESCRIPTION);
      if (r.ZCOLORCOMPONENTSSTRING) { f.colorComponentsString = field(r.ZCOLORCOMPONENTSSTRING); f.color = field(normalizeColor(r.ZCOLORCOMPONENTSSTRING)); }
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('PersonGroup', r.Z_PK), 'PersonGroup', f);
    }
  }
  for (const r of safeRows(query, 'SELECT Z_PK, ZPERSON, ZPERSONGROUP, ZUNIQUEID FROM ZPERSONGROUPRELATION', warnings)) {
    const f = {};
    if (r.ZPERSON) f.person = ref('Person', r.ZPERSON);
    if (r.ZPERSONGROUP) f.personGroup = ref('PersonGroup', r.ZPERSONGROUP);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    addRecord(makeId('PersonGroupRelation', r.Z_PK), 'PersonGroupRelation', f);
  }
  if (entityMap.Story) {
    for (const r of safeRows(query, `SELECT Z_PK, ZTITLE1, ZSUBTITLE, ZTEXT2, ZAUTHORNAME, ZDATESTRING, ZUNIQUEID FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Story}`, warnings)) {
      const f = {};
      if (r.ZTITLE1) f.title = field(r.ZTITLE1);
      if (r.ZSUBTITLE) f.subtitle = field(r.ZSUBTITLE);
      if (r.ZTEXT2) f.text = field(r.ZTEXT2);
      if (r.ZAUTHORNAME) f.author = field(r.ZAUTHORNAME);
      if (r.ZDATESTRING) f.date = field(r.ZDATESTRING);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('Story', r.Z_PK), 'Story', f);
    }
  }
  if (entityMap.StorySection) {
    for (const r of safeRows(query, `SELECT Z_PK, ZSTORY, ZTITLE, ZTEXT1, ZORDER, ZUNIQUEID FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.StorySection}`, warnings)) {
      const f = {};
      if (r.ZSTORY) f.story = ref('Story', r.ZSTORY);
      if (r.ZTITLE) f.title = field(r.ZTITLE);
      if (r.ZTEXT1) f.text = field(r.ZTEXT1);
      if (r.ZORDER !== null) f.order = field(r.ZORDER, 'DOUBLE');
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('StorySection', r.Z_PK), 'StorySection', f);
    }
  }
  for (const table of [
    { name: 'ZSTORYRELATION', type: 'StoryRelation', storyCol: 'ZSTORY' },
    { name: 'ZSTORYSECTIONRELATION', type: 'StorySectionRelation', storyCol: 'ZSTORYSECTION' },
  ]) {
    for (const r of safeRows(query, `SELECT Z_PK, ZBASEOBJECT, Z4_BASEOBJECT, ${table.storyCol} as ZSTORYLIKE, ZUNIQUEID FROM ${table.name}`, warnings)) {
      const f = {};
      const target = refByEntity(r.ZBASEOBJECT, r.Z4_BASEOBJECT);
      if (target) f.target = target;
      const targetType = entityMap._names?.[r.Z4_BASEOBJECT || baseObjectEntities[r.ZBASEOBJECT]];
      if (targetType) f.targetType = field(targetType);
      if (r.ZSTORYLIKE) f[table.type === 'StoryRelation' ? 'story' : 'storySection'] = ref(table.type === 'StoryRelation' ? 'Story' : 'StorySection', r.ZSTORYLIKE);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId(table.type, r.Z_PK), table.type, f);
    }
  }

  // Change log and tree info.
  for (const r of safeRows(query, `
    SELECT Z_PK, ZOBJECTENTITYNAME, ZOBJECTNAMEKEY, ZOBJECTNAMEKEYVALUESFORFORMATSTRING,
           ZOBJECTUNIQUEID, ZUNIQUEID, ZEARLIESTCHANGEDATE, ZLATESTCHANGEDATE
    FROM ZCHANGELOGENTRY
  `, warnings)) {
    const f = {};
    if (r.ZOBJECTENTITYNAME) f.objectEntityName = field(r.ZOBJECTENTITYNAME);
    if (r.ZOBJECTNAMEKEY) f.objectNameKey = field(r.ZOBJECTNAMEKEY);
    if (r.ZOBJECTNAMEKEYVALUESFORFORMATSTRING) f.objectNameKeyValuesForFormatString = field(r.ZOBJECTNAMEKEYVALUESFORFORMATSTRING);
    if (r.ZOBJECTUNIQUEID) f.objectUniqueID = field(r.ZOBJECTUNIQUEID);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    if (r.ZEARLIESTCHANGEDATE) f.earliestChangeDate = field(cdTs(r.ZEARLIESTCHANGEDATE), 'TIMESTAMP');
    if (r.ZLATESTCHANGEDATE) f.latestChangeDate = field(cdTs(r.ZLATESTCHANGEDATE), 'TIMESTAMP');
    f.changeDate = f.latestChangeDate || f.earliestChangeDate;
    addRecord(makeId('ChangeLogEntry', r.Z_PK), 'ChangeLogEntry', f, cdTs(r.ZEARLIESTCHANGEDATE), cdTs(r.ZLATESTCHANGEDATE));
  }
  for (const r of safeRows(query, `
    SELECT Z_PK, ZSUPERENTRY, ZCHANGETYPE, ZCHANGEDATE, ZCHANGEKEY, ZCHANGEKEYVALUESFORFORMATSTRING,
           ZCHANGEOBJECTENTITYNAME, ZCHANGEOBJECTUNIQUEID, ZCHANGEDKEYINCHANGEOBJECT, ZUNIQUEID, ZUSERNAME
    FROM ZCHANGELOGSUBENTRY
  `, warnings)) {
    const f = {};
    if (r.ZSUPERENTRY) f.superEntry = ref('ChangeLogEntry', r.ZSUPERENTRY);
    if (r.ZCHANGETYPE !== null) f.changeType = field(r.ZCHANGETYPE, 'INT64');
    if (r.ZCHANGEDATE) f.changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
    if (r.ZCHANGEKEY) f.changeKey = field(r.ZCHANGEKEY);
    if (r.ZCHANGEKEYVALUESFORFORMATSTRING) f.changeKeyValuesForFormatString = field(r.ZCHANGEKEYVALUESFORFORMATSTRING);
    if (r.ZCHANGEOBJECTENTITYNAME) f.changeObjectEntityName = field(r.ZCHANGEOBJECTENTITYNAME);
    if (r.ZCHANGEOBJECTUNIQUEID) f.changeObjectUniqueID = field(r.ZCHANGEOBJECTUNIQUEID);
    if (r.ZCHANGEDKEYINCHANGEOBJECT) f.changedKeyInChangeObject = field(r.ZCHANGEDKEYINCHANGEOBJECT);
    if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
    if (r.ZUSERNAME) f.userName = field(r.ZUSERNAME);
    addRecord(makeId('ChangeLogSubEntry', r.Z_PK), 'ChangeLogSubEntry', f, cdTs(r.ZCHANGEDATE), cdTs(r.ZCHANGEDATE));
  }
  if (entityMap.FamilyTreeInformation) {
    for (const r of safeRows(query, `SELECT Z_PK, ZNAME, ZUNIQUEID FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.FamilyTreeInformation}`, warnings)) {
      const f = {};
      if (r.ZNAME) f.name = field(r.ZNAME);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(makeId('FamilyTreeInformation', r.Z_PK), 'FamilyTreeInformation', f);
    }
  }

  const treeInfoRecords = Object.values(records).filter((r) => r.recordType === 'FamilyTreeInformation');
  const treeName = treeInfoRecords[0]?.fields?.name?.value || sourceName?.replace(/\.mftpkg$/i, '') || 'Family Tree';
  const decodedSavedViews = Object.values(records).filter((r) => r.recordType.startsWith('Saved') && Object.keys(r.fields || {}).some((k) => k.endsWith('Decoded'))).length;
  const skippedResources = resourceFiles.length - assets.length;

  return {
    records,
    assets,
    zones: {
      defaultZone: {
        zoneName: treeName,
        zoneShortName: 'default',
        ownerRecordName: '_local_user',
      },
    },
    meta: {
      source: sourceName || 'browser-import',
      importedAt: new Date().toISOString(),
      counts,
      assetCount: assets.length,
      decodedSavedViews,
      skippedResources,
      warnings,
    },
    treeName,
    counts,
    decodedSavedViews,
    skippedResources,
    warnings,
  };
}

export default extractMFTPKGDataset;
