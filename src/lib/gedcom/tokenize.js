/**
 * GEDCOM tokenizer + tree builder.
 *
 * Pure text-shape stage of the importer:
 *   tokenizeGedcomText(text)  → { tokens, issues }
 *   parseGedcomTree(text)     → top-level node array (children-first tree)
 *
 * Both `analyze` and `normalize` consume this output. No record-shape or
 * IndexedDB knowledge here — just GEDCOM grammar.
 */
import { makeValidationIssue } from '../validationIssues.js';

function tokenizeLine(line) {
  // "level [@xref@] tag [value]"
  const m = line.match(/^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
  if (!m) return null;
  const tag = m[3];
  const xref = (tag === 'CONC' || tag === 'CONT') ? null : (m[2] || null);
  return { level: +m[1], xref, tag, value: (m[4] || '').replace(/@@/g, '@') };
}

export function issue(severity, line, code, message, extra = {}) {
  return makeValidationIssue({
    scope: 'gedcom-import',
    severity,
    line,
    code,
    message,
    ...extra,
  });
}

export function tokenizeGedcomText(text) {
  const lines = String(text || '').split(/\r\n|\r|\n/);
  const tokens = [];
  const issues = [];
  let previousToken = null;

  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    if (!raw.trim()) continue;

    const token = tokenizeLine(raw);
    if (!token) {
      issues.push(issue('error', line, 'gedcom-syntax', 'Line does not match GEDCOM level/tag syntax.', { details: { raw } }));
      continue;
    }

    if (token.level > 99) {
      issues.push(issue('warning', line, 'excessive-level', `Level ${token.level} is unusually deep for GEDCOM.`, { details: { level: token.level } }));
    }

    if (previousToken && token.level > previousToken.level + 1) {
      issues.push(issue('error', line, 'level-jump', `Level jumps from ${previousToken.level} to ${token.level}; expected at most ${previousToken.level + 1}.`, {
        details: { previousLine: previousToken.line, previousLevel: previousToken.level, level: token.level },
      }));
    }

    if ((token.tag === 'CONC' || token.tag === 'CONT') && token.level === 0) {
      issues.push(issue('error', line, 'orphan-continuation', `${token.tag} cannot appear at level 0.`));
    }

    tokens.push({ ...token, line, raw });
    previousToken = { ...token, line };
  }

  return { tokens, issues };
}

export function parseGedcomTree(text) {
  const { tokens } = tokenizeGedcomText(text);
  return parseGedcomTokens(tokens);
}

function parseGedcomTokens(tokens) {
  const root = { children: [] };
  const stack = [root];
  for (const t of tokens) {
    while (stack.length > t.level + 1) stack.pop();
    const node = { ...t, children: [] };
    const parent = stack[stack.length - 1] || root;
    parent.children.push(node);
    stack.push(node);
  }
  return root.children;
}

export function child(node, tag) {
  return node.children.find((c) => c.tag === tag);
}

export function children(node, tag) {
  return node.children.filter((c) => c.tag === tag);
}

export function isPointerValue(value) {
  return /^@[^@]+@$/.test(String(value || '').trim());
}

export function eventLikeTag(tag) {
  return tag.startsWith('_') || ['BIRT', 'DEAT', 'MARR', 'DIV', 'EVEN', 'FACT', 'ADOP', 'BURI', 'RESI', 'OCCU', 'CENS', 'IMMI', 'EMIG', 'NATU', 'EDUC', 'PROP'].includes(tag);
}
