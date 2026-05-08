/**
 * Vietnamese-localised "gia phả" (family lineage) report.
 *
 * The locale is fixed inside this module so the rest of the codebase
 * isn't tempted to import it; we use the Vietnamese-friendly date format
 * regardless of the user's display preferences.
 */
import { buildAncestorTree, buildDescendantTree } from '../../treeQuery.js';
import { formatEventDate } from '../../../utils/formatDate.js';
import { block, emptyReport } from '../ast.js';
import { nameOf } from './_helpers.js';

const VI_LOCALIZATION = Object.freeze({ locale: 'vi', calendar: 'gregory', numberingSystem: 'latn', direction: 'ltr' });

function lineagePersonLine(person) {
  const parts = [nameOf(person)];
  const birth = formatVietnameseDate(person?.birthDate);
  const death = formatVietnameseDate(person?.deathDate);
  if (birth) parts.push(`sinh ${birth}`);
  if (death) parts.push(`mất ${death}`);
  return parts.join(', ');
}

function formatVietnameseDate(value) {
  return value ? formatEventDate(value, VI_LOCALIZATION) : '';
}

function vietnameseAncestorRole(generation, path) {
  if (generation === 0) return 'Gốc';
  const maternal = path.endsWith('M');
  if (generation === 1) return maternal ? 'Mẹ' : 'Cha';
  if (generation === 2) return maternal ? 'Bà' : 'Ông';
  return `${generation - 1} đời tổ tiên ${maternal ? 'bên mẹ' : 'bên cha'}`;
}

/**
 * GIA PHA / FAMILY LINEAGE — Vietnamese-oriented lineage register.
 */
export async function buildGiaPhaLineageReport(recordName, generations = 5) {
  const [ancestors, descendants] = await Promise.all([
    buildAncestorTree(recordName, generations),
    buildDescendantTree(recordName, generations),
  ]);
  const root = descendants?.person || ancestors?.person;
  if (!root) return emptyReport('Person not found');

  const report = emptyReport(`Gia phả / Family Lineage — ${nameOf(root)}`);
  report.blocks.push(block.title(report.title, 1));
  report.blocks.push(block.paragraph(`Trưởng hệ / Lineage subject: ${lineagePersonLine(root)}`));

  const ancestorRows = [];
  function visitAncestor(node, generation, path) {
    if (!node?.person || generation > generations) return;
    ancestorRows.push([
      String(generation + 1),
      vietnameseAncestorRole(generation, path),
      path || 'Gốc',
      nameOf(node.person),
      formatVietnameseDate(node.person.birthDate),
      formatVietnameseDate(node.person.deathDate),
    ]);
    visitAncestor(node.father, generation + 1, `${path}F`);
    visitAncestor(node.mother, generation + 1, `${path}M`);
  }
  visitAncestor(ancestors, 0, '');

  report.blocks.push(block.title('Tổ tiên / Ancestors', 2));
  report.blocks.push(block.table(['Đời', 'Vai trò', 'Mã nhánh', 'Họ tên', 'Sinh', 'Mất'], ancestorRows));

  const descendantRows = [];
  function visitDescendant(node, generation, lineageCode) {
    if (!node?.person || generation > generations) return;
    const spouses = [];
    const children = [];
    for (const union of node.unions || []) {
      if (union.partner) spouses.push(nameOf(union.partner));
      for (const child of union.children || []) children.push(nameOf(child.person));
    }
    descendantRows.push([
      String(generation + 1),
      generation === 0 ? 'Gốc' : `${generation} đời sau`,
      lineageCode,
      nameOf(node.person),
      formatVietnameseDate(node.person.birthDate),
      formatVietnameseDate(node.person.deathDate),
      spouses.join('; '),
      children.join('; '),
    ]);
    let childIndex = 1;
    for (const union of node.unions || []) {
      for (const child of union.children || []) {
        visitDescendant(child, generation + 1, `${lineageCode}.${childIndex}`);
        childIndex += 1;
      }
    }
  }
  visitDescendant(descendants, 0, '1');

  report.blocks.push(block.title('Hậu duệ / Descendants', 2));
  report.blocks.push(block.table(['Đời', 'Vai trò', 'Mã nhánh', 'Họ tên', 'Sinh', 'Mất', 'Phối ngẫu', 'Con'], descendantRows));
  return report;
}
