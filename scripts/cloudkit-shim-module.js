/**
 * CloudKit JS SDK Shim — replaces Apple's CloudKit SDK (webpack module 962)
 * with a local mock that auto-authenticates and serves sample family tree data.
 *
 * This module exports an object with the same interface as the real CloudKit JS SDK.
 * When the app calls CloudKit.configure(), it gets a fake container that
 * auto-signs in and provides mock databases with sample family tree records.
 *
 * Data is stored in localStorage so edits persist across page reloads.
 */

// ── Sample Data Store ──

const STORAGE_KEY = 'cloudtreeweb-demo-data';

function getStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // Try to load extracted family data from a pre-built JSON file
  return null; // Will be loaded async — see loadStoreAsync
}

// Async loader that fetches family-data.json if localStorage is empty
var _storeLoadPromise = null;
function loadStoreAsync() {
  if (_store) return Promise.resolve(_store);
  if (_storeLoadPromise) return _storeLoadPromise;
  _storeLoadPromise = fetch('/family-data.json')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data && data.records) {
        _store = data;
        saveStore(_store);
        console.log('[CloudKit Shim] Loaded ' + Object.keys(data.records).length + ' records from family-data.json');
      } else {
        _store = createSampleData();
        console.log('[CloudKit Shim] Using sample data');
      }
      return _store;
    })
    .catch(function() {
      _store = createSampleData();
      return _store;
    });
  return _storeLoadPromise;
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

var _store = null;
function store() {
  if (!_store) {
    _store = getStore();
    if (!_store) {
      // Synchronous fallback — create sample data, async load will replace it
      _store = createSampleData();
      // Kick off async load
      loadStoreAsync();
    }
  }
  return _store;
}
function persist() { saveStore(store()); }

// ── Record Helpers ──

let _nextId = Date.now();
function genId() { return 'rec-' + (_nextId++).toString(36); }

function makeRecord(type, fields, recordName) {
  return {
    recordType: type,
    recordName: recordName || genId(),
    fields: fields || {},
    created: { timestamp: Date.now() },
    modified: { timestamp: Date.now() },
    _dirty: false,
  };
}

function fieldVal(record, name) {
  const f = record.fields[name];
  return f ? f.value : undefined;
}

function setField(record, name, value, type) {
  record.fields[name] = { value, type: type || 'STRING' };
  record._dirty = true;
  record.modified = { timestamp: Date.now() };
}

// ── Sample Family Tree Data ──

function createSampleData() {
  const data = { records: {}, zones: {} };

  // Create a default zone
  const zoneId = 'defaultZone';
  data.zones[zoneId] = {
    zoneName: 'Family Tree',
    zoneShortName: 'default',
    ownerName: '_demo_user',
  };

  // Sample persons
  const persons = [
    { first: 'Ahmad', last: 'Jalil', gender: 0, id: 'person-ahmad' },
    { first: 'Fatima', last: 'Ali', gender: 1, id: 'person-fatima' },
    { first: 'Omar', last: 'Jalil', gender: 0, id: 'person-omar' },
    { first: 'Layla', last: 'Jalil', gender: 1, id: 'person-layla' },
    { first: 'Yusuf', last: 'Jalil', gender: 0, id: 'person-yusuf' },
    { first: 'Noor', last: 'Hassan', gender: 1, id: 'person-noor' },
    { first: 'Ibrahim', last: 'Jalil', gender: 0, id: 'person-ibrahim' },
    { first: 'Maryam', last: 'Khalid', gender: 1, id: 'person-maryam' },
    { first: 'Ali', last: 'Jalil', gender: 0, id: 'person-ali' },
    { first: 'Zainab', last: 'Jalil', gender: 1, id: 'person-zainab' },
  ];

  for (const p of persons) {
    data.records[p.id] = makeRecord('Person', {
      firstName: { value: p.first, type: 'STRING' },
      lastName: { value: p.last, type: 'STRING' },
      gender: { value: p.gender, type: 'INT64' },
    }, p.id);
  }

  // Sample families (parent-child relationships)
  const families = [
    { id: 'family-1', man: 'person-ahmad', woman: 'person-fatima', children: ['person-omar', 'person-layla', 'person-yusuf'] },
    { id: 'family-2', man: 'person-omar', woman: 'person-noor', children: ['person-ali', 'person-zainab'] },
    { id: 'family-3', man: 'person-ibrahim', woman: 'person-maryam', children: ['person-ahmad'] },
  ];

  for (const f of families) {
    data.records[f.id] = makeRecord('Family', {
      man: { value: { recordName: f.man, action: 'NONE' }, type: 'REFERENCE' },
      woman: { value: { recordName: f.woman, action: 'NONE' }, type: 'REFERENCE' },
    }, f.id);

    // Create child relations
    for (const childId of f.children) {
      const crId = 'cr-' + f.id + '-' + childId;
      data.records[crId] = makeRecord('ChildRelation', {
        family: { value: { recordName: f.id, action: 'NONE' }, type: 'REFERENCE' },
        child: { value: { recordName: childId, action: 'NONE' }, type: 'REFERENCE' },
      }, crId);
    }
  }

  // Sample birth events
  const birthEvents = [
    { person: 'person-ibrahim', date: '1940-03-15', id: 'evt-birth-ibrahim' },
    { person: 'person-maryam', date: '1945-07-22', id: 'evt-birth-maryam' },
    { person: 'person-ahmad', date: '1970-01-10', id: 'evt-birth-ahmad' },
    { person: 'person-fatima', date: '1972-05-20', id: 'evt-birth-fatima' },
    { person: 'person-omar', date: '1995-08-03', id: 'evt-birth-omar' },
    { person: 'person-layla', date: '1998-12-14', id: 'evt-birth-layla' },
    { person: 'person-yusuf', date: '2001-04-28', id: 'evt-birth-yusuf' },
    { person: 'person-noor', date: '1996-06-11', id: 'evt-birth-noor' },
    { person: 'person-ali', date: '2020-02-19', id: 'evt-birth-ali' },
    { person: 'person-zainab', date: '2022-09-05', id: 'evt-birth-zainab' },
  ];

  for (const evt of birthEvents) {
    data.records[evt.id] = makeRecord('PersonEvent', {
      person: { value: { recordName: evt.person, action: 'NONE' }, type: 'REFERENCE' },
      eventType: { value: 'Birth', type: 'STRING' },
      conclusionType: { value: 'Birth', type: 'STRING' },
      date: { value: evt.date, type: 'STRING' },
    }, evt.id);
  }

  // Sample marriage events
  const marriageEvents = [
    { family: 'family-3', date: '1965-06-01', id: 'evt-marriage-3' },
    { family: 'family-1', date: '1993-09-15', id: 'evt-marriage-1' },
    { family: 'family-2', date: '2018-03-20', id: 'evt-marriage-2' },
  ];

  for (const evt of marriageEvents) {
    data.records[evt.id] = makeRecord('FamilyEvent', {
      family: { value: { recordName: evt.family, action: 'NONE' }, type: 'REFERENCE' },
      eventType: { value: 'Marriage', type: 'STRING' },
      conclusionType: { value: 'Marriage', type: 'STRING' },
      date: { value: evt.date, type: 'STRING' },
    }, evt.id);
  }

  // Sample places
  const places = [
    { id: 'place-1', name: 'Mainz', country: 'Germany', state: 'Rhineland-Palatinate' },
    { id: 'place-2', name: 'Damascus', country: 'Syria' },
    { id: 'place-3', name: 'Amman', country: 'Jordan' },
  ];

  for (const pl of places) {
    data.records[pl.id] = makeRecord('Place', {
      placeName: { value: pl.name, type: 'STRING' },
      countryName: { value: pl.country, type: 'STRING' },
      stateName: { value: pl.state || '', type: 'STRING' },
    }, pl.id);
  }

  // Tree info
  data.records['tree-info-1'] = makeRecord('FamilyTreeInformation', {
    name: { value: 'Jalil Family Tree', type: 'STRING' },
  }, 'tree-info-1');

  return data;
}

// ── ConclusionType Definitions ──
// These are the event/fact type records the app expects when querying ConclusionType

function getConclusionTypes(typeName) {
  var types = {
    ConclusionPersonEventType: [
      'Birth', 'Death', 'Baptism', 'Christening', 'Burial', 'Cremation',
      'Graduation', 'Immigration', 'Emigration', 'Naturalization',
      'Residence', 'Retirement', 'Census', 'Military Service',
      'Occupation', 'Education', 'Religion', 'Nationality',
    ],
    ConclusionFamilyEventType: [
      'Marriage', 'Divorce', 'Engagement', 'Annulment', 'Marriage Contract',
      'Marriage License', 'Marriage Settlement',
    ],
    ConclusionPersonFactType: [
      'Description', 'Caste', 'Physical Description', 'National ID',
      'Social Security Number', 'Nobility Title', 'Citizenship',
    ],
    ConclusionAdditionalNameType: [
      'Also Known As', 'Birth Name', 'Married Name', 'Nickname',
      'Religious Name', 'Name at Immigration',
    ],
    ConclusionAssociateRelationType: [
      'Friend', 'Neighbor', 'Colleague', 'Godparent', 'Witness',
      'Guardian', 'Teacher', 'Doctor',
    ],
  };

  var list = types[typeName] || [];
  return list.map(function(name, i) {
    return {
      recordName: typeName + '-' + i,
      recordType: typeName,
      recordChangeTag: 'ct-1',
      fields: {
        typeName: { value: name, type: 'STRING' },
        typeNameLocalizationKey: { value: name, type: 'STRING' },
        identifier: { value: name.toLowerCase().replace(/\s+/g, '_'), type: 'STRING' },
        isEnabled: { value: 1, type: 'INT64' },
        isUserCreated: { value: 0, type: 'INT64' },
        order: { value: i, type: 'DOUBLE' },
        uniqueID: { value: typeName + '-' + i, type: 'STRING' },
      },
      created: { timestamp: Date.now() },
      modified: { timestamp: Date.now() },
    };
  });
}

// ── Record Wrapper (mimics the app's record object interface) ──

function wrapRecord(raw) {
  if (!raw) return null;
  const r = {
    _raw: raw,
    _modified: false,
    onIsModifiedChanged: null,

    recordName()  { return raw.recordName; },
    recordType()  { return raw.recordType; },
    key()         { return raw.recordName; },
    isModified()  { return r._modified; },

    firstName()   { return fieldVal(raw, 'firstName') || ''; },
    lastName()    { return fieldVal(raw, 'lastName') || ''; },
    fullName()    { return ((fieldVal(raw, 'firstName') || '') + ' ' + (fieldVal(raw, 'lastName') || '')).trim(); },
    get gender()  { return fieldVal(raw, 'gender') ?? 2; },

    familyName() {
      const s = store();
      const manRef = fieldVal(raw, 'man');
      const womanRef = fieldVal(raw, 'woman');
      const man = manRef ? s.records[manRef.recordName] : null;
      const woman = womanRef ? s.records[womanRef.recordName] : null;
      const parts = [];
      if (man) parts.push(fieldVal(man, 'lastName') || fieldVal(man, 'firstName') || '');
      if (woman) parts.push(fieldVal(woman, 'lastName') || fieldVal(woman, 'firstName') || '');
      return parts.join(' & ') || 'Unknown Family';
    },

    familyRecordName() { return raw.recordName; },
    marriageDate()     { return null; },
    placeName()        { return fieldVal(raw, 'placeName') || ''; },
    normalLocationString() {
      const parts = [fieldVal(raw, 'placeName'), fieldVal(raw, 'stateName'), fieldVal(raw, 'countryName')].filter(Boolean);
      return parts.join(', ');
    },
    date()          { return fieldVal(raw, 'date') || null; },
    text()          { return fieldVal(raw, 'text') || ''; },

    fieldValue(name) { return fieldVal(raw, name); },
    setFieldValue(value, type, name) {
      setField(raw, name, value, type);
      r._modified = true;
      if (r.onIsModifiedChanged) r.onIsModifiedChanged(true, r);
    },

    getThumbnailImageSource() { return null; },
    getImageSource()          { return null; },
    getPDFDownloadURL()       { return null; },
    canShowAsMedia()          { return false; },
    placeholderImageSource()  { return null; },

    title(full) { return Promise.resolve(fieldVal(raw, 'title') || fieldVal(raw, 'name') || raw.recordName); },

    save() {
      raw.modified = { timestamp: Date.now() };
      raw._dirty = false;
      r._modified = false;
      persist();
      if (r.onIsModifiedChanged) r.onIsModifiedChanged(false, r);
      return Promise.resolve(r);
    },

    delete() {
      const s = store();
      delete s.records[raw.recordName];
      persist();
      return Promise.resolve();
    },
  };
  return r;
}

// ── Database Object ──

function createDatabase(zoneId, dbController, isShared) {
  const zone = store().zones[zoneId] || { zoneName: 'Default', zoneShortName: 'default' };

  const db = {
    isReadOnly: isShared,
    isSharedDatabase: isShared,
    shareParticipantPermission: isShared ? 'READ' : 'READWRITE',
    _zone: zone,

    zoneShortName() { return zone.zoneShortName || 'default'; },
    zoneName()      { return zone.zoneName || 'Family Tree'; },

    performDatabaseOperation(fn) {
      // Execute the async generator or function
      try {
        const result = fn;
        if (result && typeof result.next === 'function') {
          // It's a generator — run it to completion
          return runGenerator(result);
        }
        return Promise.resolve(result);
      } catch (e) {
        return Promise.reject(e);
      }
    },

    // ── Query Methods ──

    getPersonBirthEvents(personRecordName) {
      const s = store();
      const events = Object.values(s.records).filter(r =>
        r.recordType === 'PersonEvent' &&
        fieldVal(r, 'person')?.recordName === personRecordName &&
        (fieldVal(r, 'conclusionType') === 'Birth' || fieldVal(r, 'eventType') === 'Birth')
      );
      return Promise.resolve(events.map(wrapRecord));
    },

    getPersonsParents(personRecordName) {
      const s = store();
      // Find ChildRelation records where child = personRecordName
      const childRels = Object.values(s.records).filter(r =>
        r.recordType === 'ChildRelation' &&
        fieldVal(r, 'child')?.recordName === personRecordName
      );
      const results = childRels.map(cr => {
        const familyRef = fieldVal(cr, 'family');
        const family = familyRef ? s.records[familyRef.recordName] : null;
        if (!family) return null;
        const manRef = fieldVal(family, 'man');
        const womanRef = fieldVal(family, 'woman');
        return {
          family: wrapRecord(family),
          man: manRef ? wrapRecord(s.records[manRef.recordName]) : null,
          woman: womanRef ? wrapRecord(s.records[womanRef.recordName]) : null,
        };
      }).filter(Boolean);
      return Promise.resolve(results);
    },

    getPersonsChildrenInformation(person) {
      const s = store();
      const personId = typeof person === 'string' ? person : person.recordName();
      // Find families where this person is man or woman
      const families = Object.values(s.records).filter(r =>
        r.recordType === 'Family' && (
          fieldVal(r, 'man')?.recordName === personId ||
          fieldVal(r, 'woman')?.recordName === personId
        )
      );
      const results = families.map(fam => {
        const manRef = fieldVal(fam, 'man');
        const womanRef = fieldVal(fam, 'woman');
        const partnerId = manRef?.recordName === personId ? womanRef?.recordName : manRef?.recordName;
        // Find children via ChildRelation
        const childRels = Object.values(s.records).filter(r =>
          r.recordType === 'ChildRelation' &&
          fieldVal(r, 'family')?.recordName === fam.recordName
        );
        const children = childRels.map(cr => {
          const childRef = fieldVal(cr, 'child');
          return childRef ? wrapRecord(s.records[childRef.recordName]) : null;
        }).filter(Boolean);
        return {
          family: wrapRecord(fam),
          partner: partnerId ? wrapRecord(s.records[partnerId]) : null,
          children,
        };
      });
      return Promise.resolve(results);
    },

    getPersonFacts(personRecordName) {
      const s = store();
      const facts = Object.values(s.records).filter(r =>
        r.recordType === 'PersonFact' &&
        fieldVal(r, 'person')?.recordName === personRecordName
      );
      return Promise.resolve(facts.map(wrapRecord));
    },

    getPersonAdditionalNames(personRecordName) {
      const s = store();
      const names = Object.values(s.records).filter(r =>
        r.recordType === 'AdditionalName' &&
        fieldVal(r, 'person')?.recordName === personRecordName
      );
      return Promise.resolve(names.map(wrapRecord));
    },

    getPerson(recordName) {
      const rec = store().records[recordName];
      return Promise.resolve(rec ? wrapRecord(rec) : null);
    },

    getFamily(recordName) {
      const rec = store().records[recordName];
      return Promise.resolve(rec ? wrapRecord(rec) : null);
    },

    getPersonEvent(recordName) {
      const rec = store().records[recordName];
      return Promise.resolve(rec ? wrapRecord(rec) : null);
    },

    getFamilyEvent(recordName) {
      const rec = store().records[recordName];
      return Promise.resolve(rec ? wrapRecord(rec) : null);
    },

    getEvents(object) {
      const s = store();
      const objId = typeof object === 'string' ? object : object.recordName();
      const events = Object.values(s.records).filter(r =>
        (r.recordType === 'PersonEvent' || r.recordType === 'FamilyEvent') &&
        (fieldVal(r, 'person')?.recordName === objId || fieldVal(r, 'family')?.recordName === objId)
      );
      return Promise.resolve(events.map(wrapRecord));
    },

    getMedia(recordName) {
      const rec = store().records[recordName];
      return Promise.resolve(rec ? wrapRecord(rec) : null);
    },

    getObjectsMedias(object) {
      return Promise.resolve([]);
    },

    getAllPlaceTemplateKeys() {
      return Promise.resolve([]);
    },

    allEventConclusionTypeRecordNamesForRecordType(recordType) {
      // Return common event types
      if (recordType === 'Person' || recordType === 'PersonEvent') {
        return Promise.resolve(['Birth', 'Death', 'Baptism', 'Burial', 'Graduation', 'Immigration', 'Emigration']);
      }
      if (recordType === 'Family' || recordType === 'FamilyEvent') {
        return Promise.resolve(['Marriage', 'Divorce', 'Engagement']);
      }
      return Promise.resolve([]);
    },

    getAllSourceRelationsForSourceContainer(container) {
      return Promise.resolve([]);
    },

    getChangeLogSubEntriesForChangeLogEntry(entry) {
      return Promise.resolve([]);
    },

    removeSourceRelationFromSourceContainer() { return Promise.resolve(); },
    removeAssociateRelationFromAssociateContainer() { return Promise.resolve(); },
    removeChildFromFamily() { return Promise.resolve(); },
    uploadMediaPictureForFile() { return Promise.resolve(); },

    // Query for list view (search/filter)
    queryObjectsForList(objectClass, searchOptions) {
      const s = store();
      // objectClass is a constructor reference — we can't match it directly
      // Instead, return all persons/families/places based on context
      const allRecords = Object.values(s.records);
      let filtered = allRecords;

      // Try to filter by common record types
      if (searchOptions?.recordType) {
        filtered = filtered.filter(r => r.recordType === searchOptions.recordType);
      }

      return Promise.resolve({
        records: filtered.map(wrapRecord),
        hasMore: false,
        cursor: null,
      });
    },
  };

  return db;
}

function runGenerator(gen) {
  return new Promise((resolve, reject) => {
    function step(result) {
      if (result.done) return resolve(result.value);
      Promise.resolve(result.value).then(
        val => { try { step(gen.next(val)); } catch (e) { reject(e); } },
        err => { try { step(gen.throw(err)); } catch (e) { reject(e); } }
      );
    }
    try { step(gen.next()); } catch (e) { reject(e); }
  });
}

// ── Container Object ──

function createCloudKitDatabase(scope) {
  var isShared = scope === 'SHARED';
  return {
    databaseScope: scope,

    fetchAllRecordZones() {
      if (isShared) {
        return Promise.resolve({ zones: [], hasErrors: false });
      }
      // Ensure data is loaded before returning zones
      return loadStoreAsync().then(function(s) {
        var zoneName = (s && s.zones && s.zones.defaultZone && s.zones.defaultZone.zoneName) || 'Family Tree';
        return {
          hasErrors: false,
          zones: [
            {
              zoneID: {
                zoneName: 'com.apple.coredata.cloudkit.zone#####Root',
                ownerRecordName: '_demo_user',
              },
              syncToken: 'demo-sync-1',
              atomic: true,
            }
          ],
        };
      });
    },

    performQuery(query) {
      return loadStoreAsync().then(function(s) {
        var type = query && query.recordType;
        var zoneID = query && query.zoneID;
        var filterComparisons = (query && query.filterBy) || [];

        // Handle ConclusionType queries — return event/fact type definitions
        if (type && type.startsWith('Conclusion')) {
          var conclusionTypes = getConclusionTypes(type);
          return { records: conclusionTypes, hasMore: false, continuationMarker: null, hasErrors: false };
        }

        var records = Object.values(s.records)
          .filter(function(r) { return !type || r.recordType === type; });

        // Apply filters
        for (var fi = 0; fi < filterComparisons.length; fi++) {
          var filter = filterComparisons[fi];
          if (filter.fieldName && filter.fieldValue) {
            records = records.filter(function(r) {
              var fld = r.fields[filter.fieldName];
              if (!fld) return false;
              var val = fld.value;
              if (filter.comparator === 'EQUALS') return val === filter.fieldValue.value;
              if (filter.comparator === 'BEGINS_WITH') return typeof val === 'string' && val.startsWith(filter.fieldValue.value);
              return true;
            });
          }
        }

        // Apply sort
        if (query && query.sortBy && query.sortBy.length > 0) {
          var sort = query.sortBy[0];
          records.sort(function(a, b) {
            var va = a.fields[sort.fieldName] ? a.fields[sort.fieldName].value : '';
            var vb = b.fields[sort.fieldName] ? b.fields[sort.fieldName].value : '';
            if (va < vb) return sort.ascending === false ? 1 : -1;
            if (va > vb) return sort.ascending === false ? -1 : 1;
            return 0;
          });
        }

        // Limit results
        var limit = (query && query.resultsLimit) || 200;
        var limited = records.slice(0, limit);

        var mapped = limited.map(function(r) {
          return {
            recordName: r.recordName,
            recordType: r.recordType,
            recordChangeTag: 'tag-1',
            fields: r.fields,
            created: r.created,
            modified: r.modified,
            zoneID: zoneID || { zoneName: 'com.apple.coredata.cloudkit.zone#####Root', ownerRecordName: '_demo_user' },
          };
        });
        return { records: mapped, hasMore: records.length > limit, continuationMarker: null, hasErrors: false };
      });
    },

    saveRecords(records, options) {
      var s = store();
      var saved = [];
      (records || []).forEach(function(r) {
        var id = r.recordName || genId();
        if (s.records[id]) {
          Object.assign(s.records[id].fields, r.fields || {});
          s.records[id].modified = { timestamp: Date.now() };
        } else {
          s.records[id] = makeRecord(r.recordType, r.fields, id);
        }
        saved.push(s.records[id]);
      });
      persist();
      return Promise.resolve({ records: saved, hasErrors: false });
    },

    deleteRecords(records) {
      var s = store();
      (records || []).forEach(function(r) {
        var name = typeof r === 'string' ? r : r.recordName;
        delete s.records[name];
      });
      persist();
      return Promise.resolve({ records: [], hasErrors: false });
    },

    fetchRecords(recordNames, options) {
      return loadStoreAsync().then(function(s) {
        var records = (recordNames || []).map(function(name) {
          var n = typeof name === 'string' ? name : name.recordName;
          // Handle special CloudKit zone root records
          if (n === 'databaseRoot' || n === 'databaseRootShare') {
            // Return a FamilyTreeInformation record as the root
            var treeName = (s.zones && s.zones.defaultZone && s.zones.defaultZone.zoneName) || 'Family Tree';
            return {
              recordName: n,
              recordType: 'FamilyTreeInformation',
              recordChangeTag: 'root-1',
              fields: {
                name: { value: treeName, type: 'STRING' },
                databaseVersion: { value: 29, type: 'INT64' },
              },
              created: { timestamp: Date.now() },
              modified: { timestamp: Date.now() },
              zoneID: (options && options.zoneID) || { zoneName: 'com.apple.coredata.cloudkit.zone#####Root', ownerRecordName: '_demo_user' },
            };
          }
          return s.records[n] || null;
        }).filter(Boolean);
        return { records: records, hasErrors: false };
      });
    },

    newRecordsBatch() {
      var ops = [];
      return {
        create(record) { ops.push({ op: 'create', record: record }); return this; },
        update(record) { ops.push({ op: 'update', record: record }); return this; },
        delete: function(recordName) { ops.push({ op: 'delete', recordName: recordName }); return this; },
        commit() {
          var s = store();
          ops.forEach(function(o) {
            if (o.op === 'delete') {
              delete s.records[o.recordName];
            } else {
              var r = o.record;
              var id = r.recordName || genId();
              s.records[id] = makeRecord(r.recordType, r.fields, id);
            }
          });
          persist();
          return Promise.resolve({ records: [], hasErrors: false });
        },
      };
    },
  };
}

function createContainer(config) {
  let _userIdentity = null;
  let _signInResolve = null;
  let _signOutResolve = null;

  var _privateDB = createCloudKitDatabase('PRIVATE');
  var _sharedDB = createCloudKitDatabase('SHARED');
  var _publicDB = createCloudKitDatabase('PUBLIC');

  const container = {
    containerIdentifier: config.containerIdentifier,

    // These are the getter properties the app actually uses
    get privateCloudDatabase() { return _privateDB; },
    get sharedCloudDatabase() { return _sharedDB; },
    get publicCloudDatabase() { return _publicDB; },

    setUpAuth() {
      // Auto-authenticate immediately
      _userIdentity = {
        userRecordName: '_demo_user',
        lookupInfo: { emailAddress: 'demo@cloudtreeweb.local' },
        nameComponents: { givenName: 'Demo', familyName: 'User' },
      };

      // Resolve the whenUserSignsIn promise after a tick
      setTimeout(function() {
        if (_signInResolve) _signInResolve(_userIdentity);
        // Hide sign-in button, show sign-out
        var signInBtn = document.getElementById(config.apiTokenAuth?.signInButton?.id);
        if (signInBtn) signInBtn.style.display = 'none';
        var signOutBtn = document.getElementById(config.apiTokenAuth?.signOutButton?.id);
        if (signOutBtn) {
          signOutBtn.innerHTML = '<button style="padding:6px 16px;border-radius:6px;border:1px solid #555;background:#222;color:#fff;cursor:pointer;font-size:13px;">Sign Out (Demo)<\/button>';
          signOutBtn.onclick = function() {
            if (_signOutResolve) _signOutResolve();
          };
        }
      }, 100);

      return Promise.resolve(_userIdentity);
    },

    // These must be regular methods (not getters) — the app calls them as container.whenUserSignsIn()
    whenUserSignsIn() {
      return new Promise(function(resolve) { _signInResolve = resolve; });
    },

    whenUserSignsOut() {
      return new Promise(function(resolve) { _signOutResolve = resolve; });
    },

    fetchCurrentUserIdentity() {
      return Promise.resolve(_userIdentity);
    },

    getDatabaseWithDatabaseScope(scope) {
      if (scope === 'PUBLIC') return _publicDB;
      if (scope === 'SHARED') return _sharedDB;
      return _privateDB;
    },
  };

  return container;
}

// ── CloudKit Global API ──

let _containers = [];
let _defaultContainer = null;

const CloudKitShim = {
  configure(config) {
    if (config && config.containers) {
      _containers = config.containers.map(c => createContainer(c));
      _defaultContainer = _containers[0] || null;
    }
    return _defaultContainer;
  },

  getDefaultContainer() {
    return _defaultContainer;
  },

  getContainer(identifier) {
    return _containers.find(c => c.containerIdentifier === identifier) || null;
  },

  getAllContainers() {
    return _containers;
  },

  // Constants
  PRODUCTION_ENVIRONMENT: 'production',
  DEVELOPMENT_ENVIRONMENT: 'development',
  CLOUDKIT_LOADED: 'cloudkitloaded',
  VERSION: '2.0-shim',
  BUILD_VERSION: 'shim-1.0',
  WS_API_VERSION: 1,
  logToConsole: false,

  // Enums
  DatabaseScope: { PRIVATE: 'PRIVATE', SHARED: 'SHARED', PUBLIC: 'PUBLIC' },
  QueryFilterComparator: { EQUALS: 'EQUALS', NOT_EQUALS: 'NOT_EQUALS', BEGINS_WITH: 'BEGINS_WITH' },
  ReferenceAction: { NONE: 'NONE', DELETE_SELF: 'DELETE_SELF' },
  SubscriptionType: { QUERY: 'QUERY', ZONE: 'ZONE' },
  ShareRecordType: { SHARE: 'cloudkit.share' },
  ShareParticipantPermission: { UNKNOWN: 'UNKNOWN', NONE: 'NONE', READ_ONLY: 'READ_ONLY', READ_WRITE: 'READ_WRITE' },
  ShareParticipantAcceptanceStatus: { UNKNOWN: 'UNKNOWN', PENDING: 'PENDING', ACCEPTED: 'ACCEPTED' },
  ShareParticipantType: { OWNER: 'OWNER', PRIVATE_USER: 'PRIVATE_USER', PUBLIC_USER: 'PUBLIC_USER' },
  AppleIDButtonTheme: { LIGHT: 'light', DARK: 'dark' },

  CKError: class CKError extends Error {
    constructor(props) {
      super(props?.reason || 'CloudKit error');
      this.ckErrorCode = props?.ckErrorCode || 'UNKNOWN_ERROR';
    }
  },

  get Promise() { return window.Promise; },

  fetch(url, opts) { return window.fetch(url, opts); },

  parseRawNotification(notification) { return notification; },
};

// ── Export as webpack module ──
// This replaces module 962 in the webpack bundle.
// The module factory signature is: function(e, t, n) { e.exports = ... }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudKitShim;
} else {
  window.CloudKit = CloudKitShim;
}

// Dispatch the cloudkitloaded event (same as the real SDK does)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  setTimeout(function() {
    var evt = document.createEvent('Event');
    evt.initEvent('cloudkitloaded', true, true);
    document.dispatchEvent(evt);
  }, 0);
}
