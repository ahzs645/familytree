// MFT stores label colors as space-separated float RGB ("0.23 0.5 0.89") or
// sometimes plain 0-255 triplets. Convert any of those — plus already-valid CSS
// colors — to a #rrggbb string the native <input type="color"> can consume.
export function toCssHexColor(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return ('#' + r + r + g + g + b + b).toLowerCase();
  }
  const parts = raw.split(/[;,\s]+/).map(Number).filter((n) => Number.isFinite(n));
  if (parts.length >= 3) {
    const [r, g, b] = parts.slice(0, 3).map((n) =>
      Math.max(0, Math.min(255, n <= 1 ? Math.round(n * 255) : Math.round(n)))
    );
    const hex = (n) => n.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  return '';
}
