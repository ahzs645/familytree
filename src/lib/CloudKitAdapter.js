/**
 * CloudKitAdapter — bridges the legacy bundle's CloudKit expectations
 * with our LocalDatabase (IndexedDB).
 *
 * This replaces cloudkit-shim-module.js with a proper adapter that:
 * 1. Reads data from IndexedDB (populated by MFTPKGImporter)
 * 2. Provides the CloudKit API surface the bundle expects
 * 3. Blocks all real Apple CloudKit API calls
 * 4. Auto-authenticates without Apple ID
 *
 * This is loaded as webpack module 962 via the patch-bundle script.
 */

// ── IndexedDB Access (lightweight, no idb dependency — runs inside the bundle) ──

var DB_NAME = 'cloudtreeweb-local';
var DB_VERSION = 2;
var STORE_RECORDS = 'records';
var STORE_META = 'meta';

function openIDB() {
  return new Promise(function(resolve, reject) {
    var request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function(event) {
      var db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        var store = db.createObjectStore(STORE_RECORDS, { keyPath: 'recordName' });
        store.createIndex('byType', 'recordType', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    request.onsuccess = function() { resolve(request.result); };
    request.onerror = function() { reject(request.error); };
  });
}

function idbGet(storeName, key) {
  return openIDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName);
      var req = tx.objectStore(storeName).get(key);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function idbGetAll(storeName, indexName, indexValue) {
  return openIDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName);
      var source = indexName
        ? tx.objectStore(storeName).index(indexName)
        : tx.objectStore(storeName);
      var req = indexValue !== undefined
        ? source.getAll(indexValue)
        : source.getAll();
      req.onsuccess = function() { resolve(req.result || []); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function idbPut(storeName, record) {
  return openIDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var req = tx.objectStore(storeName).put(record);
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function idbDelete(storeName, key) {
  return openIDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var req = tx.objectStore(storeName).delete(key);
      req.onsuccess = function() { resolve(); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function idbCount(storeName) {
  return openIDB().then(function(db) {
    return new Promise(function(resolve, reject) {
      var tx = db.transaction(storeName);
      var req = tx.objectStore(storeName).count();
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { reject(req.error); };
    });
  });
}

function getMeta(key) {
  return idbGet(STORE_META, key).then(function(row) {
    return row ? row.value : null;
  });
}

// ── ConclusionType Definitions ──

var CONCLUSION_TYPES = {
  ConclusionPersonEventType: [
    'Birth', 'Death', 'Baptism', 'Christening', 'Burial', 'Cremation',
    'Graduation', 'Immigration', 'Emigration', 'Naturalization',
    'Residence', 'Retirement', 'Census', 'Military Service',
    'Occupation', 'Education', 'Religion', 'Nationality',
  ],
  ConclusionFamilyEventType: [
    'Marriage', 'Divorce', 'Engagement', 'Annulment', 'Marriage Contract',
  ],
  ConclusionPersonFactType: [
    'Description', 'Caste', 'Physical Description', 'National ID',
    'Social Security Number', 'Nobility Title', 'Citizenship',
  ],
  ConclusionAdditionalNameType: [
    'Also Known As', 'Birth Name', 'Married Name', 'Nickname',
  ],
  ConclusionAssociateRelationType: [
    'Friend', 'Neighbor', 'Colleague', 'Godparent', 'Witness',
  ],
};

function getConclusionTypeRecords(typeName) {
  var list = CONCLUSION_TYPES[typeName] || [];
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

// ── Reference Format Helpers ──

// The app uses "recordName---RecordType" format for reference field values.
// Our imported data uses { recordName: "person-123", action: "NONE" } objects.
// We need to convert our format to the app's format in query results.

function guessRecordType(recordName) {
  if (!recordName) return 'Unknown';
  var prefix = recordName.split('-')[0];
  var map = {
    person: 'Person', family: 'Family', place: 'Place', source: 'Source',
    personevent: 'PersonEvent', familyevent: 'FamilyEvent',
    childrelation: 'ChildRelation', treeinfo: 'FamilyTreeInformation',
    note: 'Note', media: 'Media', todo: 'ToDo', label: 'Label',
  };
  return map[prefix] || 'Unknown';
}

// With the fixed importers, refs are already stored as "recordName---RecordType" strings.
// This function is now a pass-through but kept for safety with legacy data.
function convertRefsToCloudKitFormat(fields) {
  if (!fields) return fields;
  var result = {};
  for (var key in fields) {
    var field = fields[key];
    if (field && field.type === 'REFERENCE' && field.value && typeof field.value === 'object' && field.value.recordName) {
      // Legacy format: convert object ref to string
      var refName = field.value.recordName;
      var refType = field.value.recordType || guessRecordType(refName);
      result[key] = { value: refName + '---' + refType, type: 'REFERENCE' };
    } else {
      result[key] = field;
    }
  }
  return result;
}

// ── CloudKit Database (backed by IndexedDB) ──

function createCloudKitDatabase(scope) {
  var isShared = scope === 'SHARED';
  return {
    databaseScope: scope,

    fetchAllRecordZones: function() {
      if (isShared) {
        return Promise.resolve({ zones: [], hasErrors: false });
      }
      return getMeta('zones').then(function(zones) {
        var zoneName = (zones && zones.defaultZone && zones.defaultZone.zoneName) || 'Family Tree';
        return {
          hasErrors: false,
          zones: [{
            zoneID: {
              zoneName: 'com.apple.coredata.cloudkit.zone#####Root',
              ownerRecordName: '_local_user',
            },
            syncToken: 'local-1',
            atomic: true,
          }],
        };
      });
    },

    performQuery: function(query) {
      var type = query && query.recordType;

      // Handle ConclusionType queries — try IndexedDB first, fall back to hardcoded
      if (type && type.startsWith('Conclusion')) {
        return idbGetAll(STORE_RECORDS, 'byType', type).then(function(dbRecords) {
          var records = dbRecords.length > 0
            ? dbRecords.map(function(r) {
                return { recordName: r.recordName, recordType: r.recordType, recordChangeTag: 'ct-1',
                         fields: convertRefsToCloudKitFormat(r.fields), created: r.created, modified: r.modified };
              })
            : getConclusionTypeRecords(type);
          return { records: records, hasMore: false, continuationMarker: null, hasErrors: false };
        });
      }

      // Handle PlaceTemplate/PlaceTemplateKey queries (return empty for now)
      if (type && type.startsWith('PlaceTemplate')) {
        return Promise.resolve({ records: [], hasMore: false, hasErrors: false });
      }

      return idbGetAll(STORE_RECORDS, 'byType', type).then(function(records) {
        // Apply filters
        // CloudKit reference format: field values are "recordName---RecordType" strings
        // Our imported data stores references as { recordName: "...", action: "NONE" } objects
        // We need to match both formats
        var filterBy = (query && query.filterBy) || [];
        for (var i = 0; i < filterBy.length; i++) {
          var filter = filterBy[i];
          if (filter.fieldName && filter.fieldValue) {
            records = records.filter(function(r) {
              var fld = r.fields && r.fields[filter.fieldName];
              if (!fld) return false;
              var val = fld.value;
              var target = filter.fieldValue.value !== undefined ? filter.fieldValue.value : filter.fieldValue;

              // Normalize reference values for comparison
              // App queries use "recordName---RecordType" format
              // Our data stores { recordName: "...", action: "NONE" } objects
              var normalizedVal = val;
              if (val && typeof val === 'object' && val.recordName) {
                // Convert our object ref to the app's string format
                normalizedVal = val.recordName + '---' + (val.recordType || guessRecordType(val.recordName));
              }

              if (filter.comparator === 'EQUALS') {
                if (normalizedVal === target) return true;
                // Match reference format: target is "recordName---RecordType"
                if (typeof target === 'string' && target.includes('---')) {
                  var targetName = target.split('---')[0];
                  // Match against object-style refs
                  if (val && typeof val === 'object' && val.recordName === targetName) return true;
                  if (val === targetName) return true;
                  // Match conclusionType: target is "UniqueID_PersonEvent_Birth---ConclusionPersonEventType"
                  // Our data stores just "Birth"
                  if (targetName.startsWith('UniqueID_')) {
                    var parts = targetName.split('_');
                    var typeName = parts[parts.length - 1]; // e.g. "Birth"
                    if (val === typeName || normalizedVal === typeName) return true;
                    // Also match the ConclusionType record name format
                    if (typeof val === 'string' && val.includes(typeName)) return true;
                  }
                }
                return normalizedVal === target || val === target;
              }
              if (filter.comparator === 'BEGINS_WITH') {
                var s = typeof normalizedVal === 'string' ? normalizedVal : (typeof val === 'string' ? val : '');
                return s.startsWith(target);
              }
              return true;
            });
          }
        }

        // Apply sort
        if (query && query.sortBy && query.sortBy.length > 0) {
          var sort = query.sortBy[0];
          records.sort(function(a, b) {
            var va = (a.fields && a.fields[sort.fieldName] && a.fields[sort.fieldName].value) || '';
            var vb = (b.fields && b.fields[sort.fieldName] && b.fields[sort.fieldName].value) || '';
            var cmp = typeof va === 'string' ? va.localeCompare(vb) : (va - vb);
            return sort.ascending === false ? -cmp : cmp;
          });
        }

        var limit = (query && query.resultsLimit) || 200;
        var limited = records.slice(0, limit);
        var mapped = limited.map(function(r) {
          return {
            recordName: r.recordName,
            recordType: r.recordType,
            recordChangeTag: 'tag-1',
            fields: convertRefsToCloudKitFormat(r.fields),
            created: r.created,
            modified: r.modified,
            zoneID: (query && query.zoneID) || { zoneName: 'com.apple.coredata.cloudkit.zone#####Root', ownerRecordName: '_local_user' },
          };
        });
        return { records: mapped, hasMore: records.length > limit, continuationMarker: null, hasErrors: false };
      });
    },

    fetchRecords: function(recordNames, options) {
      var promises = (recordNames || []).map(function(name) {
        var n = typeof name === 'string' ? name : name.recordName;

        // Handle special root records
        if (n === 'databaseRoot' || n === 'databaseRootShare') {
          return getMeta('zones').then(function(zones) {
            var treeName = (zones && zones.defaultZone && zones.defaultZone.zoneName) || 'Family Tree';
            return {
              recordName: n,
              recordType: 'FamilyTreeInformation',
              recordChangeTag: 'root-1',
              fields: {
                databaseName: { value: treeName, type: 'STRING' },
                name: { value: treeName, type: 'STRING' },
                databaseVersion: { value: 7, type: 'INT64' },
              },
              created: { timestamp: Date.now() },
              modified: { timestamp: Date.now() },
              zoneID: (options && options.zoneID) || { zoneName: 'com.apple.coredata.cloudkit.zone#####Root', ownerRecordName: '_local_user' },
            };
          });
        }

        return idbGet(STORE_RECORDS, n).then(function(rec) {
          if (rec) rec.fields = convertRefsToCloudKitFormat(rec.fields);
          return rec;
        });
      });

      return Promise.all(promises).then(function(results) {
        return { records: results.filter(Boolean), hasErrors: false };
      });
    },

    saveRecords: function(records) {
      var promises = (records || []).map(function(r) {
        r.modified = { timestamp: Date.now() };
        return idbPut(STORE_RECORDS, r);
      });
      return Promise.all(promises).then(function() {
        return { records: records, hasErrors: false };
      });
    },

    deleteRecords: function(records) {
      var promises = (records || []).map(function(r) {
        var name = typeof r === 'string' ? r : r.recordName;
        return idbDelete(STORE_RECORDS, name);
      });
      return Promise.all(promises).then(function() {
        return { records: [], hasErrors: false };
      });
    },

    newRecordsBatch: function() {
      var ops = [];
      return {
        create: function(r) { ops.push({ op: 'create', record: r }); return this; },
        update: function(r) { ops.push({ op: 'update', record: r }); return this; },
        delete: function(name) { ops.push({ op: 'delete', recordName: name }); return this; },
        commit: function() {
          var promises = ops.map(function(o) {
            if (o.op === 'delete') return idbDelete(STORE_RECORDS, o.recordName);
            return idbPut(STORE_RECORDS, o.record);
          });
          return Promise.all(promises).then(function() {
            return { records: [], hasErrors: false };
          });
        },
      };
    },
  };
}

// ── CloudKit Container ──

function createContainer(config) {
  var _userIdentity = null;
  var _signInResolve = null;
  var _signOutResolve = null;
  var _privateDB = createCloudKitDatabase('PRIVATE');
  var _sharedDB = createCloudKitDatabase('SHARED');
  var _publicDB = createCloudKitDatabase('PUBLIC');

  return {
    containerIdentifier: config.containerIdentifier,

    get privateCloudDatabase() { return _privateDB; },
    get sharedCloudDatabase() { return _sharedDB; },
    get publicCloudDatabase() { return _publicDB; },

    getDatabaseWithDatabaseScope: function(scope) {
      if (scope === 'PUBLIC') return _publicDB;
      if (scope === 'SHARED') return _sharedDB;
      return _privateDB;
    },

    setUpAuth: function() {
      _userIdentity = {
        userRecordName: '_local_user',
        lookupInfo: { emailAddress: 'local@cloudtreeweb.local' },
        nameComponents: { givenName: 'Local', familyName: 'User' },
      };
      setTimeout(function() {
        if (_signInResolve) _signInResolve(_userIdentity);
        var signInBtn = document.getElementById(config.apiTokenAuth && config.apiTokenAuth.signInButton && config.apiTokenAuth.signInButton.id);
        if (signInBtn) signInBtn.style.display = 'none';
        var signOutBtn = document.getElementById(config.apiTokenAuth && config.apiTokenAuth.signOutButton && config.apiTokenAuth.signOutButton.id);
        if (signOutBtn) signOutBtn.style.display = 'none';
      }, 50);
      return Promise.resolve(_userIdentity);
    },

    whenUserSignsIn: function() {
      return new Promise(function(resolve) { _signInResolve = resolve; });
    },

    whenUserSignsOut: function() {
      return new Promise(function(resolve) { _signOutResolve = resolve; });
    },

    fetchCurrentUserIdentity: function() {
      return Promise.resolve(_userIdentity);
    },
  };
}

// ── CloudKit Global API ──

var _containers = [];
var _defaultContainer = null;

var CloudKitAdapter = {
  configure: function(config) {
    if (config && config.containers) {
      _containers = config.containers.map(function(c) { return createContainer(c); });
      _defaultContainer = _containers[0] || null;
    }
    return _defaultContainer;
  },

  getDefaultContainer: function() { return _defaultContainer; },
  getContainer: function(id) {
    return _containers.find(function(c) { return c.containerIdentifier === id; }) || null;
  },
  getAllContainers: function() { return _containers; },

  PRODUCTION_ENVIRONMENT: 'production',
  DEVELOPMENT_ENVIRONMENT: 'development',
  CLOUDKIT_LOADED: 'cloudkitloaded',
  VERSION: '2.0-local',
  BUILD_VERSION: 'local-adapter-1.0',
  WS_API_VERSION: 1,
  logToConsole: false,

  DatabaseScope: { PRIVATE: 'PRIVATE', SHARED: 'SHARED', PUBLIC: 'PUBLIC' },
  QueryFilterComparator: { EQUALS: 'EQUALS', NOT_EQUALS: 'NOT_EQUALS', BEGINS_WITH: 'BEGINS_WITH' },
  ReferenceAction: { NONE: 'NONE', DELETE_SELF: 'DELETE_SELF' },
  SubscriptionType: { QUERY: 'QUERY', ZONE: 'ZONE' },
  ShareRecordType: { SHARE: 'cloudkit.share' },
  ShareParticipantPermission: { UNKNOWN: 'UNKNOWN', NONE: 'NONE', READ_ONLY: 'READ_ONLY', READ_WRITE: 'READ_WRITE' },
  ShareParticipantAcceptanceStatus: { UNKNOWN: 'UNKNOWN', PENDING: 'PENDING', ACCEPTED: 'ACCEPTED' },
  ShareParticipantType: { OWNER: 'OWNER', PRIVATE_USER: 'PRIVATE_USER', PUBLIC_USER: 'PUBLIC_USER' },
  AppleIDButtonTheme: { LIGHT: 'light', DARK: 'dark' },

  CKError: function CKError(props) {
    this.message = (props && props.reason) || 'CloudKit error';
    this.ckErrorCode = (props && props.ckErrorCode) || 'UNKNOWN_ERROR';
  },

  get Promise() { return window.Promise; },
  fetch: function(url, opts) { return window.fetch(url, opts); },
  parseRawNotification: function(n) { return n; },
};

// ── Block real CloudKit API calls ──
// Override fetch to intercept calls to api.apple-cloudkit.com
var _originalFetch = window.fetch;
window.fetch = function(url, opts) {
  if (typeof url === 'string' && url.includes('apple-cloudkit.com')) {
    // Silently block CloudKit API calls
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  return _originalFetch.apply(window, arguments);
};

// ── Export & dispatch event ──
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CloudKitAdapter;
} else {
  window.CloudKit = CloudKitAdapter;
}

// Dispatch cloudkitloaded event
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  setTimeout(function() {
    var evt = document.createEvent('Event');
    evt.initEvent('cloudkitloaded', true, true);
    document.dispatchEvent(evt);
    console.log('[CloudKit Adapter] Local database adapter ready — no CloudKit connection needed');
  }, 0);
}
