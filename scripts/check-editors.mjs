#!/usr/bin/env node

/**
 * Verify the editor routes render and core editors persist changes against
 * real imported data. Defaults to the local Ahmad family MacFamilyTree package
 * when present, because it exercises more record types than the demo tree.
 */
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { extractMFTPKGDataset } from '../src/lib/mftpkgExtractor.js';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';
const SAMPLE_DB = process.env.MFTPKG_DATABASE || "/Users/ahmadjalil/Downloads/family tree/Ahmad's Family (Arabic).mftpkg/database";

if (!existsSync(SAMPLE_DB)) {
  console.error(`Sample database not found: ${SAMPLE_DB}`);
  process.exit(1);
}

function loadDataset() {
  const sqlite = new Database(SAMPLE_DB, { readonly: true });
  try {
    return extractMFTPKGDataset({
      sourceName: SAMPLE_DB.split('/').slice(-2, -1)[0] || 'editor-smoke.mftpkg',
      query: (sql) => sqlite.prepare(sql).all(),
    });
  } finally {
    sqlite.close();
  }
}

const dataset = loadDataset();
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (text.includes('basemaps.cartocdn.com')) return;
  errors.push(`console.error: ${text}`);
});
page.on('dialog', (dialog) => dialog.accept());

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(async (payload) => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  await db.importDataset(payload);
  localStorage.setItem('cloudtreeweb-has-imported', '1');
  localStorage.setItem('cloudtreeweb:disable-unsaved-guard', '1');
}, dataset);

const sample = await page.evaluate(async () => {
  const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
  const db = getLocalDatabase();
  const first = async (type) => (await db.query(type, { limit: 1 })).records[0]?.recordName || null;
  return {
    person: await first('Person'),
    family: await first('Family'),
    place: await first('Place'),
    source: await first('Source'),
    personEvent: await first('PersonEvent'),
    familyEvent: await first('FamilyEvent'),
    media: await first('Media'),
    todo: await first('ToDo'),
    story: await first('Story'),
    group: await first('PersonGroup'),
    label: await first('Label'),
    tribalAffiliation: await first('TribalAffiliation'),
    sourceRepository: await first('SourceRepository'),
  };
});

const routes = [
  route('/', 'Home', ['records']),
  route('/person/new', 'New person', ['First Name', 'Last Name']),
  route(`/person/${sample.person}`, 'Person editor', ['Name & Gender', 'Parents & Relatives', 'Save changes']),
  route(`/family/${sample.family}`, 'Family editor', ['Children', 'Family Events', 'Save changes']),
  route(`/places?placeId=${sample.place}`, 'Places editor', ['Place Name', 'Save']),
  route('/sources', 'Sources editor', ['Source Information', 'Save']),
  route('/events', 'Events editor', ['Events', 'Save']),
  route(sample.personEvent ? `/events?eventId=${sample.personEvent}` : null, 'Person event editor', ['Event', 'Save']),
  route(sample.familyEvent ? `/events?eventId=${sample.familyEvent}` : null, 'Family event editor', ['Event', 'Save']),
  route('/media', 'Media editor', ['Media']),
  route('/todos', 'ToDos editor', ['To']),
  route('/stories', 'Stories editor', ['Stories']),
  route('/groups', 'Groups editor', ['Person Groups']),
  route('/tribal-affiliations', 'Tribal affiliations editor', ['Tribal Affiliations']),
  route('/dna', 'DNA editor', ['DNA Results']),
  route('/repositories', 'Repositories editor', ['Source Repositories']),
  route('/labels', 'Labels editor', ['Labels']),
  route('/smart-filters', 'Smart filters editor', ['Smart filters']),
  route('/custom-types', 'Custom types editor', ['Custom Types']),
  route('/custom-validation', 'Custom validation editor', ['Custom Data Rules']),
  route('/lineages', 'Lineages editor', ['Lineages']),
  route('/author', 'Author editor', ['Author']),
  route('/websites', 'Website editor', ['Website']),
  route('/settings/edit-controllers', 'Edit controller settings', ['Edit']),
].filter((item) => item.path);

const routeResults = [];
for (const item of routes) {
  console.log(`checking ${item.label} ${item.path}`);
  const before = errors.length;
  await page.goto(`${BASE}${item.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(250);
  const text = await page.evaluate(() => document.body.textContent || '');
  const missing = item.expected.filter((needle) => !text.includes(needle));
  routeResults.push({
    label: item.label,
    path: item.path,
    missing,
    errors: errors.slice(before),
  });
}

const writeResults = [];
await captureWrite('person first name save', checkPersonWrite);
await captureWrite('person lock toggle save', checkPersonLockWrite);
await captureWrite('family marriage date save', checkFamilyWrite);
await captureWrite('place name save', checkPlaceWrite);
await captureWrite('source title save', checkSourceWrite);
if (sample.personEvent) await captureWrite('event date save', () => checkEventWrite(sample.personEvent));
await captureWrite('person note add/remove', checkPersonNoteAddRemove);
await captureWrite('family child add/remove staged save', checkFamilyChildAddRemove);
await captureWrite('person source relation attach/remove immediate', checkPersonSourceRelationAddRemove);
await captureWrite('person media relation attach/remove immediate', checkPersonMediaRelationAddRemove);
await captureWrite('todo create/delete', checkCreateDeleteTodo);
await captureWrite('story create/delete', checkCreateDeleteStory);
await captureWrite('group create/delete', checkCreateDeleteGroup);
await captureWrite('group member add/remove immediate', checkGroupMemberAddRemove);
await captureWrite('repository create/delete', checkCreateDeleteRepository);
await captureWrite('label create/delete', checkCreateDeleteLabel);

console.log('=== EDITOR ROUTES ===');
for (const result of routeResults) {
  const status = result.missing.length || result.errors.length ? 'FAIL' : 'ok';
  const missing = result.missing.length ? ` missing: ${result.missing.join(', ')}` : '';
  const routeErrors = result.errors.length ? ` errors: ${result.errors.join(' | ')}` : '';
  console.log(`${status.padEnd(4)} ${result.label.padEnd(26)} ${result.path}${missing}${routeErrors}`);
}

console.log('\n=== EDITOR WRITES ===');
for (const result of writeResults) {
  console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.label}${result.detail ? `: ${result.detail}` : ''}`);
}

await browser.close();

const failedRoutes = routeResults.filter((result) => result.missing.length || result.errors.length);
const failedWrites = writeResults.filter((result) => !result.ok);
process.exit(failedRoutes.length || failedWrites.length ? 1 : 0);

function route(path, label, expected) {
  return { path, label, expected };
}

async function checkPersonWrite() {
  const value = `Smoke-${Date.now()}`;
  await page.goto(`${BASE}/person/${sample.person}`, { waitUntil: 'networkidle' });
  await page.locator('input').first().fill(value);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(250);
  const persisted = await page.evaluate(async (id) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    return (await getLocalDatabase().getRecord(id))?.fields?.firstName?.value;
  }, sample.person);
  return { ok: persisted === value, detail: persisted };
}

async function checkFamilyWrite() {
  const value = '1888';
  await page.goto(`${BASE}/family/${sample.family}`, { waitUntil: 'networkidle' });
  await page.locator('input[placeholder="YYYY or YYYY-MM-DD"]').fill(value);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(250);
  const persisted = await page.evaluate(async (id) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    return (await getLocalDatabase().getRecord(id))?.fields?.cached_marriageDate?.value;
  }, sample.family);
  return { ok: persisted === value, detail: persisted };
}

async function checkPersonLockWrite() {
  await page.goto(`${BASE}/person/${sample.person}`, { waitUntil: 'networkidle' });
  const lockButton = page.locator('button[aria-pressed]').first();
  const wasLocked = await lockButton.getAttribute('aria-pressed') === 'true';
  await lockButton.click();
  await page.waitForTimeout(250);
  const persisted = await page.evaluate(async (id) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    return !!(await getLocalDatabase().getRecord(id))?.fields?.isLocked?.value;
  }, sample.person);
  if (persisted !== wasLocked) {
    await page.locator('button[aria-pressed]').first().click();
    await page.waitForTimeout(250);
  }
  await setLocked(sample.person, false);
  return { ok: persisted === !wasLocked, detail: String(persisted) };
}

async function checkPlaceWrite() {
  const value = `Smoke Place ${Date.now()}`;
  await page.goto(`${BASE}/places`, { waitUntil: 'networkidle' });
  await page.locator('main input').nth(1).fill(value);
  await page.locator('main').getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.waitForTimeout(250);
  const persisted = await page.evaluate(async (expected) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const records = (await getLocalDatabase().query('Place', { limit: 100000 })).records;
    return records.find((record) => String(record.fields?.placeName?.value || '').includes(expected))?.fields?.placeName?.value || null;
  }, value);
  return { ok: String(persisted || '').includes(value), detail: persisted };
}

async function checkSourceWrite() {
  const value = `Smoke Source ${Date.now()}`;
  await page.goto(`${BASE}/sources`, { waitUntil: 'networkidle' });
  await page.locator('main input').nth(1).fill(value);
  await page.locator('main').getByRole('button', { name: 'Save', exact: true }).first().click();
  await page.waitForTimeout(250);
  const persisted = await page.evaluate(async (expected) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const records = (await getLocalDatabase().query('Source', { limit: 100000 })).records;
    return records.find((record) => record.fields?.title?.value === expected)?.fields?.title?.value || null;
  }, value);
  return { ok: persisted === value, detail: persisted };
}

async function checkEventWrite(eventId) {
  const value = '1901';
  await page.goto(`${BASE}/events?eventId=${encodeURIComponent(eventId)}`, { waitUntil: 'networkidle' });
  await page.locator('button[aria-haspopup="dialog"]').click();
  await page.locator('input[placeholder="YYYY, YYYY-MM, or YYYY-MM-DD"]').fill(value);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(250);
  const persisted = await page.evaluate(async (id) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    return (await getLocalDatabase().getRecord(id))?.fields?.date?.value;
  }, eventId);
  return { ok: persisted === value, detail: persisted };
}

async function checkPersonNoteAddRemove() {
  await setLocked(sample.person, false);
  await page.goto(`${BASE}/person/${sample.person}`, { waitUntil: 'networkidle' });
  const before = await countRecords('Note', 'person', sample.person);
  const addNote = page.getByRole('button', { name: 'Add Note' });
  await addNote.scrollIntoViewIfNeeded();
  await addNote.click();
  const noteTextareas = page.locator('textarea');
  await noteTextareas.last().waitFor({ state: 'visible' });
  await noteTextareas.last().fill('Smoke note');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(250);
  const added = await countRecords('Note', 'person', sample.person);
  const removeButtons = page.locator('button').filter({ hasText: '×' });
  const removeCount = await removeButtons.count();
  if (removeCount > 0) await removeButtons.nth(removeCount - 1).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(250);
  const removed = await countRecords('Note', 'person', sample.person);
  return { ok: added === before + 1 && removed === before, detail: `${before}->${added}->${removed}` };
}

async function checkFamilyChildAddRemove() {
  await setLocked(sample.family, false);
  const candidate = await familyChildCandidate(sample.family);
  if (!candidate) return { ok: false, detail: 'no available child candidate' };
  await page.goto(`${BASE}/family/${sample.family}`, { waitUntil: 'networkidle' });
  const before = await countRecords('ChildRelation', 'family', sample.family);
  await page.locator('button').filter({ hasText: /Choose person/i }).first().click();
  await page.locator('input:not([type]), input[type="text"], input[type="search"]').last().fill(candidate.fullName);
  await page.locator('div[style*="cursor: pointer"]').filter({ hasText: candidate.fullName }).first().click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(250);
  const added = await countRecords('ChildRelation', 'family', sample.family);
  const childrenSection = page.locator('div.rounded-lg', { hasText: 'Children' }).first();
  await childrenSection.locator('button[title="Stage child removal until Save changes"]').last().click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForTimeout(250);
  const removed = await countRecords('ChildRelation', 'family', sample.family);
  return { ok: added === before + 1 && removed === before, detail: `${before}->${added}->${removed}` };
}

async function checkPersonSourceRelationAddRemove() {
  await setLocked(sample.person, false);
  const source = await firstAvailableRelationTarget('SourceRelation', 'target', sample.person, 'source', 'Source');
  if (!source) return { ok: false, detail: 'no available source candidate' };
  await page.goto(`${BASE}/person/${sample.person}`, { waitUntil: 'networkidle' });
  const before = await countRecords('SourceRelation', 'target', sample.person);
  const section = page.locator('div.rounded-lg', { hasText: 'Source Citations' }).first();
  await section.locator('select').last().selectOption(source.recordName);
  await section.getByRole('button', { name: 'Attach now' }).click();
  await page.waitForTimeout(250);
  const added = await countRecords('SourceRelation', 'target', sample.person);
  await section.getByRole('button', { name: 'Remove now' }).last().click();
  await page.waitForTimeout(250);
  const removed = await countRecords('SourceRelation', 'target', sample.person);
  return { ok: added === before + 1 && removed === before, detail: `${before}->${added}->${removed}` };
}

async function checkPersonMediaRelationAddRemove() {
  await setLocked(sample.person, false);
  const media = await createSmokeMedia();
  try {
    await page.goto(`${BASE}/person/${sample.person}`, { waitUntil: 'networkidle' });
    const before = await countRecords('MediaRelation', 'target', sample.person);
    const section = page.locator('div.rounded-lg', { hasText: 'Media' }).first();
    await section.locator('select').first().selectOption('MediaPicture');
    await section.locator('select').last().selectOption(media.recordName);
    await section.getByRole('button', { name: 'Attach now' }).click();
    await page.waitForTimeout(250);
    const added = await countRecords('MediaRelation', 'target', sample.person);
    await section.getByRole('button', { name: 'Remove now' }).last().click();
    await page.waitForTimeout(250);
    const removed = await countRecords('MediaRelation', 'target', sample.person);
    return { ok: added === before + 1 && removed === before, detail: `${before}->${added}->${removed}` };
  } finally {
    await deleteRecordDirect(media.recordName);
  }
}

async function checkCreateDeleteTodo() {
  await page.goto(`${BASE}/todos`, { waitUntil: 'domcontentloaded' });
  const before = await countType('ToDo');
  await page.getByRole('button', { name: /New/i }).click();
  await page.waitForTimeout(250);
  const afterCreate = await countType('ToDo');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForTimeout(250);
  const afterDelete = await countType('ToDo');
  return { ok: afterCreate === before + 1 && afterDelete === before, detail: `${before}->${afterCreate}->${afterDelete}` };
}

async function checkCreateDeleteStory() {
  await page.goto(`${BASE}/stories`, { waitUntil: 'domcontentloaded' });
  const before = await countType('Story');
  await page.getByRole('button', { name: /New/i }).click();
  await page.waitForTimeout(250);
  const createdId = await newestRecordName('Story');
  const afterCreate = await countType('Story');
  await deleteRecordDirect(createdId);
  const afterDelete = await countType('Story');
  return { ok: afterCreate === before + 1 && afterDelete === before, detail: `${before}->${afterCreate}->${afterDelete}` };
}

async function checkCreateDeleteGroup() {
  await page.goto(`${BASE}/groups`, { waitUntil: 'domcontentloaded' });
  const before = await countType('PersonGroup');
  await page.getByRole('button', { name: /New/i }).click();
  await page.waitForTimeout(250);
  const createdId = await newestRecordName('PersonGroup');
  const afterCreate = await countType('PersonGroup');
  await deleteRecordDirect(createdId);
  const afterDelete = await countType('PersonGroup');
  return { ok: afterCreate === before + 1 && afterDelete === before, detail: `${before}->${afterCreate}->${afterDelete}` };
}

async function checkGroupMemberAddRemove() {
  const groupId = await createSmokeGroup();
  try {
    await setLocked(groupId, false);
    await page.goto(`${BASE}/groups?groupId=${encodeURIComponent(groupId)}`, { waitUntil: 'networkidle' });
    const candidate = await groupMemberCandidate(groupId);
    if (!candidate) return { ok: false, detail: 'no available member candidate' };
    const before = await countRecords('PersonGroupRelation', 'personGroup', groupId);
    await page.locator('.p-5 select').first().selectOption(candidate.recordName);
    await page.getByRole('button', { name: 'Add now' }).click();
    await page.waitForTimeout(250);
    const added = await countRecords('PersonGroupRelation', 'personGroup', groupId);
    await page.getByRole('button', { name: 'Remove now' }).last().click();
    await page.waitForTimeout(250);
    const removed = await countRecords('PersonGroupRelation', 'personGroup', groupId);
    return { ok: added === before + 1 && removed === before, detail: `${before}->${added}->${removed}` };
  } finally {
    await deleteRecordDirect(groupId);
  }
}

async function checkCreateDeleteRepository() {
  await page.goto(`${BASE}/repositories`, { waitUntil: 'domcontentloaded' });
  const before = await countType('SourceRepository');
  await page.getByRole('button', { name: /New/i }).click();
  await page.waitForTimeout(250);
  const afterCreate = await countType('SourceRepository');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForTimeout(250);
  const afterDelete = await countType('SourceRepository');
  return { ok: afterCreate === before + 1 && afterDelete === before, detail: `${before}->${afterCreate}->${afterDelete}` };
}

async function checkCreateDeleteLabel() {
  await page.goto(`${BASE}/labels`, { waitUntil: 'domcontentloaded' });
  const before = await countType('Label');
  await page.getByRole('button', { name: /New/i }).click();
  await page.waitForTimeout(250);
  const afterCreate = await countType('Label');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForTimeout(250);
  const afterDelete = await countType('Label');
  return { ok: afterCreate === before + 1 && afterDelete === before, detail: `${before}->${afterCreate}->${afterDelete}` };
}

async function countType(recordType) {
  return page.evaluate(async (type) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    return getLocalDatabase().getRecordCountByType(type);
  }, recordType);
}

async function countRecords(recordType, referenceField, referenceValue) {
  return page.evaluate(async ({ recordType, referenceField, referenceValue }) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    return (await getLocalDatabase().query(recordType, { referenceField, referenceValue, limit: 100000 })).records.length;
  }, { recordType, referenceField, referenceValue });
}

async function newestRecordName(recordType) {
  return page.evaluate(async (type) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const records = (await getLocalDatabase().query(type, { limit: 100000 })).records;
    records.sort((a, b) => (b.modified?.timestamp || 0) - (a.modified?.timestamp || 0));
    return records[0]?.recordName || null;
  }, recordType);
}

async function deleteRecordDirect(recordName) {
  await page.evaluate(async (name) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    if (name) await getLocalDatabase().deleteRecord(name);
  }, recordName);
}

async function setLocked(recordName, locked) {
  await page.evaluate(async ({ recordName, locked }) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const db = getLocalDatabase();
    const record = await db.getRecord(recordName);
    if (!record) return;
    const fields = { ...(record.fields || {}) };
    if (locked) fields.isLocked = { value: true, type: 'BOOLEAN' };
    else delete fields.isLocked;
    await db.saveRecord({ ...record, fields });
  }, { recordName, locked });
}

async function familyChildCandidate(familyId) {
  return page.evaluate(async (familyId) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const { readRef } = await import('/src/lib/schema.js');
    const db = getLocalDatabase();
    const family = await db.getRecord(familyId);
    const partnerIds = new Set([readRef(family?.fields?.man), readRef(family?.fields?.woman)].filter(Boolean));
    const children = await db.query('ChildRelation', { referenceField: 'family', referenceValue: familyId, limit: 100000 });
    const childIds = new Set(children.records.map((rel) => readRef(rel.fields?.child)).filter(Boolean));
    const persons = (await db.query('Person', { limit: 100000 })).records;
    const labels = new Map();
    for (const person of persons) {
      if (childIds.has(person.recordName) || partnerIds.has(person.recordName)) continue;
      const fullName = person.fields?.cached_fullName?.value ||
        [person.fields?.firstName?.value, person.fields?.lastName?.value].filter(Boolean).join(' ');
      if (!fullName) continue;
      labels.set(fullName, (labels.get(fullName) || 0) + 1);
    }
    for (const person of persons) {
      if (childIds.has(person.recordName) || partnerIds.has(person.recordName)) continue;
      const fullName = person.fields?.cached_fullName?.value ||
        [person.fields?.firstName?.value, person.fields?.lastName?.value].filter(Boolean).join(' ');
      if (fullName && labels.get(fullName) === 1) return { recordName: person.recordName, fullName };
    }
    return null;
  }, familyId);
}

async function groupMemberCandidate(groupId) {
  return page.evaluate(async (groupId) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const { readRef } = await import('/src/lib/schema.js');
    const db = getLocalDatabase();
    const members = await db.query('PersonGroupRelation', { referenceField: 'personGroup', referenceValue: groupId, limit: 100000 });
    const memberIds = new Set(members.records.map((rel) => readRef(rel.fields?.person)).filter(Boolean));
    const person = (await db.query('Person', { limit: 100000 })).records.find((record) => !memberIds.has(record.recordName));
    return person ? { recordName: person.recordName } : null;
  }, groupId);
}

async function firstAvailableRelationTarget(relationType, ownerField, ownerId, targetField, targetType) {
  return page.evaluate(async ({ relationType, ownerField, ownerId, targetField, targetType }) => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const { readRef } = await import('/src/lib/schema.js');
    const db = getLocalDatabase();
    const relations = await db.query(relationType, { referenceField: ownerField, referenceValue: ownerId, limit: 100000 });
    const attached = new Set(relations.records.map((rel) => readRef(rel.fields?.[targetField])).filter(Boolean));
    const target = (await db.query(targetType, { limit: 100000 })).records.find((record) => !attached.has(record.recordName));
    return target ? { recordName: target.recordName } : null;
  }, { relationType, ownerField, ownerId, targetField, targetType });
}

async function createSmokeMedia() {
  return page.evaluate(async () => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const record = {
      recordName: `media-smoke-${Date.now()}`,
      recordType: 'MediaPicture',
      fields: {
        title: { value: `Smoke media ${Date.now()}`, type: 'STRING' },
        caption: { value: 'Smoke media', type: 'STRING' },
      },
    };
    await getLocalDatabase().saveRecord(record);
    return { recordName: record.recordName };
  });
}

async function createSmokeGroup() {
  return page.evaluate(async () => {
    const { getLocalDatabase } = await import('/src/lib/LocalDatabase.js');
    const record = {
      recordName: `grp-smoke-${Date.now()}`,
      recordType: 'PersonGroup',
      fields: {
        name: { value: `Smoke group ${Date.now()}`, type: 'STRING' },
      },
    };
    await getLocalDatabase().saveRecord(record);
    return record.recordName;
  });
}

async function captureWrite(label, fn) {
  console.log(`writing ${label}`);
  try {
    writeResults.push({ label, ...await fn() });
  } catch (error) {
    writeResults.push({ label, ok: false, detail: error.message });
  }
}
