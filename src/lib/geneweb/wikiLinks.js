const TOKEN_NONE = 'none';
const TOKEN_PAGE = 'page';
const TOKEN_PERSON = 'person';
const TOKEN_WIZARD = 'wizard';
const TOKEN_IMAGE = 'image';

function none(end, text) {
  return { type: TOKEN_NONE, end, text };
}

function validFilePath(value) {
  const parts = String(value).split(':');
  if (parts.some((part) => part.length === 0 || !/^[A-Za-z0-9_.-]+$/.test(part))) return null;
  return {
    dirs: parts.slice(0, -1),
    fileName: parts.at(-1),
  };
}

function scanNone(text, start, from) {
  for (let index = from; index < text.length; index += 1) {
    const char = text[index];
    if (char === '%' || char === "'" || char === '{') return none(index, text.slice(start, index));
    if (char === '[') {
      if (index > start && text[index + 1] === '[') return none(index, text.slice(start, index));
    }
  }
  return none(text.length, text.slice(start));
}

function parsePage(text, start) {
  const close = text.indexOf(']]]', start + 3);
  const end = close === -1 ? start : close + 3;
  if (end <= start + 6) return scanNone(text, start, end);

  const body = text.slice(start + 3, end - 3);
  const slash = body.lastIndexOf('/');
  let file = body;
  let anchor = '';
  let label = body;

  if (slash !== -1) {
    const hash = body.lastIndexOf('#', slash);
    const fileEnd = hash === -1 ? slash : hash;
    const anchorStart = hash === -1 ? slash : Math.min(hash + 1, slash);
    file = body.slice(0, fileEnd);
    anchor = body.slice(anchorStart, slash);
    label = body.slice(slash + 1);
  }

  const path = validFilePath(file);
  if (!path) return scanNone(text, start, end);

  return {
    type: TOKEN_PAGE,
    end,
    path,
    full: file,
    anchor,
    text: label,
  };
}

function splitFirst(value, separator) {
  const index = value.indexOf(separator);
  return index === -1 ? [value, null] : [value.slice(0, index), value.slice(index + 1)];
}

function parseWizard(end, body) {
  const [wizard, name] = splitFirst(body, '/');
  return { type: TOKEN_WIZARD, end, wizard, name: name ?? '' };
}

function parseImage(text, start, end, body) {
  const [imagePath, rest] = splitFirst(body, '/');
  const path = validFilePath(imagePath);
  if (!path) return scanNone(text, start, end);

  let alt = '';
  let width = null;
  if (rest !== null) {
    const [rawAlt, rawWidth] = splitFirst(rest, '/');
    alt = rawAlt;
    width = rawWidth || null;
  }

  return { type: TOKEN_IMAGE, end, path, alt, width };
}

function parsePerson(text, start, end, body, explicitText) {
  const firstSlash = body.indexOf('/');
  if (firstSlash === -1) return scanNone(text, start, end);

  const rawFirstName = body.slice(0, firstSlash);
  const firstName = rawFirstName.toLowerCase();
  const rest = body.slice(firstSlash + 1);
  const secondSlash = rest.indexOf('/');
  let surname;
  let rawSurname;
  let occurrence = 0;
  let name;

  if (secondSlash === -1) {
    rawSurname = rest;
    surname = rawSurname.toLowerCase();
    name = `${rawFirstName} ${rawSurname}`;
  } else {
    rawSurname = rest.slice(0, secondSlash);
    surname = rawSurname.toLowerCase();
    const afterSurname = rest.slice(secondSlash + 1);
    const thirdSlash = afterSurname.indexOf('/');
    if (thirdSlash === -1) {
      name = afterSurname;
    } else {
      const occurrenceText = afterSurname.slice(0, thirdSlash);
      occurrence = Number.parseInt(occurrenceText, 10);
      if (Number.isNaN(occurrence)) occurrence = 0;
      name = afterSurname.slice(thirdSlash + 1);
    }

    const nameOccurrence = Number.parseInt(name, 10);
    if (!Number.isNaN(nameOccurrence) && String(nameOccurrence) === name) {
      occurrence = nameOccurrence;
      name = `${rawFirstName} ${rawSurname}`;
    }
  }

  let tokenEnd = end;
  let familyMarker = null;
  if (text[tokenEnd] === '#') {
    let index = tokenEnd + 1;
    let value = 0;
    while (index < text.length && /[0-9]/.test(text[index])) {
      value = value * 10 + Number(text[index]);
      index += 1;
    }
    tokenEnd = index;
    if (value > 0) familyMarker = value;
  }

  return {
    type: TOKEN_PERSON,
    end: tokenEnd,
    key: { firstName, surname, occurrence },
    name,
    text: explicitText,
    familyMarker,
  };
}

function parseDoubleLink(text, start) {
  const close = text.indexOf(']]', start + 2);
  const end = close === -1 ? text.length : close + 2;
  if (end <= start + 4) return scanNone(text, start, end);

  let body = text.slice(start + 2, end - 2);
  const [prefixOrBody, afterPrefix] = splitFirst(body, ':');
  const prefix = afterPrefix === null ? null : prefixOrBody;
  body = afterPrefix === null ? body : afterPrefix;

  const [linkBody, explicitText] = splitFirst(body, ';');

  if (prefix === 'w') return parseWizard(end, linkBody);
  if (prefix === 'image') return parseImage(text, start, end, linkBody);
  return parsePerson(text, start, end, linkBody, explicitText);
}

export function parseGeneWebWikiLinkAt(text, start = 0) {
  const value = String(text ?? '');
  if (start < value.length - 2 && value[start] === '[' && value[start + 1] === '[') {
    if (value[start + 2] === '[') return parsePage(value, start);
    return parseDoubleLink(value, start);
  }
  return scanNone(value, start, start + 1);
}

export function parseGeneWebWikiLinks(text) {
  const value = String(text ?? '');
  const tokens = [];
  let index = 0;

  while (index < value.length) {
    const token = parseGeneWebWikiLinkAt(value, index);
    tokens.push(token);
    index = token.end;
  }

  return tokens;
}

export const geneWebWikiTokenTypes = {
  none: TOKEN_NONE,
  page: TOKEN_PAGE,
  person: TOKEN_PERSON,
  wizard: TOKEN_WIZARD,
  image: TOKEN_IMAGE,
};
