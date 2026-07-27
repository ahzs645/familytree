import { getAppDataClient } from './data/AppDataClient.js';
import { readField } from './schema.js';

const META_KEY = 'familyTreeAuthorInfo';

const DEFAULT_AUTHOR_INFO = {
  treeName: '',
  subtitle: '',
  authorName: '',
  organization: '',
  address1: '',
  address2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  email: '',
  phone: '',
  website: '',
  copyright: '',
  notes: '',
  iconMediaRecordName: '',
};

export async function getAuthorInfo() {
  const db = getAppDataClient().meta;
  const saved = await db.get(META_KEY);
  if (saved) return normalizeAuthorInfo(saved);
  return normalizeAuthorInfo(await hydrateFromTreeInformation());
}

export async function saveAuthorInfo(info) {
  const db = getAppDataClient().meta;
  const normalized = normalizeAuthorInfo(info);
  await db.set(META_KEY, normalized);
  await saveTreeInformationRecord(normalized);
  return normalized;
}

function normalizeAuthorInfo(info = {}) {
  return { ...DEFAULT_AUTHOR_INFO, ...(info || {}) };
}

async function hydrateFromTreeInformation() {
  const db = getAppDataClient().records;
  const { records } = await db.query('FamilyTreeInformation', { limit: 100000 });
  const record = records[0];
  if (!record) return DEFAULT_AUTHOR_INFO;
  return {
    treeName: readField(record, ['name', 'treeName', 'title'], ''),
    subtitle: readField(record, ['subtitle', 'description'], ''),
    authorName: readField(record, ['authorName', 'author', 'submitterName'], ''),
    organization: readField(record, ['organization', 'submitterOrganization'], ''),
    address1: readField(record, ['address1', 'address'], ''),
    address2: readField(record, ['address2'], ''),
    city: readField(record, ['city'], ''),
    region: readField(record, ['region', 'state'], ''),
    postalCode: readField(record, ['postalCode', 'zip'], ''),
    country: readField(record, ['country'], ''),
    email: readField(record, ['email'], ''),
    phone: readField(record, ['phone', 'telephone'], ''),
    website: readField(record, ['website', 'url'], ''),
    copyright: readField(record, ['copyright'], ''),
    notes: readField(record, ['notes', 'note'], ''),
    iconMediaRecordName: readField(record, ['iconMediaRecordName'], ''),
  };
}

async function saveTreeInformationRecord(info) {
  const db = getAppDataClient().records;
  const { records } = await db.query('FamilyTreeInformation', { limit: 100000 });
  const record = records[0] || {
    recordName: 'treeinfo-local-author',
    recordType: 'FamilyTreeInformation',
    fields: {},
  };
  record.fields = {
    ...(record.fields || {}),
    name: field(info.treeName),
    title: field(info.treeName),
    subtitle: field(info.subtitle),
    authorName: field(info.authorName),
    author: field(info.authorName),
    organization: field(info.organization),
    address1: field(info.address1),
    address2: field(info.address2),
    city: field(info.city),
    region: field(info.region),
    postalCode: field(info.postalCode),
    country: field(info.country),
    email: field(info.email),
    phone: field(info.phone),
    website: field(info.website),
    copyright: field(info.copyright),
    notes: field(info.notes),
    iconMediaRecordName: field(info.iconMediaRecordName),
  };
  for (const [key, value] of Object.entries(record.fields)) {
    if (!value?.value) delete record.fields[key];
  }
  await db.save(record);
}

function field(value) {
  return { value: value || '', type: 'STRING' };
}
