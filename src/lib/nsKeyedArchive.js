/**
 * Targeted NSKeyedArchiver decoder for MacFamilyTree XML and binary plist archives.
 *
 * MacFamilyTree stores smart scopes and saved view layouts as archived object
 * graphs. The browser does not have NSKeyedUnarchiver, so this decoder handles
 * the plist archive shape we need: CF$UID references, Foundation arrays and
 * dictionaries, and QueryObjectsController filter containers.
 */

function base64ToBytes(base64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToText(bytes) {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('utf8');
  let out = '';
  for (const b of bytes) out += String.fromCharCode(b);
  return decodeURIComponent(escape(out));
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function xmlDecode(value) {
  return String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function tagName(token) {
  const match = String(token).match(/^<\/?\s*([^\s>/]+)/);
  return match?.[1] || '';
}

function isClosing(token, name) {
  return String(token).startsWith('</') && tagName(token) === name;
}

function isSelfClosing(token) {
  return /\/\s*>$/.test(String(token));
}

function parseScalarText(tokens, cursor, closeName) {
  let text = '';
  while (cursor.i < tokens.length) {
    const token = tokens[cursor.i++];
    if (isClosing(token, closeName)) break;
    if (!String(token).startsWith('<')) text += token;
  }
  return xmlDecode(text);
}

function parseXmlPlist(text) {
  const tokens = Array.from(
    String(text).matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[\s\S]*?>|<[^>]+>|[^<]+/g),
    (match) => match[0]
  );
  const cursor = { i: 0 };

  function nextMeaningful() {
    while (cursor.i < tokens.length) {
      const token = tokens[cursor.i++];
      if (!String(token).startsWith('<') && !String(token).trim()) continue;
      if (String(token).startsWith('<?') || String(token).startsWith('<!') || String(token).startsWith('<!--')) continue;
      return token;
    }
    return null;
  }

  function peekMeaningful() {
    const old = cursor.i;
    const token = nextMeaningful();
    cursor.i = old;
    return token;
  }

  function parseValue() {
    const token = nextMeaningful();
    if (!token) return null;
    const name = tagName(token);

    if (name === 'plist') {
      if (isSelfClosing(token)) return null;
      const value = parseValue();
      nextMeaningful(); // </plist>
      return value;
    }

    if (name === 'dict') {
      if (isSelfClosing(token)) return {};
      const obj = {};
      while (cursor.i < tokens.length) {
        const next = peekMeaningful();
        if (!next || isClosing(next, 'dict')) {
          nextMeaningful();
          break;
        }
        const keyToken = nextMeaningful();
        if (tagName(keyToken) !== 'key') throw new Error('Expected plist <key>');
        const key = parseScalarText(tokens, cursor, 'key');
        obj[key] = parseValue();
      }
      return obj;
    }

    if (name === 'array') {
      if (isSelfClosing(token)) return [];
      const arr = [];
      while (cursor.i < tokens.length) {
        const next = peekMeaningful();
        if (!next || isClosing(next, 'array')) {
          nextMeaningful();
          break;
        }
        arr.push(parseValue());
      }
      return arr;
    }

    if (name === 'string' || name === 'key' || name === 'data' || name === 'date') {
      if (isSelfClosing(token)) return '';
      return parseScalarText(tokens, cursor, name).trim();
    }

    if (name === 'integer') {
      if (isSelfClosing(token)) return 0;
      const value = parseScalarText(tokens, cursor, name).trim();
      return Number.parseInt(value, 10);
    }

    if (name === 'real') {
      if (isSelfClosing(token)) return 0;
      const value = parseScalarText(tokens, cursor, name).trim();
      return Number.parseFloat(value);
    }

    if (name === 'true') return true;
    if (name === 'false') return false;

    throw new Error(`Unsupported plist tag <${name}>`);
  }

  return parseValue();
}

function readUInt(bytes, offset, size) {
  let value = 0;
  for (let i = 0; i < size; i++) value = value * 256 + bytes[offset + i];
  return value;
}

function readInt(bytes, offset, size) {
  const unsigned = readUInt(bytes, offset, size);
  const signBit = 2 ** (size * 8 - 1);
  return unsigned >= signBit ? unsigned - 2 ** (size * 8) : unsigned;
}

function readDouble(bytes, offset, size) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, size);
  if (size === 4) return view.getFloat32(0, false);
  if (size === 8) return view.getFloat64(0, false);
  throw new Error(`Unsupported binary plist float size ${size}`);
}

function readBinaryCount(bytes, objectOffset, lowNibble, readObjectAtOffset) {
  if (lowNibble < 0xf) return { count: lowNibble, offset: objectOffset + 1 };
  const countObject = readObjectAtOffset(objectOffset + 1, true);
  if (typeof countObject.value !== 'number') throw new Error('Binary plist extended count is not numeric');
  return { count: countObject.value, offset: countObject.nextOffset };
}

function parseBinaryPlist(bytes) {
  if (bytes.length < 40 || bytesToText(bytes.slice(0, 8)) !== 'bplist00') {
    throw new Error('Invalid binary plist header');
  }

  const trailerOffset = bytes.length - 32;
  const offsetIntSize = bytes[trailerOffset + 6];
  const objectRefSize = bytes[trailerOffset + 7];
  const numObjects = readUInt(bytes, trailerOffset + 8, 8);
  const topObject = readUInt(bytes, trailerOffset + 16, 8);
  const offsetTableOffset = readUInt(bytes, trailerOffset + 24, 8);
  const offsets = [];
  for (let i = 0; i < numObjects; i++) {
    offsets.push(readUInt(bytes, offsetTableOffset + i * offsetIntSize, offsetIntSize));
  }
  const cache = new Map();

  function readObject(index) {
    if (index < 0 || index >= offsets.length) throw new Error(`Binary plist object index out of range: ${index}`);
    if (cache.has(index)) return cache.get(index);
    const parsed = readObjectAtOffset(offsets[index]);
    cache.set(index, parsed.value);
    return parsed.value;
  }

  function readRefs(offset, count) {
    const refs = [];
    for (let i = 0; i < count; i++) refs.push(readUInt(bytes, offset + i * objectRefSize, objectRefSize));
    return refs;
  }

  function readObjectAtOffset(offset, raw = false) {
    const marker = bytes[offset];
    const high = marker >> 4;
    const low = marker & 0x0f;

    if (high === 0x0) {
      if (low === 0x0) return { value: null, nextOffset: offset + 1 };
      if (low === 0x8) return { value: false, nextOffset: offset + 1 };
      if (low === 0x9) return { value: true, nextOffset: offset + 1 };
      if (low === 0xf) return { value: null, nextOffset: offset + 1 };
      throw new Error(`Unsupported binary plist simple object 0x${marker.toString(16)}`);
    }

    if (high === 0x1) {
      const size = 2 ** low;
      const value = readInt(bytes, offset + 1, size);
      return { value, nextOffset: offset + 1 + size };
    }

    if (high === 0x2) {
      const size = 2 ** low;
      return { value: readDouble(bytes, offset + 1, size), nextOffset: offset + 1 + size };
    }

    if (high === 0x3) {
      const seconds = readDouble(bytes, offset + 1, 8);
      return { value: new Date(978307200000 + seconds * 1000).toISOString(), nextOffset: offset + 9 };
    }

    if (high === 0x4) {
      const { count, offset: payloadOffset } = readBinaryCount(bytes, offset, low, readObjectAtOffset);
      const payload = bytes.slice(payloadOffset, payloadOffset + count);
      return { value: bytesToBase64(payload), nextOffset: payloadOffset + count };
    }

    if (high === 0x5) {
      const { count, offset: payloadOffset } = readBinaryCount(bytes, offset, low, readObjectAtOffset);
      return { value: bytesToText(bytes.slice(payloadOffset, payloadOffset + count)), nextOffset: payloadOffset + count };
    }

    if (high === 0x6) {
      const { count, offset: payloadOffset } = readBinaryCount(bytes, offset, low, readObjectAtOffset);
      let value = '';
      for (let i = 0; i < count; i++) value += String.fromCharCode(readUInt(bytes, payloadOffset + i * 2, 2));
      return { value, nextOffset: payloadOffset + count * 2 };
    }

    if (high === 0x8) {
      const size = low + 1;
      return { value: { 'CF$UID': readUInt(bytes, offset + 1, size) }, nextOffset: offset + 1 + size };
    }

    if (high === 0xa) {
      const { count, offset: refsOffset } = readBinaryCount(bytes, offset, low, readObjectAtOffset);
      const refs = readRefs(refsOffset, count);
      return { value: raw ? refs : refs.map(readObject), nextOffset: refsOffset + count * objectRefSize };
    }

    if (high === 0xd) {
      const { count, offset: refsOffset } = readBinaryCount(bytes, offset, low, readObjectAtOffset);
      const keyRefs = readRefs(refsOffset, count);
      const valueRefs = readRefs(refsOffset + count * objectRefSize, count);
      const out = {};
      for (let i = 0; i < count; i++) out[String(readObject(keyRefs[i]))] = readObject(valueRefs[i]);
      return { value: out, nextOffset: refsOffset + count * objectRefSize * 2 };
    }

    throw new Error(`Unsupported binary plist marker 0x${marker.toString(16)}`);
  }

  return readObject(topObject);
}

function isUid(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, 'CF$UID')
  );
}

function uidValue(value) {
  return isUid(value) ? value['CF$UID'] : null;
}

function classNameFor(value, objects) {
  const classUid = uidValue(value?.$class);
  if (classUid == null) return '';
  return objects?.[classUid]?.$classname || '';
}

function resolveArchivedValue(value, objects, seen = new Set()) {
  if (isUid(value)) {
    const idx = value['CF$UID'];
    if (idx === 0) return null;
    if (seen.has(idx)) return { $ref: idx };
    seen.add(idx);
    const resolved = resolveArchivedValue(objects[idx], objects, seen);
    seen.delete(idx);
    return resolved;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveArchivedValue(item, objects, seen));
  }

  if (!value || typeof value !== 'object') return value;

  const className = classNameFor(value, objects);
  if (value['NS.keys'] && value['NS.objects']) {
    const keys = resolveArchivedValue(value['NS.keys'], objects, seen);
    const vals = resolveArchivedValue(value['NS.objects'], objects, seen);
    const out = {};
    keys.forEach((key, index) => {
      out[String(key)] = vals[index];
    });
    if (className) out.$className = className;
    return out;
  }

  if (value['NS.objects'] && /Array$/.test(className)) {
    return resolveArchivedValue(value['NS.objects'], objects, seen);
  }

  const out = {};
  if (className) out.$className = className;
  for (const [key, raw] of Object.entries(value)) {
    if (key === '$class') continue;
    out[key] = resolveArchivedValue(raw, objects, seen);
  }
  return out;
}

function collectFilters(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  const className = node.$className || '';

  if (className.includes('CompoundFilter')) {
    out.push({
      kind: 'compound',
      compoundFilterType: node.compoundFilterType ?? null,
      selectionDictionary: stripClassName(node.selectionDictionary),
    });
    for (const child of node.subFilters || []) collectFilters(child, out);
    return out;
  }

  if (className.includes('FetchFilter')) {
    out.push({
      kind: 'fetch',
      fetchFilterType: node.fetchFilterType ?? null,
      selectionDictionary: stripClassName(node.selectionDictionary),
    });
    return out;
  }

  if (className.includes('ArrayFilter')) {
    out.push({
      kind: 'array',
      arrayFilterType: node.arrayFilterType ?? null,
      selectionDictionary: stripClassName(node.selectionDictionary),
    });
    return out;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => collectFilters(item, out));
    else if (value && typeof value === 'object') collectFilters(value, out);
  }
  return out;
}

function stripClassName(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (key !== '$className') out[key] = val;
  }
  return out;
}

function summarizeRoot(root) {
  if (!root || typeof root !== 'object') return {};
  const filters = collectFilters(root.rootCompoundFilter);
  return {
    rootClass: root.$className || '',
    entityName: root.entityName || '',
    identifier: root.identifier || '',
    filterCount: filters.filter((filter) => filter.kind !== 'compound').length,
    filters,
  };
}

export function decodeNSKeyedArchive(base64) {
  const bytes = base64ToBytes(base64);
  const header = bytesToText(bytes.slice(0, 16));
  let plist;

  if (header.startsWith('bplist00')) {
    plist = parseBinaryPlist(bytes);
  } else {
    const text = bytesToText(bytes);
    if (!text.trim().startsWith('<?xml') && !text.trim().startsWith('<plist')) {
      return {
        format: 'NSKeyedArchiver',
        status: 'unknown',
        decoded: null,
        summary: { reason: 'Payload is not an XML or binary plist archive.' },
      };
    }
    plist = parseXmlPlist(text);
  }

  if (plist?.$archiver !== 'NSKeyedArchiver' || !Array.isArray(plist.$objects)) {
    return {
      format: 'plist',
      status: 'decoded',
      decoded: plist,
      summary: {},
    };
  }

  const rootUid = uidValue(plist.$top?.root);
  const root = rootUid == null ? null : resolveArchivedValue({ 'CF$UID': rootUid }, plist.$objects);
  return {
    format: 'NSKeyedArchiver',
    status: 'decoded',
    decoded: root,
    summary: summarizeRoot(root),
  };
}
