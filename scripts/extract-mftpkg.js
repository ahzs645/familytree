#!/usr/bin/env node

/**
 * Extract family tree data from a MacFamilyTree .mftpkg SQLite database
 * and convert it to the CloudKit shim JSON format.
 *
 * Usage:
 *   node scripts/extract-mftpkg.js <path-to.mftpkg> [output.json]
 */

import Database from 'better-sqlite3';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const mftpkgPath = process.argv[2];
const outputPath = process.argv[3] || resolve(__dirname, '../public/family-data.json');

if (!mftpkgPath) {
  console.error('Usage: node scripts/extract-mftpkg.js <path-to.mftpkg> [output.json]');
  process.exit(1);
}

const dbPath = resolve(mftpkgPath, 'database');
console.log(`Opening ${dbPath}...`);
const db = new Database(dbPath, { readonly: true });

// ── Entity type IDs ──
const ENT = {};
const entities = db.prepare('SELECT Z_ENT, Z_NAME FROM Z_PRIMARYKEY').all();
for (const e of entities) ENT[e.Z_NAME] = e.Z_ENT;

console.log('Entity types:', Object.keys(ENT).filter(k => ['Person', 'Family', 'PersonEvent', 'FamilyEvent', 'PersonFact', 'Place', 'Source', 'ChildRelation', 'FamilyTreeInformation', 'AdditionalName', 'Note'].includes(k)).join(', '));

const records = {};

function makeId(type, pk) {
  return `${type.toLowerCase()}-${pk}`;
}

function field(value, type) {
  if (value === null || value === undefined) return undefined;
  return { value, type: type || 'STRING' };
}

// CloudKit reference format: "recordName---RecordType"
const RECORD_TYPE_MAP = {
  person: 'Person', family: 'Family', place: 'Place', source: 'Source',
  personevent: 'PersonEvent', familyevent: 'FamilyEvent',
  childrelation: 'ChildRelation', placetemplate: 'PlaceTemplate',
  placetemplatekey: 'PlaceTemplateKey', placekeyvalue: 'PlaceKeyValue',
  coordinate: 'Coordinate', placedetail: 'PlaceDetail',
  source: 'Source', sourcetemplate: 'SourceTemplate', treeinfo: 'FamilyTreeInformation',
};

function ref(targetType, pk) {
  if (!pk) return undefined;
  const id = makeId(targetType, pk);
  const ckType = RECORD_TYPE_MAP[targetType] || targetType;
  return { value: id + '---' + ckType, type: 'REFERENCE' };
}

// Helper: convert CoreData timestamp (seconds since 2001-01-01) to JS timestamp
function coreDataTimestamp(val) {
  if (val === null || val === undefined) return null;
  // CoreData epoch: 2001-01-01T00:00:00Z = 978307200000 ms
  return Math.round((val * 1000) + 978307200000);
}

// ── Extract Persons (Z_ENT = 14) ──
console.log('\nExtracting persons...');
const persons = db.prepare(`
  SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZGENDER, ZNAMEPREFIX, ZNAMESUFFIX, ZNAMEMIDDLE,
         ZCACHED_BIRTHDATE, ZCACHED_DEATHDATE, ZCACHED_FULLNAME, ZCACHED_FULLNAMEFORSORTING,
         ZUNIQUEID, ZISSTARTPERSON, ZISBOOKMARKED2, ZISPRIVATE,
         ZGEDCOMID, ZREFERENCENUMBERID, ZANCESTRALFILENUMBERID, ZFAMILYSEARCHID,
         ZCHANGEDATE, ZCREATIONDATE
  FROM ZBASEOBJECT WHERE Z_ENT = ?
`).all(ENT.Person);

for (const p of persons) {
  const id = makeId('person', p.Z_PK);
  records[id] = {
    recordType: 'Person',
    recordName: id,
    fields: {},
    created: { timestamp: coreDataTimestamp(p.ZCREATIONDATE) || Date.now() },
    modified: { timestamp: coreDataTimestamp(p.ZCHANGEDATE) || Date.now() },
  };
  const f = records[id].fields;
  if (p.ZFIRSTNAME) f.firstName = field(p.ZFIRSTNAME);
  if (p.ZLASTNAME) f.lastName = field(p.ZLASTNAME);
  if (p.ZGENDER !== null) f.gender = field(p.ZGENDER, 'INT64');
  if (p.ZNAMEPREFIX) f.namePrefix = field(p.ZNAMEPREFIX);
  if (p.ZNAMESUFFIX) f.nameSuffix = field(p.ZNAMESUFFIX);
  if (p.ZNAMEMIDDLE) f.nameMiddle = field(p.ZNAMEMIDDLE);
  if (p.ZCACHED_FULLNAME) f.cached_fullName = field(p.ZCACHED_FULLNAME);
  if (p.ZCACHED_FULLNAMEFORSORTING) f.cached_fullNameForSorting = field(p.ZCACHED_FULLNAMEFORSORTING);
  if (p.ZCACHED_BIRTHDATE) f.cached_birthDate = field(p.ZCACHED_BIRTHDATE);
  if (p.ZCACHED_DEATHDATE) f.cached_deathDate = field(p.ZCACHED_DEATHDATE);
  if (p.ZUNIQUEID) f.uniqueID = field(p.ZUNIQUEID);
  if (p.ZISSTARTPERSON) f.isStartPerson = field(p.ZISSTARTPERSON, 'INT64');
  if (p.ZISBOOKMARKED2) f.isBookmarked = field(p.ZISBOOKMARKED2, 'INT64');
  if (p.ZISPRIVATE) f.isPrivate = field(p.ZISPRIVATE, 'INT64');
  if (p.ZGEDCOMID) f.gedcomID = field(p.ZGEDCOMID);
  if (p.ZREFERENCENUMBERID) f.referenceNumberID = field(p.ZREFERENCENUMBERID);
  if (p.ZANCESTRALFILENUMBERID) f.ancestralFileNumberID = field(p.ZANCESTRALFILENUMBERID);
  if (p.ZFAMILYSEARCHID) f.familySearchID = field(p.ZFAMILYSEARCHID);
  // Dates as fields — app reads mft_changeDate/mft_creationDate with new Date(value)
  if (p.ZCHANGEDATE) f.mft_changeDate = field(coreDataTimestamp(p.ZCHANGEDATE), 'TIMESTAMP');
  if (p.ZCREATIONDATE) f.mft_creationDate = field(coreDataTimestamp(p.ZCREATIONDATE), 'TIMESTAMP');
}
console.log(`  ${persons.length} persons`);

// ── Extract Families (Z_ENT = 13) ──
console.log('Extracting families...');
const families = db.prepare(`
  SELECT Z_PK, ZMAN, ZWOMAN, ZCACHED_MARRIAGEDATE, ZUNIQUEID,
         ZCHANGEDATE, ZCREATIONDATE, ZISBOOKMARKED1, ZGEDCOMID
  FROM ZBASEOBJECT WHERE Z_ENT = ?
`).all(ENT.Family);

for (const f of families) {
  const id = makeId('family', f.Z_PK);
  records[id] = {
    recordType: 'Family',
    recordName: id,
    fields: {},
    created: { timestamp: coreDataTimestamp(f.ZCREATIONDATE) || Date.now() },
    modified: { timestamp: coreDataTimestamp(f.ZCHANGEDATE) || Date.now() },
  };
  const fld = records[id].fields;
  if (f.ZMAN) fld.man = ref('person', f.ZMAN);
  if (f.ZWOMAN) fld.woman = ref('person', f.ZWOMAN);
  if (f.ZCACHED_MARRIAGEDATE) fld.cached_marriageDate = field(f.ZCACHED_MARRIAGEDATE);
  if (f.ZUNIQUEID) fld.uniqueID = field(f.ZUNIQUEID);
}
console.log(`  ${families.length} families`);

// ── Extract Child Relations (from ZCHILDRELATION table) ──
console.log('Extracting child relations...');
const childRels = db.prepare(`
  SELECT Z_PK, ZFAMILY, ZCHILD FROM ZCHILDRELATION
`).all();

for (const cr of childRels) {
  const id = makeId('childrelation', cr.Z_PK);
  records[id] = {
    recordType: 'ChildRelation',
    recordName: id,
    fields: {},
    created: { timestamp: Date.now() },
    modified: { timestamp: Date.now() },
  };
  const f = records[id].fields;
  if (cr.ZFAMILY) f.family = ref('family', cr.ZFAMILY);
  if (cr.ZCHILD) f.child = ref('person', cr.ZCHILD);
}
console.log(`  ${childRels.length} child relations`);

// Build reverse entity name map
const ENT_NAMES = {};
for (const e of entities) ENT_NAMES[e.Z_ENT] = e.Z_NAME;

// ── Extract Person Events (Z_ENT = 25) ──
console.log('Extracting person events...');
const personEvents = db.prepare(`
  SELECT e.Z_PK, e.ZPERSON1 as ZPERSON, e.ZCONCLUSIONTYPE2 as ZCTYPE, e.ZDATE2 as ZDATE,
         e.ZCACHED_DATEASDATE3, e.ZASSIGNEDPLACE, e.ZUSERDESCRIPTION1, e.ZUNIQUEID,
         e.ZCAUSE, e.ZVALUE, e.ZCHANGEDATE, e.ZCREATIONDATE,
         c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
  FROM ZBASEOBJECT e
  LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE2
  WHERE e.Z_ENT = ?
`).all(ENT.PersonEvent);

for (const ev of personEvents) {
  const id = makeId('personevent', ev.Z_PK);
  records[id] = {
    recordType: 'PersonEvent',
    recordName: id,
    fields: {},
    created: { timestamp: coreDataTimestamp(ev.ZCREATIONDATE) || Date.now() },
    modified: { timestamp: coreDataTimestamp(ev.ZCHANGEDATE) || Date.now() },
  };
  const f = records[id].fields;
  if (ev.ZPERSON) f.person = ref('person', ev.ZPERSON);
  if (ev.CTYPE_UID) {
    const ctypeName = ENT_NAMES[ev.CTYPE_ENT] || 'ConclusionPersonEventType';
    f.conclusionType = { value: ev.CTYPE_UID + '---' + ctypeName, type: 'REFERENCE' };
  }
  if (ev.CONCLUSION_NAME) f.eventType = field(ev.CONCLUSION_NAME);
  if (ev.ZDATE) f.date = field(ev.ZDATE);
  if (ev.ZASSIGNEDPLACE) f.assignedPlace = ref('place', ev.ZASSIGNEDPLACE);
  if (ev.ZUSERDESCRIPTION1) f.userDescription = field(ev.ZUSERDESCRIPTION1);
  if (ev.ZCAUSE) f.cause = field(ev.ZCAUSE);
  if (ev.ZVALUE) f.value = field(ev.ZVALUE);
  if (ev.ZUNIQUEID) f.uniqueID = field(ev.ZUNIQUEID);
}
console.log(`  ${personEvents.length} person events`);

// ── Extract Family Events (Z_ENT = 24) ──
console.log('Extracting family events...');
const familyEvents = db.prepare(`
  SELECT e.Z_PK, e.ZFAMILY, e.ZCONCLUSIONTYPE1 as ZCTYPE, e.ZDATE1 as ZDATE,
         e.ZASSIGNEDPLACE, e.ZUNIQUEID,
         c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
  FROM ZBASEOBJECT e
  LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE1
  WHERE e.Z_ENT = ?
`).all(ENT.FamilyEvent);

for (const ev of familyEvents) {
  const id = makeId('familyevent', ev.Z_PK);
  records[id] = {
    recordType: 'FamilyEvent',
    recordName: id,
    fields: {},
    created: { timestamp: Date.now() },
    modified: { timestamp: Date.now() },
  };
  const f = records[id].fields;
  if (ev.ZFAMILY) f.family = ref('family', ev.ZFAMILY);
  if (ev.CTYPE_UID) {
    const ctypeName = ENT_NAMES[ev.CTYPE_ENT] || 'ConclusionFamilyEventType';
    f.conclusionType = { value: ev.CTYPE_UID + '---' + ctypeName, type: 'REFERENCE' };
  }
  if (ev.CONCLUSION_NAME) f.eventType = field(ev.CONCLUSION_NAME);
  if (ev.ZDATE) f.date = field(ev.ZDATE);
  if (ev.ZASSIGNEDPLACE) f.assignedPlace = ref('place', ev.ZASSIGNEDPLACE);
  if (ev.ZUNIQUEID) f.uniqueID = field(ev.ZUNIQUEID);
}
console.log(`  ${familyEvents.length} family events`);

// ── Extract PersonFacts ──
console.log('Extracting person facts...');
if (ENT.PersonFact) {
  const facts = db.prepare(`
    SELECT e.Z_PK, e.ZPERSON2 as ZPERSON, e.ZVALUE, e.ZUSERDESCRIPTION2, e.ZUNIQUEID,
           c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
    FROM ZBASEOBJECT e
    LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE3
    WHERE e.Z_ENT = ?
  `).all(ENT.PersonFact);

  for (const pf of facts) {
    const id = makeId('personfact', pf.Z_PK);
    records[id] = { recordType: 'PersonFact', recordName: id, fields: {}, created: { timestamp: Date.now() }, modified: { timestamp: Date.now() } };
    const f = records[id].fields;
    if (pf.ZPERSON) f.person = ref('person', pf.ZPERSON);
    if (pf.CTYPE_UID) {
      const ctypeName = ENT_NAMES[pf.CTYPE_ENT] || 'ConclusionPersonFactType';
      f.conclusionType = { value: pf.CTYPE_UID + '---' + ctypeName, type: 'REFERENCE' };
    }
    if (pf.CONCLUSION_NAME) f.factType = field(pf.CONCLUSION_NAME);
    if (pf.ZVALUE) f.value = field(pf.ZVALUE);
    if (pf.ZUSERDESCRIPTION2) f.description = field(pf.ZUSERDESCRIPTION2);
    if (pf.ZUNIQUEID) f.uniqueID = field(pf.ZUNIQUEID);
  }
  console.log(`  ${facts.length} person facts`);
}

// ── Extract ConclusionTypes ──
console.log('Extracting conclusion types...');
{
  const ctypes = db.prepare(`
    SELECT Z_PK, Z_ENT, ZTYPENAME, ZTYPENAMELOCALIZATIONKEY, ZUNIQUEID,
           ZISENABLED, ZISUSERCREATED, ZORDER, ZGEDCOMTAG, ZIDENTIFIER,
           ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME, ZINVERTEDTYPENAME,
           HEX(ZICONPNGDATA) as ICON_HEX
    FROM ZCONCLUSIONTYPE
  `).all();

  for (const ct of ctypes) {
    const entName = ENT_NAMES[ct.Z_ENT] || 'ConclusionType';
    const id = ct.ZUNIQUEID || makeId('conclusiontype', ct.Z_PK);
    records[id] = { recordType: entName, recordName: id, fields: {}, created: { timestamp: Date.now() }, modified: { timestamp: Date.now() } };
    const f = records[id].fields;
    if (ct.ZTYPENAME) f.typeName = field(ct.ZTYPENAME);
    if (ct.ZTYPENAMELOCALIZATIONKEY) f.typeNameLocalizationKey = field(ct.ZTYPENAMELOCALIZATIONKEY);
    if (ct.ZUNIQUEID) f.uniqueID = field(ct.ZUNIQUEID);
    if (ct.ZIDENTIFIER) f.identifier = field(ct.ZIDENTIFIER);
    if (ct.ZISENABLED !== null) f.isEnabled = field(ct.ZISENABLED, 'INT64');
    if (ct.ZISUSERCREATED !== null) f.isUserCreated = field(ct.ZISUSERCREATED, 'INT64');
    if (ct.ZORDER !== null) f.order = field(ct.ZORDER, 'DOUBLE');
    if (ct.ZGEDCOMTAG) f.gedcomTag = field(ct.ZGEDCOMTAG);
    if (ct.ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME) f.compatibleAssociatedContainerClassName = field(ct.ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME);
    if (ct.ZINVERTEDTYPENAME) f.invertedTypeName = field(ct.ZINVERTEDTYPENAME);
    if (ct.ICON_HEX) {
      // Convert hex to base64 for the icon PNG
      const buf = Buffer.from(ct.ICON_HEX, 'hex');
      f.iconPNGData = field(buf.toString('base64'));
    }
  }
  console.log(`  ${ctypes.length} conclusion types`);
}

// ── Extract Labels ──
console.log('Extracting labels...');
try {
  const labels = db.prepare('SELECT Z_PK, ZTITLE, ZCOLORCOMPONENTSSTRING, ZUNIQUEID FROM ZLABEL').all();
  for (const l of labels) {
    const id = makeId('label', l.Z_PK);
    records[id] = { recordType: 'Label', recordName: id, fields: {}, created: { timestamp: Date.now() }, modified: { timestamp: Date.now() } };
    const f = records[id].fields;
    if (l.ZTITLE) f.title = field(l.ZTITLE);
    if (l.ZCOLORCOMPONENTSSTRING) f.colorComponentsString = field(l.ZCOLORCOMPONENTSSTRING);
    if (l.ZUNIQUEID) f.uniqueID = field(l.ZUNIQUEID);
  }
  console.log(`  ${labels.length} labels`);
} catch (e) { console.log('  Labels: skipped'); }

// ── Extract LabelRelations ──
try {
  const labelRels = db.prepare('SELECT Z_PK, ZLABEL, ZBASEOBJECT, ZUNIQUEID FROM ZLABELRELATION').all();
  for (const lr of labelRels) {
    const id = makeId('labelrelation', lr.Z_PK);
    records[id] = { recordType: 'LabelRelation', recordName: id, fields: {}, created: { timestamp: Date.now() }, modified: { timestamp: Date.now() } };
    const f = records[id].fields;
    if (lr.ZLABEL) f.label = ref('label', lr.ZLABEL);
    if (lr.ZBASEOBJECT) f.baseObject = ref('person', lr.ZBASEOBJECT); // Simplification: may point to other types
    if (lr.ZUNIQUEID) f.uniqueID = field(lr.ZUNIQUEID);
  }
  console.log(`  ${labelRels.length} label relations`);
} catch (e) { console.log('  LabelRelations: skipped'); }

// ── Extract Sources (Z_ENT = 10) ──
console.log('Extracting sources...');
if (ENT.Source) {
  const sources = db.prepare(`
    SELECT Z_PK, ZCACHED_TITLE, ZCACHED_DATE, ZTEXT, ZUNIQUEID, ZGEDCOMID,
           ZTEMPLATE, ZCHANGEDATE, ZCREATIONDATE, ZISBOOKMARKED
    FROM ZBASEOBJECT WHERE Z_ENT = ?
  `).all(ENT.Source);
  for (const s of sources) {
    const id = makeId('source', s.Z_PK);
    records[id] = { recordType: 'Source', recordName: id, fields: {},
      created: { timestamp: coreDataTimestamp(s.ZCREATIONDATE) || Date.now() },
      modified: { timestamp: coreDataTimestamp(s.ZCHANGEDATE) || Date.now() } };
    const f = records[id].fields;
    if (s.ZCACHED_TITLE) f.cached_title = field(s.ZCACHED_TITLE);
    if (s.ZCACHED_TITLE) f.title = field(s.ZCACHED_TITLE);
    if (s.ZCACHED_DATE) f.cached_date = field(s.ZCACHED_DATE);
    if (s.ZTEXT) f.text = field(s.ZTEXT);
    if (s.ZUNIQUEID) f.uniqueID = field(s.ZUNIQUEID);
    if (s.ZGEDCOMID) f.gedcomID = field(s.ZGEDCOMID);
    if (s.ZTEMPLATE) f.template = ref('sourcetemplate', s.ZTEMPLATE);
    if (s.ZISBOOKMARKED) f.isBookmarked = field(s.ZISBOOKMARKED, 'INT64');
    if (s.ZCHANGEDATE) f.mft_changeDate = field(coreDataTimestamp(s.ZCHANGEDATE), 'TIMESTAMP');
    if (s.ZCREATIONDATE) f.mft_creationDate = field(coreDataTimestamp(s.ZCREATIONDATE), 'TIMESTAMP');
  }
  console.log(`  ${sources.length} sources`);
}

// ── Extract SourceTemplates ──
console.log('Extracting source templates...');
try {
  const stmpls = db.prepare('SELECT Z_PK, ZNAME, ZUNIQUEID FROM ZSOURCETEMPLATE').all();
  for (const st of stmpls) {
    const id = st.ZUNIQUEID || makeId('sourcetemplate', st.Z_PK);
    records[id] = { recordType: 'SourceTemplate', recordName: id, fields: {}, created: { timestamp: Date.now() }, modified: { timestamp: Date.now() } };
    if (st.ZNAME) records[id].fields.name = field(st.ZNAME);
    if (st.ZUNIQUEID) records[id].fields.uniqueID = field(st.ZUNIQUEID);
  }
  console.log(`  ${stmpls.length} source templates`);
} catch (e) { console.log('  SourceTemplates: skipped'); }

// ── Extract ChangeLogEntries ──
console.log('Extracting change log entries...');
try {
  const cles = db.prepare(`
    SELECT Z_PK, ZOBJECTENTITYNAME, ZOBJECTNAMEKEY, ZOBJECTNAMEKEYVALUESFORFORMATSTRING,
           ZOBJECTUNIQUEID, ZUNIQUEID, ZEARLIESTCHANGEDATE, ZLATESTCHANGEDATE
    FROM ZCHANGELOGENTRY
  `).all();
  for (const c of cles) {
    const id = makeId('changelogentry', c.Z_PK);
    records[id] = { recordType: 'ChangeLogEntry', recordName: id, fields: {},
      created: { timestamp: coreDataTimestamp(c.ZEARLIESTCHANGEDATE) || Date.now() },
      modified: { timestamp: coreDataTimestamp(c.ZLATESTCHANGEDATE) || Date.now() } };
    const f = records[id].fields;
    if (c.ZOBJECTENTITYNAME) f.objectEntityName = field(c.ZOBJECTENTITYNAME);
    if (c.ZOBJECTNAMEKEY) f.objectNameKey = field(c.ZOBJECTNAMEKEY);
    if (c.ZOBJECTNAMEKEYVALUESFORFORMATSTRING) f.objectNameKeyValuesForFormatString = field(c.ZOBJECTNAMEKEYVALUESFORFORMATSTRING);
    if (c.ZOBJECTUNIQUEID) f.objectUniqueID = field(c.ZOBJECTUNIQUEID);
    if (c.ZUNIQUEID) f.uniqueID = field(c.ZUNIQUEID);
    if (c.ZEARLIESTCHANGEDATE) f.earliestChangeDate = field(coreDataTimestamp(c.ZEARLIESTCHANGEDATE), 'TIMESTAMP');
    if (c.ZLATESTCHANGEDATE) f.latestChangeDate = field(coreDataTimestamp(c.ZLATESTCHANGEDATE), 'TIMESTAMP');
    f.changeDate = f.latestChangeDate || f.earliestChangeDate;
  }
  console.log(`  ${cles.length} change log entries`);
} catch (e) { console.log('  ChangeLogEntries: skipped (' + e.message + ')'); }

// ── Extract Places (Z_ENT = 28) ──
console.log('Extracting places...');
const places = db.prepare(`
  SELECT Z_PK, ZCACHED_NORMALLOCATIONSTRING, ZCACHED_SHORTLOCATIONSTRING,
         ZCACHED_STANDARDIZEDLOCATIONSTRING, ZUNIQUEID, ZTEMPLATE1,
         ZCHANGEDATE, ZCREATIONDATE, ZGEONAMEID, ZALTERNATEPLACENAMES, ZCOORDINATE,
         ZGEDCOMID, ZREFERENCENUMBERID
  FROM ZBASEOBJECT WHERE Z_ENT = ?
`).all(ENT.Place);

// Build PlaceKeyValue lookup: place Z_PK -> {templateKeyPK -> value}
const placeKeyValues = {};
try {
  const pkvs = db.prepare('SELECT ZPLACE, ZTEMPLATEKEY, ZVALUE FROM ZPLACEKEYVALUE').all();
  for (const pkv of pkvs) {
    if (!placeKeyValues[pkv.ZPLACE]) placeKeyValues[pkv.ZPLACE] = {};
    placeKeyValues[pkv.ZPLACE][pkv.ZTEMPLATEKEY] = pkv.ZVALUE;
  }
} catch {}

// Build PlaceTemplateKeyRelation lookup: template Z_PK -> [{keyPK, order}]
const templateKeyRelations = {};
try {
  const rels = db.prepare('SELECT ZTEMPLATE, ZTEMPLATEKEY, ZORDER FROM ZPLACETEMPLATEKEYRELATION ORDER BY ZORDER').all();
  for (const r of rels) {
    if (!templateKeyRelations[r.ZTEMPLATE]) templateKeyRelations[r.ZTEMPLATE] = [];
    templateKeyRelations[r.ZTEMPLATE].push({ keyPK: r.ZTEMPLATEKEY, order: r.ZORDER });
  }
} catch {}

// Build PlaceTemplateKey name lookup (from localization keys or key position)
const templateKeyNames = {};
try {
  const keys = db.prepare('SELECT Z_PK, ZINTERNATIONALNAME, ZLOCALNAME, ZLOCALIZABLEINTERNATIONALNAMEKEY FROM ZPLACETEMPLATEKEY').all();
  for (const k of keys) {
    // Use international name, or derive from localization key
    let name = k.ZINTERNATIONALNAME || k.ZLOCALNAME || '';
    if (!name && k.ZLOCALIZABLEINTERNATIONALNAMEKEY) {
      // Extract key name: _PlaceTemplateKey_Place -> Place
      const m = k.ZLOCALIZABLEINTERNATIONALNAMEKEY.match(/(?:PlaceTemplate_KeyName_|_PlaceTemplateKey_)(\w+)/);
      if (m) name = m[1];
    }
    templateKeyNames[k.Z_PK] = name;
  }
} catch {}

for (const pl of places) {
  const id = makeId('place', pl.Z_PK);
  records[id] = {
    recordType: 'Place',
    recordName: id,
    fields: {},
    created: { timestamp: coreDataTimestamp(pl.ZCREATIONDATE) || Date.now() },
    modified: { timestamp: coreDataTimestamp(pl.ZCHANGEDATE) || Date.now() },
  };
  const f = records[id].fields;

  // Resolve individual place components from PlaceKeyValues + template key relations
  if (pl.ZTEMPLATE1 && templateKeyRelations[pl.ZTEMPLATE1] && placeKeyValues[pl.Z_PK]) {
    const kvs = placeKeyValues[pl.Z_PK];
    const rels = templateKeyRelations[pl.ZTEMPLATE1];
    for (const rel of rels) {
      const keyName = templateKeyNames[rel.keyPK];
      const value = kvs[rel.keyPK];
      if (keyName && value) {
        // Map template key names to CloudKit field names
        const fieldMap = { Place: 'place', County: 'county', State: 'state', Country: 'country', City: 'place' };
        const fieldName = fieldMap[keyName] || keyName.toLowerCase();
        if (!f[fieldName]) f[fieldName] = field(value);
      }
    }
  }

  // Fallback: use cached string for the 'place' field if not set from components
  if (!f.place && pl.ZCACHED_NORMALLOCATIONSTRING) {
    f.place = field(pl.ZCACHED_NORMALLOCATIONSTRING);
  }
  if (pl.ZCACHED_NORMALLOCATIONSTRING) f.placeName = field(pl.ZCACHED_NORMALLOCATIONSTRING);
  if (pl.ZCACHED_SHORTLOCATIONSTRING) f.cached_shortLocationString = field(pl.ZCACHED_SHORTLOCATIONSTRING);
  if (pl.ZCACHED_STANDARDIZEDLOCATIONSTRING) f.cached_standardizedLocationString = field(pl.ZCACHED_STANDARDIZEDLOCATIONSTRING);
  if (pl.ZUNIQUEID) f.uniqueID = field(pl.ZUNIQUEID);
  if (pl.ZTEMPLATE1) f.template = ref('placetemplate', pl.ZTEMPLATE1);
  if (pl.ZGEONAMEID) f.geonameID = field(pl.ZGEONAMEID);
  if (pl.ZALTERNATEPLACENAMES) f.alternateNames = field(pl.ZALTERNATEPLACENAMES);
  if (pl.ZGEDCOMID) f.gedcomID = field(pl.ZGEDCOMID);
  if (pl.ZREFERENCENUMBERID) f.referenceNumberID = field(pl.ZREFERENCENUMBERID);
  if (pl.ZCHANGEDATE) f.mft_changeDate = field(coreDataTimestamp(pl.ZCHANGEDATE), 'TIMESTAMP');
  if (pl.ZCREATIONDATE) f.mft_creationDate = field(coreDataTimestamp(pl.ZCREATIONDATE), 'TIMESTAMP');
}
console.log(`  ${places.length} places`);

// ── Extract PlaceKeyValues ──
console.log('Extracting place key values...');
try {
  const pkvs = db.prepare('SELECT Z_PK, ZPLACE, ZTEMPLATEKEY, ZVALUE, ZUNIQUEID FROM ZPLACEKEYVALUE').all();
  for (const pkv of pkvs) {
    const id = makeId('placekeyvalue', pkv.Z_PK);
    records[id] = { recordType: 'PlaceKeyValue', recordName: id, fields: {}, created: { timestamp: Date.now() }, modified: { timestamp: Date.now() } };
    const f = records[id].fields;
    if (pkv.ZPLACE) f.place = ref('place', pkv.ZPLACE);
    if (pkv.ZTEMPLATEKEY) f.templateKey = ref('placetemplatekey', pkv.ZTEMPLATEKEY);
    if (pkv.ZVALUE) f.value = field(pkv.ZVALUE);
    if (pkv.ZUNIQUEID) f.uniqueID = field(pkv.ZUNIQUEID);
  }
  console.log(`  ${pkvs.length} place key values`);
} catch (e) { console.log('  PlaceKeyValues: skipped (' + e.message + ')'); }

// ── Extract Coordinates ──
console.log('Extracting coordinates...');
try {
  const coords = db.prepare(`
    SELECT Z_PK, ZPLACE, ZPLACEDETAIL, ZLATITUDEDEGREES, ZLATITUDEMINUTES, ZLATITUDESECONDS,
           ZLATITUDEISSOUTH, ZLONGITUDEDEGREES, ZLONGITUDEMINUTES, ZLONGITUDESECONDS,
           ZLONGITUDEISWEST, ZUNIQUEID
    FROM ZCOORDINATE
  `).all();
  for (const c of coords) {
    const id = makeId('coordinate', c.Z_PK);
    const f = {};
    if (c.ZLATITUDEDEGREES) f.latitudeDegrees = field(c.ZLATITUDEDEGREES);
    if (c.ZLATITUDEMINUTES) f.latitudeMinutes = field(c.ZLATITUDEMINUTES);
    if (c.ZLATITUDESECONDS) f.latitudeSeconds = field(c.ZLATITUDESECONDS);
    if (c.ZLATITUDEISSOUTH) f.latitudeIsSouth = field(c.ZLATITUDEISSOUTH, 'INT64');
    if (c.ZLONGITUDEDEGREES) f.longitudeDegrees = field(c.ZLONGITUDEDEGREES);
    if (c.ZLONGITUDEMINUTES) f.longitudeMinutes = field(c.ZLONGITUDEMINUTES);
    if (c.ZLONGITUDESECONDS) f.longitudeSeconds = field(c.ZLONGITUDESECONDS);
    if (c.ZLONGITUDEISWEST) f.longitudeIsWest = field(c.ZLONGITUDEISWEST, 'INT64');
    if (c.ZPLACE) f.place = ref('place', c.ZPLACE);
    if (c.ZPLACEDETAIL) f.placeDetail = ref('placedetail', c.ZPLACEDETAIL);
    if (c.ZUNIQUEID) f.uniqueID = field(c.ZUNIQUEID);

    // Also compute decimal lat/lon for convenience
    const lat = (parseFloat(c.ZLATITUDEDEGREES || 0) + parseFloat(c.ZLATITUDEMINUTES || 0) / 60 + parseFloat(c.ZLATITUDESECONDS || 0) / 3600) * (c.ZLATITUDEISSOUTH ? -1 : 1);
    const lon = (parseFloat(c.ZLONGITUDEDEGREES || 0) + parseFloat(c.ZLONGITUDEMINUTES || 0) / 60 + parseFloat(c.ZLONGITUDESECONDS || 0) / 3600) * (c.ZLONGITUDEISWEST ? -1 : 1);
    f.latitude = field(lat, 'DOUBLE');
    f.longitude = field(lon, 'DOUBLE');

    records[id] = { recordType: 'Coordinate', recordName: id, fields: f, created: { timestamp: Date.now() }, modified: { timestamp: Date.now() } };

    // Also attach coordinate reference to the place record
    if (c.ZPLACE) {
      const placeId = makeId('place', c.ZPLACE);
      if (records[placeId]) {
        records[placeId].fields.coordinate = ref('coordinate', c.Z_PK);
      }
    }
  }
  console.log(`  ${coords.length} coordinates`);
} catch (e) { console.log('  Coordinates: skipped (' + e.message + ')'); }

// ── Extract PlaceTemplates, Keys, KeyRelations ──
console.log('Extracting place templates...');
const ptTables = [
  { table: 'ZPLACETEMPLATE', type: 'PlaceTemplate', cols: 'Z_PK, ZNAME, ZCOUNTRYIDENTIFIER, ZUNIQUEID, ZLOCALIZEABLENAMEKEY' },
  { table: 'ZPLACETEMPLATEKEY', type: 'PlaceTemplateKey', cols: 'Z_PK, ZINTERNATIONALNAME, ZLOCALNAME, ZUNIQUEID' },
  { table: 'ZPLACETEMPLATEKEYRELATION', type: 'PlaceTemplateKeyRelation', cols: 'Z_PK, ZTEMPLATE, ZTEMPLATEKEY, ZUNIQUEID, ZORDER' },
];
for (const t of ptTables) {
  try {
    const rows = db.prepare(`SELECT ${t.cols} FROM ${t.table}`).all();
    for (const r of rows) {
      const id = makeId(t.type.toLowerCase(), r.Z_PK);
      records[id] = {
        recordType: t.type,
        recordName: id,
        fields: {},
        created: { timestamp: Date.now() },
        modified: { timestamp: Date.now() },
      };
      const f = records[id].fields;
      if (r.ZNAME) f.name = field(r.ZNAME);
      if (r.ZCOUNTRYIDENTIFIER) f.countryIdentifier = field(r.ZCOUNTRYIDENTIFIER);
      if (r.ZINTERNATIONALNAME) f.internationalName = field(r.ZINTERNATIONALNAME);
      if (r.ZLOCALNAME) f.localName = field(r.ZLOCALNAME);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZLOCALIZEABLENAMEKEY) f.localizeableNameKey = field(r.ZLOCALIZEABLENAMEKEY);
      // Derive name from uniqueID if not present (PlaceTemplate_Norway -> Norway)
      if (!r.ZNAME && r.ZUNIQUEID && t.type === 'PlaceTemplate') {
        const derivedName = r.ZUNIQUEID.replace('PlaceTemplate_', '').replace(/_/g, ' ');
        f.name = field(derivedName);
      }
      if (r.ZTEMPLATE) f.template = ref('placetemplate', r.ZTEMPLATE);
      if (r.ZTEMPLATEKEY) f.templateKey = ref('placetemplatekey', r.ZTEMPLATEKEY);
      if (r.ZORDER !== undefined && r.ZORDER !== null) f.order = field(r.ZORDER, 'DOUBLE');
    }
    console.log(`  ${rows.length} ${t.type} records`);
  } catch (e) { console.log(`  ${t.type}: skipped (${e.message})`); }
}

// ── Extract FamilyTreeInformation (Z_ENT = 8) ──
console.log('Extracting tree info...');
const treeInfo = db.prepare(`
  SELECT Z_PK, ZNAME, ZUNIQUEID FROM ZBASEOBJECT WHERE Z_ENT = ?
`).all(ENT.FamilyTreeInformation);

for (const ti of treeInfo) {
  const id = makeId('treeinfo', ti.Z_PK);
  records[id] = {
    recordType: 'FamilyTreeInformation',
    recordName: id,
    fields: {},
    created: { timestamp: Date.now() },
    modified: { timestamp: Date.now() },
  };
  if (ti.ZNAME) records[id].fields.name = field(ti.ZNAME);
  if (ti.ZUNIQUEID) records[id].fields.uniqueID = field(ti.ZUNIQUEID);
}
console.log(`  ${treeInfo.length} tree info records`);

// ── Build output ──
const output = {
  records,
  zones: {
    defaultZone: {
      zoneName: treeInfo[0]?.ZNAME || basename(mftpkgPath, '.mftpkg'),
      zoneShortName: 'default',
      ownerRecordName: '_demo_user',
    },
  },
  meta: {
    source: basename(mftpkgPath),
    extractedAt: new Date().toISOString(),
    counts: {
      persons: persons.length,
      families: families.length,
      childRelations: childRels.length,
      personEvents: personEvents.length,
      familyEvents: familyEvents.length,
      places: places.length,
    },
  },
};

const totalRecords = Object.keys(records).length;
console.log(`\nTotal: ${totalRecords} records`);

writeFileSync(outputPath, JSON.stringify(output), 'utf8');
const sizeKB = (Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(1);
console.log(`Written to ${outputPath} (${sizeKB} KB)`);

db.close();
