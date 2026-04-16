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
      placetemplatekey: 'PlaceTemplateKey', treeinfo: 'FamilyTreeInformation',
    };

    function ref(targetType, pk) {
      if (!pk) return undefined;
      const id = makeId(targetType, pk);
      const ckType = RECORD_TYPE_MAP[targetType] || targetType;
      return { value: id + '---' + ckType, type: 'REFERENCE' };
    }

    function addRecord(id, type, fields) {
      records[id] = {
        recordType: type,
        recordName: id,
        fields,
        created: { timestamp: Date.now() },
        modified: { timestamp: Date.now() },
      };
      counts[type] = (counts[type] || 0) + 1;
    }

    // ── Extract Persons ──
    this._progress('extracting', 0, 7);
    if (entityMap.Person) {
      const rows = db.exec(`
        SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZGENDER, ZNAMEPREFIX, ZNAMESUFFIX, ZNAMEMIDDLE,
               ZCACHED_BIRTHDATE, ZCACHED_DEATHDATE, ZCACHED_FULLNAME, ZCACHED_FULLNAMEFORSORTING,
               ZUNIQUEID, ZISSTARTPERSON
        FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Person}
      `);
      if (rows.length > 0) {
        const cols = rows[0].columns;
        for (const row of rows[0].values) {
          const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          const id = makeId('person', r.Z_PK);
          const fields = {};
          if (r.ZFIRSTNAME) fields.firstName = field(r.ZFIRSTNAME);
          if (r.ZLASTNAME) fields.lastName = field(r.ZLASTNAME);
          if (r.ZGENDER !== null) fields.gender = field(r.ZGENDER, 'INT64');
          if (r.ZNAMEPREFIX) fields.namePrefix = field(r.ZNAMEPREFIX);
          if (r.ZNAMESUFFIX) fields.nameSuffix = field(r.ZNAMESUFFIX);
          if (r.ZNAMEMIDDLE) fields.nameMiddle = field(r.ZNAMEMIDDLE);
          if (r.ZCACHED_FULLNAME) fields.cached_fullName = field(r.ZCACHED_FULLNAME);
          if (r.ZCACHED_FULLNAMEFORSORTING) fields.cached_fullNameForSorting = field(r.ZCACHED_FULLNAMEFORSORTING);
          if (r.ZCACHED_BIRTHDATE) fields.cached_birthDate = field(r.ZCACHED_BIRTHDATE);
          if (r.ZCACHED_DEATHDATE) fields.cached_deathDate = field(r.ZCACHED_DEATHDATE);
          if (r.ZUNIQUEID) fields.uniqueID = field(r.ZUNIQUEID);
          if (r.ZISSTARTPERSON) fields.isStartPerson = field(r.ZISSTARTPERSON, 'INT64');
          addRecord(id, 'Person', fields);
        }
      }
    }

    // ── Extract Families ──
    this._progress('extracting', 1, 7);
    if (entityMap.Family) {
      const rows = db.exec(`
        SELECT Z_PK, ZMAN, ZWOMAN, ZCACHED_MARRIAGEDATE, ZUNIQUEID
        FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Family}
      `);
      if (rows.length > 0) {
        const cols = rows[0].columns;
        for (const row of rows[0].values) {
          const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          const id = makeId('family', r.Z_PK);
          const fields = {};
          if (r.ZMAN) fields.man = ref('person', r.ZMAN);
          if (r.ZWOMAN) fields.woman = ref('person', r.ZWOMAN);
          if (r.ZCACHED_MARRIAGEDATE) fields.cached_marriageDate = field(r.ZCACHED_MARRIAGEDATE);
          if (r.ZUNIQUEID) fields.uniqueID = field(r.ZUNIQUEID);
          addRecord(id, 'Family', fields);
        }
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
    this._progress('extracting', 3, 7);
    if (entityMap.PersonEvent) {
      const rows = db.exec(`
        SELECT e.Z_PK, e.ZPERSON1 as ZPERSON, e.ZDATE2 as ZDATE,
               e.ZASSIGNEDPLACE, e.ZUSERDESCRIPTION1, e.ZUNIQUEID,
               c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
        FROM ZBASEOBJECT e
        LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE2
        WHERE e.Z_ENT = ${entityMap.PersonEvent}
      `);
      if (rows.length > 0) {
        const cols = rows[0].columns;
        for (const row of rows[0].values) {
          const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          const id = makeId('personevent', r.Z_PK);
          const fields = {};
          if (r.ZPERSON) fields.person = ref('person', r.ZPERSON);
          // conclusionType as CloudKit reference: "UniqueID_PersonEvent_Birth---ConclusionPersonEventType"
          if (r.CTYPE_UID) {
            const ctypeEntName = entityMap._names?.[r.CTYPE_ENT] || 'ConclusionPersonEventType';
            fields.conclusionType = { value: r.CTYPE_UID + '---' + ctypeEntName, type: 'REFERENCE' };
          }
          if (r.CONCLUSION_NAME) fields.eventType = field(r.CONCLUSION_NAME);
          if (r.ZDATE) fields.date = field(r.ZDATE);
          if (r.ZASSIGNEDPLACE) fields.place = ref('place', r.ZASSIGNEDPLACE);
          if (r.ZUSERDESCRIPTION1) fields.description = field(r.ZUSERDESCRIPTION1);
          if (r.ZUNIQUEID) fields.uniqueID = field(r.ZUNIQUEID);
          addRecord(id, 'PersonEvent', fields);
        }
      }
    }

    // ── Extract Family Events ──
    this._progress('extracting', 4, 7);
    if (entityMap.FamilyEvent) {
      const rows = db.exec(`
        SELECT e.Z_PK, e.ZFAMILY, e.ZDATE1 as ZDATE,
               e.ZASSIGNEDPLACE, e.ZUNIQUEID,
               c.ZTYPENAME as CONCLUSION_NAME, c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
        FROM ZBASEOBJECT e
        LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE1
        WHERE e.Z_ENT = ${entityMap.FamilyEvent}
      `);
      if (rows.length > 0) {
        const cols = rows[0].columns;
        for (const row of rows[0].values) {
          const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          const id = makeId('familyevent', r.Z_PK);
          const fields = {};
          if (r.ZFAMILY) fields.family = ref('family', r.ZFAMILY);
          if (r.CTYPE_UID) {
            const ctypeEntName = entityMap._names?.[r.CTYPE_ENT] || 'ConclusionFamilyEventType';
            fields.conclusionType = { value: r.CTYPE_UID + '---' + ctypeEntName, type: 'REFERENCE' };
          }
          if (r.CONCLUSION_NAME) fields.eventType = field(r.CONCLUSION_NAME);
          if (r.ZDATE) fields.date = field(r.ZDATE);
          if (r.ZASSIGNEDPLACE) fields.place = ref('place', r.ZASSIGNEDPLACE);
          if (r.ZUNIQUEID) fields.uniqueID = field(r.ZUNIQUEID);
          addRecord(id, 'FamilyEvent', fields);
        }
      }
    }

    // ── Extract PersonFacts ──
    this._progress('extracting', 5, 11);
    if (entityMap.PersonFact) {
      const rows = db.exec(`
        SELECT e.Z_PK, e.ZPERSON2 as ZPERSON, e.ZVALUE, e.ZUSERDESCRIPTION2,
               e.ZUNIQUEID, c.ZTYPENAME as CONCLUSION_NAME,
               c.ZUNIQUEID as CTYPE_UID, c.Z_ENT as CTYPE_ENT
        FROM ZBASEOBJECT e
        LEFT JOIN ZCONCLUSIONTYPE c ON c.Z_PK = e.ZCONCLUSIONTYPE3
        WHERE e.Z_ENT = ${entityMap.PersonFact}
      `);
      if (rows.length > 0) {
        const cols = rows[0].columns;
        for (const row of rows[0].values) {
          const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          const id = makeId('personfact', r.Z_PK);
          const fields = {};
          if (r.ZPERSON) fields.person = ref('person', r.ZPERSON);
          if (r.CTYPE_UID) {
            const ctypeEntName = entityMap._names?.[r.CTYPE_ENT] || 'ConclusionPersonFactType';
            fields.conclusionType = { value: r.CTYPE_UID + '---' + ctypeEntName, type: 'REFERENCE' };
          }
          if (r.CONCLUSION_NAME) fields.factType = field(r.CONCLUSION_NAME);
          if (r.ZVALUE) fields.value = field(r.ZVALUE);
          if (r.ZUSERDESCRIPTION2) fields.description = field(r.ZUSERDESCRIPTION2);
          if (r.ZUNIQUEID) fields.uniqueID = field(r.ZUNIQUEID);
          addRecord(id, 'PersonFact', fields);
        }
      }
    }

    // ── Extract ConclusionTypes (event/fact type definitions) ──
    this._progress('extracting', 6, 11);
    {
      const rows = db.exec(`
        SELECT Z_PK, Z_ENT, ZTYPENAME, ZTYPENAMELOCALIZATIONKEY, ZUNIQUEID,
               ZISENABLED, ZISUSERCREATED, ZORDER, ZGEDCOMTAG, ZIDENTIFIER
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
          addRecord(id, entName, fields);
        }
      }
    }

    // ── Extract Places ──
    this._progress('extracting', 7, 11);
    if (entityMap.Place) {
      const rows = db.exec(`
        SELECT Z_PK, ZCACHED_NORMALLOCATIONSTRING, ZCACHED_SHORTLOCATIONSTRING,
               ZCACHED_STANDARDIZEDLOCATIONSTRING, ZUNIQUEID
        FROM ZBASEOBJECT WHERE Z_ENT = ${entityMap.Place}
      `);
      if (rows.length > 0) {
        const cols = rows[0].columns;
        for (const row of rows[0].values) {
          const r = Object.fromEntries(cols.map((c, i) => [c, row[i]]));
          const id = makeId('place', r.Z_PK);
          const fields = {};
          if (r.ZCACHED_NORMALLOCATIONSTRING) fields.placeName = field(r.ZCACHED_NORMALLOCATIONSTRING);
          if (r.ZCACHED_SHORTLOCATIONSTRING) fields.cached_shortLocationString = field(r.ZCACHED_SHORTLOCATIONSTRING);
          if (r.ZCACHED_STANDARDIZEDLOCATIONSTRING) fields.cached_standardizedLocationString = field(r.ZCACHED_STANDARDIZEDLOCATIONSTRING);
          if (r.ZUNIQUEID) fields.uniqueID = field(r.ZUNIQUEID);
          addRecord(id, 'Place', fields);
        }
      }
    }

    // ── Extract PlaceTemplates, Keys, KeyRelations ──
    this._progress('extracting', 8, 11);
    {
      const tables = [
        { table: 'ZPLACETEMPLATE', type: 'PlaceTemplate', cols: 'Z_PK, ZNAME, ZCOUNTRYIDENTIFIER, ZUNIQUEID' },
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
              if (r.ZTEMPLATE) fields.template = ref('placetemplate', r.ZTEMPLATE);
              if (r.ZTEMPLATEKEY) fields.templateKey = ref('placetemplatekey', r.ZTEMPLATEKEY);
              if (r.ZORDER !== undefined && r.ZORDER !== null) fields.order = field(r.ZORDER, 'DOUBLE');
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
