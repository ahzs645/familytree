export function sosaFather(number) {
  const n = normalizeSosaNumber(number);
  return n == null ? null : n * 2;
}

export function sosaMother(number) {
  const n = normalizeSosaNumber(number);
  return n == null ? null : n * 2 + 1;
}

export function sosaParent(number) {
  const n = normalizeSosaNumber(number);
  return n == null || n <= 1 ? null : Math.floor(n / 2);
}

export function sosaGeneration(number) {
  const n = normalizeSosaNumber(number);
  if (n == null) return null;
  return Math.floor(Math.log2(n)) + 1;
}

export function sosaRelation(number) {
  const n = normalizeSosaNumber(number);
  if (n == null) return '';
  if (n === 1) return 'Self';
  const steps = sosaBranchPath(n);
  const parentChain = steps.map((step) => (step === 'F' ? 'Father' : 'Mother'));
  return parentChain.reverse().join("'s ");
}

export function sosaBranchPath(number) {
  const n = normalizeSosaNumber(number);
  if (n == null || n === 1) return [];
  const steps = [];
  let current = n;
  while (current > 1) {
    steps.push(current % 2 === 0 ? 'F' : 'M');
    current = Math.floor(current / 2);
  }
  return steps.reverse();
}

export function previousSosa(number) {
  const n = normalizeSosaNumber(number);
  return n == null || n <= 1 ? null : n - 1;
}

export function nextSosa(number) {
  const n = normalizeSosaNumber(number);
  return n == null ? null : n + 1;
}

export function normalizeSosaNumber(number) {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}
