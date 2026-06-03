function suburbParts(value) {
  const text = String(value ?? '');
  if (!text.startsWith('[')) return null;

  const close = text.indexOf(']');
  if (close === -1) return null;

  let index = close + 1;
  while (index < text.length && text[index] === ' ') index += 1;

  const dash = text[index];
  if (dash !== '-' && dash !== '\u2013' && dash !== '\u2014') return null;

  index += 1;
  while (index < text.length && text[index] === ' ') index += 1;

  if (index >= text.length) return null;

  return {
    suburb: text.slice(1, close),
    place: text.slice(index),
  };
}

function alphabeticKey(char) {
  return char.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function alphabeticOrder(left, right) {
  const a = String(left);
  const b = String(right);
  if (a === b) return 0;

  const aChars = Array.from(a);
  const bChars = Array.from(b);
  const length = Math.min(aChars.length, bChars.length);

  for (let index = 0; index < length; index += 1) {
    const aKey = alphabeticKey(aChars[index]);
    const bKey = alphabeticKey(bChars[index]);
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    if (aChars[index] < bChars[index]) return -1;
    if (aChars[index] > bChars[index]) return 1;
  }

  if (aChars.length === bChars.length) return 0;
  return aChars.length < bChars.length ? -1 : 1;
}

function compareLists(left, right, compare) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const result = compare(left[index], right[index]);
    if (result !== 0) return result;
  }
  if (left.length === right.length) return 0;
  return left.length < right.length ? -1 : 1;
}

export function splitSuburb(value) {
  const text = String(value ?? '');
  const parts = suburbParts(text);
  return parts ? [parts.suburb, parts.place] : ['', text];
}

export function onlySuburb(value) {
  return suburbParts(value)?.suburb ?? '';
}

export function withoutSuburb(value) {
  const text = String(value ?? '');
  return suburbParts(text)?.place ?? text;
}

export function normalizePlace(value) {
  const text = String(value ?? '');
  const parts = suburbParts(text);
  return parts ? `${parts.suburb}, ${parts.place}` : text;
}

export function comparePlaces(left, right) {
  const [leftSuburb, leftPlace] = splitSuburb(left);
  const [rightSuburb, rightPlace] = splitSuburb(right);
  const placeResult = compareLists(leftPlace.split(','), rightPlace.split(','), alphabeticOrder);
  return placeResult === 0 ? alphabeticOrder(leftSuburb, rightSuburb) : placeResult;
}

