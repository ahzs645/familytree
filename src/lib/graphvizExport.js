import { loadFamilyGraph, personDisplayName } from './familyGraph.js';
import { refToRecordName } from './recordRef.js';
import { childRelationKind, childRelationLabel } from './childRelationshipTypes.js';

export async function buildGraphvizDot(options = {}) {
  const graph = await loadFamilyGraph({ includePrivate: !!options.includePrivate });
  const relationByFamilyChild = new Map();
  for (const relation of graph.childRelations || []) {
    const familyId = refToRecordName(relation.fields?.family?.value);
    const childId = refToRecordName(relation.fields?.child?.value);
    if (familyId && childId) relationByFamilyChild.set(`${familyId}:${childId}`, relation);
  }

  const groupedPersonIds = new Set();
  const groups = groupPeople(graph);
  const lines = [
    'digraph FamilyTree {',
    '  graph [rankdir=TB, splines=ortho, nodesep=0.45, ranksep=0.7, bgcolor="transparent"];',
    '  node [shape=box, style="rounded,filled", fillcolor="white", color="#b8c0cc", fontname="Helvetica"];',
    '  edge [color="#8f98a8", fontname="Helvetica", fontsize=10];',
  ];

  groups.forEach((group, index) => {
    lines.push(`  subgraph cluster_${index} {`);
    lines.push(`    label=${quote(group.name)};`);
    lines.push('    style="rounded,dashed,filled";');
    lines.push('    color="#b8c0cc";');
    lines.push('    fillcolor="#f5f7fb";');
    for (const personId of group.personIds) {
      groupedPersonIds.add(personId);
      lines.push(`    ${nodeId(personId)} [label=${quote(personDisplayName(graph.getPerson(personId)))}];`);
    }
    lines.push('  }');
  });

  for (const person of graph.persons) {
    if (groupedPersonIds.has(person.recordName)) continue;
    lines.push(`  ${nodeId(person.recordName)} [label=${quote(personDisplayName(person))}];`);
  }

  for (const family of graph.families) {
    const familyId = family.recordName;
    const parents = [
      refToRecordName(family.fields?.man?.value),
      refToRecordName(family.fields?.woman?.value),
    ].filter((id) => id && graph.personById.has(id));
    const children = [...(graph.childrenByFamily.get(familyId) || [])].filter((id) => graph.personById.has(id));
    if (!parents.length && !children.length) continue;

    const unionId = nodeId(`union-${familyId}`);
    lines.push(`  ${unionId} [shape=circle, label="", width=0.12, height=0.12, fixedsize=true, fillcolor="#8f98a8", color="#8f98a8"];`);
    for (const parentId of parents) {
      lines.push(`  ${nodeId(parentId)} -> ${unionId} [dir=none, penwidth=1.7];`);
    }
    for (const childId of children) {
      const relation = relationByFamilyChild.get(`${familyId}:${childId}`);
      const secondary = childRelationKind(relation) === 'secondary';
      const attrs = [
        'dir=forward',
        'arrowhead=none',
        secondary ? 'style=dashed' : null,
        secondary ? 'color="#a9745b"' : null,
        secondary ? `label=${quote(childRelationLabel(relation))}` : null,
      ].filter(Boolean).join(', ');
      lines.push(`  ${unionId} -> ${nodeId(childId)} [${attrs}];`);
    }
  }

  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export async function downloadGraphvizDot(options = {}) {
  const dot = await buildGraphvizDot(options);
  const blob = new Blob([dot], { type: 'text/vnd.graphviz;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.filename || `family-tree-${new Date().toISOString().slice(0, 10)}.dot`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'Graphviz DOT exported.';
}

function groupPeople(graph) {
  const byGroup = new Map();
  for (const person of graph.persons) {
    for (const groupName of graph.getGroups(person.recordName) || []) {
      if (!groupName) continue;
      if (!byGroup.has(groupName)) byGroup.set(groupName, []);
      byGroup.get(groupName).push(person.recordName);
    }
  }
  return [...byGroup.entries()]
    .map(([name, personIds]) => ({ name, personIds }))
    .filter((group) => group.personIds.length >= 2)
    .slice(0, 24);
}

function nodeId(value) {
  return `n_${String(value).replace(/[^A-Za-z0-9_]/g, '_')}`;
}

function quote(value) {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
