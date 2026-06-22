/**
 * Helpers that pull the set of citable record names out of a person context
 * (the object returned by buildPersonContext). Sources are attached to people,
 * families, and events via SourceRelation; the citation appender needs the
 * flat list of those record names to follow the relations.
 */

/**
 * Collect the record names whose citations should appear for a person-centric
 * report: the subject, their direct events, parent families, spouse families,
 * partners, parents, and children.
 */
export function citationTargetsForContext(ctx) {
  const ids = new Set();
  if (!ctx) return [];
  if (ctx.self?.recordName) ids.add(ctx.self.recordName);
  if (ctx.selfSummary?.recordName) ids.add(ctx.selfSummary.recordName);
  for (const event of ctx.events || []) {
    if (event?.recordName) ids.add(event.recordName);
  }
  for (const fam of ctx.parents || []) {
    if (fam.family?.recordName) ids.add(fam.family.recordName);
    if (fam.man?.recordName) ids.add(fam.man.recordName);
    if (fam.woman?.recordName) ids.add(fam.woman.recordName);
  }
  for (const fam of ctx.families || []) {
    if (fam.family?.recordName) ids.add(fam.family.recordName);
    if (fam.partner?.recordName) ids.add(fam.partner.recordName);
    for (const child of fam.children || []) {
      if (child?.recordName) ids.add(child.recordName);
    }
  }
  return [...ids];
}
