/**
 * MFTPKGImporter — reads MacFamilyTree .mftpkg SQLite databases in the browser.
 *
 * Uses sql.js (SQLite compiled to WebAssembly) to parse the SQLite file
 * directly in the browser, then converts the data to our record format
 * and stores it in IndexedDB via LocalDatabase.
 *
 * Supports:
 * - Drag-and-drop of the `database` file from inside a .mftpkg folder
 * - File picker selection
 * - Pre-extracted JSON (from the Node.js extract script)
 *
 * Usage:
 *   const importer = new MFTPKGImporter();
 *   const result = await importer.importFromFile(file);
 *   // result = { persons: 836, families: 282, ... }
 */
import { getLocalDatabase } from './LocalDatabase.js';

// sql.js is loaded dynamically on first use.
// Both sql-wasm.js and sql-wasm.wasm are served from public/ — fully local, no CDN.
let _SQL = null;

async function getSqlJs() {
  if (_SQL) return _SQL;

  // Load the sql.js script into the page (it sets window.initSqlJs)
  if (!window.initSqlJs) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      // Use base tag or fallback to detect base path (works with GitHub Pages subpath)
      var base = document.querySelector('base')?.href || import.meta.env?.BASE_URL || '/';
      script.src = base + 'sql-wasm.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load sql-wasm.js'));
      document.head.appendChild(script);
    });
  }

  _SQL = await window.initSqlJs({
    locateFile: () => (document.querySelector('base')?.href || import.meta.env?.BASE_URL || '/') + 'sql-wasm.wasm',
  });
  return _SQL;
}

export class MFTPKGImporter {
  constructor() {
    this.onProgress = null; // callback(stage, current, total)
  }

  /**
   * Import from a File object (the `database` file from .mftpkg).
   * @param {File} file - The SQLite database file
   * @returns {Promise<object>} Import summary
   */
  async importFromFile(file) {
    this._progress('loading', 0, 1);

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Check if it's a JSON file first
    if (file.name.endsWith('.json') || uint8Array[0] === 0x7B /* { */) {
      try {
        const text = new TextDecoder().decode(uint8Array);
        const data = JSON.parse(text);
        if (data.records) {
          return await this.importFromJSON(data);
        }
      } catch (e) {
        // Not JSON, try SQLite
      }
    }

    // Check for SQLite magic bytes: "SQLite format 3\0"
    const header = new TextDecoder().decode(uint8Array.slice(0, 64));

    // If it's a ZIP (macOS zips .mftpkg packages on drag), extract the database file from it
    if (uint8Array[0] === 0x50 && uint8Array[1] === 0x4B) { // "PK" = ZIP
      this._progress('extracting', 0, 1);
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Find the 'database' file inside the ZIP
      let dbEntry = null;
      zip.forEach((path, entry) => {
        if (!entry.dir && path.endsWith('/database')) {
          dbEntry = entry;
        }
      });

      if (!dbEntry) {
        // Try just 'database' at root level
        dbEntry = zip.file('database');
      }

      if (!dbEntry) {
        const files = [];
        zip.forEach((path) => files.push(path));
        throw new Error(
          'ZIP does not contain a "database" file. Found: ' + files.slice(0, 10).join(', ')
        );
      }

      console.log('[MFTPKGImporter] Extracted database from ZIP:', dbEntry.name);
      const dbBuffer = await dbEntry.async('uint8array');
      const SQL = await getSqlJs();
      const db = new SQL.Database(dbBuffer);
      try {
        return await this._extractAndImport(db, file.name.replace('.zip', ''));
      } finally {
        db.close();
      }
    }

    if (!header.startsWith('SQLite format 3')) {
      throw new Error(
        'Not a recognized file format. ' +
        'Drag your .mftpkg file, the "database" file from inside it, or a .json export.'
      );
    }

    this._progress('parsing', 0, 1);
    const SQL = await getSqlJs();
    const db = new SQL.Database(uint8Array);

    try {
      return await this._extractAndImport(db, file.name);
    } finally {
      db.close();
    }
  }

  /**
   * Import from a pre-extracted JSON object (from family-data.json).
   * @param {object} jsonData - The extracted dataset
   */
  async importFromJSON(jsonData) {
    this._progress('importing', 0, 1);
    const localDB = getLocalDatabase();
    const count = await localDB.importDataset(jsonData);
    this._progress('done', count, count);
    return { total: count, source: 'json' };
  }

  /**
   * Import from a URL pointing to a JSON file.
   */
  async importFromURL(url) {
    this._progress('downloading', 0, 1);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    const data = await response.json();
    return this.importFromJSON(data);
  }

  // ── Internal extraction ──

  async _extractAndImport(db, sourceName) {
    // Get entity type mapping
    const entityMap = { _names: {} };
    const entities = db.exec('SELECT Z_ENT, Z_NAME FROM Z_PRIMARYKEY');
    if (entities.length > 0) {
      for (const row of entities[0].values) {
        entityMap[row[1]] = row[0]; // name -> ent ID
        entityMap._names[row[0]] = row[1]; // ent ID -> name (reverse)
      }
    }

    const records = {};
    const counts = {};

    function makeId(type, pk) {
      return `${type.toLowerCase()}-${pk}`;
    }

    function field(value, type) {
      if (value === null || value === undefined) return undefined;
      return { value, type: type || 'STRING' };
    }

    // CloudKit reference format: "recordName---RecordType"
    // The app expects this string format, NOT an object like {recordName, action}
    const RECORD_TYPE_MAP = {
      person: 'Person', family: 'Family', place: 'Place', source: 'Source',
      personevent: 'PersonEvent', familyevent: 'FamilyEvent',
      childrelation: 'ChildRelation', placetemplate: 'PlaceTemplate',
      placetemplatekey: 'PlaceTemplateKey', placekeyvalue: 'PlaceKeyValue',
      coordinate: 'Coordinate', placedetail: 'PlaceDetail',
      source: 'Source', sourcetemplate: 'SourceTemplate',
      changelogentry: 'ChangeLogEntry', changelogsubentry: 'ChangeLogSubEntry',
      treeinfo: 'FamilyTreeInformation',
    };

    function ref(targetType, pk) {
      if (!pk) return undefined;
      const id = makeId(targetType, pk);
      const ckType = RECORD_TYPE_MAP[targetType] || targetType;
      return { value: id + '---' + ckType, type: 'REFERENCE' };
    }

    // CoreData timestamp: seconds since 2001-01-01 -> JS ms
    function cdTs(val) {
      if (val === null || val === undefined) return null;
      return Math.round((val * 1000) + 978307200000);
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
    }

    // Helper: run query safely, return rows or empty
    function q(sql) {
      try {
        const r = db.exec(sql);
        if (r.length === 0) return [];
        return r[0].values.map(row => Object.fromEntries(r[0].columns.map((c, i) => [c, row[i]])));
      } catch { return []; }
    }

    // ── Extract Persons ──
    this._progress('extracting', 0, 11);
    if (entityMap.Person) {
      for (const r of q(`
        SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZGENDER, ZNAMEPREFIX, ZNAMESUFFIX, ZNAMEMIDDLE,
               ZCACHED_BIRTHDATE, ZCACHED_DEATHDATE, ZCACHED_FULLNAME, ZCACHED_FULLNAMEFORSORTING,
               ZUNIQUEID, ZISSTARTPERSON, ZISBOOKMARKED2, ZISPRIVATE,
               ZGEDCOMID, ZREFERENCENUMBERID, ZANCESTRALFILENUMBERID, ZFAMILYSEARCHID,
               ZCHANGEDATE, ZCREATIONDATE
        FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Person}
      `)) {
        const id = makeId('person', r.Z_PK);
        const f = {};
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
        if (r.ZCHANGEDATE) f.mft_changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
        if (r.ZCREATIONDATE) f.mft_creationDate = field(cdTs(r.ZCREATIONDATE), 'TIMESTAMP');
        addRecord(id, 'Person', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
      }
    }

    // ── Extract Families ──
    this._progress('extracting', 1, 11);
    if (entityMap.Family) {
      for (const r of q(`
        SELECT Z_PK, ZMAN, ZWOMAN, ZCACHED_MARRIAGEDATE, ZUNIQUEID,
               ZCHANGEDATE, ZCREATIONDATE, ZGEDCOMID
        FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Family}
      `)) {
        const id = makeId('family', r.Z_PK);
        const f = {};
        if (r.ZMAN) f.man = ref('person', r.ZMAN);
        if (r.ZWOMAN) f.woman = ref('person', r.ZWOMAN);
        if (r.ZCACHED_MARRIAGEDATE) f.cached_marriageDate = field(r.ZCACHED_MARRIAGEDATE);
        if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
        if (r.ZGEDCOMID) f.gedcomID = field(r.ZGEDCOMID);
        if (r.ZCHANGEDATE) f.mft_changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
        if (r.ZCREATIONDATE) f.mft_creationDate = field(cdTs(r.ZCREATIONDATE), 'TIMESTAMP');
        addRecord(id, 'Family', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
      }
    }

    // ── Extract Child Relations ──
    this._progress('extracting', 2, 7);
    {
      const rows = db.exec('SELECT Z_PK, ZFAMILY, ZCHILD FROM ZCHILDRELATION');
      if (rows.length > 0) {
        const cols = rows[0].columns;
        for (const row of rows[0].values) {
          const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          const id = makeId('childrelation', r.Z_PK);
          const fields = {};
          if (r.ZFAMILY) fields.family = ref('family', r.ZFAMILY);
          if (r.ZCHILD) fields.child = ref('person', r.ZCHILD);
          addRecord(id, 'ChildRelation', fields);
        }
      }
    }

    // ── Extract Person Events ──
    this._progress('extracting', 3, 11);
    if (entityMap.PersonEvent) {
      for (const r of q(`
        SELECT e.Z_PK, e.ZPERSON1 as ZPERSON, e.ZDATE2 as ZDATE,
               e.ZASSIGNEDPLACE, e.ZUSERDESCRIPTION1, e.ZUNIQUEID,
               e.ZCAUSE, e.ZVALUE, e.ZCHANGEDATE, e.ZCREATIONDATE,
               c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
        FROM ZBASEOBJECT e
        LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE2
        WHERE e.Z_ENT = ${entityMap.PersonEvent}
      `)) {
        const id = makeId('personevent', r.Z_PK);
        const f = {};
        if (r.ZPERSON) f.person = ref('person', r.ZPERSON);
        if (r.CTYPE_UID) {
          const ctypeEntName = entityMap._names?.[r.CTYPE_ENT] || 'ConclusionPersonEventType';
          f.conclusionType = { value: r.CTYPE_UID + '---' + ctypeEntName, type: 'REFERENCE' };
        }
        if (r.CONCLUSION_NAME) f.eventType = field(r.CONCLUSION_NAME);
        if (r.ZDATE) f.date = field(r.ZDATE);
        if (r.ZASSIGNEDPLACE) f.assignedPlace = ref('place', r.ZASSIGNEDPLACE);
        if (r.ZUSERDESCRIPTION1) f.userDescription = field(r.ZUSERDESCRIPTION1);
        if (r.ZCAUSE) f.cause = field(r.ZCAUSE);
        if (r.ZVALUE) f.value = field(r.ZVALUE);
        if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
        addRecord(id, 'PersonEvent', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
      }
    }

    // ── Extract Family Events ──
    this._progress('extracting', 4, 11);
    if (entityMap.FamilyEvent) {
      for (const r of q(`
        SELECT e.Z_PK, e.ZFAMILY, e.ZDATE1 as ZDATE,
               e.ZASSIGNEDPLACE, e.ZUNIQUEID, e.ZCHANGEDATE, e.ZCREATIONDATE,
               c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
        FROM ZBASEOBJECT e
        LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE1
        WHERE e.Z_ENT = ${entityMap.FamilyEvent}
      `)) {
        const id = makeId('familyevent', r.Z_PK);
        const f = {};
        if (r.ZFAMILY) f.family = ref('family', r.ZFAMILY);
        if (r.CTYPE_UID) {
          const ctypeEntName = entityMap._names?.[r.CTYPE_ENT] || 'ConclusionFamilyEventType';
          f.conclusionType = { value: r.CTYPE_UID + '---' + ctypeEntName, type: 'REFERENCE' };
        }
        if (r.CONCLUSION_NAME) f.eventType = field(r.CONCLUSION_NAME);
        if (r.ZDATE) f.date = field(r.ZDATE);
        if (r.ZASSIGNEDPLACE) f.assignedPlace = ref('place', r.ZASSIGNEDPLACE);
        if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
        addRecord(id, 'FamilyEvent', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
      }
    }

    // ── Extract PersonFacts ──
    this._progress('extracting', 5, 11);
    if (entityMap.PersonFact) {
      for (const r of q(`
        SELECT e.Z_PK, e.ZPERSON2 as ZPERSON, e.ZVALUE, e.ZUSERDESCRIPTION2,
               e.ZUNIQUEID, e.ZCHANGEDATE, e.ZCREATIONDATE,
               c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
        FROM ZBASEOBJECT e
        LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE3
        WHERE e.Z_ENT = ${entityMap.PersonFact}
      `)) {
        const id = makeId('personfact', r.Z_PK);
        const f = {};
        if (r.ZPERSON) f.person = ref('person', r.ZPERSON);
        if (r.CTYPE_UID) {
          const ctypeEntName = entityMap._names?.[r.CTYPE_ENT] || 'ConclusionPersonFactType';
          f.conclusionType = { value: r.CTYPE_UID + '---' + ctypeEntName, type: 'REFERENCE' };
        }
        if (r.CONCLUSION_NAME) f.factType = field(r.CONCLUSION_NAME);
        if (r.ZVALUE) f.value = field(r.ZVALUE);
        if (r.ZUSERDESCRIPTION2) f.description = field(r.ZUSERDESCRIPTION2);
        if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
        addRecord(id, 'PersonFact', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
      }
    }

    // ── Extract ConclusionTypes with icon data ──
    this._progress('extracting', 6, 11);
    {
      // Note: HEX() converts BLOB to hex string; we convert to base64 in JS
      const rows = db.exec(`
        SELECT Z_PK, Z_ENT, ZTYPENAME, ZTYPENAMELOCALIZATIONKEY, ZUNIQUEID,
               ZISENABLED, ZISUSERCREATED, ZORDER, ZGEDCOMTAG, ZIDENTIFIER,
               ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME, ZINVERTEDTYPENAME,
               HEX(ZICONPNGDATA) as ICON_HEX
        FROM ZCONCLUSIONTYPE
      `);
      if (rows.length > 0) {
        const cols = rows[0].columns;
        for (const row of rows[0].values) {
          const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          const entName = entityMap._names?.[r.Z_ENT] || 'ConclusionType';
          const id = r.ZUNIQUEID || makeId('conclusiontype', r.Z_PK);
          const fields = {};
          if (r.ZTYPENAME) fields.typeName = field(r.ZTYPENAME);
          if (r.ZTYPENAMELOCALIZATIONKEY) fields.typeNameLocalizationKey = field(r.ZTYPENAMELOCALIZATIONKEY);
          if (r.ZUNIQUEID) fields.uniqueID = field(r.ZUNIQUEID);
          if (r.ZIDENTIFIER) fields.identifier = field(r.ZIDENTIFIER);
          if (r.ZISENABLED !== null) fields.isEnabled = field(r.ZISENABLED, 'INT64');
          if (r.ZISUSERCREATED !== null) fields.isUserCreated = field(r.ZISUSERCREATED, 'INT64');
          if (r.ZORDER !== null) fields.order = field(r.ZORDER, 'DOUBLE');
          if (r.ZGEDCOMTAG) fields.gedcomTag = field(r.ZGEDCOMTAG);
          if (r.ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME) fields.compatibleAssociatedContainerClassName = field(r.ZCOMPATIBLEASSOCIATEDCONTAINERCLASSNAME);
          if (r.ZINVERTEDTYPENAME) fields.invertedTypeName = field(r.ZINVERTEDTYPENAME);
          if (r.ICON_HEX) {
            // Convert hex to base64 for the icon PNG
            const bytes = new Uint8Array(r.ICON_HEX.match(/.{2}/g).map(h => parseInt(h, 16)));
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            fields.iconPNGData = field(btoa(binary));
          }
          addRecord(id, entName, fields);
        }
      }
    }

    // ── Extract Labels ──
    this._progress('extracting', 7, 11);
    for (const r of q('SELECT Z_PK, ZTITLE, ZCOLORCOMPONENTSSTRING, ZUNIQUEID FROM ZLABEL')) {
      const id = makeId('label', r.Z_PK);
      const f = {};
      if (r.ZTITLE) f.title = field(r.ZTITLE);
      if (r.ZCOLORCOMPONENTSSTRING) f.colorComponentsString = field(r.ZCOLORCOMPONENTSSTRING);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(id, 'Label', f);
    }

    // ── Extract LabelRelations ──
    for (const r of q('SELECT Z_PK, ZLABEL, ZBASEOBJECT, ZUNIQUEID FROM ZLABELRELATION')) {
      const id = makeId('labelrelation', r.Z_PK);
      const f = {};
      if (r.ZLABEL) f.label = ref('label', r.ZLABEL);
      if (r.ZBASEOBJECT) f.baseObject = ref('person', r.ZBASEOBJECT);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(id, 'LabelRelation', f);
    }

    // ── Extract Sources ──
    this._progress('extracting', 7, 14);
    if (entityMap.Source) {
      for (const r of q(`
        SELECT Z_PK, ZCACHED_TITLE, ZCACHED_DATE, ZTEXT, ZUNIQUEID, ZGEDCOMID,
               ZTEMPLATE, ZCHANGEDATE, ZCREATIONDATE, ZISBOOKMARKED
        FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Source}
      `)) {
        const id = makeId('source', r.Z_PK);
        const f = {};
        if (r.ZCACHED_TITLE) { f.cached_title = field(r.ZCACHED_TITLE); f.title = field(r.ZCACHED_TITLE); }
        if (r.ZCACHED_DATE) f.cached_date = field(r.ZCACHED_DATE);
        if (r.ZTEXT) f.text = field(r.ZTEXT);
        if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
        if (r.ZGEDCOMID) f.gedcomID = field(r.ZGEDCOMID);
        if (r.ZTEMPLATE) f.template = ref('sourcetemplate', r.ZTEMPLATE);
        if (r.ZISBOOKMARKED) f.isBookmarked = field(r.ZISBOOKMARKED, 'INT64');
        if (r.ZCHANGEDATE) f.mft_changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
        if (r.ZCREATIONDATE) f.mft_creationDate = field(cdTs(r.ZCREATIONDATE), 'TIMESTAMP');
        addRecord(id, 'Source', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
      }
    }

    // ── Extract SourceTemplates ──
    for (const r of q('SELECT Z_PK, ZNAME, ZUNIQUEID FROM ZSOURCETEMPLATE')) {
      const id = r.ZUNIQUEID || makeId('sourcetemplate', r.Z_PK);
      const f = {};
      if (r.ZNAME) f.name = field(r.ZNAME);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      addRecord(id, 'SourceTemplate', f);
    }

    // ── Extract ChangeLogEntries ──
    this._progress('extracting', 8, 14);
    for (const r of q(`
      SELECT Z_PK, ZOBJECTENTITYNAME, ZOBJECTNAMEKEY, ZOBJECTNAMEKEYVALUESFORFORMATSTRING,
             ZOBJECTUNIQUEID, ZUNIQUEID, ZEARLIESTCHANGEDATE, ZLATESTCHANGEDATE
      FROM ZCHANGELOGENTRY
    `)) {
      const id = makeId('changelogentry', r.Z_PK);
      const f = {};
      if (r.ZOBJECTENTITYNAME) f.objectEntityName = field(r.ZOBJECTENTITYNAME);
      if (r.ZOBJECTNAMEKEY) f.objectNameKey = field(r.ZOBJECTNAMEKEY);
      if (r.ZOBJECTNAMEKEYVALUESFORFORMATSTRING) f.objectNameKeyValuesForFormatString = field(r.ZOBJECTNAMEKEYVALUESFORFORMATSTRING);
      if (r.ZOBJECTUNIQUEID) f.objectUniqueID = field(r.ZOBJECTUNIQUEID);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZEARLIESTCHANGEDATE) f.earliestChangeDate = field(cdTs(r.ZEARLIESTCHANGEDATE), 'TIMESTAMP');
      if (r.ZLATESTCHANGEDATE) f.latestChangeDate = field(cdTs(r.ZLATESTCHANGEDATE), 'TIMESTAMP');
      f.changeDate = f.latestChangeDate || f.earliestChangeDate;
      addRecord(id, 'ChangeLogEntry', f, cdTs(r.ZEARLIESTCHANGEDATE), cdTs(r.ZLATESTCHANGEDATE));
    }

    // ── Extract ChangeLogSubEntries ──
    this._progress('extracting', 9, 14);
    for (const r of q(`
      SELECT Z_PK, ZSUPERENTRY, ZCHANGETYPE, ZCHANGEDATE, ZCHANGEKEY,
             ZCHANGEKEYVALUESFORFORMATSTRING, ZCHANGEOBJECTENTITYNAME,
             ZCHANGEOBJECTUNIQUEID, ZCHANGEDKEYINCHANGEOBJECT, ZUNIQUEID, ZUSERNAME
      FROM ZCHANGELOGSUBENTRY
    `)) {
      const id = makeId('changelogsubentry', r.Z_PK);
      const f = {};
      if (r.ZSUPERENTRY) f.superEntry = ref('changelogentry', r.ZSUPERENTRY);
      if (r.ZCHANGETYPE !== null) f.changeType = field(r.ZCHANGETYPE, 'INT64');
      if (r.ZCHANGEDATE) f.changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
      if (r.ZCHANGEKEY) f.changeKey = field(r.ZCHANGEKEY);
      if (r.ZCHANGEKEYVALUESFORFORMATSTRING) f.changeKeyValuesForFormatString = field(r.ZCHANGEKEYVALUESFORFORMATSTRING);
      if (r.ZCHANGEOBJECTENTITYNAME) f.changeObjectEntityName = field(r.ZCHANGEOBJECTENTITYNAME);
      if (r.ZCHANGEOBJECTUNIQUEID) f.changeObjectUniqueID = field(r.ZCHANGEOBJECTUNIQUEID);
      if (r.ZCHANGEDKEYINCHANGEOBJECT) f.changedKeyInChangeObject = field(r.ZCHANGEDKEYINCHANGEOBJECT);
      if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
      if (r.ZUSERNAME) f.userName = field(r.ZUSERNAME);
      addRecord(id, 'ChangeLogSubEntry', f, cdTs(r.ZCHANGEDATE), cdTs(r.ZCHANGEDATE));
    }

    // ── Extract Places with components and coordinates ──
    this._progress('extracting', 8, 11);
    if (entityMap.Place) {
      // Build PlaceKeyValue lookup
      const placeKVs = {};
      for (const r of q('SELECT ZPLACE, ZTEMPLATEKEY, ZVALUE FROM ZPLACEKEYVALUE')) {
        if (!placeKVs[r.ZPLACE]) placeKVs[r.ZPLACE] = {};
        placeKVs[r.ZPLACE][r.ZTEMPLATEKEY] = r.ZVALUE;
      }
      // Build template key relations
      const tmplKeyRels = {};
      for (const r of q('SELECT ZTEMPLATE, ZTEMPLATEKEY, ZORDER FROM ZPLACETEMPLATEKEYRELATION ORDER BY ZORDER')) {
        if (!tmplKeyRels[r.ZTEMPLATE]) tmplKeyRels[r.ZTEMPLATE] = [];
        tmplKeyRels[r.ZTEMPLATE].push({ keyPK: r.ZTEMPLATEKEY });
      }
      // Build template key names
      const keyNames = {};
      for (const r of q('SELECT Z_PK, ZINTERNATIONALNAME, ZLOCALNAME, ZLOCALIZABLEINTERNATIONALNAMEKEY FROM ZPLACETEMPLATEKEY')) {
        let name = r.ZINTERNATIONALNAME || r.ZLOCALNAME || '';
        if (!name && r.ZLOCALIZABLEINTERNATIONALNAMEKEY) {
          const m = r.ZLOCALIZABLEINTERNATIONALNAMEKEY.match(/(?:PlaceTemplate_KeyName_|_PlaceTemplateKey_)(\w+)/);
          if (m) name = m[1];
        }
        keyNames[r.Z_PK] = name;
      }

      for (const r of q(`
        SELECT Z_PK, ZCACHED_NORMALLOCATIONSTRING, ZCACHED_SHORTLOCATIONSTRING,
               ZCACHED_STANDARDIZEDLOCATIONSTRING, ZUNIQUEID, ZTEMPLATE1,
               ZCHANGEDATE, ZCREATIONDATE, ZGEONAMEID, ZALTERNATEPLACENAMES,
               ZGEDCOMID, ZREFERENCENUMBERID
        FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Place}
      `)) {
        const id = makeId('place', r.Z_PK);
        const f = {};
        // Resolve individual components
        if (r.ZTEMPLATE1 && tmplKeyRels[r.ZTEMPLATE1] && placeKVs[r.Z_PK]) {
          const kvs = placeKVs[r.Z_PK];
          for (const rel of (tmplKeyRels[r.ZTEMPLATE1] || [])) {
            const kn = keyNames[rel.keyPK];
            const v = kvs[rel.keyPK];
            if (kn && v) {
              const fm = { Place: 'place', County: 'county', State: 'state', Country: 'country', City: 'place' };
              const fn = fm[kn] || kn.toLowerCase();
              if (!f[fn]) f[fn] = field(v);
            }
          }
        }
        if (!f.place && r.ZCACHED_NORMALLOCATIONSTRING) f.place = field(r.ZCACHED_NORMALLOCATIONSTRING);
        if (r.ZCACHED_NORMALLOCATIONSTRING) f.placeName = field(r.ZCACHED_NORMALLOCATIONSTRING);
        if (r.ZCACHED_SHORTLOCATIONSTRING) f.cached_shortLocationString = field(r.ZCACHED_SHORTLOCATIONSTRING);
        if (r.ZCACHED_STANDARDIZEDLOCATIONSTRING) f.cached_standardizedLocationString = field(r.ZCACHED_STANDARDIZEDLOCATIONSTRING);
        if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
        if (r.ZTEMPLATE1) f.template = ref('placetemplate', r.ZTEMPLATE1);
        if (r.ZGEONAMEID) f.geonameID = field(r.ZGEONAMEID);
        if (r.ZALTERNATEPLACENAMES) f.alternateNames = field(r.ZALTERNATEPLACENAMES);
        if (r.ZGEDCOMID) f.gedcomID = field(r.ZGEDCOMID);
        if (r.ZREFERENCENUMBERID) f.referenceNumberID = field(r.ZREFERENCENUMBERID);
        if (r.ZCHANGEDATE) f.mft_changeDate = field(cdTs(r.ZCHANGEDATE), 'TIMESTAMP');
        if (r.ZCREATIONDATE) f.mft_creationDate = field(cdTs(r.ZCREATIONDATE), 'TIMESTAMP');
        addRecord(id, 'Place', f, cdTs(r.ZCREATIONDATE), cdTs(r.ZCHANGEDATE));
      }

      // Extract PlaceKeyValues
      for (const r of q('SELECT Z_PK, ZPLACE, ZTEMPLATEKEY, ZVALUE, ZUNIQUEID FROM ZPLACEKEYVALUE')) {
        const id = makeId('placekeyvalue', r.Z_PK);
        const f = {};
        if (r.ZPLACE) f.place = ref('place', r.ZPLACE);
        if (r.ZTEMPLATEKEY) f.templateKey = ref('placetemplatekey', r.ZTEMPLATEKEY);
        if (r.ZVALUE) f.value = field(r.ZVALUE);
        if (r.ZUNIQUEID) f.uniqueID = field(r.ZUNIQUEID);
        addRecord(id, 'PlaceKeyValue', f);
      }

      // Extract coordinates
      for (const c of q(`
        SELECT Z_PK, ZPLACE, ZPLACEDETAIL, ZLATITUDEDEGREES, ZLATITUDEMINUTES, ZLATITUDESECONDS,
               ZLATITUDEISSOUTH, ZLONGITUDEDEGREES, ZLONGITUDEMINUTES, ZLONGITUDESECONDS,
               ZLONGITUDEISWEST, ZUNIQUEID
        FROM ZCOORDINATE
      `)) {
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
        if (c.ZUNIQUEID) f.uniqueID = field(c.ZUNIQUEID);
        const lat = (parseFloat(c.ZLATITUDEDEGREES||0) + parseFloat(c.ZLATITUDEMINUTES||0)/60 + parseFloat(c.ZLATITUDESECONDS||0)/3600) * (c.ZLATITUDEISSOUTH ? -1 : 1);
        const lon = (parseFloat(c.ZLONGITUDEDEGREES||0) + parseFloat(c.ZLONGITUDEMINUTES||0)/60 + parseFloat(c.ZLONGITUDESECONDS||0)/3600) * (c.ZLONGITUDEISWEST ? -1 : 1);
        f.latitude = field(lat, 'DOUBLE');
        f.longitude = field(lon, 'DOUBLE');
        addRecord(id, 'Coordinate', f);
        // Attach to place
        const placeId = c.ZPLACE ? makeId('place', c.ZPLACE) : null;
        if (placeId && records[placeId]) records[placeId].fields.coordinate = ref('coordinate', c.Z_PK);
      }
    }

    // ── Extract PlaceTemplates, Keys, KeyRelations ──
    this._progress('extracting', 8, 11);
    {
      const tables = [
        { table: 'ZPLACETEMPLATE', type: 'PlaceTemplate', cols: 'Z_PK, ZNAME, ZCOUNTRYIDENTIFIER, ZUNIQUEID, ZLOCALIZEABLENAMEKEY' },
        { table: 'ZPLACETEMPLATEKEY', type: 'PlaceTemplateKey', cols: 'Z_PK, ZINTERNATIONALNAME, ZLOCALNAME, ZUNIQUEID' },
        { table: 'ZPLACETEMPLATEKEYRELATION', type: 'PlaceTemplateKeyRelation', cols: 'Z_PK, ZTEMPLATE, ZTEMPLATEKEY, ZUNIQUEID, ZORDER' },
      ];
      for (const t of tables) {
        try {
          const rows = db.exec(`SELECT ${t.cols} FROM ${t.table}`);
          if (rows.length > 0) {
            const cols = rows[0].columns;
            for (const row of rows[0].values) {
              const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
              const id = makeId(t.type.toLowerCase(), r.Z_PK);
              const fields = {};
              if (r.ZNAME) fields.name = field(r.ZNAME);
              if (r.ZCOUNTRYIDENTIFIER) fields.countryIdentifier = field(r.ZCOUNTRYIDENTIFIER);
              if (r.ZINTERNATIONALNAME) fields.internationalName = field(r.ZINTERNATIONALNAME);
              if (r.ZLOCALNAME) fields.localName = field(r.ZLOCALNAME);
              if (r.ZUNIQUEID) fields.uniqueID = field(r.ZUNIQUEID);
              if (r.ZLOCALIZEABLENAMEKEY) fields.localizeableNameKey = field(r.ZLOCALIZEABLENAMEKEY);
              if (r.ZTEMPLATE) fields.template = ref('placetemplate', r.ZTEMPLATE);
              if (r.ZTEMPLATEKEY) fields.templateKey = ref('placetemplatekey', r.ZTEMPLATEKEY);
              if (r.ZORDER !== undefined && r.ZORDER !== null) fields.order = field(r.ZORDER, 'DOUBLE');
              // Derive name from uniqueID if not present
              if (!r.ZNAME && r.ZUNIQUEID && t.type === 'PlaceTemplate') {
                fields.name = field(r.ZUNIQUEID.replace('PlaceTemplate_', '').replace(/_/g, ' '));
              }
              addRecord(id, t.type, fields);
            }
          }
        } catch (e) { /* table might not exist */ }
      }
    }

    // ── Extract FamilyTreeInformation ──
    this._progress('extracting', 10, 11);
    if (entityMap.FamilyTreeInformation) {
      const rows = db.exec(`
        SELECT Z_PK, ZNAME, ZUNIQUEID FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.FamilyTreeInformation}
      `);
      if (rows.length > 0) {
        for (const row of rows[0].values) {
          const id = makeId('treeinfo', row[0]);
          const fields = {};
          if (row[1]) fields.name = field(row[1]);
          if (row[2]) fields.uniqueID = field(row[2]);
          addRecord(id, 'FamilyTreeInformation', fields);
        }
      }
    }

    // Find tree name
    const treeInfoRecords = Object.values(records).filter((r) => r.recordType === 'FamilyTreeInformation');
    const treeName = treeInfoRecords[0]?.fields?.name?.value || sourceName?.replace('.mftpkg', '') || 'Family Tree';

    // Build dataset
    const dataset = {
      records,
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
      },
    };

    // Import into IndexedDB
    this._progress('importing', 0, 1);
    const localDB = getLocalDatabase();
    const total = await localDB.importDataset(dataset);

    this._progress('done', total, total);

    return {
      total,
      treeName,
      counts,
    };
  }

  _progress(stage, current, total) {
    if (this.onProgress) this.onProgress(stage, current, total);
  }
}

export default MFTPKGImporter;
